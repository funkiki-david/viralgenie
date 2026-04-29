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

function readLimit(service: Service): number {
  const raw = process.env[`DAILY_${service.toUpperCase()}_LIMIT`];
  if (!raw) return Number.POSITIVE_INFINITY;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : Number.POSITIVE_INFINITY;
}

export async function checkLimit(service: Service): Promise<LimitStatus> {
  const date = todayUTC();
  const limit = readLimit(service);

  const row = await prisma.apiUsage.findUnique({
    where: { service_date: { service, date } },
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

  await prisma.apiUsage.upsert({
    where: { service_date: { service, date } },
    create: { service, date, count: 1, costUsd },
    update: {
      count: { increment: 1 },
      costUsd: { increment: costUsd },
    },
  });
}
