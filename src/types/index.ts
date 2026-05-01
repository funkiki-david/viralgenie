export type Platform =
  | "youtube"
  | "tiktok"
  | "x"
  | "blog"
  | "ecommerce"
  | "other";

export interface UnifiedContent {
  sourceUrl: string;
  platform: Platform;
  title: string;
  author?: string;
  publishDate?: string;
  metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    rating?: number;
  };
  content: {
    text: string;
    summary?: string;
    tags?: string[];
    mediaUrls?: string[];
  };
  metadata: Record<string, unknown>;
}

export type AnalysisType =
  | "script_teardown"
  | "product_compare"
  | "viral_rewrite"
  | "seo_audit"
  | "content_rewrite"
  | "competitive_strategy";

export type CrawlEngine = "supadata" | "firecrawl" | "apify";

export type TaskStatus =
  | "pending"
  | "crawling"
  | "analyzing"
  | "done"
  | "failed";
