import type {
  CreatorPackReport,
  CreatorPackShot,
  VideoDraftScene,
} from "@/src/types";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampPrompt(value: string, max = 980): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3).trimEnd()}...`;
}

function parseTimestamp(value: string): number {
  const match = value.trim().match(/^(\d+):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatTimestamp(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const SCRIPT_LINE_RE =
  /^\[(\d+:\d{2})\s*[–-]\s*(\d+:\d{2})\]\s*([^—-]+?)\s*[—-]\s*(.+)$/;

export function parseVideoScriptToShots(args: {
  videoScript15s?: string;
  shotPrompts?: string[];
}): CreatorPackShot[] {
  const script = args.videoScript15s?.trim() ?? "";
  const shotPrompts =
    args.shotPrompts?.map((item) => item.trim()).filter(Boolean) ?? [];

  const scriptShots = script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(SCRIPT_LINE_RE);
      if (!match) return null;
      const [, start, end, beat, body] = match;
      const startSeconds = parseTimestamp(start);
      const endSeconds = Math.max(startSeconds + 1, parseTimestamp(end));
      return {
        startTime: start,
        endTime: end,
        startSeconds,
        endSeconds,
        beat: normalizeWhitespace(beat),
        body: normalizeWhitespace(body),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const maxLength = Math.max(scriptShots.length, shotPrompts.length);
  if (maxLength === 0) return [];

  return Array.from({ length: maxLength }, (_, index) => {
    const scriptShot = scriptShots[index];
    const prompt = shotPrompts[index] ?? scriptShot?.body ?? "";
    const startSeconds = scriptShot?.startSeconds ?? index * 2;
    const endSeconds = scriptShot?.endSeconds ?? startSeconds + 2;
    return {
      index,
      label: scriptShot?.beat || `Shot ${index + 1}`,
      beat: scriptShot?.body || prompt,
      prompt,
      startTime: scriptShot?.startTime ?? formatTimestamp(startSeconds),
      endTime: scriptShot?.endTime ?? formatTimestamp(endSeconds),
      durationSeconds: Math.max(1, endSeconds - startSeconds),
    } satisfies CreatorPackShot;
  });
}

export function ensureShotPlan(pack: CreatorPackReport): CreatorPackShot[] {
  if (pack.shotPlan && pack.shotPlan.length > 0) {
    return pack.shotPlan;
  }
  return parseVideoScriptToShots({
    videoScript15s: pack.videoScript15s,
    shotPrompts: pack.shotPrompts,
  });
}

export function buildRunwayScenePlan(
  shotPlan: CreatorPackShot[],
  ratio = "720:1280",
): VideoDraftScene[] {
  if (shotPlan.length === 0) return [];

  const groups: CreatorPackShot[][] = [[], [], []];
  shotPlan.forEach((shot, index) => {
    groups[index % 3].push(shot);
  });

  return groups
    .filter((group) => group.length > 0)
    .map((group, index) => {
      const first = group[0];
      const last = group[group.length - 1];
      const prompt = group
        .map((shot) => {
          const beat = shot.beat ? `${shot.label}: ${shot.beat}` : shot.label;
          return `${beat}. Visual direction: ${shot.prompt}`;
        })
        .join(" ");

      return {
        id: `scene-${index + 1}`,
        label: `${first.startTime}-${last.endTime}`,
        prompt: clampPrompt(prompt),
        durationSeconds: 5,
        ratio,
        sourceShotIndexes: group.map((shot) => shot.index),
        status: "pending",
        provider: "runway",
        model: "gen4.5",
        createdAt: new Date().toISOString(),
      } satisfies VideoDraftScene;
    });
}
