import type { Platform, UnifiedContent } from "@/src/types";

export type CrawlResult =
  | { success: true; data: UnifiedContent }
  | { success: false; error: string };

type TikHubPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "douyin"
  | "xiaohongshu"
  | "bilibili";

const BASE_URL = "https://api.tikhub.io";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const str = getString(value);
    if (str) return str;
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const num = getNumber(value);
    if (num !== undefined) return num;
  }
  return undefined;
}

function findNestedRecord(root: unknown): Record<string, unknown> | null {
  const seen = new Set<unknown>();
  const queue: unknown[] = [root];

  while (queue.length > 0) {
    const item = queue.shift();
    if (item == null || seen.has(item)) continue;
    if (Array.isArray(item)) {
      seen.add(item);
      queue.push(...item);
      continue;
    }
    if (!isRecord(item)) continue;
    seen.add(item);

    if (Array.isArray(item.note_list) && isRecord(item.note_list[0])) {
      return item.note_list[0];
    }
    if (item.id && (item.title || item.desc || item.share_info || item.statistics)) {
      return item;
    }
    queue.push(...Object.values(item));
  }

  return null;
}

function pickRecord(root: unknown): Record<string, unknown> {
  const nestedRecord = findNestedRecord(root);
  if (nestedRecord) return nestedRecord;
  if (!isRecord(root)) return {};

  const directData = root.data;
  if (isRecord(directData)) {
    const nested = directData.data;
    if (isRecord(nested)) return nested;
    if (Array.isArray(nested) && isRecord(nested[0])) return nested[0];
    return directData;
  }

  return root;
}

function collectStrings(value: unknown, keys: Set<string>, limit = 8): string[] {
  const found: string[] = [];
  const seen = new Set<unknown>();

  function visit(node: unknown, keyHint = "") {
    if (found.length >= limit || node == null || seen.has(node)) return;
    if (typeof node !== "object") {
      if (keys.has(keyHint) && typeof node === "string" && node.trim()) {
        found.push(node.trim());
      }
      return;
    }
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) visit(item, keyHint);
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      visit(child, key);
    }
  }

  visit(value);
  return [...new Set(found)];
}

function extractYouTubeVideoId(rawUrl: string): string | undefined {
  const url = new URL(rawUrl);
  if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0];
  return url.searchParams.get("v") ?? undefined;
}

function extractXiaohongshuNoteId(rawUrl: string): string | undefined {
  const url = new URL(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.at(-1);
}

function buildUrl(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

async function tikhubGet(
  path: string,
  params: Record<string, string | undefined>,
): Promise<unknown> {
  const apiKey = process.env.TIKHUB_API_KEY;
  if (!apiKey) throw new Error("TIKHUB_API_KEY is not configured");

  const response = await fetch(buildUrl(path, params), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep plain text body for error messages.
  }

  if (!response.ok) {
    const detail = isRecord(body) ? JSON.stringify(body).slice(0, 400) : text.slice(0, 400);
    throw new Error(`TikHub HTTP ${response.status}: ${detail || response.statusText}`);
  }

  return body;
}

function normalizeTikHubContent(args: {
  url: string;
  platform: TikHubPlatform;
  raw: unknown;
}): UnifiedContent {
  const record = pickRecord(args.raw);
  const stats = isRecord(record.statistics)
    ? record.statistics
    : isRecord(record.stats)
      ? record.stats
      : record;
  const authorRecord = isRecord(record.author)
    ? record.author
    : isRecord(record.user)
      ? record.user
      : isRecord(record.owner)
        ? record.owner
        : {};
  const author = firstString(
    authorRecord.nickname,
    authorRecord.unique_id,
    authorRecord.username,
    authorRecord.name,
    authorRecord.full_name,
    record.author,
  );

  const xhsTags = Array.isArray(record.hash_tag)
    ? record.hash_tag
        .map((tag) =>
          isRecord(tag)
            ? firstString(tag.name, tag.tag_name, tag.title)
            : undefined,
        )
        .filter((tag): tag is string => !!tag)
    : [];
  const tags = (xhsTags.length
    ? xhsTags
    : collectStrings(record, new Set(["tag_name", "hashtag_name", "name"]), 12)
  )
    .filter((tag) => !tag.startsWith("http") && tag !== author)
    .slice(0, 8);
  const mediaUrls = collectStrings(
    record,
    new Set(["play_addr", "playAddr", "download_addr", "cover", "cover_url", "url", "image"]),
    10,
  ).filter((url) => /^https?:\/\//i.test(url));

  const title = firstString(
    record.title,
    record.desc,
    record.description,
    record.caption,
    record.text,
    record.content,
    isRecord(record.share_info) ? record.share_info.title : undefined,
  );
  const summary = firstString(
    record.desc,
    record.description,
    record.caption,
    record.text,
    record.content,
    isRecord(record.share_info) ? record.share_info.content : undefined,
  );
  const metrics = {
    views: firstNumber(
      stats.play_count,
      stats.view_count,
      stats.views,
      record.view_count,
    ),
    likes: firstNumber(
      stats.digg_count,
      stats.like_count,
      stats.likes,
      record.liked_count,
    ),
    comments: firstNumber(
      stats.comment_count,
      stats.comments,
      record.comments_count,
    ),
    shares: firstNumber(
      stats.share_count,
      stats.shares,
      record.shared_count,
    ),
  };
  const hasMetrics = Object.values(metrics).some((value) => value !== undefined);

  return {
    sourceUrl: args.url,
    platform: args.platform as Platform,
    title: title ?? `${args.platform} content`,
    author,
    publishDate: firstString(record.create_time, record.createTime, record.published_at),
    metrics: hasMetrics ? metrics : undefined,
    content: {
      text: summary ?? title ?? "",
      summary,
      tags: tags.length ? tags : undefined,
      mediaUrls: mediaUrls.length ? mediaUrls : undefined,
    },
    metadata: {
      provider: "tikhub",
      platform: args.platform,
      raw: args.raw,
    },
  };
}

async function fetchTikHubRaw(
  url: string,
  platform: TikHubPlatform,
): Promise<unknown> {
  if (platform === "tiktok") {
    return tikhubGet("/api/v1/tiktok/app/v3/fetch_one_video_by_share_url", {
      share_url: url,
    });
  }
  if (platform === "douyin") {
    return tikhubGet("/api/v1/douyin/app/v3/fetch_one_video_by_share_url", {
      share_url: url,
    });
  }
  if (platform === "instagram") {
    return tikhubGet("/api/v1/instagram/v3/get_post_info", { url });
  }
  if (platform === "youtube") {
    return tikhubGet("/api/v1/youtube/web_v2/get_video_info", {
      video_id: extractYouTubeVideoId(url),
      video_url: url,
      need_format: "true",
    });
  }
  if (platform === "bilibili") {
    return tikhubGet("/api/v1/bilibili/web/fetch_one_video_v3", { url });
  }

  const noteId = extractXiaohongshuNoteId(url);
  const image = await tikhubGet("/api/v1/xiaohongshu/app_v2/get_image_note_detail", {
    note_id: noteId,
    share_text: url,
  });
  const picked = pickRecord(image);
  const returnedId = getString(picked.id);
  if (!noteId || returnedId === noteId || !returnedId) return image;

  return tikhubGet("/api/v1/xiaohongshu/app_v2/get_video_note_detail", {
    note_id: noteId,
    share_text: url,
  });
}

export async function crawlWithTikHub(
  url: string,
  platform: TikHubPlatform,
): Promise<CrawlResult> {
  try {
    const raw = await fetchTikHubRaw(url, platform);
    return {
      success: true,
      data: normalizeTikHubContent({ url, platform, raw }),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
