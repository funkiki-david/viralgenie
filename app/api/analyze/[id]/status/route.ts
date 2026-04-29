import { prisma } from "@/src/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const task = await prisma.analysisTask.findUnique({ where: { id } });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "done") {
    return Response.json({
      id: task.id,
      status: task.status,
      urlType: task.urlType,
      crawlEngine: task.crawlEngine,
      createdAt: task.createdAt,
    });
  }

  return Response.json({ task });
}
