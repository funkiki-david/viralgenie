export type Platform =
  | "youtube"
  | "tiktok"
  | "x"
  | "blog"
  | "ecommerce"
  | "amazon"
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

export interface AmazonProductData {
  asin: string;
  marketplace: string;
  title: string;
  brand?: string;
  price?: number;
  listPrice?: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  bsr?: number;
  category?: string;
  categoryLadder?: string[];
  bulletPoints?: string[];
  description?: string;
  images?: string[];
  isPrime?: boolean;
  buyboxSeller?: string;
  variations?: Record<string, unknown>[];
  topReviews?: {
    title: string;
    rating: number;
    text: string;
    date?: string;
    verified?: boolean;
  }[];
  rawData: Record<string, unknown>;
}

export type AnalysisType =
  | "script_teardown"
  | "product_compare"
  | "viral_rewrite"
  | "seo_audit"
  | "content_rewrite"
  | "competitive_strategy"
  | "listing_audit"
  | "review_mining"
  | "competitor_compare";

export type CrawlEngine =
  | "supadata"
  | "firecrawl"
  | "apify"
  | "amazon-apify"
  | "amazon-scraper-api";

export type TaskStatus =
  | "pending"
  | "crawling"
  | "analyzing"
  | "done"
  | "failed";
