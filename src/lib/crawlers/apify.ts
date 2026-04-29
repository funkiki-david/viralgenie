import { ApifyClient } from "apify-client";
import type { UnifiedContent } from "@/src/types";

export type CrawlResult =
  | { success: true; data: UnifiedContent }
  | { success: false; error: string };

const ACTOR_ID = "apify/web-scraper";

const PAGE_FUNCTION = `async function pageFunction(context) {
    const $ = context.jQuery;
    const url = context.request.loadedUrl || context.request.url;
    const get = (sel) => ($(sel).first().text() || '').trim();
    const meta = (name) => ($('meta[name="' + name + '"]').attr('content') || $('meta[property="' + name + '"]').attr('content') || '').trim();

    const title = (
        meta('og:title') ||
        $('title').first().text() ||
        get('h1')
    ).trim();

    const description = meta('description') || meta('og:description');
    const ogImage = meta('og:image');
    const price = meta('product:price:amount') || meta('og:price:amount') || get('[itemprop="price"]') || get('.price');
    const rating = meta('og:rating') || get('[itemprop="ratingValue"]');
    const brand = meta('og:brand') || meta('product:brand') || get('[itemprop="brand"]');
    const availability = meta('og:availability') || get('[itemprop="availability"]');

    const text = $('body').text().replace(/\\s+/g, ' ').trim().slice(0, 20000);

    const images = [];
    if (ogImage) images.push(ogImage);
    $('img').each(function (_, el) {
        const src = $(el).attr('src');
        if (src && images.length < 10 && !images.includes(src)) images.push(src);
    });

    return { url, title, description, price, rating, brand, availability, text, images };
}`;

interface ScraperItem {
  url?: string;
  title?: string;
  description?: string;
  price?: string;
  rating?: string;
  brand?: string;
  availability?: string;
  text?: string;
  images?: unknown;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

export async function crawlWithApify(url: string): Promise<CrawlResult> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return { success: false, error: "APIFY_API_TOKEN is not configured" };
  }

  try {
    const client = new ApifyClient({ token });

    const run = await client.actor(ACTOR_ID).call(
      {
        startUrls: [{ url }],
        pageFunction: PAGE_FUNCTION,
        maxRequestsPerCrawl: 1,
        proxyConfiguration: { useApifyProxy: true },
        runMode: "PRODUCTION",
      },
      {
        timeout: 120,
        waitSecs: 130,
      },
    );

    if (run.status !== "SUCCEEDED") {
      return {
        success: false,
        error: `Apify run did not succeed (status: ${run.status})`,
      };
    }

    const { items } = await client
      .dataset<ScraperItem>(run.defaultDatasetId)
      .listItems();

    if (items.length === 0) {
      return { success: false, error: "Apify run returned no items" };
    }

    const item = items[0];
    const title = pickString(item.title) ?? "";
    const description = pickString(item.description);
    const text = pickString(item.text) ?? description ?? "";
    const images = pickStringArray(item.images);

    const data: UnifiedContent = {
      sourceUrl: url,
      platform: "ecommerce",
      title,
      content: {
        text,
        summary: description,
        mediaUrls: images,
      },
      metadata: {
        actor: ACTOR_ID,
        runId: run.id,
        defaultDatasetId: run.defaultDatasetId,
        price: pickString(item.price),
        rating: pickString(item.rating),
        brand: pickString(item.brand),
        availability: pickString(item.availability),
      },
    };

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
