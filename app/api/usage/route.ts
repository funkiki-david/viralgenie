import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { checkLimit, type Service } from "@/src/lib/cost-guard";

const SERVICES: Service[] = ["supadata", "firecrawl", "apify", "claude"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

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
