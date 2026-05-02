import type { AmazonProductData, UnifiedContent } from "@/src/types";
import { marketplaceToUrl } from "@/src/lib/crawlers/amazon-product";

function buildSummary(data: AmazonProductData): string {
  const parts: string[] = [data.title];
  if (data.price !== undefined) {
    const cur = data.currency ?? "";
    parts.push(`${cur}${data.price}`);
  }
  if (data.rating !== undefined && data.reviewCount !== undefined) {
    parts.push(`${data.rating}★ (${data.reviewCount.toLocaleString()} reviews)`);
  }
  return parts.filter(Boolean).join(" · ");
}

function buildText(data: AmazonProductData): string {
  const lines: string[] = [];
  if (data.bulletPoints && data.bulletPoints.length > 0) {
    lines.push("Key features:");
    for (const b of data.bulletPoints) lines.push(`- ${b}`);
    lines.push("");
  }
  if (data.description) {
    lines.push("Description:");
    lines.push(data.description);
    lines.push("");
  }
  if (data.topReviews && data.topReviews.length > 0) {
    lines.push("Top reviews:");
    for (const r of data.topReviews) {
      const verified = r.verified ? " (verified)" : "";
      lines.push(
        `- [${r.rating}★]${verified} ${r.title ? `"${r.title}" — ` : ""}${r.text.slice(0, 400)}`,
      );
    }
  }
  return lines.join("\n").trim();
}

export function normalizeAmazon(data: AmazonProductData): UnifiedContent {
  const sourceUrl = marketplaceToUrl(data.asin, data.marketplace);

  return {
    sourceUrl,
    platform: "amazon",
    title: data.title,
    author: data.brand,
    metrics: {
      rating: data.rating,
      comments: data.reviewCount,
    },
    content: {
      text: buildText(data),
      summary: buildSummary(data),
      tags: data.categoryLadder,
      mediaUrls: data.images,
    },
    metadata: {
      asin: data.asin,
      marketplace: data.marketplace,
      price: data.price,
      listPrice: data.listPrice,
      currency: data.currency,
      bsr: data.bsr,
      category: data.category,
      isPrime: data.isPrime,
      buyboxSeller: data.buyboxSeller,
      variations: data.variations,
      topReviews: data.topReviews,
      reviewCount: data.reviewCount,
    },
  };
}
