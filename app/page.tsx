"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

// ============================================================================
// Types
// ============================================================================

type Lang = "zh" | "en";
type Tab = "analyze" | "history" | "usage";
type Workspace = "connections" | "creative" | "microsite";
type AnalysisType =
  | "script_teardown"
  | "product_compare"
  | "viral_rewrite"
  | "seo_audit"
  | "content_rewrite"
  | "competitive_strategy"
  | "backlink_intel";

type Platform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "douyin"
  | "xiaohongshu"
  | "bilibili"
  | "x"
  | "blog"
  | "ecommerce"
  | "other";
type Engine = "tikhub" | "rnote" | "supadata" | "firecrawl" | "apify";
type TaskStatus = "pending" | "crawling" | "analyzing" | "done" | "failed";
type ProviderAttemptRole = "primary" | "fallback" | "cache";
type ProviderAttemptStatus = "success" | "failed" | "skipped";

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

interface ProviderAttemptRecord {
  engine?: string;
  role?: ProviderAttemptRole;
  status?: ProviderAttemptStatus;
  durationMs?: number;
  reason?: string;
}

interface ProviderTraceRecord {
  primaryEngine?: string;
  finalEngine?: string;
  platform?: string;
  cached?: boolean;
  fallbackUsed?: boolean;
  attempts?: ProviderAttemptRecord[];
}

interface UsageEntry {
  service: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  allowed: boolean;
}

interface CreativePack {
  imagePrompts?: {
    midjourney?: string;
    dalle?: string;
  };
  videoScript15s?: string;
  shotPrompts?: string[];
  shotPlan?: {
    index: number;
    label: string;
    beat?: string;
    prompt: string;
    startTime: string;
    endTime: string;
    durationSeconds: number;
  }[];
  readyToPostCopy?: string[];
  hookOptions?: string[];
  outreachCopy?: string[];
  generatedCoverImage?: {
    provider?: "openai";
    model?: "gpt-image-1";
    prompt?: string;
    mimeType?: string;
    dataUrl?: string;
    createdAt?: string;
    revisedPrompt?: string;
  };
  generatedVideoDraft?: {
    provider?: "runway";
    model?: "gen4.5";
    ratio?: string;
    totalDurationSeconds?: number;
    status?: "pending" | "running" | "succeeded" | "failed";
    scenes?: {
      id: string;
      label: string;
      prompt: string;
      durationSeconds: number;
      ratio: string;
      sourceShotIndexes: number[];
      status: "pending" | "running" | "succeeded" | "failed";
      provider: "runway";
      model: "gen4.5";
      createdAt: string;
      runwayTaskId?: string;
      outputUrl?: string;
      error?: string;
      completedAt?: string;
    }[];
    createdAt?: string;
    completedAt?: string;
  };
}

interface ScriptTeardownReport {
  hook?: string;
  pivotPoints?: string[];
  cta?: string;
  pacing?: string;
  emotionalArc?: string;
  keyTakeaways?: string[];
  creativePack?: CreativePack;
}

interface ProductCompareReport {
  features?: string[];
  pricing?: string;
  targetAudience?: string;
  painPoints?: string[];
  strengths?: string[];
  weaknesses?: string[];
  competitiveAdvantage?: string;
  creativePack?: CreativePack;
}

interface ViralRewriteVariant {
  style?: string;
  content?: string;
  whyItWorks?: string;
}

interface ViralRewriteReport {
  originalAnalysis?: string;
  variants?: ViralRewriteVariant[];
  creativePack?: CreativePack;
}

interface SeoAuditReport {
  overallScore?: number;
  metaTags?: {
    title?: string;
    description?: string;
    keywords?: string[];
    issues?: string[];
  };
  headings?: {
    structure?: string;
    issues?: string[];
  };
  content?: {
    wordCount?: number;
    keywordDensity?: string;
    readability?: string;
  };
  links?: {
    internal?: number;
    external?: number;
    broken?: string[];
  };
  recommendations?: string[];
  creativePack?: CreativePack;
}

interface ContentRewriteChange {
  what?: string;
  why?: string;
}

interface ContentRewriteReport {
  originalAnalysis?: string;
  improvedTitle?: string;
  improvedContent?: string;
  changes?: ContentRewriteChange[];
  seoImprovements?: string[];
  creativePack?: CreativePack;
}

interface ActionPlanItem {
  priority?: "high" | "medium" | "low";
  action?: string;
  expectedImpact?: string;
}

interface CompetitiveStrategyReport {
  positioning?: string;
  messaging?: {
    tone?: string;
    keyThemes?: string[];
  };
  targetAudience?: string;
  contentStrategy?: {
    strengths?: string[];
    gaps?: string[];
  };
  uxEvaluation?: string;
  actionPlan?: ActionPlanItem[];
  creativePack?: CreativePack;
}

interface BacklinkSource {
  platform?: string;
  accountName?: string;
  handle?: string;
  url?: string;
  evidence?: string;
}

interface SocialProfileRecord {
  platform?: string;
  url?: string;
  canonicalUrl?: string;
  handle?: string;
  accountPath?: string;
  accountName?: string;
  hostname?: string;
  evidence?: string[];
  confidence?: "high" | "medium";
}

interface LinkOpportunity {
  platform?: string;
  opportunity?: string;
  priority?: "high" | "medium" | "low";
}

interface BacklinkIntelReport {
  brandSummary?: string;
  officialAccounts?: BacklinkSource[];
  platformPresence?: {
    platform?: string;
    status?: "official" | "likely" | "mentioned";
    notes?: string;
  }[];
  connectionAnalysis?: {
    ownedChannels?: string[];
    communitySignals?: string[];
    mediaSignals?: string[];
    crossPlatformFlow?: string;
  };
  relatedConnections?: {
    name?: string;
    type?: "media" | "community" | "partner" | "directory" | "creator" | "other";
    url?: string;
    whyItMatters?: string;
  }[];
  distributionOpportunities?: LinkOpportunity[];
  creativeAngles?: string[];
  creativePack?: CreativePack;
}

interface SignalMapPanel {
  brandSummary?: string;
  officialAccounts?: BacklinkSource[];
  platformPresence?: {
    platform?: string;
    status?: "official" | "likely" | "mentioned";
    notes?: string;
  }[];
  connectionAnalysis?: {
    ownedChannels?: string[];
    communitySignals?: string[];
    mediaSignals?: string[];
    crossPlatformFlow?: string;
  };
  relatedConnections?: {
    name?: string;
    type?: "media" | "community" | "partner" | "directory" | "creator" | "other";
    url?: string;
    whyItMatters?: string;
  }[];
  distributionOpportunities?: LinkOpportunity[];
  creativeAngles?: string[];
}

interface StudioSection {
  title?: string;
  summary?: string;
  bullets?: string[];
}

interface StudioMicrositeDraft {
  title?: string;
  subtitle?: string;
  sections?: string[];
  cta?: string;
}

interface LaunchPageSection {
  title?: string;
  body?: string;
}

interface LaunchPageSocialLink {
  platform?: string;
  label?: string;
  url?: string;
}

interface LaunchPagePanel {
  title?: string;
  subtitle?: string;
  heroCta?: string;
  sections?: LaunchPageSection[];
  socialLinks?: LaunchPageSocialLink[];
  visualDirection?: string;
  outreachCopy?: string[];
}

interface StudioEnvelope {
  version?: number;
  workspace?: Workspace;
  providerTrace?: ProviderTraceRecord;
  connections?: StudioSection;
  signalMap?: SignalMapPanel;
  creativePack?: CreativePack;
  launchPage?: LaunchPagePanel;
  micrositeDraft?: StudioMicrositeDraft;
}

type ResultIntentId =
  | "whyViral"
  | "rewrite"
  | "prompts"
  | "script"
  | "accounts"
  | "outreach";

interface ResultIntent {
  id: ResultIntentId;
  workspace: Workspace;
  analysisType: AnalysisType;
  icon: string;
}

interface DemoUrl {
  id: "tiktok" | "youtube" | "instagram";
  platform: Platform;
  url: string;
}

const RESULT_INTENTS: ResultIntent[] = [
  {
    id: "whyViral",
    workspace: "creative",
    analysisType: "script_teardown",
    icon: "◎",
  },
  {
    id: "rewrite",
    workspace: "creative",
    analysisType: "viral_rewrite",
    icon: "↻",
  },
  {
    id: "prompts",
    workspace: "creative",
    analysisType: "viral_rewrite",
    icon: "✦",
  },
  {
    id: "script",
    workspace: "creative",
    analysisType: "script_teardown",
    icon: "▶",
  },
  {
    id: "accounts",
    workspace: "connections",
    analysisType: "backlink_intel",
    icon: "▦",
  },
  {
    id: "outreach",
    workspace: "microsite",
    analysisType: "backlink_intel",
    icon: "↗",
  },
];

const DEMO_URLS: DemoUrl[] = [
  {
    id: "tiktok",
    platform: "tiktok",
    url: "https://www.tiktok.com/@scout2015/video/6718335390845095173",
  },
  {
    id: "youtube",
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    id: "instagram",
    platform: "instagram",
    url: "https://www.instagram.com/reel/DUa5b_BDmmD/",
  },
];

// ============================================================================
// i18n dictionary
// ============================================================================

const baseI18n = {
  en: {
    title: "ViralGenie",
    subtitle: "Convert any viral content into your own content assets",
    tabs: {
      analyze: "Studio",
      history: "Library",
      usage: "Usage",
    },
    downloadPdf: "Download Full Report",
    workingHint: "Genie is working for you now.",
    logout: "Sign out",
    analyze: {
      heroHeadline:
        "Turn one viral URL into your next winning post.",
      heroBody:
        "Paste any TikTok, YouTube, or Instagram URL. ViralGenie breaks down why a competitor's content worked, then rebuilds that logic into fresh scripts, captions, and image prompts for your brand.",
      demoHeading: "Start with a live TikTok demo, or test YouTube and Instagram next.",
      demoLabel: "Recommended demo URLs",
      sampleIdeas: [
        "TikTok demo video URL",
        "YouTube Short or video",
        "Instagram Reel or post",
      ],
      resultHeading: "Choose the result you need",
      resultHelper:
        "Step 1: paste a URL. Step 2: choose the output. Step 3: Genie starts now.",
      flowPasteUrl: "Paste a URL",
      flowChooseResult: "Choose the result you need",
      flowRunAnalysis: "Genie Starts Now",
      resultIntents: {
        whyViral: {
          title: "Why did it go viral?",
          desc: "Break down the hook, pacing, emotion, proof, and CTA behind the original post.",
          bestFor:
            "Best for TikTok, YouTube Shorts, Instagram Reels, Douyin, Xiaohongshu, and Bilibili video links.",
        },
        rewrite: {
          title: "Rewrite the concept",
          desc: "Turn the same viral pattern into new angles your brand can actually use.",
          bestFor:
            "Best for turning TikTok, Reels, Shorts, Douyin, or Xiaohongshu posts into new captions and ideas.",
        },
        prompts: {
          title: "Create image prompts",
          desc: "Generate Midjourney and DALL-E prompts based on the video's scenes and message.",
          bestFor:
            "Best for image-heavy content on Instagram, Xiaohongshu, Pinterest-style posts, and visual social ads.",
        },
        script: {
          title: "Write a video script",
          desc: "Create a 15-second video script with scene beats, shot prompts, and a CTA.",
          bestFor:
            "Best for TikTok, Instagram Reels, YouTube Shorts, Douyin, and Bilibili short videos.",
        },
        accounts: {
          title: "Find competitor accounts",
          desc: "Pull official social links, handles, and platform presence from a site or profile.",
          bestFor:
            "Best for company websites and creator profiles across Instagram, YouTube, TikTok, X, LinkedIn, and Xiaohongshu.",
        },
        outreach: {
          title: "Build an outreach page",
          desc: "Turn the analysis into a simple page brief you can share, pitch, or test.",
          bestFor:
            "Best after analyzing any social or website URL when you need a simple page for email, LinkedIn, or social outreach.",
        },
      },
      workflowHeading: "From competitor URL to new content",
      workflowHelper:
        "A simple path from a proven post to publishable creative assets.",
      workflowSteps: [
        "Paste a viral URL",
        "Choose the result",
        "Decode why it worked",
        "Rebuild the idea",
        "Publish or test",
      ],
      workspaceHeading: "Choose your workspace",
      workspaceHelper:
        "Each workspace changes the recommended analysis path without changing the one-URL workflow.",
      micrositeHelper:
        "Launch Pages are driven by signal insights and creator outputs. For now, start with one of the recommended inputs below.",
      urlLabel: "URL to analyze",
      urlPlaceholder: "Paste a TikTok, YouTube, or Instagram URL...",
      detected: "Detected",
      noDetection: "Enter a URL to detect platform",
      routePreview: "Route",
      typeHeading: "Analysis type",
      selectedResult: "Selected result",
      submit: "Genie Starts Now",
      submitting: "Starting...",
      stepperHeading: "Progress",
      reportHeading: "Report",
      priorityHeading: "Ready-to-use outputs",
      priorityHelper:
        "Start here: the most useful creative angles, links, prompts, and short-video script from this analysis.",
      fullDetailsHeading: "Full analysis details",
      fullDetailsHelper:
        "Open this section when you want the supporting breakdown, account map, and deeper report notes.",
      newAnalysis: "New analysis",
      errorTitle: "Analysis failed",
    },
    types: {
      script_teardown: {
        name: "Viral Breakdown",
        desc: "Break down the hook, pacing, emotional arc, and CTA behind short-form content.",
      },
      product_compare: {
        name: "Product Compare",
        desc: "Extract features, pricing, and pain points from a product page.",
      },
      viral_rewrite: {
        name: "Concept Rewrite",
        desc: "Rebuild a proven viral pattern into fresh hooks, captions, and angles.",
      },
      seo_audit: {
        name: "SEO Audit",
        desc: "Score the page on meta tags, headings, content, links, and recommendations.",
      },
      content_rewrite: {
        name: "Content Rewrite",
        desc: "Produce a fully rewritten, SEO-optimized version with stronger structure and CTAs.",
      },
      competitive_strategy: {
        name: "Content Positioning",
        desc: "Read the messaging, audience, themes, and gaps behind a creator or brand's content system.",
      },
      backlink_intel: {
        name: "Find Accounts",
        desc: "Find official social channels, media footprint, and the web of links around a brand or creator.",
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
        instagram: "Instagram",
        douyin: "Douyin",
        xiaohongshu: "Xiaohongshu",
        bilibili: "Bilibili",
        x: "X / Twitter",
        blog: "Blog / Web",
      ecommerce: "E-commerce",
      other: "Other",
    },
    engines: {
      tikhub: "TikHub",
      rnote: "RNote",
      supadata: "Supadata",
      firecrawl: "Firecrawl",
      apify: "Apify",
    },
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
      overallScore: "Overall Score",
      metaTags: "Meta Tags",
      headings: "Headings",
      content: "Content",
      links: "Links",
      recommendations: "Recommendations",
      improvedTitle: "Improved Title",
      improvedContent: "Improved Content",
      changes: "Changes",
      seoImprovements: "SEO Improvements",
      positioning: "Positioning",
      messaging: "Messaging",
      contentStrategy: "Content Strategy",
      uxEvaluation: "UX Evaluation",
      actionPlan: "Action Plan",
      exposureSummary: "Brand Summary",
      likelyFeaturedSources: "Official Accounts",
      linkOpportunities: "Distribution Opportunities",
      outreachAngles: "Creative Angles",
      contentIdeas: "Related Connections",
      sourceType: "Platform",
      pitchAngle: "Evidence",
      opportunityType: "Presence",
      pitchIdea: "Opportunity",
      accountName: "Account Name",
      handle: "Handle",
      officialAccounts: "Official Accounts",
      platformPresence: "Platform Presence",
      ownedChannels: "Owned Channels",
      communitySignals: "Community Signals",
      mediaSignals: "Media Signals",
      crossPlatformFlow: "Cross-platform Flow",
      relatedConnections: "Related Connections",
      whyItMatters: "Why It Matters",
      distributionOpportunities: "Distribution Opportunities",
      creativeAngles: "Creative Angles",
      creativePack: "Creator Pack",
      imagePrompts: "Image Prompts",
      midjourney: "Midjourney",
      dalle: "DALL-E",
      videoScript15s: "15s Video Script",
      shotPrompts: "Shot Prompts",
      shotPlan: "Shot Plan",
      readyToPostCopy: "Ready-to-post Copy",
      hookOptions: "Hook Options",
      outreachCopy: "Outreach Copy",
      generateImage: "Generate Cover Image",
      generatingImage: "Generating image...",
      generatedImage: "Generated Cover Image",
      generateVideoDraft: "Generate 15s Video Draft",
      generatingVideoDraft: "Generating video draft...",
      generatedVideoDraft: "Generated Video Draft",
      sceneClips: "Scene Clips",
      generationStatus: "Generation Status",
      generationError: "Generation error",
      visualDirection: "Visual Direction",
      socialLinks: "Social Links",
      tone: "Tone",
      keyThemes: "Key Themes",
      gaps: "Gaps",
      wordCount: "Word Count",
      keywordDensity: "Keyword Density",
      readability: "Readability",
      internal: "Internal",
      external: "External",
      broken: "Broken",
      issues: "Issues",
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
    workspace: {
      connections: {
        label: "Signal Map",
        desc: "Map accounts, platforms, media footprint, and cross-platform relationships.",
      },
      creative: {
        label: "Creator Pack",
        desc: "Turn one URL into prompts, scripts, hooks, and ready-to-post copy.",
      },
      microsite: {
        label: "Launch Page",
        desc: "Shape analysis outputs into a simple outreach-ready landing page brief.",
      },
    },
  },
  zh: {
    title: "ViralGenie",
    subtitle: "把任意爆款内容转化成你的创作资产",
    downloadPdf: "Download Full Report",
    workingHint: "Genie is working for you now.",
    tabs: {
      analyze: "工作台",
      history: "资料库",
      usage: "用量",
    },
    logout: "退出",
    analyze: {
      heroHeadline:
        "把一个爆款 URL 变成你的下一条爆款内容。",
      heroBody:
        "粘贴任意 TikTok、YouTube 或 Instagram 链接。ViralGenie 会拆解竞争对手的内容为什么会火，再把这套爆款逻辑重组成适合你品牌的新脚本、文案和图片提示词。",
      demoHeading: "先试跑一条 TikTok 真实示例，再测试 YouTube 和 Instagram。",
      demoLabel: "推荐测试链接",
      sampleIdeas: [
        "TikTok 示例视频链接",
        "YouTube Shorts 或视频",
        "Instagram Reels 或帖子",
      ],
      resultHeading: "选择你想得到的结果",
      resultHelper:
        "第一步放入 URL，第二步选择你要的结果，第三步启动 Genie 分析。",
      flowPasteUrl: "放入 URL",
      flowChooseResult: "选择你要的结果",
      flowRunAnalysis: "Genie 开始分析",
      resultIntents: {
        whyViral: {
          title: "为什么会爆？",
          desc: "拆解原内容的钩子、节奏、情绪、信任点和行动召唤。",
          bestFor:
            "适用于 TikTok、YouTube Shorts、Instagram Reels、抖音、小红书和 B 站视频链接。",
        },
        rewrite: {
          title: "重写这个创意",
          desc: "把同一套爆款结构改写成适合你品牌的新角度。",
          bestFor:
            "适合把 TikTok、Reels、Shorts、抖音或小红书内容改写成新文案和新选题。",
        },
        prompts: {
          title: "生成图片提示词",
          desc: "根据视频场景和信息，生成 Midjourney 与 DALL-E 提示词。",
          bestFor:
            "适用于 Instagram、小红书、Pinterest 风格图文，以及视觉广告素材。",
        },
        script: {
          title: "撰写视频脚本",
          desc: "生成 15 秒短视频脚本、场景节奏、镜头提示和 CTA。",
          bestFor:
            "适用于 TikTok、Instagram Reels、YouTube Shorts、抖音和 B 站短视频。",
        },
        accounts: {
          title: "查找竞品账号",
          desc: "从官网或主页提取官方社媒链接、Handle 和平台布局。",
          bestFor:
            "适用于公司官网和创作者主页，可查 Instagram、YouTube、TikTok、X、LinkedIn、小红书等账号。",
        },
        outreach: {
          title: "创建外联页面",
          desc: "把分析结果变成一个可用于分享、Cold outreach 或测试的页面草稿。",
          bestFor:
            "适用于分析任意社媒或网站 URL 后，生成可用于邮件、LinkedIn 或社媒外联的简洁页面。",
        },
      },
      workflowHeading: "从竞品链接到新内容",
      workflowHelper:
        "从一条已验证的爆款内容，快速生成你可以复用和测试的新创意资产。",
      workflowSteps: [
        "粘贴爆款 URL",
        "选择目标结果",
        "拆解爆款逻辑",
        "重组新创意",
        "发布或测试",
      ],
      workspaceHeading: "选择工作区",
      workspaceHelper:
        "工作区会切换推荐的分析路径，但整体仍然保持单一 URL 工作流。",
      micrositeHelper:
        "Launch Page 会基于信号分析和创作输出生成。当前先从下面推荐的分析入口开始。",
      urlLabel: "要分析的 URL",
      urlPlaceholder: "粘贴 TikTok、YouTube 或 Instagram 链接...",
      detected: "已识别",
      noDetection: "输入 URL 以识别平台",
      routePreview: "路由",
      typeHeading: "分析类型",
      selectedResult: "已选择结果",
      submit: "Genie 开始分析",
      submitting: "启动中...",
      stepperHeading: "进度",
      reportHeading: "分析报告",
      priorityHeading: "可直接使用的输出",
      priorityHelper:
        "先看这里：这次分析中最有用的创意角度、相关链接、图片提示词和 15 秒脚本。",
      fullDetailsHeading: "完整分析详情",
      fullDetailsHelper:
        "需要支撑信息、账号地图和更完整拆解时，再展开这一部分。",
      newAnalysis: "新建分析",
      errorTitle: "分析失败",
    },
    types: {
      script_teardown: {
        name: "爆款拆解",
        desc: "拆解短视频内容的钩子、节奏、情绪弧线和行动召唤。",
      },
      product_compare: {
        name: "产品对比",
        desc: "提取产品页的功能、定价与用户痛点。",
      },
      viral_rewrite: {
        name: "创意重写",
        desc: "把已验证的爆款结构重组成新的钩子、文案和内容角度。",
      },
      seo_audit: {
        name: "SEO 审计",
        desc: "评估 Meta 标签、标题层级、内容、链接,给出优化建议。",
      },
      content_rewrite: {
        name: "内容重写",
        desc: "生成 SEO 优化的全新版本,结构更清晰、CTA 更有力。",
      },
      competitive_strategy: {
        name: "内容定位",
        desc: "读取创作者或品牌的内容定位、受众、主题结构与机会缺口。",
      },
      backlink_intel: {
        name: "查找官方账号",
        desc: "找出品牌或创作者的官方社媒、媒体足迹，以及它们之间的连接关系。",
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
        instagram: "Instagram",
        douyin: "抖音",
        xiaohongshu: "小红书",
        bilibili: "哔哩哔哩",
        x: "X / 推特",
        blog: "网站",
      ecommerce: "电商",
      other: "其他",
    },
    engines: {
      tikhub: "TikHub",
      rnote: "RNote",
      supadata: "Supadata",
      firecrawl: "Firecrawl",
      apify: "Apify",
    },
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
      overallScore: "整体评分",
      metaTags: "Meta 标签",
      headings: "标题层级",
      content: "内容",
      links: "链接",
      recommendations: "优化建议",
      improvedTitle: "改进标题",
      improvedContent: "改进内容",
      changes: "改动详情",
      seoImprovements: "SEO 优化点",
      positioning: "市场定位",
      messaging: "信息传达",
      contentStrategy: "内容策略",
      uxEvaluation: "UX 评估",
      actionPlan: "行动计划",
      exposureSummary: "品牌概览",
      likelyFeaturedSources: "官方账号",
      linkOpportunities: "分发机会",
      outreachAngles: "创意角度",
      contentIdeas: "相关连接",
      sourceType: "平台",
      pitchAngle: "证据",
      opportunityType: "存在状态",
      pitchIdea: "机会说明",
      accountName: "账号名称",
      handle: "账号 Handle",
      officialAccounts: "官方账号",
      platformPresence: "平台布局",
      ownedChannels: "自有渠道",
      communitySignals: "社区信号",
      mediaSignals: "媒体信号",
      crossPlatformFlow: "跨平台路径",
      relatedConnections: "相关连接",
      whyItMatters: "价值说明",
      distributionOpportunities: "分发机会",
      creativeAngles: "创意角度",
      creativePack: "Creator Pack",
      imagePrompts: "图片提示词",
      midjourney: "Midjourney",
      dalle: "DALL-E",
      videoScript15s: "15 秒视频脚本",
      shotPrompts: "镜头提示词",
      shotPlan: "镜头分镜",
      readyToPostCopy: "可直接发布文案",
      hookOptions: "钩子选项",
      outreachCopy: "外联文案",
      generateImage: "生成封面图",
      generatingImage: "正在生成图片...",
      generatedImage: "已生成封面图",
      generateVideoDraft: "生成 15 秒视频草稿",
      generatingVideoDraft: "正在生成视频草稿...",
      generatedVideoDraft: "已生成视频草稿",
      sceneClips: "场景片段",
      generationStatus: "生成状态",
      generationError: "生成错误",
      visualDirection: "视觉方向",
      socialLinks: "社交链接",
      tone: "语气",
      keyThemes: "核心主题",
      gaps: "缺口/机会",
      wordCount: "字数",
      keywordDensity: "关键词密度",
      readability: "可读性",
      internal: "站内",
      external: "外链",
      broken: "失效",
      issues: "问题",
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
    workspace: {
      connections: {
        label: "Signal Map",
        desc: "梳理账号、平台、媒体足迹和跨平台关系。",
      },
      creative: {
        label: "Creator Pack",
        desc: "把一个 URL 变成提示词、脚本、钩子和可直接发布文案。",
      },
      microsite: {
        label: "Launch Page",
        desc: "把分析结果整理成一个轻量、适合外联的落地页 brief。",
      },
    },
  },
} as const;

const i18n = baseI18n;

function detectBrowserLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  const langs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const value of langs) {
    const lower = value.toLowerCase();
    if (lower.startsWith("zh")) return "zh";
    if (lower.startsWith("en")) return "en";
  }
  return "en";
}

// ============================================================================
// Platform routing (mirrors src/lib/url-router server-side logic)
// ============================================================================

interface RouteResult {
  engine: Engine;
  platform: Platform;
}

function normalizeUrlForFetch(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function detectPlatform(rawUrl: string): RouteResult | null {
  const candidate = normalizeUrlForFetch(rawUrl);
  if (!candidate) return null;
  let h: string;
  try {
    h = new URL(candidate).hostname.toLowerCase();
  } catch {
    return null;
  }
  // Require at least one dot in the hostname (excludes "localhost", "foo", etc.)
  if (!h.includes(".")) return null;

  if (
    h === "youtube.com" ||
    h.endsWith(".youtube.com") ||
    h === "youtu.be" ||
    h === "m.youtube.com"
  ) {
    return { engine: "tikhub", platform: "youtube" };
  }
  if (h === "tiktok.com" || h.endsWith(".tiktok.com") || h === "vm.tiktok.com") {
    return { engine: "tikhub", platform: "tiktok" };
  }
  if (h === "instagram.com" || h.endsWith(".instagram.com")) {
    return { engine: "tikhub", platform: "instagram" };
  }
  if (
    h === "douyin.com" ||
    h.endsWith(".douyin.com") ||
    h === "iesdouyin.com" ||
    h.endsWith(".iesdouyin.com")
  ) {
    return { engine: "tikhub", platform: "douyin" };
  }
  if (
    h === "xiaohongshu.com" ||
    h.endsWith(".xiaohongshu.com") ||
    h === "xhslink.com" ||
    h.endsWith(".xhslink.com")
  ) {
    return { engine: "tikhub", platform: "xiaohongshu" };
  }
  if (h === "bilibili.com" || h.endsWith(".bilibili.com") || h === "b23.tv") {
    return { engine: "tikhub", platform: "bilibili" };
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
  instagram: "bg-pink-500 text-white",
  douyin: "bg-rose-600 text-white",
  xiaohongshu: "bg-red-600 text-white",
  bilibili: "bg-sky-400 text-white",
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
  // useId() returns a stable id that matches between SSR and client hydration.
  // Sanitize colons so the value is safe inside fill="url(#id)" everywhere.
  const id = `gg-${useId().replace(/:/g, "")}`;
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

function Stepper({
  status,
  lang,
}: {
  status: TaskStatus;
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
      {(status === "crawling" || status === "analyzing") && (
        <div className="mt-4 text-center text-sm text-zinc-500">
          {t.workingHint}
        </div>
      )}
    </div>
  );
}

type ReportLeftAccent =
  | "purple"
  | "teal"
  | "coral"
  | "sky"
  | "green"
  | "indigo";

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
    sky: "border-l-4 border-l-sky-500",
    green: "border-l-4 border-l-green-500",
    indigo: "border-l-4 border-l-indigo-500",
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

function CreativePackView({
  pack,
  lang,
  compact = false,
}: {
  pack?: CreativePack;
  lang: Lang;
  compact?: boolean;
}) {
  if (!pack) return null;
  const s = i18n[lang].sections;
  const hasImagePrompt =
    !!pack.imagePrompts?.midjourney || !!pack.imagePrompts?.dalle;
  const hasVideo = !!pack.videoScript15s || !!pack.shotPrompts?.length;
  const hasCopy = !!pack.readyToPostCopy?.length;
  const hasHooks = !!pack.hookOptions?.length;
  const hasOutreach = !!pack.outreachCopy?.length;
  if (!hasImagePrompt && !hasVideo && !hasCopy && !hasHooks && !hasOutreach) {
    return null;
  }

  const gridClass = compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2";
  const list = (items?: string[]) =>
    items && items.length > 0 ? (
      <ul className="list-disc pl-5 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="whitespace-pre-wrap">
            {item}
          </li>
        ))}
      </ul>
    ) : (
      <p>—</p>
    );

  return (
    <div className="mt-6">
      <h3
        className="text-lg font-bold text-zinc-900 mb-3"
        style={{ fontFamily: "var(--font-sora)" }}
      >
        {s.creativePack}
      </h3>
      <div className={gridClass}>
        <ReportCard title={s.imagePrompts} icon="🖼️" accent="purple" leftAccent="purple">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1">
                {s.midjourney}
              </p>
              <p className="whitespace-pre-wrap">
                {pack.imagePrompts?.midjourney ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1">
                {s.dalle}
              </p>
              <p className="whitespace-pre-wrap">
                {pack.imagePrompts?.dalle ?? "—"}
              </p>
            </div>
          </div>
        </ReportCard>
        <ReportCard title={s.videoScript15s} icon="🎥" accent="sky" leftAccent="purple">
          <p className="whitespace-pre-wrap mb-4">
            {pack.videoScript15s ?? "—"}
          </p>
          <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-2">
            {s.shotPrompts}
          </p>
          {list(pack.shotPrompts)}
        </ReportCard>
        <ReportCard title={s.hookOptions} icon="🪝" accent="amber" leftAccent="purple">
          {list(pack.hookOptions)}
        </ReportCard>
        <div className={compact ? "" : "md:col-span-2"}>
          <ReportCard
            title={s.readyToPostCopy}
            icon="✉️"
            accent="emerald"
            leftAccent="purple"
            highlighted
          >
            {list(pack.readyToPostCopy)}
          </ReportCard>
        </div>
        <div className={compact ? "" : "md:col-span-2"}>
          <ReportCard
            title={s.outreachCopy}
            icon="📣"
            accent="rose"
            leftAccent="purple"
          >
            {list(pack.outreachCopy)}
          </ReportCard>
        </div>
      </div>
    </div>
  );
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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readProviderTrace(task: Task): ProviderTraceRecord | null {
  const report = asObject(task.report);
  const studio = asObject(report.studio);
  const rawData = asObject(task.rawData);
  const metadata = asObject(rawData.metadata);
  const trace =
    studio.providerTrace ?? report.providerTrace ?? metadata.providerTrace;
  return trace && typeof trace === "object" && !Array.isArray(trace)
    ? (trace as ProviderTraceRecord)
    : null;
}

function formatElapsed(createdAt: string, lang: Lang): string {
  const startedAt = new Date(createdAt).getTime();
  if (Number.isNaN(startedAt)) return "";
  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (lang === "zh") {
    return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
  }
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function progressHint(status: TaskStatus, lang: Lang): string {
  if (lang === "zh") {
    if (status === "crawling") {
      return "正在抓取页面与社媒连接，通常需要几十秒。";
    }
    if (status === "analyzing") {
      return "正在整理账号、连接关系和创作资产，完整官网分析通常需要 1 到 2 分钟。";
    }
    return "你也可以稍后从 Library 回来看结果。";
  }
  if (status === "crawling") {
    return "We are pulling the page and its social connection signals now. This usually takes a few seconds.";
  }
  if (status === "analyzing") {
    return "We are organizing accounts, relationships, and creator assets now. Full website analysis often takes 1 to 2 minutes.";
  }
  return "You can reopen this anytime from Library.";
}

function progressReassurance(lang: Lang): string {
  return lang === "zh"
    ? "你可以离开这个页面，稍后在 Library 里继续查看。"
    : "You can leave this page and reopen the run later from Library.";
}

function compactDisplayTitle(value: string, fallback: string): string {
  const source = value.trim();
  if (!source) return fallback;
  const firstLine = source.split(/\n+/).find(Boolean)?.trim() ?? source;
  const firstSentence = firstLine.split(/(?<=[.!?])\s+/)[0]?.trim() ?? firstLine;
  const collapsed = firstSentence.replace(/\s+/g, " ");
  if (collapsed.length <= 96) return collapsed;
  return `${collapsed.slice(0, 93).trimEnd()}...`;
}

function readSocialProfilesFromRawData(rawData: unknown): SocialProfileRecord[] {
  const metadata = asObject(asObject(rawData).metadata);
  const value = metadata.socialProfiles;
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const profile = item as Record<string, unknown>;
    return [
      {
        platform:
          typeof profile.platform === "string" ? profile.platform : undefined,
        url: typeof profile.url === "string" ? profile.url : undefined,
        canonicalUrl:
          typeof profile.canonicalUrl === "string"
            ? profile.canonicalUrl
            : undefined,
        handle: typeof profile.handle === "string" ? profile.handle : undefined,
        accountPath:
          typeof profile.accountPath === "string"
            ? profile.accountPath
            : undefined,
        accountName:
          typeof profile.accountName === "string"
            ? profile.accountName
            : undefined,
        hostname:
          typeof profile.hostname === "string" ? profile.hostname : undefined,
        evidence: Array.isArray(profile.evidence)
          ? profile.evidence.filter(
              (entry): entry is string => typeof entry === "string",
            )
          : undefined,
        confidence:
          profile.confidence === "high" ? "high" : "medium",
      } satisfies SocialProfileRecord,
    ];
  });
}

function mergeOfficialAccounts(
  reportAccounts: BacklinkSource[] | undefined,
  rawData: unknown,
): BacklinkSource[] {
  const merged = new Map<string, BacklinkSource>();
  const rawProfiles = readSocialProfilesFromRawData(rawData);

  for (const profile of rawProfiles) {
    const key =
      profile.canonicalUrl ??
      profile.url ??
      `${profile.platform ?? "other"}:${profile.handle ?? profile.accountPath ?? ""}`;
    merged.set(key, {
      platform: profile.platform,
      accountName: profile.accountName,
      handle: profile.handle
        ? `@${profile.handle}`
        : profile.accountPath && profile.accountPath.startsWith("@")
          ? profile.accountPath
          : profile.handle,
      url: profile.canonicalUrl ?? profile.url,
      evidence: profile.evidence?.join("; ") ?? "",
    });
  }

  for (const account of reportAccounts ?? []) {
    const key =
      account.url ??
      `${account.platform ?? "other"}:${account.handle ?? account.accountName ?? ""}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, account);
      continue;
    }

    merged.set(key, {
      platform: existing.platform ?? account.platform,
      accountName: existing.accountName ?? account.accountName,
      handle: existing.handle ?? account.handle,
      url: existing.url ?? account.url,
      evidence: [existing.evidence, account.evidence].filter(Boolean).join("; "),
    });
  }

  return [...merged.values()];
}

function resolvedSignalMap(task: Task): SignalMapPanel {
  const report = (task.report ?? {}) as Record<string, unknown> & {
    studio?: StudioEnvelope;
    signalMap?: SignalMapPanel;
  };

  return report.studio?.signalMap ?? report.signalMap ?? (report as SignalMapPanel);
}

function resolvedLaunchPage(task: Task, lang: Lang): LaunchPagePanel {
  const report = (task.report ?? {}) as Record<string, unknown> & {
    launchPage?: LaunchPagePanel;
    studio?: StudioEnvelope;
  };
  const studio = report.studio ?? {};
  const existing = studio.launchPage ?? report.launchPage;
  if (existing?.title) return existing;

  const fallback = buildMicrositeDraft(task, lang);
  return {
    title: fallback.title,
    subtitle: fallback.subtitle,
    heroCta: fallback.cta,
    sections: fallback.sections.map((body, index) => ({
      title:
        lang === "zh"
          ? ["核心信号", "传播角度", "创作资产", "行动方向"][index] ??
            `Section ${index + 1}`
          : ["Core Signal", "Distribution Angle", "Creator Asset", "Next Action"][
              index
            ] ?? `Section ${index + 1}`,
      body,
    })),
    socialLinks: [],
    visualDirection: "",
    outreachCopy: [],
  };
}

function summarizeConnectionOutput(task: Task): {
  eyebrow: string;
  summary: string;
  bullets: string[];
} {
  const report = (task.report ?? {}) as Record<string, unknown>;
  const studio = (report.studio ?? {}) as StudioEnvelope;
  const type = task.promptType as AnalysisType | undefined;

  if (studio.connections?.summary) {
    return {
      eyebrow: studio.connections.title ?? "Signal Map",
      summary: studio.connections.summary,
      bullets: studio.connections.bullets ?? [],
    };
  }

  if (type === "backlink_intel") {
    const signalMap = resolvedSignalMap(task);
    const featured = Array.isArray(signalMap.officialAccounts)
      ? signalMap.officialAccounts
      : [];
    const sites = featured
      .map((item) =>
        item && typeof item === "object" && typeof item.url === "string"
          ? item.url
          : "",
      )
      .filter(Boolean)
      .slice(0, 4);
    return {
      eyebrow: "Signal Map",
      summary:
        typeof signalMap.brandSummary === "string"
          ? signalMap.brandSummary
          : "Brand and social connection signals extracted from the source.",
      bullets:
        sites.length > 0
          ? sites
          : flattenStrings(signalMap.distributionOpportunities, 4).slice(0, 4),
    };
  }

  if (type === "competitive_strategy") {
    return {
      eyebrow: "Content Positioning",
      summary:
        typeof report.positioning === "string"
          ? report.positioning
          : "Audience, positioning, and platform signals extracted from the source.",
      bullets: flattenStrings(report.messaging, 4).slice(0, 4),
    };
  }

  if (type === "script_teardown") {
    return {
      eyebrow: "Video Structure",
      summary:
        typeof report.hook === "string"
          ? report.hook
          : "Narrative and pacing signals extracted from the video.",
      bullets: flattenStrings(report.keyTakeaways, 4).slice(0, 4),
    };
  }

  if (type === "viral_rewrite") {
    return {
      eyebrow: "Creative Angle",
      summary:
        typeof report.originalAnalysis === "string"
          ? report.originalAnalysis
          : "Reframed angles and creative patterns extracted from the source.",
      bullets: flattenStrings(report.variants, 4).slice(0, 4),
    };
  }

  if (type === "content_rewrite") {
    return {
      eyebrow: "Content Rewrite",
      summary:
        typeof report.originalAnalysis === "string"
          ? report.originalAnalysis
          : "Core messaging and rewrite opportunities extracted from the source.",
      bullets: flattenStrings(report.changes, 4).slice(0, 4),
    };
  }

  return {
    eyebrow: "Analysis",
    summary: "Signals extracted from the source URL.",
    bullets: flattenStrings(report, 4).slice(0, 4),
  };
}

function buildMicrositeDraft(task: Task, lang: Lang): {
  title: string;
  subtitle: string;
  sections: string[];
  cta: string;
} {
  const report = (task.report ?? {}) as Record<string, unknown>;
  const studio = (report.studio ?? {}) as StudioEnvelope;
  const launchPage =
    studio.launchPage ?? ((report.launchPage ?? null) as LaunchPagePanel | null);
  if (launchPage?.title) {
    return {
      title: launchPage.title,
      subtitle: launchPage.subtitle ?? "",
      sections: (launchPage.sections ?? [])
        .map((item) => item.body ?? "")
        .filter(Boolean),
      cta: launchPage.heroCta ?? "",
    };
  }
  if (studio.micrositeDraft?.title) {
    return {
      title: studio.micrositeDraft.title,
      subtitle: studio.micrositeDraft.subtitle ?? "",
      sections: studio.micrositeDraft.sections ?? [],
      cta: studio.micrositeDraft.cta ?? "",
    };
  }
  const typeLabel =
    i18n[lang].types[(task.promptType as AnalysisType) ?? "script_teardown"]
      ?.name ?? "Analysis";
  const connection = summarizeConnectionOutput(task);
  const pack =
    studio.creativePack ??
    ((report.creatorPack ?? report.creativePack ?? {}) as CreativePack);

  const titleCandidates = [
    typeof report.improvedTitle === "string" ? report.improvedTitle : "",
    typeof report.hook === "string" ? report.hook : "",
    typeof report.positioning === "string" ? report.positioning : "",
    typeof report.brandSummary === "string" ? report.brandSummary : "",
    typeof report.originalAnalysis === "string" ? report.originalAnalysis : "",
  ].filter(Boolean);

  const title = titleCandidates[0] || `${typeLabel} Launch Page`;
  const subtitle =
    lang === "zh"
      ? `基于 ${task.urlType} 来源生成的单页草稿，用于快速展示、外联和社媒分发。`
      : `A lightweight one-page draft generated from this ${task.urlType} source for outreach, sharing, and fast launch.`;

  const sections = [
    connection.summary,
    ...connection.bullets,
    ...(pack.readyToPostCopy?.slice(0, 2) ?? []),
  ].filter(Boolean).slice(0, 4);

  const cta =
    lang === "zh"
      ? "用这条内容方向发起合作、分享或下一轮创作。"
      : "Use this angle to launch outreach, sharing, or the next content iteration.";

  return { title, subtitle, sections, cta };
}

function StudioOutputOverview({
  task,
  lang,
}: {
  task: Task;
  lang: Lang;
}) {
  const connection = summarizeConnectionOutput(task);
  const report = (task.report ?? {}) as {
    creativePack?: CreativePack;
    creatorPack?: CreativePack;
    studio?: StudioEnvelope;
  };
  const pack = report.studio?.creativePack ?? report.creatorPack ?? report.creativePack;
  const microsite = buildMicrositeDraft(task, lang);
  const launchPage = resolvedLaunchPage(task, lang);
  const cards = [
    {
      title: i18n[lang].workspace.connections.label,
      icon: "🕸️",
      text: connection.summary,
    },
    {
      title: i18n[lang].workspace.creative.label,
      icon: "✨",
      text:
        pack?.videoScript15s ||
        pack?.readyToPostCopy?.[0] ||
        (lang === "zh"
          ? "已从分析结果中生成创作资产。"
          : "Creative outputs have been generated from the analysis."),
    },
    {
      title: i18n[lang].workspace.microsite.label,
      icon: "🧱",
      text: launchPage.subtitle ?? microsite.subtitle,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <span aria-hidden>{card.icon}</span>
            <span style={{ fontFamily: "var(--font-sora)" }}>{card.title}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-600 line-clamp-5">
            {card.text}
          </p>
        </div>
      ))}
    </div>
  );
}

function resolvedCreativePack(task: Task): CreativePack | undefined {
  const report = (task.report ?? {}) as {
    creativePack?: CreativePack;
    creatorPack?: CreativePack;
    studio?: StudioEnvelope;
  };
  return report.studio?.creativePack ?? report.creatorPack ?? report.creativePack;
}

function hasPendingGeneratedVideo(task: Task | null): boolean {
  if (!task) return false;
  const draft = resolvedCreativePack(task)?.generatedVideoDraft;
  if (!draft) return false;
  return (
    draft.status === "pending" ||
    draft.status === "running" ||
    draft.scenes?.some(
      (scene) => scene.status === "pending" || scene.status === "running",
    ) === true
  );
}

function PriorityResultsView({
  task,
  lang,
  onTaskUpdated,
}: {
  task: Task;
  lang: Lang;
  onTaskUpdated?: (task: Task) => void;
}) {
  const s = i18n[lang].sections;
  const t = i18n[lang].analyze;
  const [imageBusy, setImageBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const signalMap = resolvedSignalMap(task);
  const pack = resolvedCreativePack(task);
  const creativeAngles = signalMap.creativeAngles?.filter(Boolean).slice(0, 5) ?? [];
  const relatedLinks = signalMap.relatedConnections?.slice(0, 4) ?? [];
  const hasImagePrompt =
    !!pack?.imagePrompts?.midjourney || !!pack?.imagePrompts?.dalle;
  const hasVideo =
    !!pack?.videoScript15s || !!pack?.shotPrompts?.length || !!pack?.shotPlan?.length;
  const hasAny =
    creativeAngles.length > 0 ||
    relatedLinks.length > 0 ||
    hasImagePrompt ||
    hasVideo;

  const runGeneration = async (kind: "image" | "video") => {
    const setter = kind === "image" ? setImageBusy : setVideoBusy;
    setter(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/generate/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : `Failed to generate ${kind}`,
        );
      }
      if (payload.task) {
        onTaskUpdated?.(payload.task as Task);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setter(false);
    }
  };

  if (!hasAny) {
    return <StudioOutputOverview task={task} lang={lang} />;
  }

  const cards: React.ReactNode[] = [];

  if (creativeAngles.length > 0) {
    cards.push(
      <ReportCard
        key="creative-angles"
        title={s.creativeAngles}
        icon="🎯"
        accent="amber"
        leftAccent="purple"
        highlighted
      >
        <ul className="list-disc pl-5 space-y-2">
          {creativeAngles.map((item, index) => (
            <li key={`${item}-${index}`} className="whitespace-pre-wrap">
              {item}
            </li>
          ))}
        </ul>
      </ReportCard>,
    );
  }

  if (relatedLinks.length > 0) {
    cards.push(
      <ReportCard
        key="related-connections"
        title={s.relatedConnections}
        icon="🔗"
        accent="emerald"
        leftAccent="teal"
      >
        <ul className="space-y-3">
          {relatedLinks.map((item, index) => (
            <li key={`${item.url ?? item.name ?? "link"}-${index}`}>
              <div className="font-semibold text-zinc-900">
                {item.name ?? item.url ?? "Related link"}
              </div>
              <p className="text-sm text-zinc-600 break-all">
                {item.url ?? "—"}
              </p>
              {item.whyItMatters && (
                <p className="mt-1 text-xs leading-5 text-emerald-700">
                  {item.whyItMatters}
                </p>
              )}
            </li>
          ))}
        </ul>
      </ReportCard>,
    );
  }

  if (hasImagePrompt) {
    cards.push(
      <ReportCard
        key="image-prompts"
        title={s.imagePrompts}
        icon="🖼️"
        accent="purple"
        leftAccent="indigo"
      >
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1">
              {s.midjourney}
            </p>
            <p className="whitespace-pre-wrap">
              {pack?.imagePrompts?.midjourney ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1">
              {s.dalle}
            </p>
            <p className="whitespace-pre-wrap">
              {pack?.imagePrompts?.dalle ?? "—"}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => void runGeneration("image")}
              disabled={imageBusy}
              className="rounded-full border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition-all hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {imageBusy ? s.generatingImage : s.generateImage}
            </button>
          </div>
          {pack?.generatedCoverImage?.dataUrl ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <p className="mb-2 text-xs uppercase tracking-wide font-semibold text-zinc-500">
                {s.generatedImage}
              </p>
              <Image
                src={pack.generatedCoverImage.dataUrl}
                alt={s.generatedImage}
                width={1024}
                height={1024}
                className="w-full rounded-xl border border-zinc-200 object-cover"
              />
            </div>
          ) : null}
        </div>
      </ReportCard>,
    );
  }

  if (hasVideo) {
    cards.push(
      <ReportCard
        key="video-script"
        title={s.videoScript15s}
        icon="🎥"
        accent="sky"
        leftAccent="sky"
      >
        <p className="whitespace-pre-wrap mb-4">
          {pack?.videoScript15s ?? "—"}
        </p>
        <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-2">
          {pack?.shotPlan && pack.shotPlan.length > 0 ? s.shotPlan : s.shotPrompts}
        </p>
        {pack?.shotPlan && pack.shotPlan.length > 0 ? (
          <ul className="space-y-3">
            {pack.shotPlan.map((item) => (
              <li key={`${item.index}-${item.startTime}`} className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {item.startTime} - {item.endTime}
                </div>
                <div className="mt-1 font-semibold text-zinc-900">{item.label}</div>
                {item.beat ? (
                  <p className="mt-1 text-sm text-zinc-600 whitespace-pre-wrap">
                    {item.beat}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-zinc-700 whitespace-pre-wrap">
                  {item.prompt}
                </p>
              </li>
            ))}
          </ul>
        ) : pack?.shotPrompts && pack.shotPrompts.length > 0 ? (
          <ul className="list-disc pl-5 space-y-2">
            {pack.shotPrompts.map((item, index) => (
              <li key={`${item}-${index}`} className="whitespace-pre-wrap">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p>—</p>
        )}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void runGeneration("video")}
            disabled={videoBusy}
            className="rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition-all hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {videoBusy ? s.generatingVideoDraft : s.generateVideoDraft}
          </button>
        </div>
        {pack?.generatedVideoDraft ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
              <div className="font-semibold text-zinc-900">{s.generationStatus}</div>
              <div className="mt-1">
                {pack.generatedVideoDraft.status ?? "pending"}
              </div>
            </div>
            {pack.generatedVideoDraft.scenes && pack.generatedVideoDraft.scenes.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500">
                  {s.sceneClips}
                </p>
                {pack.generatedVideoDraft.scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="rounded-xl border border-zinc-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-zinc-900">{scene.label}</div>
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        {scene.status}
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 whitespace-pre-wrap">
                      {scene.prompt}
                    </p>
                    {scene.outputUrl ? (
                      <video
                        className="mt-3 w-full rounded-xl border border-zinc-200"
                        controls
                        src={scene.outputUrl}
                      />
                    ) : null}
                    {scene.error ? (
                      <p className="mt-2 text-sm text-rose-700">
                        {s.generationError}: {scene.error}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </ReportCard>,
    );
  }

  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4">
        <h3
          className="text-lg font-bold text-zinc-900"
          style={{ fontFamily: "var(--font-sora)" }}
        >
          {t.priorityHeading}
        </h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          {t.priorityHelper}
        </p>
      </div>

      {actionError ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {actionError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">{cards}</div>
    </section>
  );
}

function FullReportDetails({
  task,
  lang,
  compact = false,
}: {
  task: Task;
  lang: Lang;
  compact?: boolean;
}) {
  const t = i18n[lang].analyze;
  return (
    <details className="group rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm md:p-6">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              className="text-lg font-bold text-zinc-900"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              {t.fullDetailsHeading}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {t.fullDetailsHelper}
            </p>
          </div>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 group-open:hidden">
            Open
          </span>
          <span className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 group-open:inline-flex">
            Close
          </span>
        </div>
      </summary>
      <div className="mt-5 space-y-6">
        <ReportRenderer task={task} lang={lang} compact={compact} includeCreativePack={false} />
        <MicrositeDraftView task={task} lang={lang} />
      </div>
    </details>
  );
}

function MicrositeDraftView({
  task,
  lang,
}: {
  task: Task;
  lang: Lang;
}) {
  const draft = resolvedLaunchPage(task, lang);
  const s = i18n[lang].sections;
  const sectionTitle =
    lang === "zh" ? "Page Draft" : "Page Draft";
  const badgeTitle =
    lang === "zh" ? "OUTREACH DRAFT" : "OUTREACH DRAFT";
  const displayTitle = compactDisplayTitle(
    draft.title ?? "",
    lang === "zh" ? "用于分享和外联的页面草稿" : "A page draft for outreach and sharing",
  );
  return (
    <div className="mt-6">
      <h3
        className="text-base font-semibold text-zinc-900 mb-3"
        style={{ fontFamily: "var(--font-sora)" }}
      >
        {sectionTitle}
      </h3>
      <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="rounded-[24px] border border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-emerald-50/40 p-6">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              {badgeTitle}
            </span>
            <h4
              className="mt-4 text-xl font-bold leading-tight text-zinc-950 md:text-2xl"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              {displayTitle}
            </h4>
            <p className="mt-3 text-sm leading-7 text-zinc-600 md:text-base">
              {draft.subtitle}
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(draft.sections ?? []).map((section, index) => (
              <div
                key={`${section.title ?? "section"}-${index}`}
                className="rounded-2xl border border-zinc-200 bg-white/75 p-4 text-sm leading-6 text-zinc-700"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {section.title ?? `Section ${index + 1}`}
                </p>
                <p className="whitespace-pre-wrap">{section.body ?? "—"}</p>
              </div>
            ))}
          </div>

          {draft.socialLinks && draft.socialLinks.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {s.socialLinks}
              </p>
              <div className="flex flex-wrap gap-2">
                {draft.socialLinks.map((link, index) => (
                  <span
                    key={`${link.url ?? link.platform ?? "link"}-${index}`}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    {link.platform ?? "Social"} · {link.label ?? link.url ?? "—"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {draft.visualDirection && (
            <div className="mt-6 rounded-2xl border border-purple-200 bg-purple-50/70 px-4 py-3 text-sm leading-6 text-purple-950">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-purple-700">
                {s.visualDirection}
              </p>
              {draft.visualDirection}
            </div>
          )}

          {draft.outreachCopy && draft.outreachCopy.length > 0 && (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {draft.outreachCopy.slice(0, 4).map((copy, index) => (
                <div
                  key={`${copy}-${index}`}
                  className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm leading-6 text-amber-950"
                >
                  {copy}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {draft.heroCta ?? "Launch outreach from this angle"}
          </div>
        </div>
      </div>
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

function SeoAuditView({
  report,
  lang,
  compact = false,
}: {
  report: SeoAuditReport;
  lang: Lang;
  compact?: boolean;
}) {
  const s = i18n[lang].sections;
  const left: ReportLeftAccent = "sky";
  const gridClass = compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2";
  const score = typeof report.overallScore === "number" ? report.overallScore : null;
  const scoreColor =
    score === null
      ? "text-zinc-500"
      : score >= 80
        ? "text-emerald-600"
        : score >= 60
          ? "text-amber-600"
          : "text-rose-600";

  const renderList = (items?: string[]) =>
    items && items.length > 0 ? (
      <ul className="list-disc pl-5 space-y-1.5">
        {items.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    ) : (
      <p>—</p>
    );

  return (
    <div className={gridClass}>
      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard title={s.overallScore} icon="📊" leftAccent={left} highlighted>
          <div className="flex items-baseline gap-3">
            <span
              className={`text-5xl font-bold ${scoreColor}`}
              style={{ fontFamily: "var(--font-sora)" }}
            >
              {score === null ? "—" : score}
            </span>
            <span className="text-sm text-zinc-500">/ 100</span>
          </div>
        </ReportCard>
      </div>

      <ReportCard title={s.metaTags} icon="🏷️" accent="sky" leftAccent={left}>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-semibold text-zinc-700">Title:</span>{" "}
            <span>{report.metaTags?.title ?? "—"}</span>
          </div>
          <div>
            <span className="font-semibold text-zinc-700">Description:</span>{" "}
            <span>{report.metaTags?.description ?? "—"}</span>
          </div>
          <div>
            <span className="font-semibold text-zinc-700">Keywords:</span>{" "}
            <span>
              {report.metaTags?.keywords?.length
                ? report.metaTags.keywords.join(", ")
                : "—"}
            </span>
          </div>
          {report.metaTags?.issues && report.metaTags.issues.length > 0 && (
            <div>
              <p className="font-semibold text-rose-700 mt-2">{s.issues}:</p>
              {renderList(report.metaTags.issues)}
            </div>
          )}
        </div>
      </ReportCard>

      <ReportCard title={s.headings} icon="📐" accent="purple" leftAccent={left}>
        <p className="whitespace-pre-wrap mb-2">
          {report.headings?.structure ?? "—"}
        </p>
        {report.headings?.issues && report.headings.issues.length > 0 && (
          <>
            <p className="font-semibold text-rose-700 text-sm mt-2">
              {s.issues}:
            </p>
            {renderList(report.headings.issues)}
          </>
        )}
      </ReportCard>

      <ReportCard title={s.content} icon="📝" accent="emerald" leftAccent={left}>
        <div className="space-y-1.5 text-sm">
          <div>
            <span className="font-semibold text-zinc-700">{s.wordCount}:</span>{" "}
            {report.content?.wordCount ?? "—"}
          </div>
          <div>
            <span className="font-semibold text-zinc-700">
              {s.keywordDensity}:
            </span>{" "}
            {report.content?.keywordDensity ?? "—"}
          </div>
          <div>
            <span className="font-semibold text-zinc-700">
              {s.readability}:
            </span>{" "}
            {report.content?.readability ?? "—"}
          </div>
        </div>
      </ReportCard>

      <ReportCard title={s.links} icon="🔗" accent="amber" leftAccent={left}>
        <div className="space-y-1.5 text-sm">
          <div>
            <span className="font-semibold text-zinc-700">{s.internal}:</span>{" "}
            {report.links?.internal ?? "—"}
          </div>
          <div>
            <span className="font-semibold text-zinc-700">{s.external}:</span>{" "}
            {report.links?.external ?? "—"}
          </div>
          {report.links?.broken && report.links.broken.length > 0 && (
            <div>
              <p className="font-semibold text-rose-700 mt-2">{s.broken}:</p>
              {renderList(report.links.broken)}
            </div>
          )}
        </div>
      </ReportCard>

      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.recommendations}
          icon="✅"
          leftAccent={left}
          highlighted
        >
          {report.recommendations && report.recommendations.length > 0 ? (
            <ol className="list-decimal pl-5 space-y-2">
              {report.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          ) : (
            <p>—</p>
          )}
        </ReportCard>
      </div>
    </div>
  );
}

function ContentRewriteView({
  report,
  lang,
  compact = false,
}: {
  report: ContentRewriteReport;
  lang: Lang;
  compact?: boolean;
}) {
  const s = i18n[lang].sections;
  const left: ReportLeftAccent = "green";
  const gridClass = compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2";

  return (
    <div className={gridClass}>
      {report.originalAnalysis && (
        <div className={compact ? "" : "md:col-span-2"}>
          <ReportCard
            title={s.originalAnalysis}
            icon="📋"
            accent="purple"
            leftAccent={left}
          >
            <p className="whitespace-pre-wrap">{report.originalAnalysis}</p>
          </ReportCard>
        </div>
      )}

      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.improvedTitle}
          icon="✨"
          leftAccent={left}
          highlighted
        >
          <p
            className="text-xl font-semibold text-zinc-900"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            {report.improvedTitle ?? "—"}
          </p>
        </ReportCard>
      </div>

      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.improvedContent}
          icon="✍️"
          accent="emerald"
          leftAccent={left}
        >
          <div className="whitespace-pre-wrap leading-relaxed">
            {report.improvedContent ?? "—"}
          </div>
        </ReportCard>
      </div>

      <ReportCard title={s.changes} icon="🔄" accent="sky" leftAccent={left}>
        {report.changes && report.changes.length > 0 ? (
          <ul className="space-y-3">
            {report.changes.map((c, i) => (
              <li key={i} className="border-l-2 border-zinc-200 pl-3">
                <div className="font-semibold text-zinc-800 text-sm">
                  {c.what ?? "—"}
                </div>
                <div className="text-xs text-zinc-600 mt-0.5">
                  {c.why ?? ""}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>—</p>
        )}
      </ReportCard>

      <ReportCard
        title={s.seoImprovements}
        icon="🚀"
        accent="amber"
        leftAccent={left}
      >
        {report.seoImprovements && report.seoImprovements.length > 0 ? (
          <ul className="list-disc pl-5 space-y-2">
            {report.seoImprovements.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        ) : (
          <p>—</p>
        )}
      </ReportCard>
    </div>
  );
}

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-rose-100 text-rose-700 ring-rose-300",
  medium: "bg-amber-100 text-amber-700 ring-amber-300",
  low: "bg-emerald-100 text-emerald-700 ring-emerald-300",
};

function CompetitiveStrategyView({
  report,
  lang,
  compact = false,
}: {
  report: CompetitiveStrategyReport;
  lang: Lang;
  compact?: boolean;
}) {
  const s = i18n[lang].sections;
  const left: ReportLeftAccent = "indigo";
  const gridClass = compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2";

  const renderList = (items?: string[]) =>
    items && items.length > 0 ? (
      <ul className="list-disc pl-5 space-y-1.5">
        {items.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    ) : (
      <p>—</p>
    );

  return (
    <div className={gridClass}>
      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.positioning}
          icon="🧭"
          accent="purple"
          leftAccent={left}
        >
          <p className="whitespace-pre-wrap">{report.positioning ?? "—"}</p>
        </ReportCard>
      </div>

      <ReportCard title={s.messaging} icon="💬" accent="sky" leftAccent={left}>
        <div className="space-y-2">
          <div>
            <span className="text-xs uppercase tracking-wide font-semibold text-zinc-500">
              {s.tone}
            </span>
            <p className="text-sm">{report.messaging?.tone ?? "—"}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide font-semibold text-zinc-500">
              {s.keyThemes}
            </span>
            {report.messaging?.keyThemes &&
            report.messaging.keyThemes.length > 0 ? (
              <ul className="list-disc pl-5 mt-1 space-y-1 text-sm">
                {report.messaging.keyThemes.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <p>—</p>
            )}
          </div>
        </div>
      </ReportCard>

      <ReportCard
        title={s.targetAudience}
        icon="🎯"
        accent="emerald"
        leftAccent={left}
      >
        <p className="whitespace-pre-wrap">{report.targetAudience ?? "—"}</p>
      </ReportCard>

      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.contentStrategy}
          icon="📈"
          accent="amber"
          leftAccent={left}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-emerald-700 mb-2">
                {s.strengths}
              </p>
              {renderList(report.contentStrategy?.strengths)}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-rose-700 mb-2">
                {s.gaps}
              </p>
              {renderList(report.contentStrategy?.gaps)}
            </div>
          </div>
        </ReportCard>
      </div>

      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard title={s.uxEvaluation} icon="🖥️" accent="rose" leftAccent={left}>
          <p className="whitespace-pre-wrap">{report.uxEvaluation ?? "—"}</p>
        </ReportCard>
      </div>

      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.actionPlan}
          icon="🏆"
          leftAccent={left}
          highlighted
        >
          {report.actionPlan && report.actionPlan.length > 0 ? (
            <ul className="space-y-3">
              {report.actionPlan.map((item, i) => {
                const pr = (item.priority ?? "medium").toLowerCase();
                const badgeClass =
                  PRIORITY_BADGE[pr] ?? PRIORITY_BADGE.medium;
                return (
                  <li
                    key={i}
                    className="rounded-lg border border-zinc-200 bg-white/60 p-3"
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ${badgeClass}`}
                      >
                        {pr}
                      </span>
                      <span className="font-semibold text-zinc-900 text-sm">
                        {item.action ?? "—"}
                      </span>
                    </div>
                    {item.expectedImpact && (
                      <p className="text-xs text-zinc-600 mt-1">
                        → {item.expectedImpact}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>—</p>
          )}
        </ReportCard>
      </div>
    </div>
  );
}

function BacklinkIntelView({
  report,
  rawData,
  lang,
  compact = false,
}: {
  report: BacklinkIntelReport;
  rawData?: unknown;
  lang: Lang;
  compact?: boolean;
}) {
  const s = i18n[lang].sections;
  const left: ReportLeftAccent = "teal";
  const gridClass = compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2";
  const officialAccounts = mergeOfficialAccounts(report.officialAccounts, rawData);
  const renderList = (items?: string[]) =>
    items && items.length > 0 ? (
      <ul className="list-disc pl-5 space-y-1.5">
        {items.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    ) : (
      <p>—</p>
    );

  return (
    <div className={gridClass}>
      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.exposureSummary}
          icon="📡"
          accent="emerald"
          leftAccent={left}
          highlighted
        >
          <p className="whitespace-pre-wrap">{report.brandSummary ?? "—"}</p>
        </ReportCard>
      </div>

      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.likelyFeaturedSources}
          icon="📰"
          accent="sky"
          leftAccent={left}
        >
          {officialAccounts.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {officialAccounts.map((source, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-200 bg-white/70 p-3"
                >
                  <div className="font-semibold text-zinc-900">
                    {source.accountName ?? "—"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {s.sourceType}: {source.platform ?? "—"}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {s.handle}: {source.handle ?? "—"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-700">
                    {source.url ?? "—"}
                  </p>
                  <p className="mt-2 text-xs text-emerald-700">
                    {s.pitchAngle}: {source.evidence ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p>—</p>
          )}
        </ReportCard>
      </div>

      <ReportCard
        title={s.platformPresence}
        icon="🌐"
        accent="purple"
        leftAccent={left}
      >
        {report.platformPresence && report.platformPresence.length > 0 ? (
          <ul className="space-y-3">
            {report.platformPresence.map((item, i) => (
              <li key={i} className="rounded-lg border border-zinc-200 bg-white/70 p-3">
                <div className="font-semibold text-zinc-900">
                  {item.platform ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {s.opportunityType}: {item.status ?? "—"}
                </div>
                <p className="mt-2 text-sm text-zinc-700">
                  {item.notes ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>—</p>
        )}
      </ReportCard>

      <ReportCard
        title={s.contentStrategy}
        icon="🧭"
        accent="amber"
        leftAccent={left}
      >
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1">
              {s.ownedChannels}
            </p>
            {renderList(report.connectionAnalysis?.ownedChannels)}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1">
              {s.communitySignals}
            </p>
            {renderList(report.connectionAnalysis?.communitySignals)}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1">
              {s.mediaSignals}
            </p>
            {renderList(report.connectionAnalysis?.mediaSignals)}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-1">
              {s.crossPlatformFlow}
            </p>
            <p className="whitespace-pre-wrap">
              {report.connectionAnalysis?.crossPlatformFlow ?? "—"}
            </p>
          </div>
        </div>
      </ReportCard>

      <div className={compact ? "" : "md:col-span-2"}>
        <ReportCard
          title={s.linkOpportunities}
          icon="🔗"
          accent="amber"
          leftAccent={left}
        >
          {report.distributionOpportunities &&
          report.distributionOpportunities.length > 0 ? (
            <ul className="space-y-3">
              {report.distributionOpportunities.map((item, i) => {
                const pr = (item.priority ?? "medium").toLowerCase();
                const badgeClass =
                  PRIORITY_BADGE[pr] ?? PRIORITY_BADGE.medium;
                return (
                  <li
                    key={i}
                    className="rounded-lg border border-zinc-200 bg-white/70 p-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ${badgeClass}`}
                      >
                        {pr}
                      </span>
                      <span className="font-semibold text-zinc-900">
                        {item.platform ?? "—"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-700">
                      {item.opportunity ?? "—"}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>—</p>
          )}
        </ReportCard>
      </div>

      <ReportCard title={s.outreachAngles} icon="📨" accent="purple" leftAccent={left}>
        {renderList(report.creativeAngles)}
      </ReportCard>
      <ReportCard title={s.contentIdeas} icon="💡" accent="emerald" leftAccent={left}>
        {report.relatedConnections && report.relatedConnections.length > 0 ? (
          <ul className="space-y-3">
            {report.relatedConnections.map((item, i) => (
              <li key={i} className="rounded-lg border border-zinc-200 bg-white/70 p-3">
                <div className="font-semibold text-zinc-900">
                  {item.name ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {item.type ?? "other"}
                </div>
                <p className="mt-2 text-sm text-zinc-700">
                  {item.url ?? "—"}
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  {s.whyItMatters}: {item.whyItMatters ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>—</p>
        )}
      </ReportCard>
    </div>
  );
}

function ReportRenderer({
  task,
  lang,
  compact = false,
  includeCreativePack = true,
}: {
  task: Task;
  lang: Lang;
  compact?: boolean;
  includeCreativePack?: boolean;
}) {
  const report = (task.report ?? {}) as Record<string, unknown>;
  const type = task.promptType as AnalysisType | undefined;
  if (!type) return null;
  let body: React.ReactNode = null;
  if (type === "script_teardown") {
    body = (
      <ScriptTeardownView
        report={report as ScriptTeardownReport}
        lang={lang}
        compact={compact}
      />
    );
  } else if (type === "product_compare") {
    body = (
      <ProductCompareView
        report={report as ProductCompareReport}
        lang={lang}
        compact={compact}
      />
    );
  } else if (type === "viral_rewrite") {
    body = <ViralRewriteView report={report as ViralRewriteReport} lang={lang} />;
  } else if (type === "seo_audit") {
    body = (
      <SeoAuditView
        report={report as SeoAuditReport}
        lang={lang}
        compact={compact}
      />
    );
  } else if (type === "content_rewrite") {
    body = (
      <ContentRewriteView
        report={report as ContentRewriteReport}
        lang={lang}
        compact={compact}
      />
    );
  } else if (type === "competitive_strategy") {
    body = (
      <CompetitiveStrategyView
        report={report as CompetitiveStrategyReport}
        lang={lang}
        compact={compact}
      />
    );
  } else if (type === "backlink_intel") {
    const signalMap = resolvedSignalMap(task);
    body = (
      <BacklinkIntelView
        report={signalMap as BacklinkIntelReport}
        rawData={task.rawData}
        lang={lang}
        compact={compact}
      />
    );
  }
  if (!body) return null;
  return (
    <>
      {body}
      {includeCreativePack && (
        <CreativePackView pack={resolvedCreativePack(task)} lang={lang} compact={compact} />
      )}
    </>
  );
}

// ============================================================================
// Tabs
// ============================================================================

function AnalyzeTab({ lang }: { lang: Lang }) {
  const t = i18n[lang];
  const [selectedIntentId, setSelectedIntentId] =
    useState<ResultIntentId>("whyViral");
  const [url, setUrl] = useState("");
  const [analysisType, setAnalysisType] =
    useState<AnalysisType>("script_teardown");
  const [submitting, setSubmitting] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTick, setElapsedTick] = useState(0);

  const detected = url.trim() ? detectPlatform(url) : null;

  const reset = useCallback(() => {
    setTask(null);
    setError(null);
    setSubmitting(false);
  }, []);

  const selectResultIntent = (intent: ResultIntent) => {
    setSelectedIntentId(intent.id);
    setAnalysisType(intent.analysisType);
  };

  // Polling
  useEffect(() => {
    if (!task) return;
    if (
      (task.status === "done" || task.status === "failed") &&
      !hasPendingGeneratedVideo(task)
    ) {
      return;
    }

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
                  errorMsg: d.errorMsg ?? prev.errorMsg,
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

  useEffect(() => {
    if (
      !task ||
      ((task.status === "done" || task.status === "failed") &&
        !hasPendingGeneratedVideo(task))
    ) {
      return;
    }
    const intervalId = setInterval(() => {
      setElapsedTick((value) => value + 1);
    }, 1000);
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
        body: JSON.stringify({
          url: normalizeUrlForFetch(url),
          analysisType,
          locale: lang,
        }),
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
  }, [url, analysisType, lang, submitting]);

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
          <div className="flex items-center gap-2">
            <a
              href={`/api/reports/${task.id}/pdf`}
              download={`viralgenie-report-${task.id}.pdf`}
              className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 font-medium text-sm hover:bg-zinc-50 hover:border-zinc-400 transition-all flex items-center gap-1.5"
            >
              <span aria-hidden>📄</span> {t.downloadPdf}
            </a>
            <button
              onClick={reset}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-emerald-500 text-white font-medium text-sm hover:shadow-lg transition-all"
            >
              + {t.analyze.newAnalysis}
            </button>
          </div>
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
        <PriorityResultsView task={task} lang={lang} onTaskUpdated={setTask} />
        <FullReportDetails task={task} lang={lang} />
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
    const elapsedLabel = formatElapsed(task.createdAt, lang);
    const trace = readProviderTrace(task);
    return (
      <div className="space-y-6">
        <h2
          className="text-2xl font-bold text-zinc-900"
          style={{ fontFamily: "var(--font-sora)" }}
        >
          {t.analyze.stepperHeading}
        </h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Stepper
            status={task.status}
            lang={lang}
          />
          <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
                <span>{task.status === "crawling" ? "01" : "02"}</span>
                <span>
                  {progressHint(task.status, lang)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {progressReassurance(lang)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {lang === "zh" ? "Live status" : "Live status"}
              </div>
              <div className="mt-2 space-y-2 text-sm text-zinc-700">
                <div className="flex items-center justify-between gap-3">
                  <span>{lang === "zh" ? "已用时间" : "Elapsed"}</span>
                  <span className="font-semibold text-zinc-900">
                    {elapsedTick >= 0 ? elapsedLabel || "—" : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{lang === "zh" ? "当前引擎" : "Current engine"}</span>
                  <span className="font-semibold text-zinc-900">
                    {trace?.finalEngine ?? task.crawlEngine ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{lang === "zh" ? "Fallback" : "Fallback"}</span>
                  <span className="font-semibold text-zinc-900">
                    {trace?.fallbackUsed
                      ? lang === "zh"
                        ? "已启用"
                        : "Used"
                      : lang === "zh"
                        ? "未启用"
                        : "Not used"}
                  </span>
                </div>
              </div>
            </div>
          </div>
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
      <section className="rounded-[28px] border border-zinc-200 bg-white px-5 py-6 shadow-sm md:px-7 md:py-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:p-5">
            <label
              className="block text-sm font-semibold text-zinc-800"
              htmlFor="url-input"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              {t.analyze.urlLabel}
            </label>
            <input
              id="url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t.analyze.urlPlaceholder}
              className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              {detected ? (
                <>
                  <span className="text-zinc-500">{t.analyze.detected}:</span>
                  <PlatformBadge platform={detected.platform} lang={lang} />
                </>
              ) : (
                <span className="text-zinc-400">{t.analyze.noDetection}</span>
              )}
            </div>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p
                    className="text-sm font-semibold text-zinc-900"
                    style={{ fontFamily: "var(--font-sora)" }}
                  >
                    {t.analyze.demoLabel}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {t.analyze.demoHeading}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEMO_URLS.map((demo) => {
                    const active = url === demo.url;
                    return (
                      <button
                        key={demo.id}
                        type="button"
                        onClick={() => setUrl(demo.url)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? "border-purple-300 bg-purple-50 text-purple-700"
                            : demo.id === "tiktok"
                              ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        {t.platforms[demo.platform]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">
                  1
                </span>
                <span>{t.analyze.flowPasteUrl}</span>
              </div>
              <div className="hidden h-px flex-1 bg-zinc-200 sm:block" />
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                  2
                </span>
                <span>{t.analyze.flowChooseResult}</span>
              </div>
              <div className="hidden h-px flex-1 bg-zinc-200 sm:block" />
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                  3
                </span>
                <span>{t.analyze.flowRunAnalysis}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white px-5 py-6 shadow-sm md:px-7">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2
              className="text-lg font-bold text-zinc-900"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              {t.analyze.resultHeading}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
              {t.analyze.resultHelper}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {RESULT_INTENTS.map((intent) => {
            const copy = t.analyze.resultIntents[intent.id];
            const isSelected = selectedIntentId === intent.id;
            return (
              <button
                key={intent.id}
                type="button"
                onClick={() => selectResultIntent(intent)}
                className={`min-h-[150px] text-left rounded-2xl border p-5 transition-all ${
                  isSelected
                    ? "border-purple-400 bg-gradient-to-br from-purple-50 to-emerald-50 shadow-md"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
                }`}
              >
                <h3
                  className="text-base font-semibold text-zinc-950"
                  style={{ fontFamily: "var(--font-sora)" }}
                >
                  {copy.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {copy.desc}
                </p>
                <p className="mt-3 text-xs font-medium text-zinc-500">
                  {copy.bestFor}
                </p>
              </button>
            );
          })}
        </div>
      </section>

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

      <section className="rounded-[28px] border border-zinc-200 bg-white px-5 py-6 shadow-sm md:px-7">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2
              className="text-lg font-bold text-zinc-900"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              {t.analyze.workflowHeading}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
              {t.analyze.workflowHelper}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {t.analyze.workflowSteps.map((step, index) => (
            <div
              key={step}
              className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white px-3 py-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                0{index + 1}
              </div>
              <div
                className="mt-1 text-sm font-semibold leading-5 text-zinc-900"
                style={{ fontFamily: "var(--font-sora)" }}
              >
                {step}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const PLATFORM_DOT: Record<Platform, string> = {
  youtube: "bg-red-500",
  tiktok: "bg-zinc-900",
  instagram: "bg-pink-500",
  douyin: "bg-rose-600",
  xiaohongshu: "bg-red-600",
  bilibili: "bg-sky-400",
  x: "bg-sky-500",
  blog: "bg-emerald-500",
  ecommerce: "bg-amber-500",
  other: "bg-zinc-400",
};

const HISTORY_FILTER_PLATFORMS: Platform[] = [
  "youtube",
  "tiktok",
  "instagram",
  "douyin",
  "xiaohongshu",
  "bilibili",
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
      return;
    }
    let alive = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const syncTask = async () => {
      try {
        const r = await fetch(`/api/analyze/${selectedId}/status`);
        const d = await r.json();
        if (!alive || !d.task) return;
        const nextTask = d.task as Task;
        setSelectedTask(nextTask);
        setTasks((prev) =>
          prev
            ? prev.map((task) => (task.id === nextTask.id ? nextTask : task))
            : prev,
        );
        if (
          intervalId &&
          (nextTask.status === "done" || nextTask.status === "failed") &&
          !hasPendingGeneratedVideo(nextTask)
        ) {
          clearInterval(intervalId);
        }
      } catch {
        // keep detail view stable through transient request errors
      }
    };
    void syncTask();
    intervalId = setInterval(syncTask, 2000);
    return () => {
      alive = false;
      if (intervalId) clearInterval(intervalId);
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

  if (selectedTask) {
    const inProgress =
      selectedTask.status === "pending" ||
      selectedTask.status === "crawling" ||
      selectedTask.status === "analyzing";
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setSelectedId(null);
              setSelectedTask(null);
            }}
            className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1"
          >
            ← {t.history.back}
          </button>
          {selectedTask.status === "done" ? (
            <a
              href={`/api/reports/${selectedTask.id}/pdf`}
              download={`viralgenie-report-${selectedTask.id}.pdf`}
              className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 font-medium text-sm hover:bg-zinc-50 hover:border-zinc-400 transition-all flex items-center gap-1.5"
            >
              <span aria-hidden>📄</span> {t.downloadPdf}
            </a>
          ) : null}
        </div>
        {inProgress ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <Stepper status={selectedTask.status} lang={lang} />
            <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                <div className="text-sm font-semibold text-zinc-900">
                  {progressHint(selectedTask.status, lang)}
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {progressReassurance(lang)}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {lang === "zh" ? "Live status" : "Live status"}
                </div>
                <div className="mt-2 space-y-2 text-sm text-zinc-700">
                  <div className="flex items-center justify-between gap-3">
                    <span>{lang === "zh" ? "已用时间" : "Elapsed"}</span>
                    <span className="font-semibold text-zinc-900">
                      {formatElapsed(selectedTask.createdAt, lang) || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{lang === "zh" ? "当前引擎" : "Current engine"}</span>
                    <span className="font-semibold text-zinc-900">
                      {readProviderTrace(selectedTask)?.finalEngine ??
                        selectedTask.crawlEngine ??
                        "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : selectedTask.status === "done" ? (
          <>
            <PriorityResultsView
              task={selectedTask}
              lang={lang}
              onTaskUpdated={(nextTask) => {
                setSelectedTask(nextTask);
                setTasks((prev) =>
                  prev
                    ? prev.map((task) => (task.id === nextTask.id ? nextTask : task))
                    : prev,
                );
              }}
            />
            <FullReportDetails task={selectedTask} lang={lang} />
          </>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
            <h3 className="text-lg font-semibold text-rose-900 mb-2">
              {t.analyze.errorTitle}
            </h3>
            <p className="text-rose-800 text-sm whitespace-pre-wrap">
              {selectedTask.errorMsg ?? "Unknown error"}
            </p>
          </div>
        )}
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
                      {dt.toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}
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
                      <button
                        onClick={() => {
                          setSelectedId(task.id);
                          setSelectedTask(task);
                        }}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                      >
                        {task.status === "done"
                          ? `${t.history.view} →`
                          : lang === "zh"
                            ? "查看进度 →"
                            : "View progress →"}
                      </button>
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
        onClick={() => setLang("zh")}
        className={`px-3 py-1.5 rounded-full transition-all ${
          lang === "zh"
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
  isAdmin,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  onLogout: () => void;
  isAdmin: boolean;
}) {
  const t = i18n[lang];
  const visibleTabs = (Object.keys(t.tabs) as Tab[]).filter(
    (k) => isAdmin || k !== "usage",
  );
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <button
          type="button"
          onClick={() => setTab("analyze")}
          aria-label={t.title}
          className="flex items-center gap-3 -m-1 p-1 rounded-lg hover:bg-zinc-100/60 transition-colors text-left"
        >
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
        </button>
        <div className="flex items-center gap-3">
          <nav className="inline-flex rounded-full bg-zinc-100 p-1 text-sm font-medium">
            {visibleTabs.map((key) => (
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
  // Default "en" for SSR consistency. On mount, the browser language wins so
  // the whole app follows the user's browser setting by default.
  const [lang, setLang] = useState<Lang>("en");
  const [tab, setTab] = useState<Tab>("analyze");
  // isAdmin gates the internal Usage tab; customer-facing pages stay brand-first.
  // and the Usage tab. Default false so non-admin UI is the safe state during
  // the brief window before the session check resolves.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/session");
        const s = (await r.json()) as { user?: { role?: string } } | null;
        if (!cancelled && s?.user?.role === "admin") setIsAdmin(true);
      } catch {
        // Non-blocking: language still comes from the browser.
      }
      if (!cancelled) setLang(detectBrowserLang());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("viralgenie_lang", lang);
    // Persist to user record. Fire-and-forget — 401 (not logged in) silently
    // fails, which is correct behavior on the brief window between mount and
    // the session check above.
    fetch("/api/user/locale", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: lang }),
    }).catch(() => {});
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
        isAdmin={isAdmin}
      />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {tab === "analyze" && <AnalyzeTab lang={lang} />}
        {tab === "history" && <HistoryTab lang={lang} />}
        {tab === "usage" && isAdmin && <UsageTab lang={lang} />}
      </main>
    </div>
  );
}
