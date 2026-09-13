# QuickMail Finder — Visual Assets & Conversion Specification (QMF-009)

**Audit Date:** 2026-09-13  
**Lead Designer:** Senior Chrome Web Store UX / Conversion Specialist & Visual Art Director  
**Target Extension:** QuickMail Finder (`nmghnadnnkageenfiklgoghlelodmked`)  
**Design System Standard:** Modern Premium Glassmorphism, Google Sans / Inter Typography, Deep Navy & Electric Violet/Blue Palettes  
**Evidence Level:** `[VERIFIED]` (All asset dimensions and margin safety guidelines comply strictly with official Chrome Web Store Developer Program specifications).

---

## 1. Brand Design System & Color Tokens

Visuals on the Chrome Web Store must instantly communicate **speed, modern craftsmanship, and zero-clutter utility**. Pale or generic blue icons look like outdated utilities from 2012; dark, vibrant gradients with clean contrast stand out sharply in both CWS Light and Dark themes.

### Color Palette (Production Hex Tokens)
* **Primary Brand Gradient:** `linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)` (Electric Indigo to Vivid Violet)
* **Canvas Dark (Screenshot Backgrounds):** `#0a0f1d` (Deep Midnight Slate)
* **Surface Glass Layer:** `rgba(255, 255, 255, 0.08)` (Backdrop Blur: 24px, Border: `1px solid rgba(255, 255, 255, 0.12)`)
* **Accent Gold / Highlight:** `#f59e0b` (Warm Amber for ratings, notification badges, and arrows)
* **Success Emerald:** `#10b981` (For "100% Free", "Detected", and "Submitted" status badges)
* **High-Contrast Text:** `#ffffff` (Headlines), `#94a3b8` (Subtitles/Metadata)

---

## 2. Store Icon Specification

The icon is the first visual token a user sees in search results and the browser toolbar. It must remain instantly recognizable at **16×16px** up to **128×128px**.

```
+-----------------------------------+
|               128px               |
|   +---------------------------+   |
|   |   Deep Indigo Rounded     |   |
|   |   Squircle (Radius 28px)  |   |
|   |                           |   |
|   |      [✉] Crisp White      |   |
|   |     Mail Envelope with    |   |
|   |      Speed Tail / Bolt    |   |
|   |       in Cyan (#38bdf8)   |   |
|   |                           |   |
|   +---------------------------+   |
|                                   |
+-----------------------------------+
```

### Technical Specification:
* **Dimensions Required:** 128×128 px (PNG format, 32-bit with alpha transparency)
* **Toolbar Sizes:** 48×48 px, 16×16 px
* **Color Psychology:** 
  * Indigo/Violet base evokes trust, intelligence, and modern SaaS quality.
  * Cyan accent lighting communicates lightning-fast speed.
* **Theme Contrast Validation:**
  * Tested on Light Theme (`#ffffff` background): Indigo squircle provides sharp outer border definition.
  * Tested on Dark Theme (`#131314` background): Deep Violet gradient with subtle cyan rim light pops cleanly without blending into the background.
* **Glyph Design:** Folded mail envelope geometry with a 15-degree forward slant (conveying speed/outreach), avoiding hairline strokes that vanish at 16×16.

---

## 3. Promotional Tiles Specification

Promotional tiles are mandatory for eligibility in Chrome Web Store Category Shelves, Editor's Picks, and Search Banners.

### 1. Small Promotional Tile (440 × 280 px)
* **Format:** PNG / JPEG (RGB, under 2 MB)
* **Safety Margin Rule:** **Crucial!** No text, logos, or critical graphics within **25px of the outer borders** (to avoid cropping across different responsive aspect ratios).
* **Composition & Layout:**
  * **Background:** Deep midnight gradient (`#0a0f1d` to `#1e1b4b`) with ambient violet glow.
  * **Left Side (Text Stack):**
    * *Eyebrow Tag:* `100% FREE & UNLIMITED` (Emerald pill badge `#10b981` with white text).
    * *Headline (Bold 28px):* `QuickMail Finder`
    * *Subheadline (Medium 15px):* `Find Any Email. Draft in Gmail in 1 Click.`
    * *Feature Micro-Chips:* `No Sign-Up` • `Zero Credit Limits` • `100% Private`
  * **Right Side (Hero Graphic):** 
    * 3D isometric mockup of the QuickMail Finder popup window floating with a subtle outer glow and a prominent green `1-Click Draft` button.

### 2. Marquee Promotional Banner (1400 × 560 px)
* **Format:** High-resolution PNG (RGB, under 5 MB)
* **Eligibility:** Required for "Featured Extension" marquee placement on the CWS Home Tab.
* **Safety Margin Rule:** Center content within the central **900×460 px box**; outer 50px borders must consist solely of ambient background art.
* **Composition & Layout:**
  * **Left Column:**
    * *Headline (Bold 48px):* `The Fastest Email Finder for Job Seekers & Creators.`
    * *Subheadline (20px):* `Detect contact emails on any website and open pre-filled Gmail & Outlook drafts in seconds.`
    * *Call-to-Action Badge:* `⚡ 100% Free Chrome Extension • No Account Required`
  * **Right Column:**
    * Split preview showing a live LinkedIn/Web page with the in-page `✉` button clicked, seamlessly transitioning into an open Gmail compose window pre-filled with the custom pitch and resume link.

---

## 4. Production Store Screenshots (1280 × 800 px)

Chrome Web Store allows up to 5 screenshots. Every screenshot must follow a unified **"Problem $\rightarrow$ Solution $\rightarrow$ Benefit"** storyboard rather than boring raw desktop screen dumps.

### Storyboard Architecture
```
Screenshot 1: The Hero Reveal (Instant Detection on Any Page)
     ↓
Screenshot 2: The In-Page Magic (✉ Inline Icon + Floating Compose Panel)
     ↓
Screenshot 3: The Job Seeker Engine (Smart Templates + Resume Link)
     ↓
Screenshot 4: The 1-Click Launch (Native Gmail & Outlook Integration)
     ↓
Screenshot 5: Full Control & Privacy (Application History + CSV Export)
```

---

### 📸 Screenshot 1: The Hero / First Impression
* **Exact Dimensions:** 1280 × 800 px
* **Headline Banner (Top 120px):**  
  `DETECT EMAILS ON ANY WEBPAGE INSTANTLY`
* **Sub-Headline (Top Banner):**  
  `No monthly credit limits. No account sign-up. 100% free forever.`
* **Central Visual Mockup:**
  * A modern web browser window showing a hiring directory / company team page.
  * QuickMail Finder popup is open on the right:
    * Toolbar badge shows `[ 4 ]`.
    * 4 detected recruiter emails listed cleanly with copy icons and checkboxes.
    * Prominent `⚡ Open Compose` button highlighted in glowing blue.
* **Annotation Callouts (Floating Badges):**
  * Pointer to Badge: *"Auto-detects emails in real-time"*
  * Pointer to Action: *"1-Click Compose or Copy All"*

---

### 📸 Screenshot 2: In-Page ✉ Button & Floating Draft Panel
* **Exact Dimensions:** 1280 × 800 px
* **Headline Banner (Top 120px):**  
  `THE 1-CLICK OUTREACH EXPERIENCE`
* **Sub-Headline (Top Banner):**  
  `Click the discreet ✉ icon next to any email to launch outreach without leaving the page.`
* **Central Visual Mockup:**
  * A job posting with recruiter text: `Please reach out to careers@innovatetech.com`.
  * Directly beside the email sits the sleek QuickMail Finder `[✉]` icon.
  * In-page floating glassmorphic draft card is expanded directly anchored to the email:
    * Pre-filled `To: careers@innovatetech.com`
    * Pre-filled `Subject: Application for Senior Frontend Engineer`
    * Pre-filled template greeting.
    * Two prominent buttons: `Draft in Gmail` and `Draft in Outlook`.
* **Annotation Callouts:**
  * Pointer to `[✉]`: *"Zero tab switching — write and send right from your current screen"*

---

### 📸 Screenshot 3: Smart Templates & Google Drive Resume Integration
* **Exact Dimensions:** 1280 × 800 px
* **Headline Banner (Top 120px):**  
  `CUSTOM DYNAMIC TEMPLATES THAT SAVE HOURS`
* **Sub-Headline (Top Banner):**  
  `Auto-fill hiring manager name, company, custom pitch, and your resume link.`
* **Central Visual Mockup:**
  * The "Templates" tab inside the extension popup.
  * Active Template selected: `Job Application Pitch`.
  * Highlighted dynamic chips displayed:
    * `{name}` $\rightarrow$ Recruiter Name
    * `{company}` $\rightarrow$ Target Company
    * `{driveLink}` $\rightarrow$ Google Drive Resume Link
  * Bottom settings card showing Google Drive Link saved with a green padlock: `Safe & Local`.
* **Annotation Callouts:**
  * Pointer to chips: *"Smart token replacement eliminates repetitive typing"*
  * Pointer to Drive Link: *"Attaches your portfolio or resume automatically"*

---

### 📸 Screenshot 4: 1-Click Compose in Gmail & Outlook
* **Exact Dimensions:** 1280 × 800 px
* **Headline Banner (Top 120px):**  
  `DIRECT INTEGRATION WITH GMAIL & OUTLOOK`
* **Sub-Headline (Top Banner):**  
  `Launches your personal email client with every field perfectly pre-populated.`
* **Central Visual Mockup:**
  * A split-screen composition:
    * Left: Webpage with QuickMail Finder active.
    * Right: A freshly opened Gmail compose window.
    * Recruiter email pre-populated in `To`.
    * Clean subject line: `Priya Sharma — Senior Designer Application (Acme Corp)`.
    * Multi-paragraph body ready to send with Google Drive resume link formatted as a clickable link.
* **Annotation Callouts:**
  * Badge over Gmail: *"Multi-Account Support (/u/0/, /u/1/)"*
  * Badge over Outlook: *"Works with Outlook Web & Desktop Mailto"*

---

### 📸 Screenshot 5: Built-In Application Tracker & CSV Export
* **Exact Dimensions:** 1280 × 800 px
* **Headline Banner (Top 120px):**  
  `TRACK OUTREACH & EXPORT CLEAN CSV LISTS`
* **Sub-Headline (Top Banner):**  
  `Never double-pitch a recruiter. Download your leads in 1 click.`
* **Central Visual Mockup:**
  * The "History" tab inside the extension popup.
  * Clean table listing past outreach:
    * `recruitment@stripe.com` • `Submitted` (Green badge) • `Today, 2:45 PM`
    * `alex@agencygrowth.co` • `Drafted` (Blue badge) • `Yesterday`
  * Top action bar showing `Search History` input and a prominent `Export to CSV` button with a download animation.
* **Annotation Callouts:**
  * Pointer to Status: *"Automatic local status logging"*
  * Pointer to Export: *"Instant Excel & Google Sheets compatible CSV download"*

---

## 5. Visual Asset Generation Checklist for Store Launch

| Asset Name | Dimensions | Required Format | File Name | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Store Icon (Large)** | 128 × 128 px | PNG (32-bit alpha) | `icon128.png` | **Existing / Verified** |
| **Extension Icon (Medium)** | 48 × 48 px | PNG (32-bit alpha) | `icon48.png` | **Existing / Verified** |
| **Toolbar Icon (Small)** | 16 × 16 px | PNG (32-bit alpha) | `icon16.png` | **Existing / Verified** |
| **Small Promo Tile** | 440 × 280 px | JPEG / PNG (No text in 25px border)| `promo_tile_440x280.png` | **Drafted in Artifacts** |
| **Marquee Promo Tile** | 1400 × 560 px| PNG (Under 5MB) | `marquee_tile_1400x560.png` | **Spec Ready** |
| **Screenshot 1 (Hero)** | 1280 × 800 px| PNG / JPEG (16:10) | `screenshot_1_hero_detect.png`| **Spec Ready** |
| **Screenshot 2 (Inline)** | 1280 × 800 px| PNG / JPEG (16:10) | `screenshot_2_inpage_compose.png`| **Spec Ready** |
| **Screenshot 3 (Templates)**| 1280 × 800 px| PNG / JPEG (16:10) | `screenshot_3_smart_templates.png`| **Spec Ready** |
| **Screenshot 4 (Gmail)** | 1280 × 800 px| PNG / JPEG (16:10) | `screenshot_4_gmail_compose.png`| **Spec Ready** |
| **Screenshot 5 (History)** | 1280 × 800 px| PNG / JPEG (16:10) | `screenshot_5_tracker_csv.png` | **Spec Ready** |
