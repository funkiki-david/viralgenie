export type Platform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "douyin"
  | "xiaohongshu"
  | "bilibili"
  | "x"
  | "blog"
  | "ecommerce"
  | "amazon"
  | "other";

export type SocialPlatform =
  | "instagram"
  | "youtube"
  | "x"
  | "tiktok"
  | "linkedin"
  | "facebook"
  | "threads"
  | "discord"
  | "telegram"
  | "github"
  | "medium"
  | "substack"
  | "pinterest"
  | "other";

export interface SocialProfile {
  platform: SocialPlatform;
  url: string;
  canonicalUrl: string;
  handle?: string;
  accountPath?: string;
  accountName?: string;
  hostname: string;
  evidence: string[];
  confidence: "high" | "medium";
}

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

export interface ProviderAttempt {
  engine: CrawlEngine;
  role: "primary" | "fallback" | "cache";
  status: "success" | "failed" | "skipped";
  durationMs?: number;
  reason?: string;
}

export interface ProviderTrace {
  primaryEngine: CrawlEngine;
  finalEngine: CrawlEngine;
  platform: Platform;
  cached: boolean;
  fallbackUsed: boolean;
  attempts: ProviderAttempt[];
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
  | "backlink_intel"
  | "listing_audit"
  | "review_mining"
  | "competitor_compare";

export type WorkspaceType =
  | "connections"
  | "creative"
  | "microsite";

export interface StudioSection {
  title: string;
  summary: string;
  bullets: string[];
}

export interface SignalMapAccount {
  platform: string;
  accountName: string;
  handle: string;
  url: string;
  evidence: string;
}

export interface SignalMapPresence {
  platform: string;
  status: "official" | "likely" | "mentioned";
  notes: string;
}

export interface SignalMapConnectionAnalysis {
  ownedChannels: string[];
  communitySignals: string[];
  mediaSignals: string[];
  crossPlatformFlow: string;
}

export interface SignalMapRelatedConnection {
  name: string;
  type: "media" | "community" | "partner" | "directory" | "creator" | "other";
  url: string;
  whyItMatters: string;
}

export interface SignalMapOpportunity {
  platform: string;
  opportunity: string;
  priority: "high" | "medium" | "low";
}

export interface SignalMapReport {
  brandSummary: string;
  officialAccounts: SignalMapAccount[];
  platformPresence: SignalMapPresence[];
  connectionAnalysis: SignalMapConnectionAnalysis;
  relatedConnections: SignalMapRelatedConnection[];
  distributionOpportunities: SignalMapOpportunity[];
  creativeAngles: string[];
}

export interface CreatorPackImagePrompts {
  midjourney: string;
  dalle: string;
}

export interface CreatorPackReport {
  imagePrompts: CreatorPackImagePrompts;
  videoScript15s: string;
  shotPrompts: string[];
  readyToPostCopy: string[];
  hookOptions: string[];
  outreachCopy: string[];
}

export interface LaunchPageSection {
  title: string;
  body: string;
}

export interface LaunchPageSocialLink {
  platform: string;
  label: string;
  url: string;
}

export interface LaunchPageReport {
  title: string;
  subtitle: string;
  heroCta: string;
  sections: LaunchPageSection[];
  socialLinks: LaunchPageSocialLink[];
  visualDirection: string;
  outreachCopy: string[];
}

export interface MicrositeDraft {
  title: string;
  subtitle: string;
  sections: string[];
  cta: string;
}

export interface StudioReport {
  version: 1;
  workspace: WorkspaceType;
  source: {
    url: string;
    platform: Platform;
    title: string;
  };
  providerTrace?: ProviderTrace;
  connections: StudioSection;
  signalMap?: SignalMapReport;
  creativePack: CreatorPackReport;
  launchPage: LaunchPageReport;
  micrositeDraft: MicrositeDraft;
}

export type CrawlEngine =
  | "tikhub"
  | "rnote"
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
