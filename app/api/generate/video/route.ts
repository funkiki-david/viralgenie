import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import {
  buildRunwayScenePlan,
  ensureShotPlan,
} from "@/src/lib/media/creator-pack";
import {
  patchCreatorPackOnReport,
  readCreatorPackFromReport,
} from "@/src/lib/media/report-assets";
import { startRunwayVideoDraft } from "@/src/lib/media/runway";

const RequestSchema = z.object({
  taskId: z.string().min(1),
  force: z.boolean().optional(),
});

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

  const task = await prisma.analysisTask.findUnique({
    where: { id: parsed.data.taskId },
  });
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "done") {
    return Response.json(
      { error: "Analysis must be completed before generating assets" },
      { status: 409 },
    );
  }

  const pack = readCreatorPackFromReport(task.report);
  if (!pack) {
    return Response.json({ error: "Creator Pack not found on report" }, { status: 404 });
  }

  const existingDraft = pack.generatedVideoDraft;
  if (
    existingDraft &&
    !parsed.data.force &&
    (existingDraft.status === "pending" ||
      existingDraft.status === "running" ||
      existingDraft.status === "succeeded")
  ) {
    return Response.json({ task });
  }

  const shotPlan = ensureShotPlan(pack);
  if (shotPlan.length === 0) {
    return Response.json(
      { error: "No video shot plan is available for this report" },
      { status: 422 },
    );
  }

  try {
    const scenes = buildRunwayScenePlan(shotPlan);
    const generatedVideoDraft = await startRunwayVideoDraft(scenes);
    const nextReport = patchCreatorPackOnReport({
      report: task.report,
      creativePack: {
        ...pack,
        shotPlan,
        generatedVideoDraft,
      },
    });

    const nextTask = await prisma.analysisTask.update({
      where: { id: task.id },
      data: { report: nextReport as never },
    });

    return Response.json({ task: nextTask });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
