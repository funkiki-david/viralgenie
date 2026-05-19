import type { VideoDraftReport, VideoDraftScene } from "@/src/types";

const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_API_VERSION = "2024-11-06";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function runwayHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Runway-Version": RUNWAY_API_VERSION,
  };
}

function draftStatus(scenes: VideoDraftScene[]): VideoDraftReport["status"] {
  const states = new Set(scenes.map((scene) => scene.status));
  if (states.has("failed")) return "failed";
  if (states.has("pending") || states.has("running")) return "running";
  return "succeeded";
}

export async function startRunwayVideoDraft(
  scenes: VideoDraftScene[],
): Promise<VideoDraftReport> {
  const apiKey = process.env.RUNWAY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RUNWAY_API_KEY is not configured");
  }

  const createdAt = new Date().toISOString();
  const createdScenes = await Promise.all(
    scenes.map(async (scene) => {
      const response = await fetch(`${RUNWAY_API_BASE}/text_to_video`, {
        method: "POST",
        headers: runwayHeaders(apiKey),
        body: JSON.stringify({
          model: scene.model,
          promptText: scene.prompt,
          ratio: scene.ratio,
          duration: scene.durationSeconds,
        }),
      });

      const payload = asRecord(await response.json().catch(() => ({})));
      if (!response.ok) {
        const error = asRecord(payload.error);
        return {
          ...scene,
          status: "failed",
          error:
            typeof error.message === "string"
              ? error.message
              : `Runway create failed with HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 240)}`,
        } satisfies VideoDraftScene;
      }

      return {
        ...scene,
        status: "running",
        runwayTaskId: typeof payload.id === "string" ? payload.id : undefined,
        createdAt,
      } satisfies VideoDraftScene;
    }),
  );

  return {
    provider: "runway",
    model: "gen4.5",
    ratio: "768:1280",
    totalDurationSeconds: createdScenes.reduce(
      (total, scene) => total + scene.durationSeconds,
      0,
    ),
    status: draftStatus(createdScenes),
    scenes: createdScenes,
    createdAt,
  };
}

export async function refreshRunwayVideoDraft(
  draft: VideoDraftReport,
): Promise<VideoDraftReport> {
  const apiKey = process.env.RUNWAY_API_KEY?.trim();
  if (!apiKey) {
    return {
      ...draft,
      status:
        draft.status === "succeeded" ? "succeeded" : "failed",
      scenes: draft.scenes.map((scene) =>
        scene.status === "succeeded"
          ? scene
          : {
              ...scene,
              status: "failed",
              error: scene.error || "RUNWAY_API_KEY is not configured",
            },
      ),
      completedAt: draft.completedAt ?? new Date().toISOString(),
    };
  }

  const updatedScenes = await Promise.all(
    draft.scenes.map(async (scene) => {
      if (
        !scene.runwayTaskId ||
        scene.status === "succeeded" ||
        scene.status === "failed"
      ) {
        return scene;
      }

      const response = await fetch(`${RUNWAY_API_BASE}/tasks/${scene.runwayTaskId}`, {
        method: "GET",
        headers: runwayHeaders(apiKey),
      });
      const payload = asRecord(await response.json().catch(() => ({})));
      if (!response.ok) {
        return {
          ...scene,
          status: "failed",
          error: `Runway task lookup failed with HTTP ${response.status}`,
        } satisfies VideoDraftScene;
      }

      const status = typeof payload.status === "string" ? payload.status : "";
      if (status === "SUCCEEDED") {
        return {
          ...scene,
          status: "succeeded",
          outputUrl:
            Array.isArray(payload.output) && typeof payload.output[0] === "string"
              ? payload.output[0]
              : undefined,
          completedAt:
            typeof payload.updatedAt === "string"
              ? payload.updatedAt
              : new Date().toISOString(),
        } satisfies VideoDraftScene;
      }
      if (status === "FAILED" || status === "CANCELLED") {
        return {
          ...scene,
          status: "failed",
          error:
            typeof payload.failureCode === "string"
              ? payload.failureCode
              : "Runway task failed",
          completedAt:
            typeof payload.updatedAt === "string"
              ? payload.updatedAt
              : new Date().toISOString(),
        } satisfies VideoDraftScene;
      }

      return {
        ...scene,
        status: "running",
      } satisfies VideoDraftScene;
    }),
  );

  const status = draftStatus(updatedScenes);
  return {
    ...draft,
    status,
    scenes: updatedScenes,
    completedAt:
      status === "running" ? undefined : draft.completedAt ?? new Date().toISOString(),
  };
}
