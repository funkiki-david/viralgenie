import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { routeUrl } from "@/src/lib/url-router";
import { checkLimit, recordUsage } from "@/src/lib/cost-guard";
import { crawlWithSupadata } from "@/src/lib/crawlers/supadata";
import { crawlWithFirecrawl } from "@/src/lib/crawlers/firecrawl";
import { crawlWithApify } from "@/src/lib/crawlers/apify";
import {
  buildClaudeContext,
  normalizeToMarkdown,
} from "@/src/lib/normalizer";
import { analyzeContent } from "@/src/lib/ai/client";
import type {
  AnalysisType,
  CrawlEngine,
  Platform,
  UnifiedContent,
} from "@/src/types";

const RequestSchema = z.object({
  url: z.string().url(),
  analysisType: z.enum([
    "script_teardown",
    "product_compare",
    "viral_rewrite",
    "seo_audit",
    "content_rewrite",
    "competitive_strategy",
  ]),
  createdBy: z.string().optional(),
});

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function asJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function parseReport(text: string): Prisma.InputJsonValue {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return { raw: text };
  }
}

async function failTask(taskId: string, errorMsg: string): Promise<void> {
  await prisma.analysisTask
    .update({
      where: { id: taskId },
      data: { status: "failed", errorMsg },
    })
    .catch(() => {});
}

async function runPipeline(args: {
  taskId: string;
  url: string;
  engine: CrawlEngine;
  platform: Platform;
  analysisType: AnalysisType;
  cachedData: UnifiedContent | null;
}): Promise<void> {
  const { taskId, url, engine, platform, analysisType, cachedData } = args;
  try {
    let unified: UnifiedContent;

    if (cachedData) {
      unified = cachedData;
    } else {
      let crawl;
      if (engine === "supadata") {
        if (
          platform !== "youtube" &&
          platform !== "tiktok" &&
          platform !== "x"
        ) {
          await failTask(
            taskId,
            `Unsupported platform for supadata: ${platform}`,
          );
          return;
        }
        crawl = await crawlWithSupadata(url, platform);
      } else if (engine === "firecrawl") {
        crawl = await crawlWithFirecrawl(url);
      } else if (engine === "apify") {
        crawl = await crawlWithApify(url);
      } else {
        await failTask(taskId, `Unknown engine: ${engine}`);
        return;
      }

      if (!crawl.success) {
        await failTask(taskId, crawl.error);
        return;
      }

      unified = crawl.data;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
      await prisma.urlCache.upsert({
        where: { url },
        create: {
          url,
          data: asJson(unified),
          engine,
          fetchedAt: now,
          expiresAt,
        },
        update: {
          data: asJson(unified),
          engine,
          fetchedAt: now,
          expiresAt,
        },
      });

      await recordUsage(engine, 0);
    }

    const markdown = normalizeToMarkdown(unified);
    const claudeContext = buildClaudeContext(unified, analysisType);

    await prisma.analysisTask.update({
      where: { id: taskId },
      data: {
        status: "analyzing",
        rawData: asJson(unified),
        normalized: markdown,
      },
    });

    const analysis = await analyzeContent(claudeContext, analysisType);
    if (!analysis.success) {
      await failTask(taskId, analysis.error);
      return;
    }

    await recordUsage("claude", 0);

    const report = parseReport(analysis.result);

    await prisma.analysisTask.update({
      where: { id: taskId },
      data: { status: "done", report },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failTask(taskId, message);
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { url, analysisType } = parsed.data;
  const createdBy = parsed.data.createdBy ?? "anonymous";

  const { engine, platform, normalizedUrl } = routeUrl(url);

  const now = new Date();
  const cached = await prisma.urlCache.findUnique({
    where: { url: normalizedUrl },
  });
  const cacheHit = !!cached && cached.expiresAt > now;

  const claudeStatus = await checkLimit("claude");
  const engineStatus = cacheHit ? null : await checkLimit(engine);

  if (!claudeStatus.allowed || (engineStatus && !engineStatus.allowed)) {
    return Response.json(
      {
        error: "Daily limit exceeded",
        claude: claudeStatus,
        engine: engineStatus,
      },
      { status: 429 },
    );
  }

  const task = await prisma.analysisTask.create({
    data: {
      url: normalizedUrl,
      urlType: platform,
      status: "crawling",
      createdBy,
      crawlEngine: engine,
      promptType: analysisType,
    },
  });

  const cachedData =
    cacheHit && cached
      ? (cached.data as unknown as UnifiedContent)
      : null;

  void runPipeline({
    taskId: task.id,
    url: normalizedUrl,
    engine,
    platform,
    analysisType,
    cachedData,
  });

  return Response.json({ task }, { status: 202 });
}
