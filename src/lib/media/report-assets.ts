import type { CreatorPackReport, StudioReport } from "@/src/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readCreatorPackFromReport(
  report: unknown,
): CreatorPackReport | null {
  const root = asRecord(report);
  const studio = asRecord(root.studio);
  const candidate = studio.creativePack ?? root.creatorPack ?? root.creativePack;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  return candidate as CreatorPackReport;
}

export function patchCreatorPackOnReport(args: {
  report: unknown;
  creativePack: CreatorPackReport;
}): Record<string, unknown> {
  const root = asRecord(args.report);
  const studio = asRecord(root.studio);
  const nextStudio: StudioReport | Record<string, unknown> = {
    ...studio,
    creativePack: args.creativePack,
  };

  return {
    ...root,
    creatorPack: args.creativePack,
    creativePack: args.creativePack,
    studio: nextStudio,
  };
}
