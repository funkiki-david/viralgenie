import type { UnifiedContent } from "@/src/types";
import type { CrawlResult } from "@/src/lib/crawlers/tikhub";

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

function extractNoteId(rawUrl: string): string | undefined {
  const url = new URL(rawUrl);
  return url.pathname.split("/").filter(Boolean).at(-1);
}

function findNote(raw: unknown, noteId: string | undefined): Record<string, unknown> {
  const candidates: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();

  function visit(value: unknown) {
    if (value == null || seen.has(value)) return;
    if (Array.isArray(value)) {
      seen.add(value);
      for (const item of value) visit(item);
      return;
    }
    if (!isRecord(value)) return;
    seen.add(value);
    if (typeof value.id === "string") candidates.push(value);
    for (const child of Object.values(value)) visit(child);
  }

  visit(raw);
  return (
    candidates.find((candidate) => candidate.id === noteId) ??
    candidates.find((candidate) => candidate.title || candidate.desc || candidate.share_info) ??
    {}
  );
}

function collectImageUrls(note: Record<string, unknown>): string[] {
  const urls = new Set<string>();

  function visit(value: unknown, keyHint = "") {
    if (value == null) return;
    if (typeof value === "string") {
      if ((keyHint.includes("image") || keyHint.includes("url")) && /^https?:\/\//i.test(value)) {
        urls.add(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, keyHint);
      return;
    }
    if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) visit(child, key);
    }
  }

  visit(note);
  return [...urls].slice(0, 12);
}

async function rnoteGet(path: string, params: Record<string, string>): Promise<unknown> {
  const apiKey = process.env.RNOTE_API_KEY;
  if (!apiKey) throw new Error("RNOTE_API_KEY is not configured");

  const url = new URL(path, "https://rnote.dev");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep text body for error details.
  }

  if (!response.ok) {
    throw new Error(`RNote HTTP ${response.status}: ${text.slice(0, 400)}`);
  }

  return body;
}

function normalizeRNoteContent(args: {
  url: string;
  noteId: string | undefined;
  raw: unknown;
}): UnifiedContent {
  const note = findNote(args.raw, args.noteId);
  const user = isRecord(note.user) ? note.user : {};
  const shareInfo = isRecord(note.share_info) ? note.share_info : {};
  const tags = Array.isArray(note.hash_tag)
    ? note.hash_tag
        .map((tag) => (isRecord(tag) ? getString(tag.name) ?? getString(tag.tag_name) : undefined))
        .filter((tag): tag is string => !!tag)
    : [];

  const title =
    getString(note.title) ??
    getString(shareInfo.title) ??
    getString(note.desc) ??
    "Xiaohongshu note";
  const summary =
    getString(note.desc) ??
    getString(shareInfo.content) ??
    getString(shareInfo.wechat_share_desc) ??
    title;

  const metrics = {
    views: getNumber(note.view_count),
    likes: getNumber(note.liked_count),
    comments: getNumber(note.comments_count),
    shares: getNumber(note.shared_count),
  };
  const hasMetrics = Object.values(metrics).some((value) => value !== undefined);

  return {
    sourceUrl: args.url,
    platform: "xiaohongshu",
    title,
    author: getString(user.nickname) ?? getString(user.name),
    publishDate: getString(note.time),
    metrics: hasMetrics ? metrics : undefined,
    content: {
      text: summary,
      summary,
      tags: tags.length ? tags : undefined,
      mediaUrls: collectImageUrls(note),
    },
    metadata: {
      provider: "rnote",
      noteId: args.noteId,
      authorId: getString(user.id) ?? getString(user.userid),
      authorHandle: getString(user.red_id),
      collects: getNumber(note.collected_count),
      raw: args.raw,
    },
  };
}

export async function crawlWithRNote(url: string): Promise<CrawlResult> {
  try {
    const noteId = extractNoteId(url);
    if (!noteId) return { success: false, error: "Could not extract Xiaohongshu note id" };

    const imageRaw = await rnoteGet("/api/v2/crawler/note/image", { note_id: noteId });
    const imageNote = findNote(imageRaw, noteId);
    if (imageNote.id === noteId) {
      return {
        success: true,
        data: normalizeRNoteContent({ url, noteId, raw: imageRaw }),
      };
    }

    const videoRaw = await rnoteGet("/api/v2/crawler/note/video", { note_id: noteId });
    return {
      success: true,
      data: normalizeRNoteContent({ url, noteId, raw: videoRaw }),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
