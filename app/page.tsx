"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

// ============================================================================
// Types
// ============================================================================

type Lang = "cn" | "en";
type Tab = "analyze" | "history" | "usage" | "compare";
type AnalysisType = "script_teardown" | "product_compare" | "viral_rewrite";
type Platform = "youtube" | "tiktok" | "x" | "blog" | "ecommerce" | "other";
type Engine = "supadata" | "firecrawl" | "apify";
type TaskStatus = "pending" | "crawling" | "analyzing" | "done" | "failed";

interface Task {
  id: string;
  url: string;
  urlType: string;
  status: TaskStatus;
  crawlEngine?: string | null;
  promptType?: string | null;
  createdAt: string;
  updatedAt?: string;
  errorMsg?: string | null;
  rawData?: unknown;
  normalized?: string | null;
  report?: Record<string, unknown> | null;
}

interface UsageEntry {
  service: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  allowed: boolean;
}

interface ScriptTeardownReport {
  hook?: string;
  pivotPoints?: string[];
  cta?: string;
  pacing?: string;
  emotionalArc?: string;
  keyTakeaways?: string[];
}

interface ProductCompareReport {
  features?: string[];
  pricing?: string;
  targetAudience?: string;
  painPoints?: string[];
  strengths?: string[];
  weaknesses?: string[];
  competitiveAdvantage?: string;
}

interface ViralRewriteVariant {
  style?: string;
  content?: string;
  whyItWorks?: string;
}

interface ViralRewriteReport {
  originalAnalysis?: string;
  variants?: ViralRewriteVariant[];
}

// ============================================================================
// i18n dictionary
// ============================================================================

const i18n = {
  en: {
    title: "ViralGenie",
    subtitle: "Website, Social Media & Video Platform",
    tabs: {
      analyze: "Analyze",
      history: "History",
      usage: "Usage",
      compare: "Compare",
    },
    footer: "ViralGenie v1.0 · Built with Next.js + Claude",
    logout: "Sign out",
    analyze: {
      urlLabel: "URL to analyze",
      urlPlaceholder: "Paste a YouTube, TikTok, X, blog or product URL...",
      detected: "Detected",
      noDetection: "Enter a URL to detect platform",
      routePreview: "Route",
      typeHeading: "Choose analysis type",
      submit: "Analyze",
      submitting: "Starting...",
      stepperHeading: "Progress",
      reportHeading: "Report",
      newAnalysis: "New analysis",
      errorTitle: "Analysis failed",
    },
    types: {
      script_teardown: {
        name: "Script Teardown",
        desc: "Break down hooks, pivots, and CTAs from short-form video content.",
      },
      product_compare: {
        name: "Product Compare",
        desc: "Extract features, pricing, and pain points from a product page.",
      },
      viral_rewrite: {
        name: "Viral Rewrite",
        desc: "Generate 5 alternate hooks/styles for the same core message.",
      },
    },
    steps: {
      pending: "Queued",
      crawling: "Crawling",
      analyzing: "Analyzing",
      done: "Done",
      failed: "Failed",
    },
    platforms: {
      youtube: "YouTube",
      tiktok: "TikTok",
      x: "X / Twitter",
      blog: "Blog / Article",
      ecommerce: "E-commerce",
      other: "Other",
    },
    engines: { supadata: "Supadata", firecrawl: "Firecrawl", apify: "Apify" },
    sections: {
      hook: "Hook",
      pivotPoints: "Pivot Points",
      cta: "Call to Action",
      pacing: "Pacing",
      emotionalArc: "Emotional Arc",
      keyTakeaways: "Key Takeaways",
      features: "Features",
      pricing: "Pricing",
      targetAudience: "Target Audience",
      painPoints: "Pain Points",
      strengths: "Strengths",
      weaknesses: "Weaknesses",
      competitiveAdvantage: "Competitive Advantage",
      originalAnalysis: "Original Analysis",
      whyItWorks: "Why it works",
    },
    history: {
      empty: "No analyses yet — paste a URL to get started",
      headers: {
        when: "Created",
        url: "URL",
        type: "Type",
        engine: "Engine",
        status: "Status",
      },
      view: "View report",
      back: "Back to history",
      loading: "Loading...",
      error: "Failed to load history",
      searchPlaceholder: "Search by URL...",
      filterAll: "All",
      noFilterMatches: "No analyses match the current filter",
    },
    usage: {
      heading: "Today's API usage",
      noLimit: "No limit",
      loading: "Loading...",
      error: "Failed to load usage",
      resetNote: "Resets daily at 00:00 UTC",
    },
    compare: {
      heading: "Compare",
      urlALabel: "URL A",
      urlBLabel: "URL B",
      submit: "Compare",
      submitting: "Starting...",
      newComparison: "New comparison",
      summaryHeading: "Quick comparison",
      summaryEmpty: "No notable differences detected.",
      errorTitle: "Comparison failed",
      sideAErrorPrefix: "URL A",
      sideBErrorPrefix: "URL B",
      bothNeeded: "Enter both URLs to compare",
      emptyHint:
        "Compare two URLs side by side. Paste a URL into each field above and pick an analysis type.",
    },
  },
  cn: {
    title: "ViralGenie",
    subtitle: "网站、社交媒体与视频平台",
    footer: "ViralGenie v1.0 · 基于 Next.js + Claude 构建",
    tabs: {
      analyze: "分析",
      history: "历史",
      usage: "用量",
      compare: "对比",
    },
    logout: "退出",
    analyze: {
      urlLabel: "要分析的 URL",
      urlPlaceholder: "粘贴 YouTube / TikTok / X / 博客 / 商品 链接...",
      detected: "已识别",
      noDetection: "输入 URL 以识别平台",
      routePreview: "路由",
      typeHeading: "选择分析类型",
      submit: "开始分析",
      submitting: "启动中...",
      stepperHeading: "进度",
      reportHeading: "分析报告",
      newAnalysis: "新建分析",
      errorTitle: "分析失败",
    },
    types: {
      script_teardown: {
        name: "脚本拆解",
        desc: "拆解短视频脚本的钩子、转折点与行动召唤。",
      },
      product_compare: {
        name: "产品对比",
        desc: "提取产品页的功能、定价与用户痛点。",
      },
      viral_rewrite: {
        name: "病毒改写",
        desc: "围绕同一核心信息生成 5 种不同风格的爆款版本。",
      },
    },
    steps: {
      pending: "排队中",
      crawling: "抓取中",
      analyzing: "分析中",
      done: "已完成",
      failed: "失败",
    },
    platforms: {
      youtube: "YouTube",
      tiktok: "TikTok",
      x: "X / 推特",
      blog: "博客 / 文章",
      ecommerce: "电商",
      other: "其他",
    },
    engines: { supadata: "Supadata", firecrawl: "Firecrawl", apify: "Apify" },
    sections: {
      hook: "开场钩子",
      pivotPoints: "转折点",
      cta: "行动召唤",
      pacing: "节奏",
      emotionalArc: "情绪弧线",
      keyTakeaways: "核心洞察",
      features: "功能特性",
      pricing: "定价",
      targetAudience: "目标用户",
      painPoints: "用户痛点",
      strengths: "优势",
      weaknesses: "劣势",
      competitiveAdvantage: "差异化优势",
      originalAnalysis: "原内容分析",
      whyItWorks: "为何有效",
    },
    history: {
      empty: "还没有分析记录 - 粘贴链接开始",
      headers: {
        when: "创建时间",
        url: "URL",
        type: "类型",
        engine: "引擎",
        status: "状态",
      },
      view: "查看报告",
      back: "返回历史",
      loading: "加载中...",
      error: "加载历史失败",
      searchPlaceholder: "搜索 URL...",
      filterAll: "全部",
      noFilterMatches: "当前筛选条件下没有匹配的分析记录",
    },
    usage: {
      heading: "今日 API 用量",
      noLimit: "无限制",
      loading: "加载中...",
      error: "加载用量失败",
      resetNote: "每日 00:00 UTC 重置",
    },
    compare: {
      heading: "对比分析",
      urlALabel: "URL A",
      urlBLabel: "URL B",
      submit: "开始对比",
      submitting: "启动中...",
      newComparison: "新建对比",
      summaryHeading: "快速对比",
      summaryEmpty: "未发现明显差异。",
      errorTitle: "对比失败",
      sideAErrorPrefix: "URL A",
      sideBErrorPrefix: "URL B",
      bothNeeded: "请输入两个 URL 进行对比",
      emptyHint: "在两个输入框中分别粘贴 URL,选择分析类型,即可并排对比。",
    },
  },
} as const;

// ============================================================================
// Platform routing (mirrors src/lib/url-router server-side logic)
// ============================================================================

interface RouteResult {
  engine: Engine;
  platform: Platform;
}

function detectPlatform(rawUrl: string): RouteResult | null {
  let h: string;
  try {
    h = new URL(rawUrl.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (
    h === "youtube.com" ||
    h.endsWith(".youtube.com") ||
    h === "youtu.be" ||
    h === "m.youtube.com"
  ) {
    return { engine: "supadata", platform: "youtube" };
  }
  if (h === "tiktok.com" || h.endsWith(".tiktok.com") || h === "vm.tiktok.com") {
    return { engine: "supadata", platform: "tiktok" };
  }
  if (
    h === "twitter.com" ||
    h.endsWith(".twitter.com") ||
    h === "x.com" ||
    h.endsWith(".x.com") ||
    h === "t.co"
  ) {
    return { engine: "supadata", platform: "x" };
  }
  if (
    h.includes("amazon.") ||
    h.includes("ebay.") ||
    h.endsWith(".shopify.com") ||
    h.endsWith(".myshopify.com")
  ) {
    return { engine: "apify", platform: "ecommerce" };
  }
  return { engine: "firecrawl", platform: "blog" };
}

const PLATFORM_BADGE: Record<Platform, string> = {
  youtube: "bg-red-500 text-white",
  tiktok: "bg-zinc-900 text-white",
  x: "bg-sky-500 text-white",
  blog: "bg-emerald-500 text-white",
  ecommerce: "bg-amber-500 text-white",
  other: "bg-zinc-400 text-white",
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  pending: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  crawling: "bg-sky-100 text-sky-700 ring-sky-300",
  analyzing: "bg-violet-100 text-violet-700 ring-violet-300",
  done: "bg-emerald-100 text-emerald-700 ring-emerald-300",
  failed: "bg-rose-100 text-rose-700 ring-rose-300",
};

const STEPS: TaskStatus[] = ["pending", "crawling", "analyzing", "done"];

// ============================================================================
// Subcomponents
// ============================================================================

function GenieLogo({ size = 64 }: { size?: number }) {
  const id = useMemo(() => `gg-${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      {/* Rounded-rect gradient background */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#${id})`} />
      {/* Three arc "hair" lines on top of the head */}
      <path
        d="M 22 18 Q 26 12, 30 18"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 30 16 Q 34 10, 38 16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 38 18 Q 42 12, 46 18"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Round face */}
      <circle cx="32" cy="34" r="14" fill="white" />
      {/* Eyes */}
      <circle cx="27" cy="32" r="1.8" fill="#1f2937" />
      <circle cx="37" cy="32" r="1.8" fill="#1f2937" />
      {/* Smile */}
      <path
        d="M 26 38 Q 32 43, 38 38"
        stroke="#1f2937"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function PlatformBadge({
  platform,
  lang,
}: {
  platform: Platform;
  lang: Lang;
}) {
  const t = i18n[lang];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PLATFORM_BADGE[platform]}`}
    >
      {t.platforms[platform]}
    </span>
  );
}

function RoutePreview({
  engine,
  analysisType,
  lang,
}: {
  engine: Engine;
  analysisType: AnalysisType;
  lang: Lang;
}) {
  const t = i18n[lang];
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-zinc-500"
      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
    >
      <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 font-medium">
        {t.engines[engine]}
      </span>
      <span aria-hidden>→</span>
      <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700">
        Normalize
      </span>
      <span aria-hidden>→</span>
      <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-500 to-emerald-500 text-white font-medium">
        Claude · {t.types[analysisType].name}
      </span>
    </div>
  );
}

function Stepper({
  status,
  engine,
  lang,
}: {
  status: TaskStatus;
  engine?: string | null;
  lang: Lang;
}) {
  const t = i18n[lang];
  const currentIdx = STEPS.indexOf(status === "failed" ? "pending" : status);
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        {STEPS.map((step, idx) => {
          const isActive = idx === currentIdx && status !== "done";
          const isComplete = idx < currentIdx || status === "done";
          return (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all duration-300 ${
                    isComplete
                      ? "bg-gradient-to-br from-purple-500 to-emerald-500 text-white"
                      : isActive
                        ? "bg-gradient-to-br from-purple-500 to-emerald-500 text-white animate-pulse-slow ring-4 ring-purple-200"
                        : "bg-zinc-100 text-zinc-400"
                  }`}
                >
                  {isComplete ? "✓" : idx + 1}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isActive
                      ? "text-zinc-900"
                      : isComplete
                        ? "text-zinc-700"
                        : "text-zinc-400"
                  }`}
                >
                  {t.steps[step as keyof typeof t.steps]}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 transition-all duration-500 ${
                    idx < currentIdx || status === "done"
                      ? "bg-gradient-to-r from-purple-400 to-emerald-400"
                      : "bg-zinc-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      {status === "crawling" && engine && (
        <div className="mt-4 text-center text-sm text-zinc-500">
          {lang === "cn" ? "正在使用 " : "Using "}
          <span className="font-medium text-zinc-700">
            {i18n[lang].engines[engine as Engine] ?? engine}
          </span>
          {lang === "cn" ? " 抓取内容..." : " to crawl content..."}
        </div>
      )}
      {status === "analyzing" && (
        <div className="mt-4 text-center text-sm text-zinc-500">
          {lang === "cn"
            ? "Claude 正在生成结构化报告..."
            : "Claude is generating the structured report..."}
        </div>
      )}
    </div>
  );
}

type ReportLeftAccent = "purple" | "teal" | "coral";

function ReportCard({
  title,
  icon,
  children,
  accent = "purple",
  leftAccent,
  highlighted = false,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
  accent?: "purple" | "emerald" | "amber" | "sky" | "rose";
  leftAccent?: ReportLeftAccent;
  highlighted?: boolean;
}) {
  const accents = {
    purple: "from-purple-50 to-white border-purple-100",
    emerald: "from-emerald-50 to-white border-emerald-100",
    amber: "from-amber-50 to-white border-amber-100",
    sky: "from-sky-50 to-white border-sky-100",
    rose: "from-rose-50 to-white border-rose-100",
  };
  const leftBorders: Record<ReportLeftAccent, string> = {
    purple: "border-l-4 border-l-purple-500",
    teal: "border-l-4 border-l-teal-500",
    coral: "border-l-4 border-l-orange-400",
  };
  const baseGradient = highlighted
    ? "from-amber-50 via-purple-50 to-emerald-50 border-amber-200 ring-1 ring-amber-200/60"
    : accents[accent];
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${baseGradient} ${
        leftAccent ? leftBorders[leftAccent] : ""
      } p-5 shadow-sm transition-all hover:shadow-md`}
    >
      <h3
        className={`mb-3 text-sm font-semibold uppercase tracking-wide flex items-center gap-2 ${
          highlighted ? "text-amber-900" : "text-zinc-500"
        }`}
        style={{ fontFamily: "var(--font-sora)" }}
      >
        {icon && (
          <span className="text-base leading-none" aria-hidden>
            {icon}
          </span>
        )}
        <span>{title}</span>
      </h3>
      <div className="text-zinc-800 leading-relaxed">{children}</div>
    </div>
  );
}

function ScriptTeardownView({
  report,
  lang,
  compact = false,
}: {
  report: ScriptTeardownReport;
  lang: Lang;
  compact?: boolean;
}) {
  const s = i18n[lang].sections;
  const gridClass = compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2";
  const left: ReportLeftAccent = "purple";
  return (
    <div className={gridClass}>
      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard title={s.hook} icon="🎣" accent="purple" leftAccent={left}>
          <p className="whitespace-pre-wrap">{report.hook ?? "—"}</p>
        </ReportCard>
      </div>
      <ReportCard
        title={s.pivotPoints}
        icon="🔄"
        accent="sky"
        leftAccent={left}
      >
        {report.pivotPoints && report.pivotPoints.length > 0 ? (
          <ol className="list-decimal pl-5 space-y-2">
            {report.pivotPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        ) : (
          <p>—</p>
        )}
      </ReportCard>
      <ReportCard title={s.cta} icon="📢" accent="emerald" leftAccent={left}>
        <p className="whitespace-pre-wrap">{report.cta ?? "—"}</p>
      </ReportCard>
      <ReportCard title={s.pacing} icon="🎵" accent="amber" leftAccent={left}>
        <p className="whitespace-pre-wrap">{report.pacing ?? "—"}</p>
      </ReportCard>
      <ReportCard
        title={s.emotionalArc}
        icon="🎭"
        accent="rose"
        leftAccent={left}
      >
        <p className="whitespace-pre-wrap">{report.emotionalArc ?? "—"}</p>
      </ReportCard>
      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.keyTakeaways}
          icon="💡"
          leftAccent={left}
          highlighted
        >
          {report.keyTakeaways && report.keyTakeaways.length > 0 ? (
            <ul className="list-disc pl-5 space-y-2">
              {report.keyTakeaways.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <p>—</p>
          )}
        </ReportCard>
      </div>
    </div>
  );
}

function ProductCompareView({
  report,
  lang,
  compact = false,
}: {
  report: ProductCompareReport;
  lang: Lang;
  compact?: boolean;
}) {
  const s = i18n[lang].sections;
  const gridClass = compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2";
  const renderList = (items?: string[]) =>
    items && items.length > 0 ? (
      <ul className="list-disc pl-5 space-y-2">
        {items.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    ) : (
      <p>—</p>
    );
  const left: ReportLeftAccent = "teal";
  return (
    <div className={gridClass}>
      <ReportCard title={s.features} icon="⭐" accent="purple" leftAccent={left}>
        {renderList(report.features)}
      </ReportCard>
      <ReportCard title={s.pricing} icon="💰" accent="emerald" leftAccent={left}>
        <p className="whitespace-pre-wrap">{report.pricing ?? "—"}</p>
      </ReportCard>
      <ReportCard
        title={s.strengths}
        icon="💪"
        accent="emerald"
        leftAccent={left}
      >
        {renderList(report.strengths)}
      </ReportCard>
      <ReportCard
        title={s.weaknesses}
        icon="⚡"
        accent="rose"
        leftAccent={left}
      >
        {renderList(report.weaknesses)}
      </ReportCard>
      <ReportCard
        title={s.painPoints}
        icon="😣"
        accent="amber"
        leftAccent={left}
      >
        {renderList(report.painPoints)}
      </ReportCard>
      <ReportCard
        title={s.targetAudience}
        icon="🎯"
        accent="sky"
        leftAccent={left}
      >
        <p className="whitespace-pre-wrap">{report.targetAudience ?? "—"}</p>
      </ReportCard>
      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.competitiveAdvantage}
          icon="🏆"
          leftAccent={left}
          highlighted
        >
          <p className="whitespace-pre-wrap">
            {report.competitiveAdvantage ?? "—"}
          </p>
        </ReportCard>
      </div>
    </div>
  );
}

function ViralRewriteView({
  report,
  lang,
}: {
  report: ViralRewriteReport;
  lang: Lang;
}) {
  const s = i18n[lang].sections;
  const left: ReportLeftAccent = "coral";
  return (
    <div className="space-y-4">
      {report.originalAnalysis && (
        <ReportCard
          title={s.originalAnalysis}
          icon="📋"
          accent="purple"
          leftAccent={left}
        >
          <p className="whitespace-pre-wrap">{report.originalAnalysis}</p>
        </ReportCard>
      )}
      <div className="grid gap-4">
        {(report.variants ?? []).map((v, i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-200 border-l-4 border-l-orange-400 bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-emerald-500 text-white text-xs font-semibold uppercase tracking-wide"
                style={{ fontFamily: "var(--font-sora)" }}
              >
                {String(i + 1).padStart(2, "0")} · {v.style ?? "—"}
              </span>
            </div>
            <p className="text-zinc-900 leading-relaxed whitespace-pre-wrap">
              {v.content ?? "—"}
            </p>
            {v.whyItWorks && (
              <div className="mt-4 pt-4 border-t border-zinc-100">
                <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1 flex items-center gap-1.5">
                  <span aria-hidden>🔥</span>
                  <span>{s.whyItWorks}</span>
                </p>
                <p className="text-sm text-zinc-600">{v.whyItWorks}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportRenderer({
  task,
  lang,
  compact = false,
}: {
  task: Task;
  lang: Lang;
  compact?: boolean;
}) {
  const report = (task.report ?? {}) as Record<string, unknown>;
  const type = task.promptType as AnalysisType | undefined;
  if (!type) return null;
  if (type === "script_teardown")
    return (
      <ScriptTeardownView
        report={report as ScriptTeardownReport}
        lang={lang}
        compact={compact}
      />
    );
  if (type === "product_compare")
    return (
      <ProductCompareView
        report={report as ProductCompareReport}
        lang={lang}
        compact={compact}
      />
    );
  if (type === "viral_rewrite")
    return <ViralRewriteView report={report as ViralRewriteReport} lang={lang} />;
  return null;
}

// ============================================================================
// Tabs
// ============================================================================

function AnalyzeTab({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [url, setUrl] = useState("");
  const [analysisType, setAnalysisType] =
    useState<AnalysisType>("script_teardown");
  const [submitting, setSubmitting] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detected = url.trim() ? detectPlatform(url) : null;

  const reset = useCallback(() => {
    setTask(null);
    setError(null);
    setSubmitting(false);
  }, []);

  // Polling
  useEffect(() => {
    if (!task) return;
    if (task.status === "done" || task.status === "failed") return;

    const intervalId = setInterval(async () => {
      try {
        const r = await fetch(`/api/analyze/${task.id}/status`);
        if (!r.ok) return;
        const d = (await r.json()) as { task?: Task } & Partial<Task>;
        if (d.task) {
          setTask(d.task);
        } else if (d.id && d.status) {
          setTask((prev) =>
            prev
              ? {
                  ...prev,
                  status: d.status as TaskStatus,
                  urlType: d.urlType ?? prev.urlType,
                  crawlEngine: d.crawlEngine ?? prev.crawlEngine,
                }
              : prev,
          );
        }
      } catch {
        // swallow transient errors; keep polling
      }
    }, 2000);
    return () => clearInterval(intervalId);
  }, [task]);

  const submit = useCallback(async () => {
    if (!url.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), analysisType }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || `Request failed (${r.status})`);
        setSubmitting(false);
        return;
      }
      setTask(d.task as Task);
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }, [url, analysisType, submitting]);

  if (task && task.status === "done") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2
            className="text-2xl font-bold text-zinc-900"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            {t.analyze.reportHeading}
          </h2>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-emerald-500 text-white font-medium text-sm hover:shadow-lg transition-all"
          >
            + {t.analyze.newAnalysis}
          </button>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm flex flex-wrap items-center gap-3">
          <span
            className="text-zinc-500"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {task.url}
          </span>
          <PlatformBadge platform={task.urlType as Platform} lang={lang} />
          {task.crawlEngine && (
            <span className="text-xs text-zinc-500">
              · {t.engines[task.crawlEngine as Engine] ?? task.crawlEngine}
            </span>
          )}
        </div>
        <ReportRenderer task={task} lang={lang} />
      </div>
    );
  }

  if (task && task.status === "failed") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <h3 className="text-lg font-semibold text-rose-900 mb-2">
            {t.analyze.errorTitle}
          </h3>
          <p className="text-rose-800 text-sm whitespace-pre-wrap">
            {task.errorMsg ?? "Unknown error"}
          </p>
        </div>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-emerald-500 text-white font-medium text-sm hover:shadow-lg transition-all"
        >
          + {t.analyze.newAnalysis}
        </button>
      </div>
    );
  }

  if (task) {
    return (
      <div className="space-y-6">
        <h2
          className="text-2xl font-bold text-zinc-900"
          style={{ fontFamily: "var(--font-sora)" }}
        >
          {t.analyze.stepperHeading}
        </h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Stepper status={task.status} engine={task.crawlEngine} lang={lang} />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm flex flex-wrap items-center gap-3">
          <span
            className="text-zinc-500"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {task.url}
          </span>
          <PlatformBadge platform={task.urlType as Platform} lang={lang} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label
          className="block text-sm font-medium text-zinc-700 mb-2"
          htmlFor="url-input"
        >
          {t.analyze.urlLabel}
        </label>
        <input
          id="url-input"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t.analyze.urlPlaceholder}
          className="w-full px-4 py-3 rounded-xl border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {detected ? (
            <>
              <span className="text-zinc-500">{t.analyze.detected}:</span>
              <PlatformBadge platform={detected.platform} lang={lang} />
              <span className="text-zinc-300">·</span>
              <span className="text-zinc-500">{t.analyze.routePreview}:</span>
              <RoutePreview
                engine={detected.engine}
                analysisType={analysisType}
                lang={lang}
              />
            </>
          ) : (
            <span className="text-zinc-400">{t.analyze.noDetection}</span>
          )}
        </div>
      </div>

      <div>
        <h3
          className="text-sm font-medium text-zinc-700 mb-3"
          style={{ fontFamily: "var(--font-sora)" }}
        >
          {t.analyze.typeHeading}
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(t.types) as AnalysisType[]).map((key) => {
            const isSelected = analysisType === key;
            return (
              <button
                key={key}
                onClick={() => setAnalysisType(key)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-purple-500 bg-gradient-to-br from-purple-50 to-emerald-50 shadow-md"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
                }`}
              >
                <div
                  className={`text-base font-semibold mb-1 ${
                    isSelected ? "text-purple-900" : "text-zinc-900"
                  }`}
                  style={{ fontFamily: "var(--font-sora)" }}
                >
                  {t.types[key].name}
                </div>
                <div className="text-sm text-zinc-600 leading-relaxed">
                  {t.types[key].desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={!url.trim() || !detected || submitting}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-emerald-500 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: "var(--font-sora)" }}
      >
        {submitting ? t.analyze.submitting : t.analyze.submit}
      </button>
    </div>
  );
}

const PLATFORM_DOT: Record<Platform, string> = {
  youtube: "bg-red-500",
  tiktok: "bg-zinc-900",
  x: "bg-sky-500",
  blog: "bg-emerald-500",
  ecommerce: "bg-amber-500",
  other: "bg-zinc-400",
};

const HISTORY_FILTER_PLATFORMS: Platform[] = [
  "youtube",
  "tiktok",
  "x",
  "blog",
  "ecommerce",
];

function HistoryTab({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");

  useEffect(() => {
    let alive = true;
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setTasks(d.tasks ?? []);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedTask(null);
      return;
    }
    let alive = true;
    fetch(`/api/analyze/${selectedId}/status`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.task) setSelectedTask(d.task);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [selectedId]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return null;
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (platformFilter !== "all" && task.urlType !== platformFilter) {
        return false;
      }
      if (q && !task.url.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, query, platformFilter]);

  if (selectedTask && selectedTask.status === "done") {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedId(null)}
          className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1"
        >
          ← {t.history.back}
        </button>
        <ReportRenderer task={selectedTask} lang={lang} />
      </div>
    );
  }

  if (error) return <div className="text-rose-700 text-sm">{t.history.error}</div>;
  if (tasks === null)
    return <div className="text-zinc-500 text-sm">{t.history.loading}</div>;
  if (tasks.length === 0)
    return (
      <div className="text-center py-16 text-zinc-500">
        <div className="text-4xl mb-3">🪄</div>
        <p>{t.history.empty}</p>
      </div>
    );

  const list = filteredTasks ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.history.searchPlaceholder}
          className="flex-1 px-4 py-2 rounded-xl border border-zinc-300 bg-white text-sm text-zinc-900 placeholder-zinc-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setPlatformFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              platformFilter === "all"
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {t.history.filterAll}
          </button>
          {HISTORY_FILTER_PLATFORMS.map((p) => {
            const isActive = platformFilter === p;
            return (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full ${PLATFORM_DOT[p]}`}
                  aria-hidden
                />
                {t.platforms[p]}
              </button>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <p>{t.history.noFilterMatches}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">
                  {t.history.headers.when}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t.history.headers.url}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t.history.headers.type}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t.history.headers.engine}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t.history.headers.status}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {list.map((task) => {
                const dt = new Date(task.createdAt);
                const platform = task.urlType as Platform;
                return (
                  <tr
                    key={task.id}
                    className="hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                      {dt.toLocaleString(lang === "cn" ? "zh-CN" : "en-US")}
                    </td>
                    <td
                      className="px-4 py-3 text-zinc-700 max-w-xs truncate"
                      title={task.url}
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                            PLATFORM_DOT[platform] ?? PLATFORM_DOT.other
                          }`}
                          aria-hidden
                        />
                        <span className="truncate">{task.url}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {task.promptType ? (
                        <span className="text-zinc-700 text-xs">
                          {t.types[task.promptType as AnalysisType]?.name ??
                            task.promptType}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 text-xs">
                      {task.crawlEngine
                        ? t.engines[task.crawlEngine as Engine] ??
                          task.crawlEngine
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                          STATUS_BADGE[task.status]
                        }`}
                      >
                        {t.steps[task.status as keyof typeof t.steps] ??
                          task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {task.status === "done" && (
                        <button
                          onClick={() => setSelectedId(task.id)}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                        >
                          {t.history.view} →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsageTab({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [data, setData] = useState<UsageEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setData(d.services ?? []);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="text-rose-700 text-sm">{t.usage.error}</div>;
  if (data === null)
    return <div className="text-zinc-500 text-sm">{t.usage.loading}</div>;

  return (
    <div className="space-y-4">
      <h2
        className="text-xl font-bold text-zinc-900"
        style={{ fontFamily: "var(--font-sora)" }}
      >
        {t.usage.heading}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((entry) => {
          const hasLimit = entry.limit !== null && entry.limit > 0;
          const pct = hasLimit
            ? Math.min(100, (entry.used / (entry.limit as number)) * 100)
            : 0;
          const danger = pct > 80;
          const warn = pct >= 60 && pct <= 80;
          return (
            <div
              key={entry.service}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-baseline justify-between mb-3">
                <span
                  className="text-sm font-semibold text-zinc-900 uppercase tracking-wide"
                  style={{ fontFamily: "var(--font-sora)" }}
                >
                  {entry.service}
                </span>
                <span
                  className="text-sm text-zinc-600"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  {entry.used} / {hasLimit ? entry.limit : "∞"}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    danger
                      ? "bg-rose-500"
                      : warn
                        ? "bg-amber-500"
                        : "bg-gradient-to-r from-purple-500 to-emerald-500"
                  }`}
                  style={{ width: hasLimit ? `${pct}%` : "0%" }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                {hasLimit ? (
                  <span
                    className={`${
                      danger
                        ? "text-rose-600 font-semibold"
                        : warn
                          ? "text-amber-700"
                          : "text-zinc-500"
                    }`}
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {pct.toFixed(0)}%
                  </span>
                ) : (
                  <span className="text-zinc-400">{t.usage.noLimit}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p
        className="text-center text-xs text-zinc-400 pt-2"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {t.usage.resetNote}
      </p>
    </div>
  );
}

// ============================================================================
// Compare tab
// ============================================================================

function summarizeDifferences(
  taskA: Task,
  taskB: Task,
  type: AnalysisType,
  lang: Lang,
): string[] {
  const a = (taskA.report ?? {}) as Record<string, unknown>;
  const b = (taskB.report ?? {}) as Record<string, unknown>;
  const isCN = lang === "cn";
  const out: string[] = [];

  const len = (v: unknown) => (typeof v === "string" ? v.trim().length : 0);
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const moreLabel = (which: "A" | "B") => (isCN ? `URL ${which}` : `URL ${which}`);

  const compareCount = (
    keyA: number,
    keyB: number,
    labelCn: string,
    labelEn: string,
  ) => {
    if (keyA === keyB) return null;
    const more = keyA > keyB ? "A" : "B";
    const hi = Math.max(keyA, keyB);
    const lo = Math.min(keyA, keyB);
    return isCN
      ? `${moreLabel(more as "A" | "B")} 列出更多${labelCn} (${hi} vs ${lo})`
      : `${moreLabel(more as "A" | "B")} lists more ${labelEn} (${hi} vs ${lo})`;
  };

  const compareTextLength = (
    lenA: number,
    lenB: number,
    labelCn: string,
    labelEn: string,
  ) => {
    if (lenA === 0 || lenB === 0) return null;
    const ratio = lenA / lenB;
    if (ratio > 1.4) {
      return isCN
        ? `${moreLabel("A")} 的${labelCn}更详细`
        : `${moreLabel("A")} has a more detailed ${labelEn}`;
    }
    if (ratio < 0.71) {
      return isCN
        ? `${moreLabel("B")} 的${labelCn}更详细`
        : `${moreLabel("B")} has a more detailed ${labelEn}`;
    }
    return null;
  };

  const presence = (
    hasA: boolean,
    hasB: boolean,
    labelCn: string,
    labelEn: string,
  ) => {
    if (hasA && !hasB) {
      return isCN
        ? `仅 ${moreLabel("A")} 包含明确的${labelCn}`
        : `Only ${moreLabel("A")} has an explicit ${labelEn}`;
    }
    if (hasB && !hasA) {
      return isCN
        ? `仅 ${moreLabel("B")} 包含明确的${labelCn}`
        : `Only ${moreLabel("B")} has an explicit ${labelEn}`;
    }
    return null;
  };

  if (type === "script_teardown") {
    const lines = [
      compareTextLength(len(a.hook), len(b.hook), "开场钩子", "hook"),
      compareCount(
        arr(a.pivotPoints).length,
        arr(b.pivotPoints).length,
        "转折点",
        "pivot points",
      ),
      compareCount(
        arr(a.keyTakeaways).length,
        arr(b.keyTakeaways).length,
        "核心洞察",
        "key takeaways",
      ),
      presence(len(a.cta) > 0, len(b.cta) > 0, "行动召唤", "CTA"),
      compareTextLength(
        len(a.emotionalArc),
        len(b.emotionalArc),
        "情绪弧线描写",
        "emotional arc",
      ),
    ];
    for (const l of lines) if (l) out.push(l);
  } else if (type === "product_compare") {
    const lines = [
      compareCount(
        arr(a.features).length,
        arr(b.features).length,
        "功能特性",
        "features",
      ),
      compareCount(
        arr(a.strengths).length,
        arr(b.strengths).length,
        "优势",
        "strengths",
      ),
      compareCount(
        arr(a.weaknesses).length,
        arr(b.weaknesses).length,
        "劣势",
        "weaknesses",
      ),
      compareCount(
        arr(a.painPoints).length,
        arr(b.painPoints).length,
        "用户痛点",
        "pain points",
      ),
      presence(len(a.pricing) > 0, len(b.pricing) > 0, "定价信息", "pricing"),
    ];
    for (const l of lines) if (l) out.push(l);
  } else if (type === "viral_rewrite") {
    const variantsA = arr(a.variants);
    const variantsB = arr(b.variants);
    if (variantsA.length !== variantsB.length) {
      out.push(
        isCN
          ? `生成数量: A ${variantsA.length} vs B ${variantsB.length}`
          : `Variant count: A ${variantsA.length} vs B ${variantsB.length}`,
      );
    }
    const stylesA = new Set(
      variantsA
        .map((v) => (v as { style?: string }).style)
        .filter((s): s is string => typeof s === "string"),
    );
    const stylesB = new Set(
      variantsB
        .map((v) => (v as { style?: string }).style)
        .filter((s): s is string => typeof s === "string"),
    );
    const onlyA = [...stylesA].filter((s) => !stylesB.has(s));
    const onlyB = [...stylesB].filter((s) => !stylesA.has(s));
    if (onlyA.length > 0) {
      out.push(
        isCN
          ? `仅 ${moreLabel("A")} 包含的风格: ${onlyA.join(", ")}`
          : `Only in ${moreLabel("A")}: ${onlyA.join(", ")}`,
      );
    }
    if (onlyB.length > 0) {
      out.push(
        isCN
          ? `仅 ${moreLabel("B")} 包含的风格: ${onlyB.join(", ")}`
          : `Only in ${moreLabel("B")}: ${onlyB.join(", ")}`,
      );
    }
    const avgLen = (variants: unknown[]) => {
      if (variants.length === 0) return 0;
      let total = 0;
      for (const v of variants) {
        const c = (v as { content?: string }).content;
        if (typeof c === "string") total += c.length;
      }
      return total / variants.length;
    };
    const lenA = avgLen(variantsA);
    const lenB = avgLen(variantsB);
    if (lenA && lenB && Math.abs(lenA - lenB) / Math.max(lenA, lenB) > 0.25) {
      const longer = lenA > lenB ? "A" : "B";
      out.push(
        isCN
          ? `${moreLabel(longer as "A" | "B")} 的改写版本平均更长`
          : `${moreLabel(longer as "A" | "B")} variants are noticeably longer on average`,
      );
    }
  }

  return out.slice(0, 5);
}

function ComparisonSummary({
  taskA,
  taskB,
  lang,
}: {
  taskA: Task;
  taskB: Task;
  lang: Lang;
}) {
  const t = i18n[lang];
  const type = taskA.promptType as AnalysisType | undefined;
  const diffs = useMemo(() => {
    if (!type || type !== taskB.promptType) return [];
    return summarizeDifferences(taskA, taskB, type, lang);
  }, [taskA, taskB, type, lang]);

  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-emerald-50 p-5 shadow-sm">
      <h3
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-700"
        style={{ fontFamily: "var(--font-sora)" }}
      >
        ✨ {t.compare.summaryHeading}
      </h3>
      {diffs.length === 0 ? (
        <p className="text-sm text-zinc-600">{t.compare.summaryEmpty}</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-zinc-800">
          {diffs.map((d, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-purple-500 shrink-0">•</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompareSide({
  label,
  task,
  lang,
}: {
  label: "A" | "B";
  task: Task | null;
  lang: Lang;
}) {
  const t = i18n[lang];
  if (!task) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-emerald-500 text-white text-sm font-bold"
          style={{ fontFamily: "var(--font-sora)" }}
        >
          {label}
        </span>
        <PlatformBadge platform={task.urlType as Platform} lang={lang} />
        {task.crawlEngine && (
          <span className="text-xs text-zinc-500">
            · {t.engines[task.crawlEngine as Engine] ?? task.crawlEngine}
          </span>
        )}
      </div>
      <div
        className="text-xs text-zinc-500 break-all"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        title={task.url}
      >
        {task.url}
      </div>

      {task.status === "done" ? (
        <ReportRenderer task={task} lang={lang} compact />
      ) : task.status === "failed" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-900 mb-1">
            {t.compare.errorTitle}
          </p>
          <p className="text-xs text-rose-800 whitespace-pre-wrap">
            {task.errorMsg ?? "Unknown error"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <Stepper status={task.status} engine={task.crawlEngine} lang={lang} />
        </div>
      )}
    </div>
  );
}

function CompareTab({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [analysisType, setAnalysisType] =
    useState<AnalysisType>("script_teardown");
  const [taskA, setTaskA] = useState<Task | null>(null);
  const [taskB, setTaskB] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedA = urlA.trim() ? detectPlatform(urlA) : null;
  const detectedB = urlB.trim() ? detectPlatform(urlB) : null;

  const reset = useCallback(() => {
    setTaskA(null);
    setTaskB(null);
    setError(null);
    setSubmitting(false);
  }, []);

  // Independent polling for A
  useEffect(() => {
    if (!taskA) return;
    if (taskA.status === "done" || taskA.status === "failed") return;
    const intervalId = setInterval(async () => {
      try {
        const r = await fetch(`/api/analyze/${taskA.id}/status`);
        if (!r.ok) return;
        const d = (await r.json()) as { task?: Task } & Partial<Task>;
        if (d.task) {
          setTaskA(d.task);
        } else if (d.id && d.status) {
          setTaskA((prev) =>
            prev
              ? {
                  ...prev,
                  status: d.status as TaskStatus,
                  urlType: d.urlType ?? prev.urlType,
                  crawlEngine: d.crawlEngine ?? prev.crawlEngine,
                }
              : prev,
          );
        }
      } catch {
        // ignore transient errors
      }
    }, 2000);
    return () => clearInterval(intervalId);
  }, [taskA]);

  // Independent polling for B
  useEffect(() => {
    if (!taskB) return;
    if (taskB.status === "done" || taskB.status === "failed") return;
    const intervalId = setInterval(async () => {
      try {
        const r = await fetch(`/api/analyze/${taskB.id}/status`);
        if (!r.ok) return;
        const d = (await r.json()) as { task?: Task } & Partial<Task>;
        if (d.task) {
          setTaskB(d.task);
        } else if (d.id && d.status) {
          setTaskB((prev) =>
            prev
              ? {
                  ...prev,
                  status: d.status as TaskStatus,
                  urlType: d.urlType ?? prev.urlType,
                  crawlEngine: d.crawlEngine ?? prev.crawlEngine,
                }
              : prev,
          );
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(intervalId);
  }, [taskB]);

  const submit = useCallback(async () => {
    if (!urlA.trim() || !urlB.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const [respA, respB] = await Promise.all([
        fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlA.trim(), analysisType }),
        }),
        fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlB.trim(), analysisType }),
        }),
      ]);
      const [dA, dB] = await Promise.all([respA.json(), respB.json()]);
      if (!respA.ok) {
        setError(`${t.compare.sideAErrorPrefix}: ${dA.error || respA.status}`);
        setSubmitting(false);
        return;
      }
      if (!respB.ok) {
        setError(`${t.compare.sideBErrorPrefix}: ${dB.error || respB.status}`);
        setSubmitting(false);
        return;
      }
      setTaskA(dA.task as Task);
      setTaskB(dB.task as Task);
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }, [urlA, urlB, analysisType, submitting, t.compare]);

  // Results view (one or both tasks present)
  if (taskA || taskB) {
    const bothDone = taskA?.status === "done" && taskB?.status === "done";
    const sameType =
      taskA?.promptType && taskA.promptType === taskB?.promptType;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2
            className="text-2xl font-bold text-zinc-900"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            {t.compare.heading}
          </h2>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-emerald-500 text-white font-medium text-sm hover:shadow-lg transition-all"
          >
            + {t.compare.newComparison}
          </button>
        </div>

        {bothDone && sameType && taskA && taskB && (
          <ComparisonSummary taskA={taskA} taskB={taskB} lang={lang} />
        )}

        <div className="grid gap-6 md:grid-cols-2 md:divide-x md:divide-zinc-200">
          <div className="md:pr-6">
            <CompareSide label="A" task={taskA} lang={lang} />
          </div>
          <div className="md:pl-6">
            <CompareSide label="B" task={taskB} lang={lang} />
          </div>
        </div>
      </div>
    );
  }

  // Input view
  const canSubmit =
    urlA.trim() && urlB.trim() && detectedA && detectedB && !submitting;

  const empty = !urlA.trim() && !urlB.trim();

  return (
    <div className="space-y-6">
      {empty && (
        <div className="rounded-2xl border border-dashed border-purple-200 bg-gradient-to-br from-purple-50/40 to-emerald-50/40 px-5 py-4 text-sm text-zinc-600 flex items-start gap-3">
          <span className="text-2xl leading-none" aria-hidden>
            ✨
          </span>
          <p>{t.compare.emptyHint}</p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            label: t.compare.urlALabel,
            value: urlA,
            setValue: setUrlA,
            detected: detectedA,
            id: "url-a-input",
          },
          {
            label: t.compare.urlBLabel,
            value: urlB,
            setValue: setUrlB,
            detected: detectedB,
            id: "url-b-input",
          },
        ].map((f) => (
          <div key={f.id}>
            <label
              className="block text-sm font-semibold text-zinc-700 mb-2"
              htmlFor={f.id}
              style={{ fontFamily: "var(--font-sora)" }}
            >
              {f.label}
            </label>
            <input
              id={f.id}
              type="url"
              value={f.value}
              onChange={(e) => f.setValue(e.target.value)}
              placeholder={t.analyze.urlPlaceholder}
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            />
            <div className="mt-2 flex items-center gap-2 text-xs">
              {f.detected ? (
                <PlatformBadge platform={f.detected.platform} lang={lang} />
              ) : (
                <span className="text-zinc-400">{t.analyze.noDetection}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3
          className="text-sm font-medium text-zinc-700 mb-3"
          style={{ fontFamily: "var(--font-sora)" }}
        >
          {t.analyze.typeHeading}
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(t.types) as AnalysisType[]).map((key) => {
            const isSelected = analysisType === key;
            return (
              <button
                key={key}
                onClick={() => setAnalysisType(key)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-purple-500 bg-gradient-to-br from-purple-50 to-emerald-50 shadow-md"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
                }`}
              >
                <div
                  className={`text-base font-semibold mb-1 ${
                    isSelected ? "text-purple-900" : "text-zinc-900"
                  }`}
                  style={{ fontFamily: "var(--font-sora)" }}
                >
                  {t.types[key].name}
                </div>
                <div className="text-sm text-zinc-600 leading-relaxed">
                  {t.types[key].desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-emerald-500 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: "var(--font-sora)" }}
      >
        {submitting
          ? t.compare.submitting
          : !urlA.trim() || !urlB.trim()
            ? t.compare.bothNeeded
            : t.compare.submit}
      </button>
    </div>
  );
}

// ============================================================================
// Auth gate
// ============================================================================

function LangToggle({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-zinc-100 p-1 text-xs font-medium">
      <button
        onClick={() => setLang("cn")}
        className={`px-3 py-1.5 rounded-full transition-all ${
          lang === "cn"
            ? "bg-white text-zinc-900 shadow-sm"
            : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        中文
      </button>
      <button
        onClick={() => setLang("en")}
        className={`px-3 py-1.5 rounded-full transition-all ${
          lang === "en"
            ? "bg-white text-zinc-900 shadow-sm"
            : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        EN
      </button>
    </div>
  );
}

// ============================================================================
// Header
// ============================================================================

function Header({
  lang,
  setLang,
  tab,
  setTab,
  onLogout,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  onLogout: () => void;
}) {
  const t = i18n[lang];
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <GenieLogo size={36} />
          <div>
            <div
              className="text-lg font-bold bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              {t.title}
            </div>
            <div className="text-xs text-zinc-500 -mt-0.5">{t.subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <nav className="inline-flex rounded-full bg-zinc-100 p-1 text-sm font-medium">
            {(Object.keys(t.tabs) as Tab[]).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-1.5 rounded-full transition-all ${
                  tab === key
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {t.tabs[key]}
              </button>
            ))}
          </nav>
          <LangToggle lang={lang} setLang={setLang} />
          <button
            onClick={onLogout}
            className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            {t.logout}
          </button>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// Root
// ============================================================================

export default function Home() {
  const [lang, setLang] = useState<Lang>("cn");
  const [tab, setTab] = useState<Tab>("analyze");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLang = localStorage.getItem("viralgenie_lang") as Lang | null;
    if (savedLang === "cn" || savedLang === "en") setLang(savedLang);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("viralgenie_lang", lang);
    }
  }, [lang]);

  const logout = () => {
    void signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50/30 via-white to-emerald-50/30">
      <Header
        lang={lang}
        setLang={setLang}
        tab={tab}
        setTab={setTab}
        onLogout={logout}
      />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {tab === "analyze" && <AnalyzeTab lang={lang} />}
        {tab === "compare" && <CompareTab lang={lang} />}
        {tab === "history" && <HistoryTab lang={lang} />}
        {tab === "usage" && <UsageTab lang={lang} />}
      </main>
      <footer
        className="text-center text-xs text-zinc-400 py-6"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {i18n[lang].footer}
      </footer>
    </div>
  );
}
