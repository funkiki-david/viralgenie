import Firecrawl, { type DocumentMetadata } from "@mendable/firecrawl-js";
import type { UnifiedContent } from "@/src/types";

export type CrawlResult =
  | { success: true; data: UnifiedContent }
  | { success: false; error: string };

function pickString(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return undefined;
}

function extractTags(meta: DocumentMetadata): string[] | undefined {
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

export async function crawlWithFirecrawl(url: string): Promise<CrawlResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return { success: false, error: "FIRECRAWL_API_KEY is not configured" };
  }

  try {
    const client = new Firecrawl({ apiKey });
    const doc = await client.scrape(url, {
      formats: ["markdown"],
      onlyMainContent: true,
    });

    const meta: DocumentMetadata = doc.metadata ?? {};
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
      },
    };

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
