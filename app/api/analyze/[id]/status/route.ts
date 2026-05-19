import { prisma } from "@/src/lib/db";
import { patchCreatorPackOnReport, readCreatorPackFromReport } from "@/src/lib/media/report-assets";
import { refreshRunwayVideoDraft } from "@/src/lib/media/runway";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let task = await prisma.analysisTask.findUnique({ where: { id } });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "done") {
    return Response.json({
      id: task.id,
      status: task.status,
      urlType: task.urlType,
      crawlEngine: task.crawlEngine,
      errorMsg: task.errorMsg,
      createdAt: task.createdAt,
    });
  }

  const pack = readCreatorPackFromReport(task.report);
  const draft = pack?.generatedVideoDraft;
  const shouldRefreshDraft =
    draft &&
    (draft.status === "pending" || draft.status === "running") &&
    draft.scenes.some(
      (scene) => scene.status === "pending" || scene.status === "running",
    );

  if (pack && draft && shouldRefreshDraft) {
    const refreshedDraft = await refreshRunwayVideoDraft(draft);
    if (JSON.stringify(refreshedDraft) !== JSON.stringify(draft)) {
      const nextReport = patchCreatorPackOnReport({
        report: task.report,
        creativePack: {
          ...pack,
          generatedVideoDraft: refreshedDraft,
        },
      });
      task = await prisma.analysisTask.update({
        where: { id },
        data: { report: nextReport as never },
      });
    }
  }

  return Response.json({ task });
}
