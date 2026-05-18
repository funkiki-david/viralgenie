import type {
  AnalysisType,
  CreatorPackReport,
  LaunchPageReport,
  LaunchPageSection,
  MicrositeDraft,
  SocialProfile,
  SignalMapAccount,
  SignalMapConnectionAnalysis,
  SignalMapOpportunity,
  SignalMapPresence,
  SignalMapRelatedConnection,
  SignalMapReport,
  StudioReport,
  UnifiedContent,
  WorkspaceType,
} from "@/src/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function flattenStrings(value: unknown, max = 24): string[] {
  const out: string[] = [];

  const visit = (input: unknown) => {
    if (out.length >= max || input == null) return;
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (trimmed) out.push(trimmed);
      return;
    }
    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }
    if (typeof input === "object") {
      Object.values(input).forEach(visit);
    }
  };

  visit(value);
  return out;
}

function readSocialProfiles(value: unknown): SocialProfile[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const profile = item as Record<string, unknown>;
    if (
      typeof profile.platform !== "string" ||
      typeof profile.url !== "string" ||
      typeof profile.canonicalUrl !== "string" ||
      typeof profile.hostname !== "string"
    ) {
      return [];
    }

    return [
      {
        platform: profile.platform as SocialProfile["platform"],
        url: profile.url,
        canonicalUrl: profile.canonicalUrl,
        handle: typeof profile.handle === "string" ? profile.handle : undefined,
        accountPath:
          typeof profile.accountPath === "string" ? profile.accountPath : undefined,
        accountName:
          typeof profile.accountName === "string" ? profile.accountName : undefined,
        hostname: profile.hostname,
        evidence: Array.isArray(profile.evidence)
          ? profile.evidence.filter(
              (entry): entry is string => typeof entry === "string",
            )
          : [],
        confidence: profile.confidence === "high" ? "high" : "medium",
      },
    ];
  });
}

function socialProfileBullets(content: UnifiedContent, max = 6): string[] {
  return readSocialProfiles(content.metadata.socialProfiles)
    .map((profile) => {
      const identity =
        profile.handle || profile.accountName || profile.accountPath || profile.canonicalUrl;
      return `${profile.platform}: ${identity}`;
    })
    .slice(0, max);
}

function dedupeStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function mergeText(parts: Array<string | undefined>): string {
  return dedupeStrings(parts.filter((part): part is string => Boolean(part))).join("; ");
}

function normalizeOfficialAccounts(
  raw: Record<string, unknown>,
  content: UnifiedContent,
): SignalMapAccount[] {
  const socialProfiles = readSocialProfiles(content.metadata.socialProfiles);
  const accounts = new Map<string, SignalMapAccount>();
  const rawAccounts = Array.isArray(raw.officialAccounts)
    ? raw.officialAccounts
    : [];

  for (const profile of socialProfiles) {
    const key = profile.canonicalUrl;
    accounts.set(key, {
      platform: profile.platform,
      accountName: profile.accountName ?? profile.handle ?? profile.accountPath ?? "",
      handle: profile.handle
        ? `@${profile.handle}`
        : profile.accountPath?.startsWith("@")
          ? profile.accountPath
          : "",
      url: profile.canonicalUrl,
      evidence: profile.evidence.join("; "),
    });
  }

  for (const item of rawAccounts) {
    if (!item || typeof item !== "object") continue;
    const account = item as Record<string, unknown>;
    const key =
      typeof account.url === "string" && account.url
        ? account.url
        : `${typeof account.platform === "string" ? account.platform : "other"}:${typeof account.handle === "string" ? account.handle : typeof account.accountName === "string" ? account.accountName : ""}`;
    const existing = accounts.get(key);
    accounts.set(key, {
      platform:
        existing?.platform ??
        (typeof account.platform === "string" ? account.platform : "other"),
      accountName:
        existing?.accountName ??
        (typeof account.accountName === "string" ? account.accountName : ""),
      handle:
        existing?.handle ??
        (typeof account.handle === "string" ? account.handle : ""),
      url: existing?.url ?? (typeof account.url === "string" ? account.url : ""),
      evidence: mergeText([
        existing?.evidence,
        typeof account.evidence === "string" ? account.evidence : "",
      ]),
    });
  }

  return [...accounts.values()].sort((a, b) => {
    if (a.platform === b.platform) return a.url.localeCompare(b.url);
    return a.platform.localeCompare(b.platform);
  });
}

function normalizePlatformPresence(
  raw: Record<string, unknown>,
  officialAccounts: SignalMapAccount[],
): SignalMapPresence[] {
  const presence = new Map<string, SignalMapPresence>();
  const rawPresence = Array.isArray(raw.platformPresence)
    ? raw.platformPresence
    : [];

  for (const account of officialAccounts) {
    if (!account.platform) continue;
    presence.set(account.platform, {
      platform: account.platform,
      status: "official",
      notes: account.url || account.accountName || account.handle,
    });
  }

  for (const item of rawPresence) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const platform =
      typeof record.platform === "string" ? record.platform : "";
    if (!platform) continue;
    const existing = presence.get(platform);
    presence.set(platform, {
      platform,
      status:
        record.status === "official" ||
        record.status === "likely" ||
        record.status === "mentioned"
          ? record.status
          : existing?.status ?? "likely",
      notes: mergeText([
        existing?.notes,
        typeof record.notes === "string" ? record.notes : "",
      ]),
    });
  }

  return [...presence.values()];
}

function normalizeConnectionAnalysis(
  raw: Record<string, unknown>,
  officialAccounts: SignalMapAccount[],
): SignalMapConnectionAnalysis {
  const source =
    raw.connectionAnalysis &&
    typeof raw.connectionAnalysis === "object" &&
    !Array.isArray(raw.connectionAnalysis)
      ? (raw.connectionAnalysis as Record<string, unknown>)
      : {};

  const ownedChannels = dedupeStrings([
    ...officialAccounts.map((account) =>
      [account.platform, account.handle || account.accountName || account.url]
        .filter(Boolean)
        .join(": "),
    ),
    ...flattenStrings(source.ownedChannels, 10),
  ]);

  return {
    ownedChannels,
    communitySignals: dedupeStrings(flattenStrings(source.communitySignals, 8)),
    mediaSignals: dedupeStrings(flattenStrings(source.mediaSignals, 8)),
    crossPlatformFlow:
      typeof source.crossPlatformFlow === "string" && source.crossPlatformFlow.trim()
        ? source.crossPlatformFlow
        : officialAccounts.length > 0
          ? "The source routes visitors from the main website into a set of owned social channels."
          : "",
  };
}

function normalizeRelatedConnections(raw: Record<string, unknown>): SignalMapRelatedConnection[] {
  const related = Array.isArray(raw.relatedConnections)
    ? raw.relatedConnections
    : [];

  return related.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return [
      {
        name: typeof record.name === "string" ? record.name : "",
        type:
          record.type === "media" ||
          record.type === "community" ||
          record.type === "partner" ||
          record.type === "directory" ||
          record.type === "creator" ||
          record.type === "other"
            ? record.type
            : "other",
        url: typeof record.url === "string" ? record.url : "",
        whyItMatters:
          typeof record.whyItMatters === "string" ? record.whyItMatters : "",
      },
    ];
  });
}

function normalizeOpportunities(
  raw: Record<string, unknown>,
  officialAccounts: SignalMapAccount[],
): SignalMapOpportunity[] {
  const items = Array.isArray(raw.distributionOpportunities)
    ? raw.distributionOpportunities
    : [];

  const opportunities = items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return [
      {
        platform: typeof record.platform === "string" ? record.platform : "",
        opportunity:
          typeof record.opportunity === "string" ? record.opportunity : "",
        priority:
          record.priority === "high" ||
          record.priority === "medium" ||
          record.priority === "low"
            ? record.priority
            : "medium",
      } satisfies SignalMapOpportunity,
    ];
  });

  if (opportunities.length > 0) return opportunities;

  return officialAccounts.slice(0, 4).map((account) => ({
    platform: account.platform,
    opportunity: `Study and mirror how this brand uses ${account.platform} as part of its channel mix.`,
    priority: "medium",
  }));
}

function buildCreatorPack(raw: Record<string, unknown>): CreatorPackReport {
  const pack =
    raw.creativePack &&
    typeof raw.creativePack === "object" &&
    !Array.isArray(raw.creativePack)
      ? (raw.creativePack as Record<string, unknown>)
      : {};
  const imagePrompts =
    pack.imagePrompts &&
    typeof pack.imagePrompts === "object" &&
    !Array.isArray(pack.imagePrompts)
      ? (pack.imagePrompts as Record<string, unknown>)
      : {};

  const hookOptions = dedupeStrings([
    typeof raw.hook === "string" ? raw.hook : "",
    typeof raw.improvedTitle === "string" ? raw.improvedTitle : "",
    ...(() => {
      const variants = Array.isArray(raw.variants) ? raw.variants : [];
      return variants.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        return typeof record.content === "string" ? [record.content] : [];
      });
    })(),
  ]).slice(0, 5);

  const outreachCopy = dedupeStrings([
    ...flattenStrings(raw.creativeAngles, 4),
    ...(() => {
      const opportunities = Array.isArray(raw.distributionOpportunities)
        ? raw.distributionOpportunities
        : [];
      return opportunities.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const platform =
          typeof record.platform === "string" ? record.platform : "";
        const opportunity =
          typeof record.opportunity === "string" ? record.opportunity : "";
        if (!platform && !opportunity) return [];
        return [`${platform}: ${opportunity}`.replace(/^:\s*/, "")];
      });
    })(),
    ...flattenStrings(pack.readyToPostCopy, 3),
  ]).slice(0, 5);

  return {
    imagePrompts: {
      midjourney:
        typeof imagePrompts.midjourney === "string"
          ? imagePrompts.midjourney
          : "",
      dalle: typeof imagePrompts.dalle === "string" ? imagePrompts.dalle : "",
    },
    videoScript15s:
      typeof pack.videoScript15s === "string" ? pack.videoScript15s : "",
    shotPrompts: dedupeStrings(flattenStrings(pack.shotPrompts, 8)),
    readyToPostCopy: dedupeStrings(flattenStrings(pack.readyToPostCopy, 6)).slice(
      0,
      3,
    ),
    hookOptions,
    outreachCopy,
  };
}

function section(title: string, body: string): LaunchPageSection | null {
  const cleanBody = body.trim();
  if (!cleanBody) return null;
  return { title, body: cleanBody };
}

export function buildSignalMap(args: {
  rawReport: Record<string, unknown>;
  content: UnifiedContent;
}): SignalMapReport {
  const { rawReport, content } = args;
  const officialAccounts = normalizeOfficialAccounts(rawReport, content);
  const connectionAnalysis = normalizeConnectionAnalysis(
    rawReport,
    officialAccounts,
  );

  return {
    brandSummary:
      typeof rawReport.brandSummary === "string"
        ? rawReport.brandSummary
        : `Signal Map extracted from the ${content.platform} source.`,
    officialAccounts,
    platformPresence: normalizePlatformPresence(rawReport, officialAccounts),
    connectionAnalysis,
    relatedConnections: normalizeRelatedConnections(rawReport),
    distributionOpportunities: normalizeOpportunities(
      rawReport,
      officialAccounts,
    ),
    creativeAngles: dedupeStrings(flattenStrings(rawReport.creativeAngles, 8)),
  };
}

export function workspaceForAnalysisType(
  analysisType: AnalysisType,
): WorkspaceType {
  if (analysisType === "backlink_intel" || analysisType === "competitive_strategy") {
    return "connections";
  }
  if (analysisType === "viral_rewrite" || analysisType === "content_rewrite") {
    return "creative";
  }
  return "microsite";
}

export function resolveAnalysisType(args: {
  workspace?: WorkspaceType;
  analysisType?: AnalysisType;
  platform?: UnifiedContent["platform"];
}): AnalysisType {
  if (args.analysisType) return args.analysisType;

  const videoCreativePlatform =
    args.platform === "youtube" ||
    args.platform === "tiktok" ||
    args.platform === "instagram" ||
    args.platform === "douyin" ||
    args.platform === "bilibili" ||
    args.platform === "xiaohongshu" ||
    args.platform === "x";

  if (args.workspace === "creative") {
    return videoCreativePlatform ? "viral_rewrite" : "content_rewrite";
  }

  if (args.workspace === "microsite") {
    return videoCreativePlatform ? "script_teardown" : "content_rewrite";
  }

  return "backlink_intel";
}

function buildLaunchPage(args: {
  report: Record<string, unknown>;
  content: UnifiedContent;
  analysisType: AnalysisType;
  creatorPack: CreatorPackReport;
  signalMap?: SignalMapReport;
}): LaunchPageReport {
  const { report, content, analysisType, creatorPack, signalMap } = args;
  const titleCandidates = [
    typeof report.improvedTitle === "string" ? report.improvedTitle : "",
    typeof report.hook === "string" ? report.hook : "",
    typeof report.positioning === "string" ? report.positioning : "",
    signalMap?.brandSummary ?? "",
    content.title,
  ].filter(Boolean);

  const socialLinks =
    signalMap?.officialAccounts.map((account) => ({
      platform: account.platform,
      label: account.handle || account.accountName || account.platform,
      url: account.url,
    })) ?? [];

  const sections = [
    section(
      "Signal",
      signalMap?.brandSummary ||
        (typeof report.positioning === "string" ? report.positioning : ""),
    ),
    section(
      "Channel Mix",
      signalMap?.connectionAnalysis.ownedChannels.slice(0, 4).join("\n") ?? "",
    ),
    section(
      "Creator Angle",
      creatorPack.hookOptions[0] ||
        creatorPack.readyToPostCopy[0] ||
        (typeof report.originalAnalysis === "string" ? report.originalAnalysis : ""),
    ),
    section(
      "Distribution Plan",
      (
        signalMap?.distributionOpportunities
          .slice(0, 3)
          .map((item) => `${item.platform}: ${item.opportunity}`) ?? []
      ).join("\n"),
    ),
  ].filter((item): item is LaunchPageSection => item !== null);

  const visualDirection =
    creatorPack.imagePrompts.midjourney ||
    creatorPack.imagePrompts.dalle ||
    "Clean social proof layout with a strong headline, channel signals, and outreach-ready calls to action.";

  return {
    title: titleCandidates[0] || `${analysisType} Launch Page`,
    subtitle: `A lightweight landing-page draft generated from ${content.platform} source analysis.`,
    heroCta: "Launch outreach from this angle",
    sections,
    socialLinks,
    visualDirection,
    outreachCopy:
      creatorPack.outreachCopy.length > 0
        ? creatorPack.outreachCopy
        : creatorPack.readyToPostCopy,
  };
}

function toMicrositeDraft(launchPage: LaunchPageReport): MicrositeDraft {
  return {
    title: launchPage.title,
    subtitle: launchPage.subtitle,
    sections: launchPage.sections.map((item) => item.body),
    cta: launchPage.heroCta,
  };
}

export function buildStudioReport(args: {
  analysisType: AnalysisType;
  content: UnifiedContent;
  rawReport: unknown;
}): StudioReport {
  const { analysisType, content } = args;
  const raw = asRecord(args.rawReport);
  const workspace = workspaceForAnalysisType(analysisType);
  const socialBullets = socialProfileBullets(content);
  const signalMap =
    analysisType === "backlink_intel" ? buildSignalMap({ rawReport: raw, content }) : undefined;
  const creatorPack = buildCreatorPack(raw);
  const launchPage = buildLaunchPage({
    report: raw,
    content,
    analysisType,
    creatorPack,
    signalMap,
  });

  const connectionsSummary =
    typeof signalMap?.brandSummary === "string" && signalMap.brandSummary
      ? signalMap.brandSummary
      : typeof raw.positioning === "string"
        ? raw.positioning
        : typeof raw.hook === "string"
          ? raw.hook
          : `Signals extracted from the ${content.platform} source.`;

  const connectionsBullets =
    analysisType === "backlink_intel"
      ? signalMap && signalMap.officialAccounts.length > 0
        ? signalMap.officialAccounts
            .map((account) =>
              [account.platform, account.handle || account.accountName || account.url]
                .filter(Boolean)
                .join(": "),
            )
            .slice(0, 6)
        : socialBullets.length > 0
        ? socialBullets
        : flattenStrings(raw.officialAccounts, 6)
      : analysisType === "competitive_strategy"
        ? flattenStrings(raw.messaging, 6)
        : flattenStrings(raw, 6);

  return {
    version: 1,
    workspace,
    source: {
      url: content.sourceUrl,
      platform: content.platform,
      title: content.title,
    },
    connections: {
      title: workspace === "connections" ? "Signal Map" : "Source Signals",
      summary: connectionsSummary,
      bullets: connectionsBullets,
    },
    signalMap,
    creativePack: creatorPack,
    launchPage,
    micrositeDraft: toMicrositeDraft(launchPage),
  };
}
