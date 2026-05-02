import { ApifyClient } from "apify-client";
import type { AmazonProductData } from "@/src/types";

// ============================================================================
// ASIN extraction
// ============================================================================

const ASIN_RE = /^[A-Z0-9]{10}$/i;
const ASIN_IN_PATH_RE = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i;

const TLD_TO_MARKETPLACE: Array<[string, string]> = [
  // Order matters: longer TLDs first (.com.au before .com)
  [".com.au", "AU"],
  [".com.mx", "MX"],
  [".com.br", "BR"],
  [".co.uk", "UK"],
  [".co.jp", "JP"],
  [".de", "DE"],
  [".fr", "FR"],
  [".it", "IT"],
  [".es", "ES"],
  [".ca", "CA"],
  [".in", "IN"],
  [".com", "US"],
];

const MARKETPLACE_TO_TLD: Record<string, string> = {
  US: "com",
  UK: "co.uk",
  DE: "de",
  JP: "co.jp",
  FR: "fr",
  IT: "it",
  ES: "es",
  CA: "ca",
  AU: "com.au",
  IN: "in",
  MX: "com.mx",
  BR: "com.br",
};

function defaultMarketplace(): string {
  return process.env.AMAZON_DEFAULT_MARKETPLACE || "US";
}

function marketplaceToUrl(asin: string, marketplace: string): string {
  const tld = MARKETPLACE_TO_TLD[marketplace] || "com";
  return `https://www.amazon.${tld}/dp/${asin}`;
}

export function extractAsin(urlOrAsin: string): {
  asin: string;
  marketplace: string;
} {
  const trimmed = (urlOrAsin || "").trim();
  if (!trimmed) {
    throw new Error("Empty input — provide an ASIN or Amazon URL");
  }

  // Raw ASIN
  if (ASIN_RE.test(trimmed)) {
    return { asin: trimmed.toUpperCase(), marketplace: defaultMarketplace() };
  }

  // URL form
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid input — not an ASIN or URL: ${trimmed}`);
  }

  // Short links can't be resolved without an HTTP redirect — refuse early.
  const host = parsed.hostname.toLowerCase();
  if (host === "amzn.to" || host === "a.co") {
    throw new Error(
      `Short link not supported — please paste the full Amazon product URL: ${trimmed}`,
    );
  }

  const match = parsed.pathname.match(ASIN_IN_PATH_RE);
  if (!match) {
    throw new Error(`No ASIN found in URL path: ${parsed.pathname}`);
  }
  const asin = match[1].toUpperCase();

  // Detect marketplace by TLD; fall back to default.
  let marketplace = defaultMarketplace();
  for (const [tld, code] of TLD_TO_MARKETPLACE) {
    if (host.endsWith(tld)) {
      marketplace = code;
      break;
    }
  }

  return { asin, marketplace };
}

// ============================================================================
// Field mapping helpers (defensive — Apify schemas drift)
// ============================================================================

function asString(v: unknown): string | undefined {
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asBoolean(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (typeof x === "string" ? x : asString((x as Record<string, unknown>)?.name)))
    .filter((x): x is string => typeof x === "string" && x.length > 0);
  return out.length > 0 ? out : undefined;
}

function pickPrice(v: unknown): { value?: number; currency?: string } {
  if (typeof v === "number") return { value: v };
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    return {
      value: asNumber(obj.value ?? obj.amount),
      currency: asString(obj.currency ?? obj.currencyCode),
    };
  }
  if (typeof v === "string") {
    return { value: asNumber(v) };
  }
  return {};
}

function mapApifyToAmazon(
  raw: Record<string, unknown>,
  asin: string,
  marketplace: string,
): AmazonProductData {
  const priceInfo = pickPrice(raw.price);
  const listInfo = pickPrice(raw.listPrice);

  const bsrEntries = Array.isArray(raw.bestSellersRank)
    ? (raw.bestSellersRank as Array<Record<string, unknown>>)
    : [];
  const firstBsr = bsrEntries[0];

  const reviewsRaw = Array.isArray(raw.reviews)
    ? (raw.reviews as Array<Record<string, unknown>>)
    : Array.isArray(raw.topReviews)
      ? (raw.topReviews as Array<Record<string, unknown>>)
      : [];
  const topReviews = reviewsRaw.slice(0, 5).map((r) => ({
    title: asString(r.title) ?? "",
    rating: asNumber(r.rating ?? r.stars) ?? 0,
    text: asString(r.text ?? r.body ?? r.content) ?? "",
    date: asString(r.date),
    verified: asBoolean(r.verified ?? r.verifiedPurchase),
  }));

  const variations = Array.isArray(raw.variations ?? raw.variants)
    ? ((raw.variations ?? raw.variants) as Array<Record<string, unknown>>)
    : undefined;

  return {
    asin,
    marketplace,
    title: asString(raw.title) ?? "",
    brand: asString(raw.brand),
    price: priceInfo.value,
    listPrice: listInfo.value,
    currency: priceInfo.currency || listInfo.currency,
    rating: asNumber(raw.stars ?? raw.rating),
    reviewCount: asNumber(raw.reviewsCount ?? raw.reviewCount),
    bsr: firstBsr ? asNumber(firstBsr.rank) : undefined,
    category: firstBsr ? asString(firstBsr.category) : undefined,
    categoryLadder: asStringArray(raw.breadcrumbs ?? raw.categoryLadder),
    bulletPoints: asStringArray(raw.features ?? raw.bulletPoints),
    description: asString(raw.description),
    images: asStringArray(raw.images),
    isPrime: asBoolean(raw.isPrime),
    buyboxSeller: asString(raw.buyBoxSeller ?? raw.buyboxSeller ?? raw.seller),
    variations,
    topReviews: topReviews.length > 0 ? topReviews : undefined,
    rawData: raw,
  };
}

function mapScraperApiToAmazon(
  raw: Record<string, unknown>,
  asin: string,
  marketplace: string,
): AmazonProductData {
  // The hosted scraper APIs (Rainforest-style) tend to nest under "product".
  const root =
    typeof raw.product === "object" && raw.product !== null
      ? (raw.product as Record<string, unknown>)
      : raw;
  return mapApifyToAmazon(root, asin, marketplace);
}

// ============================================================================
// Engine implementations
// ============================================================================

const APIFY_ACTOR = "junglee/amazon-crawler";
const APIFY_TIMEOUT_SECS = 120;
const APIFY_WAIT_SECS = 130;

async function fetchViaApify(
  asin: string,
  marketplace: string,
): Promise<AmazonProductData> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("APIFY_API_TOKEN is not configured");
  }

  const client = new ApifyClient({ token });
  const productUrl = marketplaceToUrl(asin, marketplace);

  const run = await client.actor(APIFY_ACTOR).call(
    { categoryOrProductUrls: [{ url: productUrl }] },
    { timeout: APIFY_TIMEOUT_SECS, waitSecs: APIFY_WAIT_SECS },
  );

  if (run.status !== "SUCCEEDED") {
    throw new Error(`Apify run did not succeed (status: ${run.status})`);
  }

  const { items } = await client
    .dataset<Record<string, unknown>>(run.defaultDatasetId)
    .listItems();

  if (items.length === 0) {
    throw new Error("Apify run returned no items for ASIN " + asin);
  }

  const first = items[0];
  // The actor returns an envelope like { error, errorDescription } when the
  // ASIN is unreachable (404, captcha, regional block). Surface that as a
  // failure instead of silently producing an empty product.
  if (typeof first.error === "string" && !first.title) {
    const desc =
      typeof first.errorDescription === "string"
        ? first.errorDescription
        : first.error;
    throw new Error(
      `Apify could not scrape ASIN ${asin} on ${marketplace}: ${desc}`,
    );
  }

  return mapApifyToAmazon(first, asin, marketplace);
}

async function fetchViaScraperApi(
  asin: string,
  marketplace: string,
): Promise<AmazonProductData> {
  const key = process.env.AMAZON_SCRAPER_API_KEY;
  if (!key) {
    throw new Error(
      "AMAZON_SCRAPER_API_KEY not set — switch to AMAZON_ENGINE=apify or add key",
    );
  }

  const url = `https://api.amazonscraperapi.com/products/${encodeURIComponent(asin)}?marketplace=${encodeURIComponent(marketplace)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Scraper API HTTP ${res.status}: ${body.slice(0, 200) || res.statusText}`,
    );
  }

  const raw = (await res.json()) as Record<string, unknown>;
  return mapScraperApiToAmazon(raw, asin, marketplace);
}

// ============================================================================
// Public entrypoint
// ============================================================================

export async function fetchAmazonProduct(
  urlOrAsin: string,
): Promise<AmazonProductData> {
  const { asin, marketplace } = extractAsin(urlOrAsin);
  const engine = (process.env.AMAZON_ENGINE || "apify").toLowerCase();

  if (engine === "scraper-api") {
    return fetchViaScraperApi(asin, marketplace);
  }
  // Default: apify
  return fetchViaApify(asin, marketplace);
}

export { marketplaceToUrl };
