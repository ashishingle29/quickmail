# QuickMail Finder — Technical Security & Permissions Audit (QMF-002)

**Audit Date:** 2026-09-13  
**Auditor:** Senior Chrome Extension Engineer & Security Auditor  
**Extension ID:** `nmghnadnnkageenfiklgoghlelodmked`  
**Manifest Version:** MV3 (`manifest_version: 3`)  
**Current Declared Permissions:** `["storage", "contextMenus", "activeTab", "tabs"]`  
**Current Host Permissions:** `["<all_urls>"]`  

---

## 1. Executive Summary & Verdict

| Permission / Asset | Chrome Install Warning Triggered | Code Usage & Necessity | Trust Friction | Strategic Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **`storage`** | **None** | Essential for user templates, settings, theme, domain blacklists (`sync`), and deduplicated contact history (`local`). | **Zero** | **Keep** (Verified necessary). |
| **`contextMenus`** | **None** | Powers the right-click `Draft email to "%s"` shortcut for highlighted text. | **Zero** | **Keep** (Verified necessary). |
| **`activeTab`** | **None** | Grants temporary elevated privileges on the active tab upon user click (popup open). | **Zero** | **Keep** (Best-practice security pattern). |
| **`tabs`** | ⚠️ **"Read your browsing history"** | Redundant. Used only for tab navigation, lifecycle tracking, and closing compose tabs—all of which operate without the `tabs` permission. | **HIGH (Conversion Killer)** | **REMOVE from `manifest.json`**. Eliminates the scary browsing history warning. |
| **`<all_urls>`** | ⚠️ **"Read and change all your data on all websites"** | Required for real-time DOM email detection and toolbar badge count across arbitrary websites. | **Medium-High** | **Keep, but justify proactively** in store listing copy and CWS justification. |

---

## 2. Detailed Technical Permissions Audit

### 1. `storage`
* **Used Where:**
  * `background.js`: Saves/retrieves history, layout options, and compose window session state.
  * `popup.js`: Saves/retrieves templates, sender accounts, theme, restricted domains/emails.
  * `content.js`: Synchronizes settings in real time via `chrome.storage.onChanged`.
* **API Level:** `chrome.storage.sync`, `chrome.storage.local`, `chrome.storage.session`.
* **Is it necessary?** **YES**. Without storage, user templates and history cannot persist.
* **Risk / Warning:** Zero install warning. Device-local storage.
* **Verdict:** **REQUIRED & COMPLIANT**.

---

### 2. `contextMenus`
* **Used Where:**
  * `background.js` (L14): `chrome.contextMenus.create({ id: "qmf-draft-email", title: 'Draft email to "%s"', contexts: ["selection"] })`
* **Is it necessary?** **YES**. Enables drafting to emails inside form fields or non-scanned elements.
* **Risk / Warning:** Zero install warning.
* **Verdict:** **REQUIRED & COMPLIANT**.

---

### 3. `activeTab`
* **Used Where:**
  * `popup.js`: `chrome.tabs.query({ active: true, currentWindow: true })`, querying current tab URL/title and communicating with `content.js`.
* **Is it necessary?** **YES**. It provides security-cleared temporary access to the active tab without triggering permanent permission warnings.
* **Risk / Warning:** Zero install warning. Recommended by Google as the gold standard for MV3 extensions.
* **Verdict:** **REQUIRED & COMPLIANT**.

---

### 4. `tabs` (HIGH-PRIORITY FINDING)
* **What warning does Chrome display?**
  👉 **"Read your browsing history"**
* **Code Inspection:**
  * The codebase uses `chrome.tabs.create`, `chrome.tabs.update`, `chrome.tabs.remove`, and `chrome.tabs.onUpdated`.
  * **CRITICAL CHROME MV3 ARCHITECTURE FACT:**
    1. `chrome.tabs.create({ url })` does **not** require the `"tabs"` permission.
    2. `chrome.tabs.remove(tabId)` does **not** require the `"tabs"` permission.
    3. `chrome.tabs.update(tabId, { active: true })` does **not** require the `"tabs"` permission.
    4. `chrome.tabs.onUpdated.addListener` checking `changeInfo.status === "loading"` does **not** require the `"tabs"` permission.
    5. Accessing `tab.url` and `tab.title` on the active tab from `popup.js` is already granted by **`activeTab`**.
* **Impact on Conversion:**
  When potential users click "Add to Chrome", seeing *"Read your browsing history"* causes alarm and severe drop-off (especially for business professionals and job seekers).
* **Recommendation:**
  **Remove `"tabs"` from `manifest.json` `permissions` array.**
  The extension will function identically, while completely eliminating the browsing history warning on the Chrome Web Store!

---

### 5. `host_permissions: ["<all_urls>"]`
* **What warning does Chrome display?**
  👉 **"Read and change all your data on all websites"**
* **Why is it needed?**
  * QuickMail Finder's core value is automatically scanning web pages for email addresses as you browse and showing the live count on the toolbar icon.
  * In Manifest V3, automated content scripts that run on web pages without requiring a manual click first must declare matching host permissions.
* **Can it be restricted?**
  * If restricted to specific domains (e.g., `*://*.linkedin.com/*`), it would break detection on company "About" pages, blogs, and university directories.
* **CWS Review & User Friction Mitigation:**
  * In the Chrome Web Store Developer Dashboard, the justification must clearly state:
    *"Host permissions are strictly used by content scripts to detect email regex strings within visible webpage text and inject the inline draft icon. No page data, browsing history, or personal communications are ever transmitted, collected, or stored off-device."*
  * In the store listing description, add a prominent **"Why does Chrome ask for permissions?"** transparency section.

---

## 3. Security, CSP & Codebase Hygiene Audit

| Security Domain | Status | Finding & Evidence |
| :--- | :--- | :--- |
| **Content Security Policy (CSP)** | **CLEAN** | Strict MV3 compliance (`script-src 'self'`). Zero remote scripts (`<script src="http...">`), zero inline event attributes (`onclick="..."` in HTML files is absent). |
| **Dynamic Code Execution** | **CLEAN** | Zero `eval()`, zero `new Function()`, zero `setTimeout(string)`. |
| **XSS Prevention in DOM Injection** | **SECURE** | All user inputs (`driveTitle`, `driveLink`, `email`, `hostname`, `pageTitle`) pass through strict HTML entity encoding (`escapeHtml`) before innerHTML assignment. Attachment enhancer strictly validates URL protocols against `https://(drive\|docs).google.com/`. |
| **Hardcoded Secrets & API Keys** | **CLEAN** | Zero private keys, zero backend tokens, zero exposed credentials. |
| **Network Security** | **CLEAN** | No insecure `http://` resources. All generated compose URLs use secure HTTPS (`https://mail.google.com`, `https://outlook.office.com`). |
| **Storage Quotas & DOS Prevention** | **PROTECTED** | Local contact history is capped at `MAX_HISTORY = 1000` entries using automated FIFO eviction (`history.length = MAX_HISTORY`), preventing runaway local disk growth. |

---

## 4. Actionable Deliverable & Implementation Steps

1. **Modify `manifest.json`**:
   Remove `"tabs"` from the `permissions` array:
   ```json
   "permissions": ["storage", "contextMenus", "activeTab"]
   ```
2. **Validate**:
   Load unpacked in Chrome, test:
   - Popup opening and badge rendering
   - Compose window creation (Gmail & Outlook)
   - Background tab creation in bulk outreach mode
   - Context menu right-click draft creation
3. **Outcome**:
   Eliminates the *"Read your browsing history"* warning completely, drastically increasing CWS conversion rates.
