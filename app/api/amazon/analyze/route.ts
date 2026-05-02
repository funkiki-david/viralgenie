import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { checkLimit, recordUsage, type Service } from "@/src/lib/cost-guard";
import {
  extractAsin,
  fetchAmazonProduct,
  marketplaceToUrl,
} from "@/src/lib/crawlers/amazon-product";
import { normalizeAmazon } from "@/src/lib/normalizer/amazon";
import { normalizeToMarkdown } from "@/src/lib/normalizer";
import { analyzeContent } from "@/src/lib/ai/client";
import { getSystemPrompt } from "@/src/lib/ai/prompts";
import type {
  AmazonProductData,
  AnalysisType,
  CrawlEngine,
  UnifiedContent,
} from "@/src/types";

const RequestSchema = z.object({
  input: z.string().min(1),
  analysisType: z.enum([
    "listing_audit",
    "review_mining",
    "competitor_compare",
  ]),
  compareAsin: z.string().optional(),
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

function currentEngine(): CrawlEngine {
  const e = (process.env.AMAZON_ENGINE || "apify").toLowerCase();
  return e === "scraper-api" ? "amazon-scraper-api" : "amazon-apify";
}

async function failTask(taskId: string, errorMsg: string): Promise<void> {
  await prisma.analysisTask
    .update({
      where: { id: taskId },
      data: { status: "failed", errorMsg },
    })
    .catch(() => {});
}

/**
 * Get product data from cache if fresh, otherwise fetch via the configured engine
 * (apify or scraper-api), persist into AmazonProduct, record cost-guard usage.
 */
async function getProductFromCacheOrFetch(
  urlOrAsin: string,
): Promise<{ data: AmazonProductData; cacheHit: boolean }> {
  const { asin, marketplace } = extractAsin(urlOrAsin);
  const now = new Date();

  const cached = await prisma.amazonProduct.findUnique({
    where: { asin_marketplace: { asin, marketplace } },
  });

  if (cached && cached.expiresAt > now) {
    const data = cached.rawData as unknown as AmazonProductData;
    // Cache rows store the full AmazonProductData shape under rawData.
    return { data, cacheHit: true };
  }

  const data = await fetchAmazonProduct(urlOrAsin);
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

  await prisma.amazonProduct.upsert({
    where: { asin_marketplace: { asin: data.asin, marketplace: data.marketplace } },
    create: {
      asin: data.asin,
      marketplace: data.marketplace,
      title: data.title,
      brand: data.brand ?? null,
      price: data.price ?? null,
      rating: data.rating ?? null,
      reviewCount: data.reviewCount ?? null,
      bsr: data.bsr ?? null,
      category: data.category ?? null,
      rawData: asJson(data),
      fetchedAt: now,
      expiresAt,
    },
    update: {
      title: data.title,
      brand: data.brand ?? null,
      price: data.price ?? null,
      rating: data.rating ?? null,
      reviewCount: data.reviewCount ?? null,
      bsr: data.bsr ?? null,
      category: data.category ?? null,
      rawData: asJson(data),
      fetchedAt: now,
      expiresAt,
    },
  });

  await recordUsage(currentEngine() as Service, 0);

  return { data, cacheHit: false };
}

function unifiedToMarkdown(unified: UnifiedContent, label?: string): string {
  const md = normalizeToMarkdown(unified);
  if (!label) return md;
  return `# ${label}\n\n${md}`;
}

async function runPipeline(args: {
  taskId: string;
  input: string;
  compareAsin?: string;
  analysisType: AnalysisType;
}): Promise<void> {
  const { taskId, input, compareAsin, analysisType } = args;

  try {
    // Fetch primary product
    const { data: dataA } = await getProductFromCacheOrFetch(input);
    const unifiedA = normalizeAmazon(dataA);

    // For compare mode, fetch the second product
    let unifiedB: UnifiedContent | null = null;
    let dataB: AmazonProductData | null = null;
    if (analysisType === "competitor_compare") {
      if (!compareAsin) {
        await failTask(
          taskId,
          "competitor_compare requires `compareAsin` in the request body",
        );
        return;
      }
      const second = await getProductFromCacheOrFetch(compareAsin);
      dataB = second.data;
      unifiedB = normalizeAmazon(dataB);
    }

    // Build prompt input — concat for compare, single normalized markdown otherwise.
    const claudeContext = unifiedB
      ? [
          "You are comparing two Amazon products. Each is delimited by ---.",
          "",
          unifiedToMarkdown(unifiedA, `Product A — ${dataA.asin}`),
          "",
          "---",
          "",
          unifiedToMarkdown(unifiedB, `Product B — ${dataB!.asin}`),
        ].join("\n")
      : normalizeToMarkdown(unifiedA);

    // Persist intermediate state on the task row.
    await prisma.analysisTask.update({
      where: { id: taskId },
      data: {
        status: "analyzing",
        rawData: asJson(unifiedB ? { a: dataA, b: dataB } : dataA),
        normalized: claudeContext,
      },
    });

    // Send to Claude with the analysis-type-specific system prompt.
    const systemPrompt = getSystemPrompt(analysisType);
    // analyzeContent currently looks up the prompt by analysisType internally,
    // so passing the prebuilt context as the user message is sufficient.
    void systemPrompt; // referenced for clarity; analyzeContent re-resolves.
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
  const { input, analysisType, compareAsin } = parsed.data;

  // Validate ASIN extraction up front so the user gets immediate feedback
  // instead of a delayed task-failed.
  let asin: string;
  let marketplace: string;
  try {
    ({ asin, marketplace } = extractAsin(input));
  } catch (err) {
    return Response.json(
      {
        error: "Could not extract ASIN",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }
  if (analysisType === "competitor_compare") {
    if (!compareAsin) {
      return Response.json(
        { error: "competitor_compare requires `compareAsin`" },
        { status: 400 },
      );
    }
    try {
      extractAsin(compareAsin);
    } catch (err) {
      return Response.json(
        {
          error: "Could not extract compareAsin",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 400 },
      );
    }
  }

  // Cost-guard limits (engine bucket "amazon" + claude).
  const engine = currentEngine();
  const engineStatus = await checkLimit(engine as Service);
  const claudeStatus = await checkLimit("claude");
  if (!engineStatus.allowed || !claudeStatus.allowed) {
    return Response.json(
      {
        error: "Daily limit exceeded",
        amazon: engineStatus,
        claude: claudeStatus,
      },
      { status: 429 },
    );
  }

  // Persist task as "crawling" so it appears in History and the existing polling endpoint works.
  const taskUrl = marketplaceToUrl(asin, marketplace);
  const task = await prisma.analysisTask.create({
    data: {
      url: taskUrl,
      urlType: "amazon",
      status: "crawling",
      createdBy: (session.user?.name ?? "anonymous") as string,
      crawlEngine: engine,
      promptType: analysisType,
    },
  });

  void runPipeline({
    taskId: task.id,
    input,
    compareAsin,
    analysisType,
  });

  return Response.json({ task }, { status: 202 });
}
