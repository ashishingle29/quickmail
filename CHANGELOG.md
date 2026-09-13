# Changelog & Chrome Web Store Release Notes

All notable changes, architectural updates, feature implementations, and bug fixes for **QuickMail Finder** are documented in this file for future traceability and store submissions.

---

## [Version 1.2.0] — Latest Release

### 🚀 New Features & Enhancements
- **Zero-Configuration Primary Gmail Account Routing (`/u/0/`)**:
  - Automatically defaults compose links to account index `/u/0/` (the primary/first signed-in Google account) across all browsers, operating systems, and profiles when no custom account is set.
  - Retains full support for custom index switching (`/u/1/`, `/u/2/`) and direct email routing (`&authuser=user@example.com`).
- **Redesigned Compact "Submitted" UI**:
  - Replaced wide inline text badges with a space-saving, circular green checkmark badge (`✓`) next to submitted emails on the **On this page** tab.
  - Preserved full horizontal width for email addresses (`min-width: 0; flex: 1; text-overflow: ellipsis`), completely eliminating text truncation.
  - Added subtle green row tint (`#f0fdf4`) and clean border for already submitted emails.
- **Timestamp Hover Tooltips**:
  - Hovering over the checkmark badge instantly displays the exact submission date & time (e.g., `Submitted at: 11 Sep 2026, 05:00 PM`).
  - Added timestamp hover tooltips to the row's selection checkbox and the **Resend** button.
- **History Page Performance Engine (Debouncing & Chunked Lazy-Loading)**:
  - Added 220ms debouncing on the history search input, eliminating lag and CPU freezing when typing queries across large datasets.
  - Implemented chunked lazy-loading (30 items per batch) with smooth infinite scroll and a "Load more" indicator, reducing initial DOM render overhead by >90%.
  - Migrated to full **Event Delegation** on the history container, replacing thousands of individual card and button event listeners with a single centralized listener.
- **Global Search & Multi-Field Query Matching**:
  - History search now operates globally across all fields simultaneously: email address, website domain hostnames, page titles, full URLs, formatted timestamps, and submission status.
  - Supports multi-word queries (e.g. `google submitted` matches entries from Google that are already submitted).
- **Global Bulk Selection & Actions**:
  - Bulk actions (**Select All**, **Draft Selected**, **Copy Selected**, **Mark Submitted/Pending**, and **Export to Excel**) now operate globally across the entire filtered dataset in memory, rather than being restricted to only the currently visible DOM nodes.
  - Added an interactive global count bar showing total history count and active selection count in real time.
- **Bouncing Cascade Popups (Option 2)**:
  - Implemented the bouncing ping-pong window cascade for detached compose windows, automatically reversing horizontal direction when hitting the monitor edge and leaving the bottom-left "Send" button unobstructed.

### 🐛 Bug Fixes
- **Gmail & Outlook High-Concurrency Compose Window HTML Corruption Fix**:
  - Fixed a critical bug where opening 20+ draft windows concurrently caused Gmail's linkifier to race with regex string replacement on `editor.innerHTML`, matching inside `href` and `data-saferedirecturl` attributes and spilling raw HTML code (`style="..." target="_blank"`) into the email body.
  - Migrated entirely to pure DOM node replacement (`anchor.replaceWith(cardNode)` and `TreeWalker` restricted to text nodes), making attribute corruption physically impossible.
  - Set `contenteditable="false"` on the attachment card container so Gmail treats it as an immutable block widget.
  - Cached sync storage settings locally in memory to eliminate async storage callback lag during heavy multi-window drafting.
  - Added an atomic processing guard (`editor.dataset.qmfProcessing`) to prevent duplicate interval executions and automatically clear enhancer timers upon completion.
- **On-Page (DOM) Draft Status Synchronization**:
  - Fixed an issue where clicking "Open Compose →" from the on-page floating panel (`✉`) opened the email draft without setting its status to `"Submitted"` or recording `submittedAt` in storage.
  - Added direct `QMF_UPDATE_STATUS` dispatch in `content.js` and automatic fallback status updates in `background.js` during `QMF_OPEN_COMPOSE`.
- **Concurrent Storage Race Condition Fix**:
  - Implemented a sequential promise queue (`updateHistory`) in `background.js` to serialize all history read-modify-write operations, resolving race conditions during bulk drafting or rapid status updates.

### 🛡️ Production & Chrome Web Store Compliance
- **Minimal Permissions Compliance**:
  - Removed unused `"scripting"` permission from `manifest.json` to adhere strictly to the Chrome Web Store Minimal Permissions policy and expedite review.
- **Extension Context Invalidation Guard**:
  - Added runtime check (`!chrome.runtime?.id`) to cleanly clear intervals and disconnect `MutationObserver` in `content.js` when the extension is updated or reloaded, eliminating `Extension context invalidated` console errors on active web pages.

---

## [Version 1.1.0]

### 🚀 New Features & Enhancements
- **Auto-Scroll Feed Scanner (`📡 Scan Feed`)**:
  - Automated continuous scrolling with intelligent page bottom and stickiness detection for infinite scroll platforms (LinkedIn feeds, Twitter/X, job search result lists).
  - Floating on-screen scan control pill allowing users to monitor scan count in real time or stop scrolling anytime.
- **Split-Span Email Detection Engine**:
  - Implemented a specialized scanner in `content.js` to extract emails split across multiple child HTML elements (e.g. `<span>username</span><span>@</span><span>domain.com</span>` commonly found on LinkedIn and Naukri).
- **Custom Markdown Link Formatting**:
  - Added native support for markdown link format `[Link Text](URL)` (e.g. `[Portfolio](https://ashishingle.com)`) in email body templates, converted dynamically into clean clickable HTML hyperlinks.
- **Multi-Email Bulk Outreach Modes**:
  - Multi-select emails via checkboxes or "Select All" on both the **On this page** and **History** tabs.
  - Three distinct sending modes:
    - **Separate (Personalized 1-on-1)**: Staggered independent compose windows for each recipient with personalized `{name}` and `{company}` tokens.
    - **BCC (Hidden List)**: Single compose window with recipients hidden in BCC.
    - **TO (Shared List)**: Single compose window with recipients in TO.
- **Google Drive Attachment Styles & Live Preview**:
  - Configurable attachment display formats using `{driveLink}`:
    - `Clean Hyperlink`: Highest spam deliverability.
    - `Compact Attachment Pill`: Rounded badge with red PDF tag and external link icon.
    - `Full Document Box Card`: Rich table preview card with document title and call-to-action button.
  - Real-time interactive visual preview in the popup **Template** tab.
- **Theme Customization Engine**:
  - Three switchable themes: `💻 Auto (System)`, `🌙 Dark`, and `☀️ Light` with synchronized persistence across the UI.
- **Global Extension ON/OFF Switch**:
  - Header toggle switch with instant badge updates (`OFF`), removal of injected on-page icons, and a top warning banner when disabled.
- **Dual Detection Modes**:
  - `Auto`: Automatically extracts and logs detected emails to history.
  - `Manual`: Extracts on-page emails with an explicit `➕ Add to List & History` button.
- **Excel (.xls) Export with Merged Cells**:
  - Generates formatted Excel spreadsheets where emails appearing across multiple source URLs are merged cleanly into grouped rows with total visit counts.
- **Uninstall Feedback Form**:
  - Registered `chrome.runtime.setUninstallURL` linking to Google Feedback Form for continuous user experience feedback.
- **Author & Feedback Footer**:
  - Integrated footer: "Made with ❤️ by Ashish Ingle" with direct links to author portfolio and support form.

---

## [Version 1.0.0] — Initial Release

### 🚀 Core Capabilities
- **Manifest V3 Architecture**:
  - Service worker background lifecycle, content scripts, and storage integration built strictly on Manifest V3.
- **Real-Time On-Page DOM Scanner**:
  - Single-pass `TreeWalker` text traversal with smart tag exclusions (`SCRIPT`, `STYLE`, `IFRAME`, `TEXTAREA`, `INPUT`, `SVG`, `CANVAS`).
  - False-positive asset filtering (excluding `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico`).
- **Inline Email Draft Trigger (`✉`)**:
  - Injects subtle draft icons adjacent to detected email text on web pages.
  - Floating draft side panel with pre-filled fields (To, From, Subject, Body, Provider).
- **Multi-Window Isolation**:
  - Staggered individual popup windows (560×650) for each drafted email to prevent Gmail from silently overwriting active drafts in existing tabs.
- **Dynamic Context Menus**:
  - Right-click selected text → `Draft email to "%s"` for manually selected email addresses.
- **Toolbar Counter Badge**:
  - Real-time badge counter on the extension icon displaying the count of detected emails on the active tab.
- **Grouped Contact History**:
  - Grouped by unique email address with first seen / last seen timestamps, source URLs, and visit counts.
  - Lead status management: `⏳ Pending` vs `✅ Submitted`.
  - Keyword search and status filter.
- **Email Template Engine**:
  - Gmail and Microsoft Outlook support.
  - Dynamic token replacement for `{name}`, `{company}`, `{email}`, and `{yourName}`.
