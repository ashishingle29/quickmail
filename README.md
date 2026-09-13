# QuickMail Finder

A Chrome (Manifest V3) extension that finds email addresses on **any**
website — LinkedIn, Naukri, company "About" pages, anywhere — and lets you
open a pre-filled Gmail or Outlook compose tab in one click, so all that's
left to do is hit **Send**.

## What it does

- Scans the page you're on (including content that loads dynamically, like
  LinkedIn/Naukri single-page apps, or Gmail/inbox-style virtualized lists)
  and marks every email address it finds with a small ✉️ icon.
- **Live badge count** — the toolbar icon shows how many emails are
  currently detected on the page, updating in real time as you scroll or
  as new content loads.
- Click the icon → a small panel opens with:
  - **To**: the detected address
  - **Subject / Body**: pre-filled from a template you set once, with
    placeholders like `{name}` and `{company}` auto-guessed from the email
    (e.g. `john.doe@acme.com` → name guess "john doe", company guess
    "acme") — you can still edit them before sending.
  - A provider switch (Gmail / Outlook).
- Click **"Open Compose"** → Gmail or Outlook opens already filled in with
  To/Subject/Body, reusing the **same tab** every time (see below) instead
  of stacking new compose windows.
- The toolbar popup has three tabs:
  - **On this page** — every email found on the current page, with a
    Draft button next to each and a **📊 Export** button to export page emails to Excel (.csv).
  - **History** — emails are **grouped by unique email address** (avoiding long duplicate lists). Displays status tags (**⏳ Pending** / **✅ Submitted**), all captured website sources per email, quick **Draft** button, status toggle, website source remover (✖), and email group delete (🗑️).
  - **Template** — edit your saved Subject/Body template, Google Drive file link, and provider.
- **Global ON / OFF Switch** — Toggle the extension ON or OFF anytime via the header switch. When OFF, page scanning stops, on-page icons are removed, and the toolbar icon displays `OFF`.
- **Multi-Email Bulk Compose** — Select multiple emails using checkboxes (or Select All) on either the **On this page** tab or **History** tab and click **Draft Selected** with your choice of **Separate 1-on-1**, **BCC (Hidden)**, or **TO (Shared)** mode.
- **Google Drive / PDF Attachment Links** — Attach shared Google Drive document/PDF links in your template settings using the `{driveLink}` placeholder with live preview and custom display styles (`Clean Link`, `Attachment Pill`, `Document Card`).
- **Status Tracking & Action Tracking** — Track whether you have taken action on an email (Pending vs Submitted). Drafting to single or multiple emails automatically updates their status to **Submitted**.
- **Excel Export with Merged Cells (.xls)** — Export history to Excel spreadsheets (`.xls`). When an email was found across multiple websites, Excel natively displays the email address, status, first/last seen dates, and total counts as **merged cells** spanning all associated website rows.
- Right-click any selected email text on a page → **"Draft email to..."**
  works the same way, even for addresses inside places the scanner skips
  (form fields, etc.).

No login, no OAuth, no backend server — it only builds a URL and opens your
existing Gmail/Outlook web session.

### Choosing which account it sends from

If you're signed into multiple Google accounts in the same browser, Gmail's
compose link defaults to whichever account is currently active — not
necessarily the one you want to send from. Set this once and every draft
will use it:

1. Open the extension popup → **Template** tab.
2. In **Send from account**, enter either:
   - The full email address (e.g. `ashishingle589@gmail.com`), or
   - That account's position number in your Google account switcher
     (0 = first/primary account, 1 = second, etc.)
3. Save. Every compose link generated from then on includes that account.

You can also override it per-draft in the **From account** field of the
on-page draft panel, without changing your saved default.

For Outlook, enter the account's email — it's passed as a login hint,
which works if that account is already signed in on that browser.

Leave the field blank to keep the old behavior (whichever account Gmail/
Outlook currently has active).

### One small popup window per draft — never overwrites another

Earlier this reused a single Gmail tab for every compose link, but Gmail's
own SPA just swaps the fields of whatever compose form is already open in
that tab — so an in-progress, unsent draft would silently get overwritten
by the next email you clicked. Now, each address you draft to opens in its
own small popup window (560×650, slightly staggered so several don't land
in an identical spot):

- Click a **different** email → a brand-new popup window opens. Nothing
  is shared, so nothing can be overwritten.
- Click the **same** email again while its window is still open → that
  window is just refocused, its contents left untouched.
- Close a popup whenever you're done with that one — it doesn't affect
  any of the others.

## Install (unpacked, for testing/personal use)

1. Unzip this folder somewhere on your computer.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped `mail-extension` folder.
5. Pin the extension (puzzle-piece icon in the toolbar → pin QuickMail
   Finder) so it's easy to reach.

## Setting your template

1. Click the extension icon → **Template** tab.
2. Choose Gmail or Outlook.
3. Edit the Subject and Body. Available placeholders:
   - `{name}` — guessed from the part of the email before `@`
   - `{company}` — guessed from the email's domain
   - `{email}` — the full detected address
   - `{yourName}` — not auto-filled; type your own name directly into the
     template (e.g. replace it with "Priya Sharma") since it's the same on
     every email you send.
4. Click **Save template**. It's stored in `chrome.storage.sync`, so it
   follows you across Chrome profiles signed into the same Google account.

## Permissions added in this update

- **`tabs`** — needed to detect whether your last-used Gmail/Outlook tab
  is still open and to navigate it to a new compose link (instead of
  opening a new tab every time).
- History is stored in `chrome.storage.local` (device-local, not synced),
  capped at the most recent 1000 detected emails.

## Notes & limitations

- Gmail/Outlook deep-links require you to already be logged into
  mail.google.com / outlook.office.com in that browser — the extension
  doesn't send anything on your behalf.
- Very long bodies can hit URL length limits in some browsers; keep
  templates reasonably concise.
- The scanner ignores text inside `<script>`, `<style>`, form fields, and
  iframes for safety/performance — use the right-click "Draft email to"
  option on selected text for those cases.

---

## 📦 Version & Release History

| Version | Status | Highlights |
| :--- | :--- | :--- |
| **[v1.2.0](#version-120--latest-release)** | 🚀 **Latest Release** | Email prefix sanitizer fix, Restricted Domains/Emails, Debounced history search, Bouncing cascade windows, Compact checkmark UI, Primary Gmail `/u/0/` routing |
| **[v1.1.0](#version-110)** | Stable | Auto-scroll feed scanner (`📡 Scan Feed`), Split-span detection, Multi-email bulk outreach (Separate, BCC, TO), Google Drive attachment styling & preview, Dark/Light theme, Excel (.xls) merged cell export |
| **[v1.0.0](#version-100--initial-release)** | Initial Release | Manifest V3 foundation, Real-time DOM text scanning, Inline 1-click draft panel (`✉`), Grouped history tracking, Email template engine |

---

### [Version 1.2.0] — Latest Release

#### 🚀 Features & Enhancements
- **Intelligent Email Prefix Sanitizer & Glitch Fix**:
  - Automatically cleans erroneous prefixes attached to email addresses from web layouts:
    - Strips label/protocol prefixes (`mailto:`, `email:`, `to:`, `contact:`, `reach:`).
    - Cleans run-on `To` prefixes before names and job role keywords (`Torecruitment@...` → `recruitment@...`, `Tohr@...` → `hr@...`, `ToVaishali@...` → `Vaishali@...`).
    - Strips ALL-CAPS surname run-ons from profile cards (`INGLEashishingle589@...` → `ashishingle589@...`).
    - Strips duplicate avatar initials (`Hharsadash77@...` → `harsadash77@...`).
  - Automatic migration & deduplication: instantly sanitizes and merges existing corrupted records in history storage.
- **Restricted Websites (Domain Blacklist)**:
  - Exclude entire websites (e.g. `mail.google.com`, `outlook.live.com`) from being scanned.
  - One-click `+ Add Current Site` button and on-page banner with unrestrict shortcut.
- **Restricted Emails (Address Blacklist)**:
  - Block specific email addresses or patterns (with wildcard `*` support) so personal or company emails are never detected or added to history.
  - One-click `+ Add My Email` shortcut.
- **Debounced History Search & Chunked Lazy-Loading**:
  - 220ms search debouncing eliminates UI freezes across large datasets.
  - Smooth 30-item chunked virtualized lazy-loading reduces DOM overhead by >90%.
  - Centralized event delegation for high-speed list responsiveness.
- **Global Search & Bulk Actions**:
  - Multi-field search querying email, domain, page title, URL, timestamp, and status.
  - Global bulk selection (`Select All`, `Draft Selected`, `Copy Selected`, `Mark Submitted/Pending`, `Export to Excel`) operating across the entire dataset in memory.
- **Zero-Configuration Primary Gmail Account Routing (`/u/0/`)**:
  - Automatically routes compose links to account index `/u/0/` when no account is specified.
- **Bouncing Ping-Pong Cascade Windows**:
  - Dynamic window positioning for separate popups that reverses horizontal direction when hitting monitor edges, keeping send buttons visible.
- **Compact "Submitted" UI with Timestamp Tooltips**:
  - Space-saving circular checkmark badge (`✓`) preventing email truncation.
  - Hover tooltip showing exact submission date and time.

#### 🐛 Bug Fixes
- **DOM Container Spacing**: Traverses elements with whitespace boundaries to prevent adjacent text nodes from concatenating into corrupted emails.
- **High-Concurrency HTML Safety**: Replaced regex innerHTML modification with immutable DOM widgets, eliminating raw HTML code leakage in Gmail/Outlook compose editors.
- **On-Page Draft Status Sync**: Floating panel "Open Compose" button reliably marks emails as Submitted in history storage.
- **Storage Queue Serialization**: Fixed race conditions during rapid multi-draft updates.

---

### [Version 1.1.0]

#### 🚀 Features & Enhancements
- **Auto-Scroll Feed Scanner (`📡 Scan Feed`)**:
  - Hands-free automated scrolling for infinite-scroll feeds (LinkedIn, Twitter/X, job boards) with on-screen stop pill.
- **Split-Span Email Detection**:
  - Detects emails split across multiple child HTML tags (`<span>user</span><span>@</span><span>domain.com</span>`).
- **Markdown Link Formatting**:
  - Support for `[Link Text](URL)` format in body templates, rendered as rich clickable hyperlinks.
- **Multi-Email Bulk Compose Modes**:
  - **Separate (Personalized 1-on-1)**: Staggered independent windows with individualized token replacement.
  - **BCC (Hidden List)**: Single compose window with hidden recipients.
  - **TO (Shared List)**: Single compose window with shared recipients.
- **Google Drive / PDF Attachment Card Styles**:
  - Three configurable formats for `{driveLink}`: `Clean Link`, `Attachment Pill`, `Document Box Card` with interactive live preview.
- **Theme Customization**:
  - System Auto, Dark, and Light themes.
- **Global ON/OFF Switch**:
  - Master toggle switch to pause all scanning and remove injected icons.
- **Dual Detection Modes**:
  - Switch between `Auto` logging and `Manual` verification (`➕ Add to List & History`).
- **Excel (.xls) Export with Merged Cells**:
  - Professional spreadsheet export with multi-row span merging for email addresses found across multiple websites.

---

### [Version 1.0.0] — Initial Release

#### 🚀 Core Capabilities
- **Manifest V3 Architecture**: Modern Chrome service worker and declarative content scripts.
- **Real-Time DOM Scanner**: TreeWalker text scanner with smart tag exclusions and false-positive image file filtering.
- **Inline Draft Trigger (`✉`)**: Subtle in-page icons opening pre-filled draft panels.
- **Toolbar Badge**: Real-time detected email counter on the extension icon.
- **Grouped Contact History**: Deduplicated history tracking by email with visit counts and lead statuses (`Pending` vs `Submitted`).
- **Template Engine**: Dynamic token replacement for `{name}`, `{company}`, `{email}`, and `{yourName}` supporting Gmail and Microsoft Outlook.
- **Context Menu Integration**: Right-click selected text → `Draft email to "%s"`.

For complete technical change logs and Chrome Web Store submission notes, see [CHANGELOG.md](CHANGELOG.md).


