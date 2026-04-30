import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, 200)
    : 50;

  const tasks = await prisma.analysisTask.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      url: true,
      urlType: true,
      status: true,
      crawlEngine: true,
      promptType: true,
      createdAt: true,
      updatedAt: true,
      errorMsg: true,
    },
  });

  return Response.json({ tasks });
}
