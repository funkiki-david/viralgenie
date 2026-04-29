import {
  Supadata,
  SupadataError,
  type JobId,
  type Media,
  type Metadata,
  type Transcript,
  type TranscriptOrJobId,
} from "@supadata/js";
import type { UnifiedContent } from "@/src/types";

export type CrawlResult =
  | { success: true; data: UnifiedContent }
  | { success: false; error: string };

const TRANSCRIPT_POLL_INTERVAL_MS = 1500;
const TRANSCRIPT_POLL_MAX_ATTEMPTS = 20;

function isJobId(value: TranscriptOrJobId): value is JobId {
  return typeof (value as JobId).jobId === "string";
}

function transcriptToText(transcript: Transcript): string {
  if (typeof transcript.content === "string") return transcript.content;
  return transcript.content.map((chunk) => chunk.text).join(" ");
}

function extractMediaUrls(media: Media): string[] {
  const raw: Array<string | undefined | null> = (() => {
    switch (media.type) {
      case "video":
      case "image":
        return [media.url];
      case "carousel":
        return media.items.map((item) => item.url);
      case "post":
        return [];
    }
  })();
  return raw.filter((u): u is string => typeof u === "string" && u.length > 0);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveTranscript(
  client: Supadata,
  result: TranscriptOrJobId,
): Promise<Transcript | null> {
  if (!isJobId(result)) return result;

  for (let attempt = 0; attempt < TRANSCRIPT_POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(TRANSCRIPT_POLL_INTERVAL_MS);
    const status = await client.transcript.getJobStatus(result.jobId);
    if (status.status === "completed" && status.result) return status.result;
    if (status.status === "failed") return null;
  }
  return null;
}

async function fetchTranscriptSafely(
  client: Supadata,
  url: string,
): Promise<Transcript | null> {
  try {
    const response = await client.transcript({ url, text: true });
    return await resolveTranscript(client, response);
  } catch {
    return null;
  }
}

function buildUnifiedContent(
  url: string,
  platform: "youtube" | "tiktok" | "x",
  metadata: Metadata,
  transcript: Transcript | null,
): UnifiedContent {
  const transcriptText = transcript ? transcriptToText(transcript) : "";
  const text = transcriptText || metadata.description || "";

  const stats = metadata.stats;
  const metrics = {
    views: stats.views ?? undefined,
    likes: stats.likes ?? undefined,
    comments: stats.comments ?? undefined,
    shares: stats.shares ?? undefined,
  };
  const hasMetrics = Object.values(metrics).some((v) => v !== undefined);

  const author =
    metadata.author?.displayName || metadata.author?.username || undefined;

  return {
    sourceUrl: url,
    platform,
    title: metadata.title ?? "",
    author,
    publishDate: metadata.createdAt || undefined,
    metrics: hasMetrics ? metrics : undefined,
    content: {
      text,
      summary: metadata.description ?? undefined,
      tags: metadata.tags?.length ? metadata.tags : undefined,
      mediaUrls: extractMediaUrls(metadata.media),
    },
    metadata: {
      supadataPlatform: metadata.platform,
      mediaType: metadata.type,
      id: metadata.id,
      transcriptLang: transcript?.lang,
      authorVerified: metadata.author?.verified,
      authorHandle: metadata.author?.username,
      additionalData: metadata.additionalData,
    },
  };
}

export async function crawlWithSupadata(
  url: string,
  platform: "youtube" | "tiktok" | "x",
): Promise<CrawlResult> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    return { success: false, error: "SUPADATA_API_KEY is not configured" };
  }

  try {
    const client = new Supadata({ apiKey });

    const [metadata, transcript] = await Promise.all([
      client.metadata({ url }),
      fetchTranscriptSafely(client, url),
    ]);

    return {
      success: true,
      data: buildUnifiedContent(url, platform, metadata, transcript),
    };
  } catch (err) {
    if (err instanceof SupadataError) {
      return { success: false, error: `${err.error}: ${err.details}` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
