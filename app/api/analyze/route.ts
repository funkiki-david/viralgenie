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
import { crawlWithTikHub } from "@/src/lib/crawlers/tikhub";
import { crawlWithRNote } from "@/src/lib/crawlers/rnote";
import {
  buildClaudeContext,
  normalizeToMarkdown,
} from "@/src/lib/normalizer";
import { analyzeContent } from "@/src/lib/ai/client";
import {
  buildStudioReport,
  resolveAnalysisType,
} from "@/src/lib/studio-report";
import type {
  AnalysisType,
  CrawlEngine,
  Platform,
  UnifiedContent,
  WorkspaceType,
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
    "backlink_intel",
  ]).optional(),
  workspace: z.enum(["connections", "creative", "microsite"]).optional(),
  locale: z.enum(["en", "zh"]).optional(),
});

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type AnalyzeOverrides = {
  analysisType?: AnalysisType;
  workspace?: WorkspaceType;
};

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

function enrichReport(args: {
  analysisType: AnalysisType;
  content: UnifiedContent;
  report: Prisma.InputJsonValue;
}): Prisma.InputJsonValue {
  const record =
    args.report && typeof args.report === "object" && !Array.isArray(args.report)
      ? (args.report as Record<string, unknown>)
      : { raw: args.report };

  const studio = buildStudioReport({
    analysisType: args.analysisType,
    content: args.content,
    rawReport: record,
  });

  return {
    ...record,
    ...(studio.signalMap ? { signalMap: studio.signalMap } : {}),
    ...(studio.creativePack ? { creatorPack: studio.creativePack } : {}),
    ...(studio.launchPage ? { launchPage: studio.launchPage } : {}),
    studio,
  } as unknown as Prisma.InputJsonValue;
}

function fallbackEngineFor(platform: Platform): CrawlEngine | null {
  if (platform === "youtube" || platform === "tiktok") return "supadata";
  if (platform === "instagram") return "firecrawl";
  if (platform === "xiaohongshu") return "rnote";
  return null;
}

async function crawlWithEngine(args: {
  url: string;
  engine: CrawlEngine;
  platform: Platform;
  analysisType: AnalysisType;
}) {
  const { url, engine, platform, analysisType } = args;

  if (engine === "tikhub") {
    if (
      platform !== "youtube" &&
      platform !== "tiktok" &&
      platform !== "instagram" &&
      platform !== "douyin" &&
      platform !== "xiaohongshu" &&
      platform !== "bilibili"
    ) {
      return { success: false as const, error: `Unsupported platform for TikHub: ${platform}` };
    }
    return crawlWithTikHub(url, platform);
  }

  if (engine === "rnote") {
    if (platform !== "xiaohongshu") {
      return { success: false as const, error: `Unsupported platform for RNote: ${platform}` };
    }
    return crawlWithRNote(url);
  }

  if (engine === "supadata") {
    if (platform !== "youtube" && platform !== "tiktok" && platform !== "x") {
      return { success: false as const, error: `Unsupported platform for Supadata: ${platform}` };
    }
    return crawlWithSupadata(url, platform);
  }

  if (engine === "firecrawl") {
    return crawlWithFirecrawl(url, {
      fullSiteContext: analysisType === "backlink_intel",
    });
  }

  if (engine === "apify") {
    return crawlWithApify(url);
  }

  return { success: false as const, error: `Unknown engine: ${engine}` };
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
  locale: "en" | "zh";
}): Promise<void> {
  const { taskId, url, engine, platform, analysisType, cachedData, locale } = args;
  try {
    let unified: UnifiedContent;
    let effectiveEngine = engine;

    if (cachedData) {
      unified = cachedData;
    } else {
      await recordUsage(engine, 0);
      let crawl = await crawlWithEngine({ url, engine, platform, analysisType });
      if (!crawl.success && engine === "tikhub") {
        const fallbackEngine = fallbackEngineFor(platform);
        if (fallbackEngine) {
          const fallbackStatus = await checkLimit(fallbackEngine);
          if (!fallbackStatus.allowed) {
            await failTask(
              taskId,
              `TikHub failed (${crawl.error}); fallback ${fallbackEngine} daily limit exceeded`,
            );
            return;
          }
          await recordUsage(fallbackEngine, 0);
          const fallbackCrawl = await crawlWithEngine({
            url,
            engine: fallbackEngine,
            platform,
            analysisType,
          });
          if (fallbackCrawl.success) {
            effectiveEngine = fallbackEngine;
            crawl = fallbackCrawl;
          }
        }
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
          engine: effectiveEngine,
          fetchedAt: now,
          expiresAt,
        },
        update: {
          data: asJson(unified),
          engine: effectiveEngine,
          fetchedAt: now,
          expiresAt,
        },
      });
    }

    const markdown = normalizeToMarkdown(unified);
    const claudeContext = buildClaudeContext(unified, analysisType);

    await prisma.analysisTask.update({
      where: { id: taskId },
      data: {
        status: "analyzing",
        rawData: asJson(unified),
        normalized: markdown,
        crawlEngine: effectiveEngine,
      },
    });

    const analysis = await analyzeContent(claudeContext, analysisType, locale);
    if (!analysis.success) {
      await failTask(taskId, analysis.error);
      return;
    }

    await recordUsage("claude", 0);

    const report = enrichReport({
      analysisType,
      content: unified,
      report: parseReport(analysis.result),
    });

    await prisma.analysisTask.update({
      where: { id: taskId },
      data: { status: "done", report },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failTask(taskId, message);
  }
}

export async function handleAnalyzeRequest(
  request: Request,
  overrides: AnalyzeOverrides = {},
) {
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

  const { url } = parsed.data;
  const createdBy = session.user.email;
  const locale =
    parsed.data.locale ??
    (session.user.locale === "zh" ? session.user.locale : "en");

  const { engine, platform, normalizedUrl } = routeUrl(url);
  const analysisType = resolveAnalysisType({
    analysisType: overrides.analysisType ?? parsed.data.analysisType,
    workspace: overrides.workspace ?? parsed.data.workspace,
    platform,
  });

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
    locale,
  });

  return Response.json({ task }, { status: 202 });
}

export async function POST(request: Request) {
  return handleAnalyzeRequest(request);
}
