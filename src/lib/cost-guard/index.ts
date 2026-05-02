import { prisma } from "@/src/lib/db";
import type { CrawlEngine } from "@/src/types";

export type Service = CrawlEngine | "claude";

export interface LimitStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Map a Service to the budget bucket name used both for the env var
 * (DAILY_<BUCKET>_LIMIT) and the ApiUsage row's service column.
 *
 * "amazon-apify" and "amazon-scraper-api" share the bucket "amazon" so they
 * read DAILY_AMAZON_LIMIT and aggregate their usage in a single DB row.
 */
function serviceToBucket(service: Service): string {
  if (service === "amazon-apify" || service === "amazon-scraper-api") {
    return "amazon";
  }
  return service;
}

function readLimit(service: Service): number {
  const bucket = serviceToBucket(service);
  const raw = process.env[`DAILY_${bucket.toUpperCase()}_LIMIT`];
  if (!raw) return Number.POSITIVE_INFINITY;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : Number.POSITIVE_INFINITY;
}

export async function checkLimit(service: Service): Promise<LimitStatus> {
  const date = todayUTC();
  const limit = readLimit(service);
  const bucket = serviceToBucket(service);

  const row = await prisma.apiUsage.findUnique({
    where: { service_date: { service: bucket, date } },
  });

  const used = row?.count ?? 0;
  const remaining = Math.max(limit - used, 0);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
  };
}

export async function recordUsage(
  service: Service,
  costUsd: number,
): Promise<void> {
  const date = todayUTC();
  const bucket = serviceToBucket(service);

  await prisma.apiUsage.upsert({
    where: { service_date: { service: bucket, date } },
    create: { service: bucket, date, count: 1, costUsd },
    update: {
      count: { increment: 1 },
      costUsd: { increment: costUsd },
    },
  });
}
