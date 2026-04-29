import type { CrawlEngine, Platform } from "@/src/types";

const TRACKING_PARAM_PATTERNS: Array<RegExp | string> = [
  /^utm_/i,
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "yclid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "ref",
  "ref_src",
];

function isTrackingParam(key: string): boolean {
  return TRACKING_PARAM_PATTERNS.some((pattern) =>
    typeof pattern === "string"
      ? key.toLowerCase() === pattern
      : pattern.test(key),
  );
}

function normalizeUrl(input: string): string {
  const url = new URL(input.trim());
  const cleanedParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (!isTrackingParam(key)) cleanedParams.append(key, value);
  }
  url.search = cleanedParams.toString();
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

interface HostMatcher {
  test: (hostname: string) => boolean;
  engine: CrawlEngine;
  platform: Platform;
}

const HOST_MATCHERS: HostMatcher[] = [
  {
    test: (h) =>
      h === "youtube.com" ||
      h.endsWith(".youtube.com") ||
      h === "youtu.be" ||
      h === "m.youtube.com",
    engine: "supadata",
    platform: "youtube",
  },
  {
    test: (h) =>
      h === "tiktok.com" ||
      h.endsWith(".tiktok.com") ||
      h === "vm.tiktok.com",
    engine: "supadata",
    platform: "tiktok",
  },
  {
    test: (h) =>
      h === "twitter.com" ||
      h.endsWith(".twitter.com") ||
      h === "x.com" ||
      h.endsWith(".x.com") ||
      h === "t.co",
    engine: "supadata",
    platform: "x",
  },
  {
    test: (h) =>
      h.includes("amazon.") ||
      h.includes("ebay.") ||
      h.endsWith(".shopify.com") ||
      h.endsWith(".myshopify.com"),
    engine: "apify",
    platform: "ecommerce",
  },
];

export interface RouteResult {
  engine: CrawlEngine;
  platform: Platform;
  normalizedUrl: string;
}

export function routeUrl(rawUrl: string): RouteResult {
  const normalizedUrl = normalizeUrl(rawUrl);
  const hostname = new URL(normalizedUrl).hostname;

  for (const matcher of HOST_MATCHERS) {
    if (matcher.test(hostname)) {
      return {
        engine: matcher.engine,
        platform: matcher.platform,
        normalizedUrl,
      };
    }
  }

  return { engine: "firecrawl", platform: "blog", normalizedUrl };
}
