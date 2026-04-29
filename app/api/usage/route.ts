import { checkLimit, type Service } from "@/src/lib/cost-guard";

const SERVICES: Service[] = ["supadata", "firecrawl", "apify", "claude"];

export async function GET() {
  const services = await Promise.all(
    SERVICES.map(async (service) => {
      const status = await checkLimit(service);
      return {
        service,
        used: status.used,
        limit: Number.isFinite(status.limit) ? status.limit : null,
        remaining: Number.isFinite(status.remaining) ? status.remaining : null,
        allowed: status.allowed,
      };
    }),
  );

  return Response.json({ services });
}
