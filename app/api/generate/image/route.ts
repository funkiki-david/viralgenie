import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { generateCoverImage } from "@/src/lib/media/openai-image";
import {
  patchCreatorPackOnReport,
  readCreatorPackFromReport,
} from "@/src/lib/media/report-assets";

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

  if (pack.generatedCoverImage && !parsed.data.force) {
    return Response.json({ task });
  }

  const prompt =
    pack.imagePrompts.dalle.trim() || pack.imagePrompts.midjourney.trim();
  if (!prompt) {
    return Response.json(
      { error: "No image prompt is available for this report" },
      { status: 422 },
    );
  }

  try {
    const generatedCoverImage = await generateCoverImage(prompt);
    const nextReport = patchCreatorPackOnReport({
      report: task.report,
      creativePack: {
        ...pack,
        generatedCoverImage,
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
