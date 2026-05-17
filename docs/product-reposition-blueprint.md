# ViralGenie Product Reposition Blueprint

## 1. Product Positioning

### New one-line positioning

ViralGenie turns a video, social profile, or website URL into a Signal Map, Creator Pack, and fast-launch page.

### What the product is now

The product is no longer a broad content or SEO analysis tool.

It should become a focused workflow for:

1. Understanding how a brand or creator connects content across video and social platforms
2. Turning that understanding into prompts, scripts, and copy
3. Turning those outputs into a lightweight outreach-ready landing page

### Core user job

The user wants to drop in an existing URL and quickly get:

- a map of the creator or brand's media footprint
- a breakdown of what makes the content work
- a reusable creative pack
- a simple microsite they can publish or share in outreach

### Product promise

Paste one URL.
Get the Signal Map, Creator Pack, and launch-ready page.

### What ViralGenie is not

- Not a generic website SEO auditor
- Not a traditional product comparison platform
- Not a full video generation platform
- Not a broad marketing dashboard

### North-star use cases

1. A creator studies a high-performing video and gets a reusable creative pack
2. A marketer drops in a company site and finds official social channels and media footprint
3. An operator analyzes a brand's content network and launches a simple outreach microsite in minutes

## 2. Homepage Structure

### Homepage goal

The homepage should make the product feel like one clear workflow instead of a collection of unrelated modules.

### Recommended information architecture

#### Hero

Primary message:

`Analyze a video, profile, or website. Then turn it into prompts, copy, and a microsite.`

Supporting message:

`ViralGenie maps social and content connections, extracts what makes content spread, and generates assets you can publish fast.`

Primary input:

- One URL field
- One primary CTA: `Analyze URL`

Secondary CTA:

- `See Sample Result`

#### Step band

Show the product as a 3-step system:

1. `Analyze Connections`
2. `Creator Pack`
3. `Launch Page`

This should replace the current many-module-first feeling.

#### Core workspace selector

Expose only three top-level workspaces:

1. `Signal Map`
2. `Creator Pack`
3. `Launch Page`

These are the new product pillars.

#### Result preview section

When a result exists, the page should preview three panels:

1. `Signal Map`
   Shows discovered platforms, accounts, and social links
2. `Creator Pack`
   Shows prompt outputs, short script, shot prompts, and ready-to-post copy
3. `Launch Page`
   Shows a lightweight generated landing page summary or preview

#### Sample use-case strip

Short examples:

- `Reverse-engineer a viral creator`
- `Map a brand's media footprint`
- `Turn one URL into an outreach page`

### Modules to demote or hide

These should no longer appear as top-level homepage entry points:

- SEO Audit
- Product Compare
- Content Rewrite
- Competitive Strategy
- Backlink Intel as a standalone concept

Notes:

- Their useful logic can be absorbed into the new workspaces
- They should not define the product from the homepage anymore

### New visual direction

The UI should still feel like the current product, but the framing should shift from "multi-tool dashboard" to "single workflow studio."

That means:

- one primary URL entry point
- fewer top-level choices
- result-led layout
- clear progression from analysis to assets to page

## 3. Core Function Tree

### Pillar A: Signal Map

Purpose:

Understand how a creator or brand is connected across content, accounts, and platforms.

Inputs:

- Video URL
- Social profile URL
- Website URL

Outputs:

- detected platform
- brand or creator identity
- official linked social channels
- account URLs and handles
- connection graph between website and social accounts
- likely media footprint
- external attention signals

Sub-capabilities:

1. `Social Link Discovery`
   Extract linked social accounts from website content and metadata
2. `Account Identity Resolution`
   Normalize account URLs, handles, and display names
3. `Content Relationship Analysis`
   Explain how the content or brand connects across platforms
4. `Visibility Signals`
   Summarize likely external attention, mentions, and connection opportunities

### Pillar B: Creator Pack

Purpose:

Turn a piece of content into reusable creative assets.

Inputs:

- Analysis result
- Original URL

Outputs:

- image prompt for Midjourney
- image prompt for DALL-E
- short-form video script
- shot prompts
- hook options
- ready-to-post social copy

Sub-capabilities:

1. `Video Breakdown`
   Hook, rhythm, scene sequence, emotional arc, CTA
2. `Scene Blueprint`
   Subject, setting, camera, lighting, composition, motion, text overlay, transition
3. `Prompt Rewriter`
   Convert scene blueprints into detailed prompt formats
4. `Distribution Copy`
   Generate captions, hooks, outreach copy, and repost variants

### Pillar C: Launch Page

Purpose:

Turn analysis outputs into a simple shareable landing page.

Inputs:

- Analysis result
- Creative pack
- Optional brand name or campaign angle

Outputs:

- page title
- page subtitle
- hero copy
- social proof or connection summary
- content narrative sections
- CTA copy
- social links block
- microsite preview

Sub-capabilities:

1. `Microsite Brief`
   Convert analysis into structured page content
2. `Template Selection`
   Choose a page pattern such as creator page, campaign page, or outreach page
3. `Draft Rendering`
   Populate a fixed page template in-app

## Recommended product map

### Keep

- URL-first workflow
- report persistence
- PDF export if still useful for shareability
- auth and user storage

### Reframe

- Backlink capability as part of connection analysis
- video prompt generation as part of creative pack
- landing page generation as part of microsite draft

### Remove from homepage emphasis

- broad SEO framing
- ecommerce-style product analysis framing
- too many equal-weight module cards

## Suggested next implementation order

1. Redesign the homepage around the three new pillars
2. Rename top-level analysis choices and hide outdated ones from the primary UI
3. Redefine the report schema so every result can feed:
   - connection analysis
   - creative pack
   - microsite draft
4. Add a first-pass microsite brief output before building a full rendered microsite

## Open decisions for the next round

1. Should `Backlink Intel` stay as a visible label, or be absorbed into `Signal Map`?
2. Should the microsite generator create a private preview first, or immediately persist a shareable page?
3. Should the first launch target videos only, or support website URLs equally from day one?
