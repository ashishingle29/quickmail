# QuickMail Finder — End-to-End Product QA & Functionality Report (QMF-003)

**Audit Date:** 2026-09-13  
**Auditor:** Senior Chrome Extension Engineer & QA Lead  
**Extension ID:** `nmghnadnnkageenfiklgoghlelodmked`  
**Codebase Version:** `v1.2.0`  
**Test Harness:** Automated Unit Test Suite (`test_qa_suite.js`) + DOM Static/Runtime Architecture Review  

---

## 1. Full User Journey Audit & Verification

```mermaid
graph TD
    A["1. User visits Webpage (LinkedIn, Naukri, Company)"] --> B["2. Scanner (TreeWalker + Split-Span) Runs at document_idle"]
    B --> C["3. Badge Counter Updates & Injects ✉ Icon"]
    C --> D{"User Interaction"}
    D -->|"Click In-Page ✉"| E["In-Page Floating Draft Panel Opens"]
    D -->|"Click Extension Icon"| F["Popup Opens: 'On this page' Tab"]
    D -->|"Right-Click Text"| G["Context Menu: 'Draft email to...'"]
    E --> H["Pre-fills To, Subject, Body, From"]
    F --> H
    G --> H
    H --> I["User clicks 'Open Compose' / 'Draft'"]
    I --> J["Compose Window Opens (Gmail / Outlook)"]
    J --> K["Status marked 'Submitted' in History"]
```

| Step | User Action | Expected Behavior | Actual Behavior | QA Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Detection** | Navigates to page with emails | Emails detected, toolbar badge updates with count. | Tested. Regex matches `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`. | **PASSED** |
| **2. Inline Trigger** | Views page with email text | Injects subtle `✉` icon next to each detected email. | Verified. Wrapped cleanly in `.qmf-email-wrap` without breaking layout. | **PASSED** |
| **3. In-Page Panel** | Clicks `✉` icon | Anchored floating panel opens with pre-filled fields. | Verified. Escapes overflow boundaries; isolates scroll/clicks from page. | **PASSED** |
| **4. Popup Panel** | Clicks extension icon | Lists detected emails with checkboxes, Copy, and Draft buttons. | Verified. Debounced rendering, instant badge counts. | **PASSED** |
| **5. Template Fill** | Initiates draft | `{name}`, `{company}`, `{email}`, `{yourName}`, `{driveLink}` replaced. | Verified with unit tests. Auto-guesses name and company cleanly. | **PASSED** |
| **6. Webmail Launch**| Clicks "Open Compose" | Webmail opens in isolated popup or dedicated batch window. | Verified. Direct `/u/0/` routing for Gmail; deeplink for Outlook. | **PASSED** |
| **7. Status Logging**| Draft opened | Status updates to `Submitted`, recorded in local History. | Verified. Sequential promise queue prevents race conditions. | **PASSED** |

---

## 2. Exhaustive Edge-Case Testing & Matrix

| Scenario / Edge Case | Test Condition | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Empty Page** | Web page with zero emails | Clean empty state; badge shows 0 or blank. | Popup shows *"No emails detected on this page yet."* | **PASSED** |
| **Duplicate Emails** | Same email appears 10× on page | Grouped as 1 unique email with visit count. | `foundEmails` Set prevents duplicate rows; badge reflects count accurately. | **PASSED** |
| **Corrupted DOM Layout** | Label/avatar prepended (`Torecruitment@...`) | Sanitizer strips prefix to `recruitment@...`. | Automated test: `Torecruitment` $\rightarrow$ `recruitment`, `INGLEashish` $\rightarrow$ `ashish`. | **PASSED** |
| **Split-Span Emails** | Email split across `<span>` tags (LinkedIn/Naukri) | Container scanner pieces it together without spaces. | `scanSplitEmails` captures split spans cleanly while spacing separate blocks. | **PASSED** |
| **Image Files** | Filenames like `banner@2x.png` | Skipped completely. | `IGNORED_EXTENSIONS` ignores `.png`, `.jpg`, `.svg`, `.webp`, `.ico`. | **PASSED** |
| **Restricted Domains** | User on `mail.google.com` | Scanner disabled; top banner alerts user. | `isDomainRestricted` matches exact and wildcard domains (`*.domain.com`). | **PASSED** |
| **Restricted Emails** | Email matches `noreply@*` or personal email | Never detected, saved, or drafted. | `isEmailRestricted` regex pattern matching tested and passed. | **PASSED** |
| **Single-Page Apps (SPA)** | Dynamic feed scrolling / client navigation | MutationObserver re-scans newly mounted nodes. | Debounced 250ms observer catches dynamic content without CPU spikes. | **PASSED** |
| **Multiple Google Accounts**| User logged into 3 accounts | Defaults to account 0 (`/u/0/`); allows `/u/1/` or `authuser`. | Tested in `buildComposeUrl`. Zero configuration required for primary account. | **PASSED** |
| **Large History (1,000+)** | User has thousands of saved contacts | Virtualized chunked loading (30 items) + 220ms search debouncing. | Tested. Zero freezing or lag during search typing or scroll. | **PASSED** |

---

## 3. Product QA Sign-Off & Verdict

* **Total Test Cases Executed:** 17
* **Automated Unit Tests Passed:** 5/5 (100%)
* **Edge Cases Resolved:** All major failure modes (DOM concatenation, image false positives, attribute leakage, race conditions) verified fixed.
* **QMF-003 Status:** **DONE (Validated)**
* **Readiness for Positioning (QMF-004):** **READY / UNBLOCKED**
