import { extractSocialProfiles } from "@/src/lib/social-profiles";
import type { UnifiedContent } from "@/src/types";

export type CrawlResult =
  | { success: true; data: UnifiedContent }
  | { success: false; error: string };

interface FirecrawlOptions {
  fullSiteContext?: boolean;
}

type FirecrawlMetadata = Record<string, unknown>;

interface FirecrawlDocument {
  markdown?: string;
  html?: string;
  links?: string[];
  images?: string[];
  metadata?: FirecrawlMetadata;
}

interface FirecrawlResponse {
  success?: boolean;
  data?: FirecrawlDocument;
  error?: string;
}

function pickString(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return undefined;
}

function extractTags(meta: FirecrawlMetadata): string[] | undefined {
  const tags = new Set<string>();
  if (Array.isArray(meta.keywords)) {
    for (const k of meta.keywords) if (typeof k === "string") tags.add(k);
  } else if (typeof meta.keywords === "string") {
    for (const k of meta.keywords.split(/[,;]/)) {
      const trimmed = k.trim();
      if (trimmed) tags.add(trimmed);
    }
  }
  if (typeof meta.articleTag === "string") tags.add(meta.articleTag);
  if (typeof meta.dcTermsKeywords === "string") {
    for (const k of meta.dcTermsKeywords.split(/[,;]/)) {
      const trimmed = k.trim();
      if (trimmed) tags.add(trimmed);
    }
  }
  return tags.size > 0 ? [...tags] : undefined;
}

async function scrapeWithFirecrawlApi(args: {
  apiKey: string;
  url: string;
  fullSiteContext: boolean;
}): Promise<FirecrawlDocument> {
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: args.url,
      formats: args.fullSiteContext
        ? ["markdown", "links", "html"]
        : ["markdown"],
      onlyMainContent: !args.fullSiteContext,
    }),
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as FirecrawlResponse) : {};
  if (!response.ok || payload.success === false) {
    throw new Error(
      payload.error ||
        `Firecrawl HTTP ${response.status}: ${text.slice(0, 200) || response.statusText}`,
    );
  }
  if (!payload.data) {
    throw new Error("Firecrawl returned no data");
  }
  return payload.data;
}

export async function crawlWithFirecrawl(
  url: string,
  options: FirecrawlOptions = {},
): Promise<CrawlResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return { success: false, error: "FIRECRAWL_API_KEY is not configured" };
  }

  try {
    const fullSiteContext = options.fullSiteContext === true;
    const doc = await scrapeWithFirecrawlApi({
      apiKey,
      url,
      fullSiteContext,
    });

    const meta = doc.metadata ?? {};
    const markdown = doc.markdown ?? "";
    const title = pickString(meta.title, meta.ogTitle, meta.dcTermsType) ?? "";
    const description = pickString(meta.description, meta.ogDescription);
    const publishDate = pickString(
      meta.publishedTime,
      meta.dcDate,
      meta.dcDateCreated,
      meta.dcTermsCreated,
    );
    const author = pickString(meta["author"], meta["articleAuthor"]);
    const siteName = pickString(meta.ogSiteName);

    const mediaUrls: string[] = [];
    if (typeof meta.ogImage === "string") mediaUrls.push(meta.ogImage);
    if (Array.isArray(doc.images)) {
      for (const img of doc.images) {
        if (typeof img === "string" && img.length > 0 && !mediaUrls.includes(img)) {
          mediaUrls.push(img);
        }
      }
    }

    const links = Array.isArray(doc.links) ? doc.links : [];
    const html = typeof doc.html === "string" ? doc.html : undefined;
    const socialProfiles = extractSocialProfiles({
      links,
      html,
    });

    const data: UnifiedContent = {
      sourceUrl: url,
      platform: "blog",
      title,
      author,
      publishDate,
      content: {
        text: markdown || description || "",
        summary: description,
        tags: extractTags(meta),
        mediaUrls,
      },
      metadata: {
        siteName,
        language: meta.language,
        statusCode: meta.statusCode,
        scrapeId: meta.scrapeId,
        contentType: meta.contentType,
        favicon: meta.favicon,
        canonicalUrl: meta.url,
        links,
        html,
        fullSiteContext,
        socialProfiles,
      },
    };

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
