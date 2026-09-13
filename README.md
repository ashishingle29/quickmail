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

## What's New in Version 1.2.0 (Release Notes)

### 🚀 New Features & Enhancements
- **Auto-Detection for Primary Gmail Account (`/u/0/`)**:
  - Automatically targets account index `/u/0/` (your primary/first logged-in Google account) on any browser, system, or profile out of the box when no account is specified.
- **Redesigned Compact "Submitted" UI**:
  - Replaced wide inline text tags with a sleek, circular green checkmark badge (`✓`) that preserves horizontal layout and prevents email truncation.
  - Hovering over the checkmark badge reveals the exact submission timestamp (`Submitted at: DD Mon YYYY, HH:MM`).
  - Hovering over the row's selection checkbox or the **Resend** button also reveals the submission date & time.
  - Improved row contrast with soft green accents for submitted emails.

### 🐛 Bug Fixes
- **On-Page Quick Draft Status Tracking**:
  - Fixed an issue where clicking "Open Compose" from the on-page (DOM) draft panel failed to mark the email as "Submitted" and missed recording the submission timestamp in History. Both the popup and on-page drafts now consistently record status.

### 🛡️ Production & Chrome Web Store Readiness
- **Minimal Permissions Compliant**: Removed unused `"scripting"` permission to ensure smooth and fast Chrome Web Store approval.
- **Context Invalidation Protection**: Added cleanup listeners in content scripts to avoid `Extension context invalidated` console errors when updating or reloading.
- **Generic Public Template Defaults**: Removed hardcoded sample emails in template inputs.

