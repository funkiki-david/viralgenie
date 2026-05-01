import type { AnalysisType, UnifiedContent } from "@/src/types";

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function normalizeToMarkdown(content: UnifiedContent): string {
  const sections: string[] = [];

  sections.push(`# ${content.title || "(Untitled)"}`);

  const meta: string[] = [`- **Platform:** ${content.platform}`];
  if (content.author) meta.push(`- **Author:** ${content.author}`);
  if (content.publishDate)
    meta.push(`- **Published:** ${formatDate(content.publishDate)}`);
  meta.push(`- **Source:** ${content.sourceUrl}`);
  sections.push(`## Metadata\n${meta.join("\n")}`);

  if (content.metrics) {
    const m = content.metrics;
    const rows: string[] = [];
    if (m.views !== undefined) rows.push(`- **Views:** ${formatNumber(m.views)}`);
    if (m.likes !== undefined) rows.push(`- **Likes:** ${formatNumber(m.likes)}`);
    if (m.comments !== undefined)
      rows.push(`- **Comments:** ${formatNumber(m.comments)}`);
    if (m.shares !== undefined)
      rows.push(`- **Shares:** ${formatNumber(m.shares)}`);
    if (m.rating !== undefined) rows.push(`- **Rating:** ${m.rating}`);
    if (rows.length > 0) sections.push(`## Metrics\n${rows.join("\n")}`);
  }

  const body = content.content.text?.trim();
  if (body) sections.push(`## Content\n${body}`);

  if (content.content.summary && content.content.summary !== body) {
    sections.push(`## Summary\n${content.content.summary.trim()}`);
  }

  if (content.content.tags && content.content.tags.length > 0) {
    const tags = content.content.tags.map((t) => `\`${t}\``).join(", ");
    sections.push(`## Tags\n${tags}`);
  }

  return sections.join("\n\n") + "\n";
}

const ANALYSIS_INSTRUCTIONS: Record<AnalysisType, string> = {
  script_teardown: [
    "You are a short-form video script analyst.",
    "Break down the content below into:",
    "1. Hook — the first 3 seconds and why it stops the scroll",
    "2. Pivot points — where the narrative shifts or escalates",
    "3. CTA — the explicit or implicit call to action",
    "Be specific and quote the script verbatim where useful.",
  ].join("\n"),

  product_compare: [
    "You are a product research analyst.",
    "From the content below, extract:",
    "1. Features — concrete capabilities and specs",
    "2. Pricing — tiers, anchors, discounts mentioned",
    "3. Pain points — user complaints, missing features, friction",
    "Return a structured comparison; flag any claim you cannot verify from the text.",
  ].join("\n"),

  viral_rewrite: [
    "You are a viral content rewriter.",
    "Using the source below, produce 5 distinct style variants:",
    "1. Curiosity hook",
    "2. Contrarian / hot-take",
    "3. Listicle / numbered breakdown",
    "4. Personal story",
    "5. Data-driven / proof-led",
    "Each variant must keep the core message but use a different angle, tone, and opening line.",
  ].join("\n"),

  seo_audit: [
    "You are a senior technical SEO auditor.",
    "Audit the page below across:",
    "1. Meta tags (title, description, keywords) — issues and gaps",
    "2. Heading structure — hierarchy and semantic correctness",
    "3. Content (word count, keyword density, readability)",
    "4. Links (internal, external, suspected broken)",
    "5. Prioritized recommendations",
    "Score honestly on a 0-100 scale; flag uncertainty when data is not directly observable.",
  ].join("\n"),

  content_rewrite: [
    "You are a senior content editor and SEO copywriter.",
    "Using the source below, produce an improved version:",
    "1. Original analysis — what's strong, what's weak",
    "2. Improved title (50-60 chars, SEO-friendly, no clickbait)",
    "3. Improved content (full rewrite, markdown, under 1500 words)",
    "4. Specific changes — what was edited and why",
    "5. SEO improvements applied",
  ].join("\n"),

  competitive_strategy: [
    "You are a senior competitive intelligence strategist.",
    "Analyze the competitor page below across:",
    "1. Positioning",
    "2. Messaging — tone and key themes",
    "3. Target audience",
    "4. Content strategy — strengths and gaps (gaps are your opportunities)",
    "5. UX evaluation",
    "6. Prioritized action plan to outcompete them",
    "Be specific and actionable; flag uncertainty where the page doesn't reveal info.",
  ].join("\n"),
};

export function buildClaudeContext(
  content: UnifiedContent,
  analysisType: AnalysisType,
): string {
  const instructions = ANALYSIS_INSTRUCTIONS[analysisType];
  const markdown = normalizeToMarkdown(content);
  return `${instructions}\n\n---\n\n${markdown}`;
}
