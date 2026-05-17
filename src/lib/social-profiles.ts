import type { SocialPlatform, SocialProfile } from "@/src/types";

const SOCIAL_HOSTS: Array<{
  platform: SocialPlatform;
  hosts: string[];
}> = [
  { platform: "instagram", hosts: ["instagram.com"] },
  { platform: "youtube", hosts: ["youtube.com", "youtu.be"] },
  { platform: "x", hosts: ["x.com", "twitter.com"] },
  { platform: "tiktok", hosts: ["tiktok.com"] },
  { platform: "linkedin", hosts: ["linkedin.com"] },
  { platform: "facebook", hosts: ["facebook.com", "fb.com"] },
  { platform: "threads", hosts: ["threads.net"] },
  { platform: "discord", hosts: ["discord.gg", "discord.com"] },
  { platform: "telegram", hosts: ["t.me", "telegram.me", "telegram.org"] },
  { platform: "github", hosts: ["github.com"] },
  { platform: "medium", hosts: ["medium.com"] },
  { platform: "substack", hosts: ["substack.com"] },
  { platform: "pinterest", hosts: ["pinterest.com"] },
];

const RESERVED_PATHS: Partial<Record<SocialPlatform, Set<string>>> = {
  instagram: new Set([
    "p",
    "reel",
    "reels",
    "tv",
    "stories",
    "explore",
    "accounts",
    "developer",
    "about",
  ]),
  youtube: new Set([
    "watch",
    "playlist",
    "shorts",
    "feed",
    "results",
    "embed",
    "live",
  ]),
  x: new Set([
    "home",
    "explore",
    "search",
    "i",
    "intent",
    "share",
    "hashtag",
    "settings",
  ]),
  linkedin: new Set([
    "feed",
    "jobs",
    "learning",
    "company-setup",
    "events",
    "help",
  ]),
  facebook: new Set([
    "sharer",
    "share.php",
    "dialog",
    "plugins",
    "watch",
    "groups",
    "events",
  ]),
  telegram: new Set(["share", "login"]),
};

function asUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    if (trimmed.startsWith("//")) {
      try {
        return new URL(`https:${trimmed}`);
      } catch {
        return null;
      }
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) {
      try {
        return new URL(`https://${trimmed}`);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function platformForHost(hostname: string): SocialPlatform | null {
  const normalized = normalizeHostname(hostname);
  for (const entry of SOCIAL_HOSTS) {
    if (
      entry.hosts.some(
        (host) => normalized === host || normalized.endsWith(`.${host}`),
      )
    ) {
      return entry.platform;
    }
  }

  if (normalized.endsWith(".substack.com")) {
    return "substack";
  }

  return null;
}

function cleanSegment(segment: string): string {
  return decodeURIComponent(segment).replace(/^@/, "").trim();
}

function extractYouTubeIdentity(pathSegments: string[]): {
  handle?: string;
  accountPath?: string;
} {
  if (pathSegments.length === 0) return {};
  const [first, second] = pathSegments;

  if (first.startsWith("@")) {
    const handle = cleanSegment(first);
    return {
      handle,
      accountPath: `@${handle}`,
    };
  }

  if (["channel", "user", "c"].includes(first) && second) {
    return {
      handle: cleanSegment(second),
      accountPath: `${first}/${cleanSegment(second)}`,
    };
  }

  return {};
}

function extractIdentity(
  platform: SocialPlatform,
  parsed: URL,
): {
  handle?: string;
  accountPath?: string;
  accountName?: string;
} {
  const pathSegments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (platform === "youtube") {
    return extractYouTubeIdentity(pathSegments);
  }

  if (pathSegments.length === 0) return {};

  const [first, second] = pathSegments;
  const reserved = RESERVED_PATHS[platform];
  if (reserved?.has(first.toLowerCase())) return {};

  if (platform === "linkedin" && ["company", "in", "school"].includes(first) && second) {
    const handle = cleanSegment(second);
    return {
      handle,
      accountPath: `${first}/${handle}`,
      accountName: handle,
    };
  }

  if (platform === "threads" && first.startsWith("@")) {
    const handle = cleanSegment(first);
    return {
      handle,
      accountPath: `@${handle}`,
      accountName: handle,
    };
  }

  if (platform === "telegram" && first === "joinchat" && second) {
    return {
      accountPath: `joinchat/${cleanSegment(second)}`,
      accountName: cleanSegment(second),
    };
  }

  const handle = cleanSegment(first);
  return {
    handle,
    accountPath: handle,
    accountName: handle,
  };
}

function canonicalizeProfileUrl(platform: SocialPlatform, parsed: URL): string {
  const identity = extractIdentity(platform, parsed);
  const normalized = new URL(parsed.toString());
  normalized.hash = "";
  normalized.search = "";
  normalized.pathname = identity.accountPath
    ? `/${identity.accountPath.replace(/^\/+/, "")}`
    : parsed.pathname.replace(/\/+$/, "") || "/";
  return normalized.toString().replace(/\/$/, "");
}

function findUrlsInSameAsValue(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => findUrlsInSameAsValue(item, out));
    return;
  }
  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  if ("sameAs" in record) {
    findUrlsInSameAsValue(record.sameAs, out);
  }
  Object.values(record).forEach((nested) => {
    if (nested && typeof nested === "object") {
      findUrlsInSameAsValue(nested, out);
    }
  });
}

function extractSameAsUrls(html: string | undefined): string[] {
  if (!html) return [];

  const urls: string[] = [];
  const scriptPattern =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html))) {
    const body = match[1]?.trim();
    if (!body) continue;

    try {
      const parsed = JSON.parse(body) as unknown;
      findUrlsInSameAsValue(parsed, urls);
    } catch {
      continue;
    }
  }

  return urls;
}

function mergeEvidence(existing: string[], extra: string[]): string[] {
  return [...new Set([...existing, ...extra])];
}

function toProfile(rawUrl: string, evidence: string[]): SocialProfile | null {
  const parsed = asUrl(rawUrl);
  if (!parsed || !["http:", "https:"].includes(parsed.protocol)) {
    return null;
  }

  const hostname = normalizeHostname(parsed.hostname);
  const platform = platformForHost(hostname);
  if (!platform) return null;

  const identity = extractIdentity(platform, parsed);
  const canonicalUrl = canonicalizeProfileUrl(platform, parsed);

  return {
    platform,
    url: parsed.toString(),
    canonicalUrl,
    handle: identity.handle,
    accountPath: identity.accountPath,
    accountName: identity.accountName,
    hostname,
    evidence,
    confidence: evidence.includes("Declared in structured data")
      ? "high"
      : "medium",
  };
}

export function extractSocialProfiles(args: {
  links?: unknown;
  html?: unknown;
}): SocialProfile[] {
  const linkUrls = Array.isArray(args.links)
    ? args.links.filter((value): value is string => typeof value === "string")
    : [];
  const sameAsUrls = extractSameAsUrls(
    typeof args.html === "string" ? args.html : undefined,
  );

  const profiles = new Map<string, SocialProfile>();

  for (const url of linkUrls) {
    const profile = toProfile(url, ["Linked from source page"]);
    if (!profile) continue;
    const existing = profiles.get(profile.canonicalUrl);
    if (existing) {
      existing.evidence = mergeEvidence(existing.evidence, profile.evidence);
      continue;
    }
    profiles.set(profile.canonicalUrl, profile);
  }

  for (const url of sameAsUrls) {
    const profile = toProfile(url, ["Declared in structured data"]);
    if (!profile) continue;
    const existing = profiles.get(profile.canonicalUrl);
    if (existing) {
      existing.evidence = mergeEvidence(existing.evidence, profile.evidence);
      existing.confidence = "high";
      if (!existing.handle && profile.handle) existing.handle = profile.handle;
      if (!existing.accountPath && profile.accountPath) {
        existing.accountPath = profile.accountPath;
      }
      continue;
    }
    profiles.set(profile.canonicalUrl, profile);
  }

  return [...profiles.values()].sort((a, b) => {
    if (a.platform === b.platform) return a.canonicalUrl.localeCompare(b.canonicalUrl);
    return a.platform.localeCompare(b.platform);
  });
}
