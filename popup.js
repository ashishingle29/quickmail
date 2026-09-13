const DEFAULT_SETTINGS = {
  isEnabled: true,
  detectionMode: "auto",
  provider: "gmail",
  fromAccount: "",
  yourName: "",
  driveLink: "",
  driveTitle: "Attached_Document.pdf",
  driveStyle: "link",
  draftWindowStyle: "batch_window",
  restrictedDomains: "mail.google.com, outlook.live.com, outlook.office.com",
  restrictedEmails: "",
  subjectTemplate: "Regarding an opportunity at {company}",
  bodyTemplate:
    "Hi {name},\n\nI came across your profile and wanted to reach out regarding an opportunity at {company}.\n\nWould you be open to a quick chat?\n\nBest regards,\n{yourName}",
};

function isDomainRestricted(hostname, restrictedDomainsStr) {
  if (!hostname || !restrictedDomainsStr) return false;
  const currentHost = hostname.toLowerCase().trim();
  const patterns = restrictedDomainsStr
    .split(/[,\n]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  return patterns.some((pattern) => {
    let clean = pattern.replace(/^\*\./, "").replace(/^\./, "").trim();
    if (!clean) return false;
    return currentHost === clean || currentHost.endsWith("." + clean);
  });
}

function isEmailRestricted(email, restrictedEmailsStr) {
  if (!email || !restrictedEmailsStr) return false;
  const emailLower = email.toLowerCase().trim();
  const patterns = restrictedEmailsStr
    .split(/[,\n]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  return patterns.some((pattern) => {
    if (!pattern) return false;
    if (pattern === emailLower) return true;
    if (pattern.includes("*")) {
      const regexStr = "^" + pattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$";
      return new RegExp(regexStr).test(emailLower);
    }
    return false;
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Toast Notification Helper ---
let toastTimer = null;
function showToast(message, type = "info") {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = "toast";
  }, 2400);
}

function copyToClipboard(text, successMsg = "Copied to clipboard!") {
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => showToast(successMsg, "success"),
    () => showToast("Failed to copy", "error")
  );
}

function buildComposeUrl(provider, to, subject, body, fromAccount, bcc = "") {
  const encTo = encodeURIComponent(to || "");
  const encBcc = encodeURIComponent(bcc || "");
  const encSubject = encodeURIComponent(subject || "");
  const encBody = encodeURIComponent(body || "");
  const account = (fromAccount || "").trim();

  if (provider === "outlook") {
    let url = `https://outlook.office.com/mail/deeplink/compose?to=${encTo}&subject=${encSubject}&body=${encBody}`;
    if (bcc) url += `&bcc=${encBcc}`;
    if (account) url += `&login_hint=${encodeURIComponent(account)}`;
    return url;
  }

  // Gmail's /u/<number>/ route works for account positions, but an email
  // address in that path can silently fall back to the first signed-in
  // account. Default to u/0/ (first account) if not specified.
  const isAccountPosition = /^\d+$/.test(account);
  const accountSegment = isAccountPosition ? `u/${account}/` : (account ? "" : "u/0/");
  const authUser = account && !isAccountPosition ? `&authuser=${encodeURIComponent(account)}` : "";
  let url = `https://mail.google.com/mail/${accountSegment}?view=cm&fs=1&to=${encTo}&su=${encSubject}&body=${encBody}${authUser}`;
  if (bcc) url += `&bcc=${encBcc}`;
  return url;
}

function fillTemplate(str, email, driveLink = "", yourName = "") {
  if (!str) return "";
  const namePart = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  const domainPart = email.split("@")[1] || "";
  const companyGuess = domainPart.split(".")[0];
  return str
    .replaceAll(/\{email\}/gi, email)
    .replaceAll(/\{name\}/gi, namePart || "{name}")
    .replaceAll(/\{company\}/gi, companyGuess || "{company}")
    .replaceAll(/\{yourName\}/gi, yourName || "")
    .replaceAll(/\{driveLink\}/gi, driveLink || "")
    .replaceAll(/\{fileLink\}/gi, driveLink || "");
}

function sanitizeEmail(raw) {
  if (!raw || typeof raw !== "string") return "";
  let clean = raw.trim();

  // 1. Remove wrapping quotes, brackets, angle brackets, and punctuation
  clean = clean.replace(/^[<(\['"“‘\s]+/, "").replace(/[.,;)!?\]'">”’\s]+$/, "");

  // 2. Strip common URL/mail/protocol/label prefixes with colon, hyphen, space
  clean = clean.replace(/^(mailto|email|e-mail|mail|to|from|contact|reach|inquiries|attn)[:_\s-]+/i, "");

  // Check valid @ structure
  const atIdx = clean.lastIndexOf("@");
  if (atIdx <= 0 || atIdx === clean.length - 1) return "";

  let localPart = clean.slice(0, atIdx);
  const domainPart = clean.slice(atIdx + 1);

  if (!domainPart.includes(".") || domainPart.startsWith(".") || domainPart.endsWith(".")) {
    return "";
  }

  // 3. Fix "To" glued to localPart:
  // 3a. "To" followed by PascalCase / Capitalized name: ToVaishali -> Vaishali
  localPart = localPart.replace(/^[Tt][Oo](?=[A-Z][a-z0-9])/g, "");

  // 3b. "To" or "TO" followed by common role/department keywords: Torecruitment -> recruitment, Tohr -> hr
  const ROLE_PREFIX_REGEX = /^[Tt][Oo](hr|recruitment|careers|jobs|hiring|talent|info|admin|contact|support|help|hello|team|inquiry|enquiry|sales|office|work|apply|resume|cv|people|staff|intern|interview)(?=[._0-9@-]|$)/i;
  localPart = localPart.replace(ROLE_PREFIX_REGEX, "$1");

  // 3c. "To." or "To_" or "To-" prefix: to.recruitment -> recruitment
  localPart = localPart.replace(/^[Tt][Oo][._-](?=[a-zA-Z0-9])/g, "");

  // 4. ALL-CAPS prefix (surname/title, 3+ uppercase letters) attached to lowercase username:
  // e.g. INGLEashishingle589 -> ashishingle589
  const ALL_CAPS_PREFIX_REGEX = /^([A-Z]{3,})([a-z0-9._%+-]{3,})$/;
  const capsMatch = localPart.match(ALL_CAPS_PREFIX_REGEX);
  if (capsMatch) {
    localPart = capsMatch[2];
  }

  // 5. Duplicate avatar initial letter: e.g. Hharsadash77 -> harsadash77
  if (localPart.length >= 4 && /^[A-Z]/.test(localPart)) {
    const firstChar = localPart[0];
    const secondChar = localPart[1];
    if (firstChar.toLowerCase() === secondChar && /^[a-z]/.test(secondChar)) {
      localPart = localPart.slice(1);
    }
  }

  localPart = localPart.replace(/^[._-]+/, "").replace(/[._-]+$/, "");
  if (!localPart || localPart.length < 2) return "";

  return `${localPart}@${domainPart}`;
}

// Helper to ensure data structure is grouped and sanitized when reading history
function migrateAndGroupHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  const map = new Map();

  for (const item of rawHistory) {
    if (!item || !item.email) continue;
    const cleanEmail = sanitizeEmail(item.email);
    if (!cleanEmail) continue;
    const key = cleanEmail.toLowerCase();

    if (!map.has(key)) {
      const isAlreadyGrouped = Array.isArray(item.sources);
      map.set(key, {
        email: cleanEmail,
        status: item.status || "Pending",
        firstSeen: item.firstSeen || item.lastSeen || Date.now(),
        lastSeen: item.lastSeen || Date.now(),
        submittedAt: item.submittedAt || null,
        totalCount: isAlreadyGrouped ? (item.totalCount || item.sources.reduce((acc, s) => acc + (s.count || 1), 0)) : (item.count || 1),
        sources: isAlreadyGrouped ? item.sources : [
          {
            pageUrl: item.pageUrl || "",
            pageTitle: item.pageTitle || item.pageUrl || "Unknown Page",
            count: item.count || 1,
            lastSeen: item.lastSeen || Date.now()
          }
        ]
      });
    } else {
      const existing = map.get(key);
      existing.firstSeen = Math.min(existing.firstSeen, item.firstSeen || item.lastSeen || Date.now());
      existing.lastSeen = Math.max(existing.lastSeen, item.lastSeen || Date.now());
      if (item.submittedAt) {
        existing.submittedAt = Math.max(existing.submittedAt || 0, item.submittedAt);
      }
      if (item.status === "Submitted") {
        existing.status = "Submitted";
      }

      if (Array.isArray(item.sources)) {
        item.sources.forEach((src) => {
          const sIdx = existing.sources.findIndex((s) => s.pageUrl === src.pageUrl);
          if (sIdx >= 0) {
            existing.sources[sIdx].count = (existing.sources[sIdx].count || 1) + (src.count || 1);
            existing.sources[sIdx].lastSeen = Math.max(existing.sources[sIdx].lastSeen || 0, src.lastSeen || 0);
          } else {
            existing.sources.push({ ...src });
          }
        });
        existing.totalCount = existing.sources.reduce((acc, s) => acc + (s.count || 1), 0);
      } else {
        const sIdx = existing.sources.findIndex((s) => s.pageUrl === item.pageUrl);
        if (sIdx >= 0) {
          existing.sources[sIdx].count += (item.count || 1);
          existing.sources[sIdx].lastSeen = Math.max(existing.sources[sIdx].lastSeen, item.lastSeen || Date.now());
        } else {
          existing.sources.push({
            pageUrl: item.pageUrl || "",
            pageTitle: item.pageTitle || item.pageUrl || "Unknown Page",
            count: item.count || 1,
            lastSeen: item.lastSeen || Date.now()
          });
        }
        existing.totalCount = existing.sources.reduce((acc, s) => acc + (s.count || 1), 0);
      }
    }
  }

  const result = Array.from(map.values());
  result.sort((a, b) => b.lastSeen - a.lastSeen);
  return result;
}

function draftEmail(email) {
  draftMultipleEmails([email], "separate");
}

function draftMultipleEmails(emails, mode = "separate") {
  if (!emails || emails.length === 0) return;

  // Update status in storage to Submitted for all drafted emails
  // We send a message to background.js so it completes even if the popup closes immediately
  chrome.runtime.sendMessage({
    type: "QMF_UPDATE_STATUS",
    emails: emails,
    status: "Submitted"
  });

  chrome.storage.local.get(["draftsCreatedCount"], (res) => {
    const current = (res && res.draftsCreatedCount) || 0;
    chrome.storage.local.set({ draftsCreatedCount: current + emails.length });
  });

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    if (mode === "separate") {
      const windowStyle = settings.draftWindowStyle || "batch_window";

      // If user explicitly chose Option 2: Bouncing Cascade Popups
      if (
        windowStyle === "bouncing_popups" ||
        windowStyle === "popup_windows" ||
        windowStyle === "cascade" ||
        windowStyle === "grid"
      ) {
        const screenW = window.screen.availWidth || 1920;
        const screenH = window.screen.availHeight || 1080;
        emails.forEach((email, idx) => {
          setTimeout(() => {
            const subject = fillTemplate(settings.subjectTemplate, email, settings.driveLink, settings.yourName);
            const body = fillTemplate(settings.bodyTemplate, email, settings.driveLink, settings.yourName);
            const url = buildComposeUrl(settings.provider, email, subject, body, settings.fromAccount);
            chrome.runtime.sendMessage({
              type: "QMF_OPEN_COMPOSE",
              provider: settings.provider,
              email,
              url,
              windowIndex: idx,
              draftWindowStyle: "bouncing_popups",
              screenMetrics: {
                width: screenW,
                height: screenH,
              },
            });
          }, idx * 180);
        });
        setTimeout(() => window.close(), emails.length * 180 + 120);
        return;
      }

      // Default & Recommended (Option 1): ONE clean browser window with parallel preloaded tabs
      const drafts = emails.map((email) => {
        const subject = fillTemplate(settings.subjectTemplate, email, settings.driveLink, settings.yourName);
        const body = fillTemplate(settings.bodyTemplate, email, settings.driveLink, settings.yourName);
        const url = buildComposeUrl(settings.provider, email, subject, body, settings.fromAccount);
        return { email, subject, body, url };
      });

      chrome.runtime.sendMessage(
        {
          type: "QMF_OPEN_BULK_DRAFTS",
          provider: settings.provider,
          drafts,
        },
        () => window.close()
      );
      return;
    } else if (mode === "bcc") {
      // Single compose window with recipients in BCC (hidden list)
      const firstEmail = emails[0];
      const subject = fillTemplate(settings.subjectTemplate, firstEmail, settings.driveLink, settings.yourName);
      const body = fillTemplate(settings.bodyTemplate, firstEmail, settings.driveLink, settings.yourName);
      const bccField = emails.join(",");
      const url = buildComposeUrl(settings.provider, "", subject, body, settings.fromAccount, bccField);
      chrome.runtime.sendMessage(
        {
          type: "QMF_OPEN_COMPOSE",
          provider: settings.provider,
          email: bccField,
          url,
          windowIndex: 0,
          draftWindowStyle: settings.draftWindowStyle || "batch_window",
          screenMetrics: {
            width: window.screen.availWidth || 1920,
            height: window.screen.availHeight || 1080,
          },
        },
        () => window.close()
      );
    } else {
      // Single compose window with recipients in To (shared list)
      const firstEmail = emails[0];
      const subject = fillTemplate(settings.subjectTemplate, firstEmail, settings.driveLink, settings.yourName);
      const body = fillTemplate(settings.bodyTemplate, firstEmail, settings.driveLink, settings.yourName);
      const toField = emails.join(",");
      const url = buildComposeUrl(settings.provider, toField, subject, body, settings.fromAccount);
      chrome.runtime.sendMessage(
        {
          type: "QMF_OPEN_COMPOSE",
          provider: settings.provider,
          email: toField,
          url,
          windowIndex: 0,
          draftWindowStyle: settings.draftWindowStyle || "batch_window",
          screenMetrics: {
            width: window.screen.availWidth || 1920,
            height: window.screen.availHeight || 1080,
          },
        },
        () => window.close()
      );
    }
  });
}

// --- Extension Global ON / OFF Switch ---
const extensionToggleEl = document.getElementById("extension-toggle");
const toggleLabelEl = document.getElementById("toggle-label");
const offBannerEl = document.getElementById("off-banner");

function updateToggleUI(enabled) {
  if (extensionToggleEl) extensionToggleEl.checked = enabled;
  if (toggleLabelEl) {
    toggleLabelEl.textContent = enabled ? "ON" : "OFF";
    toggleLabelEl.classList.toggle("off", !enabled);
  }
  if (offBannerEl) {
    offBannerEl.style.display = enabled ? "none" : "block";
  }
}

chrome.storage.sync.get({ isEnabled: true }, (items) => {
  const enabled = items.isEnabled !== false;
  updateToggleUI(enabled);
});

if (extensionToggleEl) {
  extensionToggleEl.addEventListener("change", () => {
    const enabled = extensionToggleEl.checked;
    updateToggleUI(enabled);
    chrome.storage.sync.set({ isEnabled: enabled });

    // Notify active tab content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "QMF_TOGGLE_STATE", enabled });
      }
    });

    // Notify background worker
    chrome.runtime.sendMessage({ type: "QMF_TOGGLE_STATE", enabled });
  });
}

// --- Theme Selection (System / Dark / Light) ---
const themeSelectEl = document.getElementById("theme-select");

function applyTheme(theme) {
  if (theme === "dark" || theme === "light") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

chrome.storage.sync.get({ theme: "system" }, (items) => {
  const currentTheme = items.theme || "system";
  if (themeSelectEl) themeSelectEl.value = currentTheme;
  applyTheme(currentTheme);
});

if (themeSelectEl) {
  themeSelectEl.addEventListener("change", () => {
    const theme = themeSelectEl.value;
    applyTheme(theme);
    chrome.storage.sync.set({ theme });
  });
}

// --- Detection Mode (Auto vs Manual) ---
const detectionModeSelectEl = document.getElementById("detection-mode-select");

chrome.storage.sync.get({ detectionMode: "auto" }, (items) => {
  if (detectionModeSelectEl) detectionModeSelectEl.value = items.detectionMode || "auto";
});

if (detectionModeSelectEl) {
  detectionModeSelectEl.addEventListener("change", () => {
    const mode = detectionModeSelectEl.value;
    chrome.storage.sync.set({ detectionMode: mode });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "QMF_SET_DETECTION_MODE", mode });
      }
    });
  });
}

// --- Manual Email Addition ---
const manualEmailInputEl = document.getElementById("manual-email-input");
const addManualEmailBtn = document.getElementById("add-manual-email-btn");
const manualAddStatusEl = document.getElementById("manual-add-status");

function handleManualAdd() {
  if (!manualEmailInputEl) return;
  const rawInput = manualEmailInputEl.value.trim();
  const email = sanitizeEmail(rawInput);
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!email || !EMAIL_REGEX.test(email)) {
    if (manualAddStatusEl) {
      manualAddStatusEl.textContent = "Please enter a valid email address.";
      manualAddStatusEl.style.color = "#dc2626";
      setTimeout(() => (manualAddStatusEl.textContent = ""), 2500);
    }
    return;
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    if (isEmailRestricted(email, settings.restrictedEmails)) {
      if (manualAddStatusEl) {
        manualAddStatusEl.textContent = "This email is in your Restricted Emails list.";
        manualAddStatusEl.style.color = "#dc2626";
        setTimeout(() => (manualAddStatusEl.textContent = ""), 2500);
      }
      return;
    }

    if (!currentTabEmails.includes(email)) {
      currentTabEmails.unshift(email);
    }
    renderEmails(currentTabEmails);

    manualEmailInputEl.value = "";
    if (manualAddStatusEl) {
      manualAddStatusEl.textContent = "Email added ✓";
      manualAddStatusEl.style.color = "#16a34a";
      setTimeout(() => (manualAddStatusEl.textContent = ""), 1800);
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0] ? tabs[0] : null;
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { type: "QMF_ADD_MANUAL_EMAIL", email });
      }
      chrome.runtime.sendMessage({
        type: "QMF_RECORD_HISTORY",
        email,
        pageUrl: activeTab ? activeTab.url : location.href,
        pageTitle: activeTab ? activeTab.title : "Manual Add",
        timestamp: Date.now(),
      });
    });
  });
}

if (addManualEmailBtn) addManualEmailBtn.addEventListener("click", handleManualAdd);
if (manualEmailInputEl) {
  manualEmailInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleManualAdd();
  });
}

// --- Scan Feed (auto-scroll + scan all emails) ---
const autoScanBtn = document.getElementById("auto-scan-btn");
let autoScanRunning = false;

function setAutoScanUI(running) {
  autoScanRunning = running;
  if (!autoScanBtn) return;
  if (running) {
    autoScanBtn.textContent = "⏹ Stop Scroll";
    autoScanBtn.classList.add("scanning");
    autoScanBtn.title = "Click to stop auto-scroll";
  } else {
    autoScanBtn.textContent = "📡 Scan Feed";
    autoScanBtn.classList.remove("scanning");
    autoScanBtn.title = "Auto-scroll page and collect all emails";
  }
}

// When popup opens, check if a scroll session is already running
// so the button shows the correct state (Stop vs Scan Feed)
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs || !tabs[0] || !tabs[0].id) return;
  chrome.tabs.sendMessage(tabs[0].id, { type: "QMF_AUTO_SCAN_STATUS" }, (resp) => {
    if (chrome.runtime.lastError) return;
    if (resp && resp.active) setAutoScanUI(true);
  });
});

if (autoScanBtn) {
  autoScanBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].id) return;
      const tabId = tabs[0].id;

      if (!autoScanRunning) {
        // Start → close popup so the page is fully visible while scrolling
        chrome.tabs.sendMessage(tabId, { type: "QMF_AUTO_SCAN_START" }, (resp) => {
          if (chrome.runtime.lastError) {
            showToast("Could not start on this page.", "error");
            return;
          }
          // Close popup after a tiny delay so user sees the button flash
          setTimeout(() => window.close(), 120);
        });
      } else {
        // Stop from popup
        chrome.tabs.sendMessage(tabId, { type: "QMF_AUTO_SCAN_STOP" });
        setAutoScanUI(false);
      }
    });
  });
}

// Reset button if content.js tells us scroll finished
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "QMF_AUTO_SCAN_DONE") {
    setAutoScanUI(false);
  }
});

// --- Tabs ---
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "history") loadHistory();
  });
});

// --- Template form ---
const providerEl = document.getElementById("provider");
const draftWindowStyleEl = document.getElementById("draftWindowStyle");
const fromAccountEl = document.getElementById("fromAccount");
const yourNameEl = document.getElementById("yourName");
const driveLinkEl = document.getElementById("driveLink");
const driveTitleEl = document.getElementById("driveTitle");
const driveStyleEl = document.getElementById("driveStyle");
const demoPreviewEl = document.getElementById("drive-demo-preview");
const subjectEl = document.getElementById("subjectTemplate");
const bodyEl = document.getElementById("bodyTemplate");
const restrictedDomainsEl = document.getElementById("restrictedDomains");
const restrictedEmailsEl = document.getElementById("restrictedEmails");
const addCurrentDomainBtn = document.getElementById("add-current-domain-btn");
const addAccountEmailBtn = document.getElementById("add-account-email-btn");
const unrestrictDomainBtn = document.getElementById("unrestrict-domain-btn");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");

function updateDemoPreview() {
  if (!demoPreviewEl) return;
  const link = (driveLinkEl ? driveLinkEl.value : "").trim() || "https://drive.google.com/file/d/demo/view";
  const title = (driveTitleEl ? driveTitleEl.value : "").trim() || "Attached_Document.pdf";
  const style = driveStyleEl ? driveStyleEl.value : "link";

  if (style === "link") {
    demoPreviewEl.innerHTML = `<div class="demo-preview-row">📄 <b>Attached Document:</b> <a href="${link}" target="_blank" onclick="return false;" class="demo-link-text">${escapeHtml(title)}</a></div>`;
  } else if (style === "pill") {
    demoPreviewEl.innerHTML = `<div style="display: inline-block;"><a href="${link}" target="_blank" onclick="return false;" class="demo-pill-btn"><span class="pdf-tag">PDF</span><span>${escapeHtml(title)}</span><span style="font-size: 11px;">↗</span></a></div>`;
  } else {
    demoPreviewEl.innerHTML = `<div class="demo-card-box"><table cellpadding="0" cellspacing="0" style="width: 100%;"><tr><td style="vertical-align: middle; padding-right: 12px; width: 42px;"><div class="pdf-badge-square">PDF</div></td><td style="vertical-align: middle;"><div class="demo-card-title">${escapeHtml(title)}</div><a href="${link}" target="_blank" onclick="return false;" class="demo-card-sublink">📎 Click to View &amp; Download File</a></td></tr></table></div>`;
  }
}

if (driveLinkEl) driveLinkEl.addEventListener("input", updateDemoPreview);
if (driveTitleEl) driveTitleEl.addEventListener("input", updateDemoPreview);
if (driveStyleEl) driveStyleEl.addEventListener("change", updateDemoPreview);

chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
  providerEl.value = items.provider;
  let currentStyle = items.draftWindowStyle || "batch_window";
  if (currentStyle === "popup_windows" || currentStyle === "grid" || currentStyle === "cascade") {
    currentStyle = "bouncing_popups";
  }
  if (draftWindowStyleEl) draftWindowStyleEl.value = currentStyle;
  fromAccountEl.value = items.fromAccount || "";
  if (yourNameEl) yourNameEl.value = items.yourName || "";
  if (driveLinkEl) driveLinkEl.value = items.driveLink || "";
  if (driveTitleEl) driveTitleEl.value = items.driveTitle || "Attached_Document.pdf";
  if (driveStyleEl) driveStyleEl.value = items.driveStyle || "link";
  subjectEl.value = items.subjectTemplate;
  bodyEl.value = items.bodyTemplate;
  if (restrictedDomainsEl) restrictedDomainsEl.value = items.restrictedDomains || "";
  if (restrictedEmailsEl) restrictedEmailsEl.value = items.restrictedEmails || "";
  updateDemoPreview();
});

if (addCurrentDomainBtn) {
  addCurrentDomainBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].url) return;
      try {
        const host = new URL(tabs[0].url).hostname.replace(/^www\./, "");
        if (!host || host.startsWith("chrome") || host.startsWith("edge")) return;
        const currentVal = restrictedDomainsEl ? restrictedDomainsEl.value.trim() : "";
        const list = currentVal.split(/[,\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
        if (!list.includes(host.toLowerCase())) {
          restrictedDomainsEl.value = currentVal ? `${currentVal}, ${host}` : host;
          showToast(`Added ${host} to restricted sites`, "info");
        } else {
          showToast(`${host} is already in list`, "info");
        }
      } catch (e) {}
    });
  });
}

if (addAccountEmailBtn) {
  addAccountEmailBtn.addEventListener("click", () => {
    const acc = fromAccountEl ? fromAccountEl.value.trim() : "";
    if (!acc || !acc.includes("@")) {
      showToast("Enter a valid email in 'Send from account' first", "info");
      return;
    }
    const currentVal = restrictedEmailsEl ? restrictedEmailsEl.value.trim() : "";
    const list = currentVal.split(/[,\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!list.includes(acc.toLowerCase())) {
      restrictedEmailsEl.value = currentVal ? `${currentVal}, ${acc}` : acc;
      showToast(`Added ${acc} to restricted emails`, "info");
    } else {
      showToast(`${acc} is already in list`, "info");
    }
  });
}

if (unrestrictDomainBtn) {
  unrestrictDomainBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].url) return;
      try {
        const host = new URL(tabs[0].url).hostname.replace(/^www\./, "");
        chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
          const currentList = (settings.restrictedDomains || "").split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
          const newList = currentList.filter((d) => {
            const clean = d.replace(/^\*\./, "").replace(/^\./, "").toLowerCase();
            return clean !== host.toLowerCase() && !host.toLowerCase().endsWith("." + clean);
          });
          const newStr = newList.join(", ");
          chrome.storage.sync.set({ restrictedDomains: newStr }, () => {
            if (restrictedDomainsEl) restrictedDomainsEl.value = newStr;
            const banner = document.getElementById("domain-restricted-banner");
            if (banner) banner.style.display = "none";
            showToast(`Allowed ${host} ✓`, "success");
            if (tabs[0].id) chrome.tabs.reload(tabs[0].id);
          });
        });
      } catch (e) {}
    });
  });
}

saveBtn.addEventListener("click", () => {
  const settings = {
    provider: providerEl.value,
    draftWindowStyle: draftWindowStyleEl ? draftWindowStyleEl.value : "batch_window",
    fromAccount: fromAccountEl.value.trim(),
    yourName: yourNameEl ? yourNameEl.value.trim() : "",
    driveLink: driveLinkEl ? driveLinkEl.value.trim() : "",
    driveTitle: driveTitleEl ? driveTitleEl.value.trim() : "Attached_Document.pdf",
    driveStyle: driveStyleEl ? driveStyleEl.value : "link",
    subjectTemplate: subjectEl.value,
    bodyTemplate: bodyEl.value,
    restrictedDomains: restrictedDomainsEl ? restrictedDomainsEl.value.trim() : "",
    restrictedEmails: restrictedEmailsEl ? restrictedEmailsEl.value.trim() : "",
  };
  chrome.storage.sync.set(settings, () => {
    saveStatus.textContent = "Saved ✓";
    showToast("Settings saved ✓", "success");
    setTimeout(() => (saveStatus.textContent = ""), 1500);
  });
});

// --- CSV & Excel Export Helpers ---
function escapeCsvCell(cell) {
  if (cell === null || cell === undefined) return '""';
  const str = String(cell);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function downloadCsv(filename, headers, rows) {
  const csvLines = [];
  csvLines.push(headers.map(escapeCsvCell).join(","));
  rows.forEach((row) => {
    csvLines.push(row.map(escapeCsvCell).join(","));
  });
  const csvContent = "\uFEFF" + csvLines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Download Excel .xls file with rowspan merged cells for grouped websites
function downloadExcelXls(filename, list) {
  let rowsHtml = "";

  list.forEach((entry) => {
    const sources = (entry.sources && entry.sources.length > 0)
      ? entry.sources
      : [{ pageTitle: "Unknown", pageUrl: "", count: 1, lastSeen: entry.lastSeen }];

    const span = sources.length;
    const emailCell = `<td rowspan="${span}">${escapeHtml(entry.email)}</td>`;
    const statusCell = `<td rowspan="${span}">${escapeHtml(entry.status || "Pending")}</td>`;
    const totalCell = `<td rowspan="${span}">${entry.totalCount || 1}</td>`;
    const firstCell = `<td rowspan="${span}">${formatDateTime(entry.firstSeen)}</td>`;
    const lastCell = `<td rowspan="${span}">${formatDateTime(entry.lastSeen)}</td>`;

    sources.forEach((src, idx) => {
      rowsHtml += "<tr>";
      if (idx === 0) {
        rowsHtml += emailCell + statusCell + totalCell + firstCell + lastCell;
      }
      rowsHtml += `<td>${escapeHtml(src.pageTitle || src.pageUrl)}</td>`;
      rowsHtml += `<td>${escapeHtml(src.pageUrl || "")}</td>`;
      rowsHtml += `<td>${src.count || 1}</td>`;
      rowsHtml += "</tr>";
    });
  });

  const xlsContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Segoe UI, sans-serif; }
        th { background-color: #2563eb; color: #ffffff; font-weight: bold; border: 1px solid #1d4ed8; padding: 8px 10px; text-align: left; }
        td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; vertical-align: top; }
        tr:nth-child(even) td { background-color: #f8fafc; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th>Email Address</th>
            <th>Status</th>
            <th>Total Seen</th>
            <th>First Seen</th>
            <th>Last Seen</th>
            <th>Website Title</th>
            <th>Website URL</th>
            <th>Website Visit Count</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(["\uFEFF" + xlsContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// --- Email list for current tab ---
const emailListEl = document.getElementById("email-list");
const exportPageBtn = document.getElementById("export-page-btn");
const selectAllPageEl = document.getElementById("select-all-page");
const draftSelectedPageBtn = document.getElementById("draft-selected-page-btn");
const copySelectedPageBtn = document.getElementById("copy-selected-page-btn");

let currentTabEmails = [];
let currentTabInfo = { title: "Unknown Page", url: "" };

function updatePageSelectionState() {
  const checkboxes = document.querySelectorAll(".page-email-checkbox");
  const checked = Array.from(checkboxes).filter((c) => c.checked);
  const count = checked.length;
  if (draftSelectedPageBtn) {
    draftSelectedPageBtn.textContent = `Draft (${count})`;
    draftSelectedPageBtn.disabled = count === 0;
  }
  if (copySelectedPageBtn) {
    copySelectedPageBtn.disabled = count === 0;
  }
  if (selectAllPageEl) {
    selectAllPageEl.checked = checkboxes.length > 0 && count === checkboxes.length;
  }
}

function renderEmails(emails) {
  currentTabEmails = emails || [];
  const count = currentTabEmails.length;
  const countEl = document.getElementById("page-email-count");
  const badgeEl = document.getElementById("tab-page-badge");
  if (countEl) countEl.textContent = count;
  if (badgeEl) badgeEl.textContent = count;

  if (selectAllPageEl) selectAllPageEl.checked = false;
  if (draftSelectedPageBtn) {
    draftSelectedPageBtn.textContent = "Draft (0)";
    draftSelectedPageBtn.disabled = true;
  }
  if (copySelectedPageBtn) copySelectedPageBtn.disabled = true;

  if (!currentTabEmails || currentTabEmails.length === 0) {
    emailListEl.innerHTML = `<p class="empty">No emails detected on this page yet.</p>`;
    return;
  }
  chrome.storage.local.get({ emailHistory: [] }, ({ emailHistory }) => {
    const history = cachedHistory.length > 0 ? cachedHistory : migrateAndGroupHistory(emailHistory);
    emailListEl.innerHTML = "";
    currentTabEmails.forEach((email) => {
      const historyItem = history.find((h) => h.email.toLowerCase() === email.toLowerCase());
      const isSubmitted = historyItem && historyItem.status === "Submitted";
      const submittedTimeStr = isSubmitted && historyItem.submittedAt ? formatDateTime(historyItem.submittedAt) : "";

      const row = document.createElement("div");
      row.className = `email-row ${isSubmitted ? 'submitted-highlight' : ''}`;
      row.innerHTML = `
        <input type="checkbox" class="item-checkbox page-email-checkbox" data-email="${escapeHtml(email)}" ${isSubmitted ? `title="${submittedTimeStr ? 'Submitted at: ' + submittedTimeStr : 'Submitted'}"` : ''} />
        <span class="email-text-wrap" title="${escapeHtml(email)}">${escapeHtml(email)}</span>
        ${isSubmitted ? `<span class="submitted-check-badge" title="${submittedTimeStr ? 'Submitted at: ' + submittedTimeStr : 'Submitted'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>` : ''}
        <div class="row-actions">
          <button class="icon-action-btn copy-single-btn" title="Copy email address" data-email="${escapeHtml(email)}">📋</button>
          <button class="draft-single-btn" ${isSubmitted ? `title="${submittedTimeStr ? 'Already submitted at: ' + submittedTimeStr : 'Submitted'}. Click to resend."` : ''}>${isSubmitted ? 'Resend' : 'Draft'}</button>
        </div>
      `;
      row.querySelector(".draft-single-btn").addEventListener("click", () => draftEmail(email));
      row.querySelector(".copy-single-btn").addEventListener("click", () => copyToClipboard(email, `Copied ${email}`));
      row.querySelector(".page-email-checkbox").addEventListener("change", updatePageSelectionState);
      emailListEl.appendChild(row);
    });
  });
}

if (selectAllPageEl) {
  selectAllPageEl.addEventListener("change", () => {
    const checkboxes = document.querySelectorAll(".page-email-checkbox");
    checkboxes.forEach((cb) => (cb.checked = selectAllPageEl.checked));
    updatePageSelectionState();
  });
}

const bulkModePageEl = document.getElementById("bulk-mode-page");
if (draftSelectedPageBtn) {
  draftSelectedPageBtn.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(".page-email-checkbox:checked");
    const selected = Array.from(checkboxes).map((cb) => cb.dataset.email);
    if (selected.length > 0) {
      const mode = bulkModePageEl ? bulkModePageEl.value : "separate";
      draftMultipleEmails(selected, mode);
    }
  });
}

if (copySelectedPageBtn) {
  copySelectedPageBtn.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(".page-email-checkbox:checked");
    const selected = Array.from(checkboxes).map((cb) => cb.dataset.email);
    if (selected.length > 0) {
      copyToClipboard(selected.join(", "), `Copied ${selected.length} email(s)`);
    }
  });
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab || !tab.id) {
    renderEmails([]);
    return;
  }
  currentTabInfo = { title: tab.title || "Unknown Page", url: tab.url || "" };

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    try {
      const host = new URL(tab.url).hostname.replace(/^www\./, "");
      if (isDomainRestricted(host, settings.restrictedDomains)) {
        const banner = document.getElementById("domain-restricted-banner");
        const domainNameEl = document.getElementById("restricted-domain-name");
        if (banner && domainNameEl) {
          domainNameEl.textContent = host;
          banner.style.display = "flex";
        }
        renderEmails([]);
        emailListEl.innerHTML = `<p class="empty">🚫 <b>${escapeHtml(host)}</b> is in your Restricted Websites list.<br/>Email scanning is paused on this domain.</p>`;
        return;
      }
    } catch (e) {}

    chrome.tabs.sendMessage(tab.id, { type: "QMF_GET_EMAILS" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        renderEmails([]);
        emailListEl.innerHTML = `<p class="empty">Reload this page for detection to start.</p>`;
        return;
      }
      if (response.isRestrictedDomain) {
        const banner = document.getElementById("domain-restricted-banner");
        const domainNameEl = document.getElementById("restricted-domain-name");
        if (banner && domainNameEl) {
          domainNameEl.textContent = response.hostname || "This site";
          banner.style.display = "flex";
        }
        renderEmails([]);
        emailListEl.innerHTML = `<p class="empty">🚫 <b>${escapeHtml(response.hostname || "This site")}</b> is in your Restricted Websites list.<br/>Email scanning is paused on this domain.</p>`;
        return;
      }
      renderEmails(response.emails);
    });
  });
});

if (exportPageBtn) {
  exportPageBtn.addEventListener("click", () => {
    if (!currentTabEmails || currentTabEmails.length === 0) {
      alert("No emails detected on this page to export.");
      return;
    }
    const headers = ["Email", "Source Page Title", "Source Page URL", "Export Date"];
    const nowStr = formatDateTime(Date.now());
    const rows = currentTabEmails.map((email) => [
      email,
      currentTabInfo.title,
      currentTabInfo.url,
      nowStr,
    ]);
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`QuickMail_Page_Emails_${dateStamp}.csv`, headers, rows);

    chrome.storage.local.get(["csvExportsCount"], (res) => {
      const current = (res && res.csvExportsCount) || 0;
      chrome.storage.local.set({ csvExportsCount: current + 1 });
    });
  });
}

// Pre-fetch history count on load so tab badge displays immediately
chrome.storage.local.get({ emailHistory: [] }, ({ emailHistory }) => {
  const grouped = migrateAndGroupHistory(emailHistory);
  const historyBadge = document.getElementById("tab-history-badge");
  if (historyBadge) historyBadge.textContent = grouped.length;
});

// --- History tab ---
const historyListEl = document.getElementById("history-list");
const historySearchEl = document.getElementById("history-search");
const historyStatusFilterEl = document.getElementById("history-status-filter");
const selectAllHistoryEl = document.getElementById("select-all-history");
const draftSelectedHistoryBtn = document.getElementById("draft-selected-history-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const exportHistoryBtn = document.getElementById("export-history-btn");
const HISTORY_PAGE_SIZE = 30;
let cachedHistory = [];
let filteredHistory = [];
let renderedHistoryCount = 0;
const selectedHistoryEmails = new Set();
let searchDebounceTimer = null;
let isHistoryListenersBound = false;

function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const datePart = d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const timePart = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return url || "";
  }
}

function toggleStatus(email) {
  chrome.storage.local.get({ emailHistory: [] }, ({ emailHistory }) => {
    let history = migrateAndGroupHistory(emailHistory);
    const item = history.find((e) => e.email.toLowerCase() === email.toLowerCase());
    if (item) {
      item.status = item.status === "Submitted" ? "Pending" : "Submitted";
      if (item.status === "Submitted") item.submittedAt = Date.now();
      chrome.storage.local.set({ emailHistory: history }, () => {
        cachedHistory = history;
        applyHistoryFilter();
      });
    }
  });
}

function deleteGroup(email) {
  if (!confirm(`Delete history for ${email}?`)) return;
  chrome.storage.local.get({ emailHistory: [] }, ({ emailHistory }) => {
    let history = migrateAndGroupHistory(emailHistory);
    history = history.filter((e) => e.email.toLowerCase() !== email.toLowerCase());
    selectedHistoryEmails.delete(email.toLowerCase());
    chrome.storage.local.set({ emailHistory: history }, () => {
      cachedHistory = history;
      applyHistoryFilter();
    });
  });
}

function removeSource(email, pageUrl) {
  chrome.storage.local.get({ emailHistory: [] }, ({ emailHistory }) => {
    let history = migrateAndGroupHistory(emailHistory);
    const item = history.find((e) => e.email.toLowerCase() === email.toLowerCase());
    if (item && item.sources) {
      item.sources = item.sources.filter((s) => s.pageUrl !== pageUrl);
      if (item.sources.length === 0) {
        history = history.filter((e) => e.email.toLowerCase() !== email.toLowerCase());
        selectedHistoryEmails.delete(email.toLowerCase());
      } else {
        item.totalCount = item.sources.reduce((acc, s) => acc + (s.count || 1), 0);
      }
      chrome.storage.local.set({ emailHistory: history }, () => {
        cachedHistory = history;
        applyHistoryFilter();
      });
    }
  });
}

const copySelectedHistoryBtn = document.getElementById("copy-selected-history-btn");
const markSubmittedHistoryBtn = document.getElementById("mark-submitted-history-btn");
const markPendingHistoryBtn = document.getElementById("mark-pending-history-btn");
const bulkModeHistoryEl = document.getElementById("bulk-mode-history");

function bulkUpdateHistoryStatus(newStatus) {
  if (selectedHistoryEmails.size === 0) return;

  chrome.storage.local.get({ emailHistory: [] }, ({ emailHistory }) => {
    let history = migrateAndGroupHistory(emailHistory);
    let updatedCount = 0;
    const now = Date.now();
    history.forEach((e) => {
      if (selectedHistoryEmails.has(e.email.toLowerCase())) {
        e.status = newStatus;
        if (newStatus === "Submitted") {
          e.submittedAt = now;
        }
        updatedCount++;
      }
    });
    if (updatedCount > 0) {
      chrome.storage.local.set({ emailHistory: history }, () => {
        cachedHistory = history;
        applyHistoryFilter();
        showToast(`Updated ${updatedCount} email(s) to ${newStatus}`, "success");
      });
    }
  });
}

function updateHistorySelectionState() {
  const count = selectedHistoryEmails.size;
  const totalFiltered = filteredHistory.length;

  if (draftSelectedHistoryBtn) {
    draftSelectedHistoryBtn.textContent = `Draft (${count})`;
    draftSelectedHistoryBtn.disabled = count === 0;
  }
  if (copySelectedHistoryBtn) {
    copySelectedHistoryBtn.disabled = count === 0;
  }
  if (markSubmittedHistoryBtn) {
    markSubmittedHistoryBtn.disabled = count === 0;
  }
  if (markPendingHistoryBtn) {
    markPendingHistoryBtn.disabled = count === 0;
  }

  if (selectAllHistoryEl) {
    selectAllHistoryEl.checked = totalFiltered > 0 && count === totalFiltered;
    selectAllHistoryEl.indeterminate = count > 0 && count < totalFiltered;
  }

  const selectionTextEl = document.getElementById("history-selection-text");
  if (selectionTextEl) {
    selectionTextEl.textContent = count > 0 ? `(${count} selected)` : "";
  }
}

function updateHistoryCountDisplay() {
  const totalCount = cachedHistory.length;
  const filteredCount = filteredHistory.length;

  const historyBadge = document.getElementById("tab-history-badge");
  const countText = document.getElementById("history-count-text");

  if (historyBadge) historyBadge.textContent = totalCount;
  if (countText) {
    if (filteredCount === totalCount) {
      if (totalCount === 0) {
        countText.textContent = "0 emails in history";
      } else if (renderedHistoryCount < filteredCount) {
        countText.textContent = `Showing ${renderedHistoryCount} of ${totalCount} emails`;
      } else {
        countText.textContent = `Total: ${totalCount} email${totalCount === 1 ? "" : "s"}`;
      }
    } else {
      if (renderedHistoryCount < filteredCount) {
        countText.textContent = `Showing ${renderedHistoryCount} of ${filteredCount} filtered (Total: ${totalCount})`;
      } else {
        countText.textContent = `Showing ${filteredCount} of ${totalCount} emails`;
      }
    }
  }
}

function createHistoryCardElement(entry) {
  const card = document.createElement("div");
  card.className = "history-card";
  card.dataset.email = entry.email;

  const isSubmitted = entry.status === "Submitted";
  const statusText = isSubmitted ? "✅ Submitted" : "⏳ Pending";
  const statusClass = isSubmitted ? "submitted" : "pending";

  const websiteCount = (entry.sources || []).length;
  const websiteLabel = websiteCount === 1 ? "1 website" : `${websiteCount} websites`;
  const isChecked = selectedHistoryEmails.has(entry.email.toLowerCase());

  const sourcesHtml = (entry.sources || []).map((s) => `
    <div class="history-source-item">
      <span class="history-source-info" title="${escapeHtml(s.pageUrl)}">
        🌐 <b>${escapeHtml(hostnameOf(s.pageUrl))}</b> — ${escapeHtml(s.pageTitle || s.pageUrl)} ${s.count > 1 ? `(${s.count}×)` : ""}
      </span>
      <button class="history-source-remove" title="Remove website from group" data-email="${escapeHtml(entry.email)}" data-url="${escapeHtml(s.pageUrl)}">✖</button>
    </div>
  `).join("");

  card.innerHTML = `
    <div class="history-card-header">
      <input type="checkbox" class="item-checkbox history-email-checkbox" data-email="${escapeHtml(entry.email)}" ${isChecked ? 'checked' : ''} />
      <span class="history-email-title" title="${escapeHtml(entry.email)}">${escapeHtml(entry.email)}</span>
      <div class="history-header-actions">
        <button class="icon-action-btn copy-single-btn" title="Copy email address" data-email="${escapeHtml(entry.email)}">📋</button>
        <button class="status-badge ${statusClass}" title="Click to toggle status" data-email="${escapeHtml(entry.email)}">${statusText}</button>
        <button class="draft-btn" data-email="${escapeHtml(entry.email)}">Draft</button>
        <button class="icon-btn-danger delete-group-btn" title="Delete entire email group" data-email="${escapeHtml(entry.email)}">🗑️</button>
      </div>
    </div>
    <div class="history-meta-bar">
      <button class="toggle-websites-btn" title="Click to open or close captured website details">🌐 ${websiteLabel} ▾</button>
      <span class="history-date-text">Seen ${entry.totalCount || 1}× · ${formatDateTime(entry.lastSeen)}${entry.submittedAt ? ` · Sent: ${formatDateTime(entry.submittedAt)}` : ''}</span>
    </div>
    <div class="history-sources-list">
      ${sourcesHtml || '<div class="history-source-item"><span>No website details</span></div>'}
    </div>
  `;

  return card;
}

function appendHistoryFooter() {
  const existingFooter = document.getElementById("history-footer-indicator");
  if (existingFooter) existingFooter.remove();

  if (renderedHistoryCount < filteredHistory.length) {
    const remaining = filteredHistory.length - renderedHistoryCount;
    const footer = document.createElement("div");
    footer.id = "history-footer-indicator";
    footer.className = "history-footer-indicator";
    footer.innerHTML = `
      <button id="history-load-more-btn" class="history-load-more-btn">
        Load more (${remaining} remaining) ▾
      </button>
    `;
    historyListEl.appendChild(footer);
  }
}

function renderNextHistoryChunk() {
  if (renderedHistoryCount >= filteredHistory.length) return;

  const existingFooter = document.getElementById("history-footer-indicator");
  if (existingFooter) existingFooter.remove();

  const nextSlice = filteredHistory.slice(renderedHistoryCount, renderedHistoryCount + HISTORY_PAGE_SIZE);
  const fragment = document.createDocumentFragment();

  nextSlice.forEach((entry) => {
    fragment.appendChild(createHistoryCardElement(entry));
  });

  historyListEl.appendChild(fragment);
  renderedHistoryCount += nextSlice.length;

  appendHistoryFooter();
  updateHistoryCountDisplay();
}

function renderHistory(list, reset = true) {
  if (reset) {
    historyListEl.innerHTML = "";
    renderedHistoryCount = 0;
    historyListEl.scrollTop = 0;
  }

  updateHistoryCountDisplay();
  updateHistorySelectionState();

  if (!list || list.length === 0) {
    historyListEl.innerHTML = `<p class="empty">No emails match the selected filters.</p>`;
    return;
  }

  renderNextHistoryChunk();
}

// Attach high-performance event delegation once to historyListEl
if (!isHistoryListenersBound && historyListEl) {
  isHistoryListenersBound = true;

  historyListEl.addEventListener("scroll", () => {
    if (renderedHistoryCount >= filteredHistory.length) return;
    if (historyListEl.scrollTop + historyListEl.clientHeight >= historyListEl.scrollHeight - 70) {
      renderNextHistoryChunk();
    }
  });

  historyListEl.addEventListener("click", (e) => {
    const target = e.target;
    if (!target) return;

    // 1. Toggle websites dropdown
    const toggleBtn = target.closest(".toggle-websites-btn");
    if (toggleBtn) {
      const card = toggleBtn.closest(".history-card");
      if (!card) return;
      const sourcesList = card.querySelector(".history-sources-list");
      if (!sourcesList) return;
      const isExpanded = sourcesList.classList.toggle("expanded");
      const count = card.querySelectorAll(".history-source-item").length;
      const label = count === 1 ? "1 website" : `${count} websites`;
      toggleBtn.innerHTML = `🌐 ${label} ${isExpanded ? "▴" : "▾"}`;
      return;
    }

    // 2. Copy single email
    const copyBtn = target.closest(".copy-single-btn");
    if (copyBtn && copyBtn.dataset.email) {
      copyToClipboard(copyBtn.dataset.email, `Copied ${copyBtn.dataset.email}`);
      return;
    }

    // 3. Toggle status
    const statusBadge = target.closest(".status-badge");
    if (statusBadge && statusBadge.dataset.email) {
      toggleStatus(statusBadge.dataset.email);
      return;
    }

    // 4. Draft single email
    const draftBtn = target.closest(".draft-btn");
    if (draftBtn && draftBtn.dataset.email) {
      draftEmail(draftBtn.dataset.email);
      return;
    }

    // 5. Delete entire email group
    const deleteBtn = target.closest(".delete-group-btn");
    if (deleteBtn && deleteBtn.dataset.email) {
      deleteGroup(deleteBtn.dataset.email);
      return;
    }

    // 6. Remove individual website source
    const removeSourceBtn = target.closest(".history-source-remove");
    if (removeSourceBtn && removeSourceBtn.dataset.email && removeSourceBtn.dataset.url) {
      removeSource(removeSourceBtn.dataset.email, removeSourceBtn.dataset.url);
      return;
    }

    // 7. Load more button
    const loadMoreBtn = target.closest("#history-load-more-btn");
    if (loadMoreBtn) {
      renderNextHistoryChunk();
      return;
    }
  });

  historyListEl.addEventListener("change", (e) => {
    if (e.target && e.target.classList.contains("history-email-checkbox")) {
      const email = (e.target.dataset.email || "").toLowerCase();
      if (e.target.checked) {
        selectedHistoryEmails.add(email);
      } else {
        selectedHistoryEmails.delete(email);
      }
      updateHistorySelectionState();
    }
  });
}

if (selectAllHistoryEl) {
  selectAllHistoryEl.addEventListener("change", () => {
    if (selectAllHistoryEl.checked) {
      filteredHistory.forEach((e) => selectedHistoryEmails.add(e.email.toLowerCase()));
    } else {
      selectedHistoryEmails.clear();
    }
    // Update visible checkboxes
    const checkboxes = historyListEl.querySelectorAll(".history-email-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = selectAllHistoryEl.checked;
    });
    updateHistorySelectionState();
  });
}

if (draftSelectedHistoryBtn) {
  draftSelectedHistoryBtn.addEventListener("click", () => {
    const selected = filteredHistory
      .filter((e) => selectedHistoryEmails.has(e.email.toLowerCase()))
      .map((e) => e.email);
    if (selected.length > 0) {
      const mode = bulkModeHistoryEl ? bulkModeHistoryEl.value : "separate";
      draftMultipleEmails(selected, mode);
    }
  });
}

if (copySelectedHistoryBtn) {
  copySelectedHistoryBtn.addEventListener("click", () => {
    const selected = filteredHistory
      .filter((e) => selectedHistoryEmails.has(e.email.toLowerCase()))
      .map((e) => e.email);
    if (selected.length > 0) {
      copyToClipboard(selected.join(", "), `Copied ${selected.length} email(s)`);
    }
  });
}

if (markSubmittedHistoryBtn) {
  markSubmittedHistoryBtn.addEventListener("click", () => bulkUpdateHistoryStatus("Submitted"));
}

if (markPendingHistoryBtn) {
  markPendingHistoryBtn.addEventListener("click", () => bulkUpdateHistoryStatus("Pending"));
}

function loadHistory() {
  chrome.storage.local.get({ emailHistory: [] }, ({ emailHistory }) => {
    cachedHistory = migrateAndGroupHistory(emailHistory);
    if (JSON.stringify(cachedHistory) !== JSON.stringify(emailHistory)) {
      chrome.storage.local.set({ emailHistory: cachedHistory });
    }
    applyHistoryFilter();
  });
}

function applyHistoryFilter() {
  const rawQ = historySearchEl ? historySearchEl.value.trim().toLowerCase() : "";
  const statusFilter = historyStatusFilterEl ? historyStatusFilterEl.value : "all";
  const terms = rawQ ? rawQ.split(/\s+/).filter(Boolean) : [];

  filteredHistory = cachedHistory.filter((entry) => {
    const itemStatus = entry.status || "Pending";
    if (statusFilter !== "all" && itemStatus !== statusFilter) {
      return false;
    }

    if (terms.length === 0) return true;

    const emailStr = (entry.email || "").toLowerCase();
    const statusStr = itemStatus.toLowerCase();
    const dateStr = formatDateTime(entry.lastSeen).toLowerCase();
    const sentDateStr = entry.submittedAt ? formatDateTime(entry.submittedAt).toLowerCase() : "";

    let sourcesBlob = "";
    if (Array.isArray(entry.sources)) {
      for (const s of entry.sources) {
        sourcesBlob += " " + (s.pageTitle || "").toLowerCase() + " " + (s.pageUrl || "").toLowerCase() + " " + hostnameOf(s.pageUrl).toLowerCase();
      }
    }

    const searchableBlob = `${emailStr} ${statusStr} ${dateStr} ${sentDateStr} ${sourcesBlob}`;
    return terms.every((term) => searchableBlob.includes(term));
  });

  // Re-synchronize selectedHistoryEmails to only retain matching emails
  const validFilteredEmails = new Set(filteredHistory.map((e) => e.email.toLowerCase()));
  for (const email of Array.from(selectedHistoryEmails)) {
    if (!validFilteredEmails.has(email)) {
      selectedHistoryEmails.delete(email);
    }
  }

  renderHistory(filteredHistory, true);
}

// Debounced search input (220ms) to ensure butter-smooth typing without lag
if (historySearchEl) {
  historySearchEl.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      applyHistoryFilter();
    }, 220);
  });

  historySearchEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      clearTimeout(searchDebounceTimer);
      applyHistoryFilter();
    }
  });
}

if (historyStatusFilterEl) {
  historyStatusFilterEl.addEventListener("change", applyHistoryFilter);
}

if (exportHistoryBtn) {
  exportHistoryBtn.addEventListener("click", () => {
    let listToExport = filteredHistory;
    if (selectedHistoryEmails.size > 0) {
      listToExport = filteredHistory.filter((e) => selectedHistoryEmails.has(e.email.toLowerCase()));
    }

    if (!listToExport || listToExport.length === 0) {
      alert("No email history matches your filters to export.");
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadExcelXls(`QuickMail_Grouped_History_${dateStamp}.xls`, listToExport);
  });
}

clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("Clear all detected-email history? This can't be undone.")) return;
  chrome.storage.local.set({ emailHistory: [] }, () => {
    cachedHistory = [];
    filteredHistory = [];
    selectedHistoryEmails.clear();
    renderHistory([]);
  });
});

// ==========================================================================
// GENUINE REVIEW & SENTIMENT PROMPT ENGINE (QMF-015)
// ==========================================================================
function checkReviewPromptEligibility() {
  const sentimentCard = document.getElementById("review-sentiment-card");
  if (!sentimentCard) return;

  chrome.storage.local.get(
    ["reviewPromptCompleted", "reviewPromptDismissedUntil", "draftsCreatedCount", "csvExportsCount"],
    (data) => {
      if (data && data.reviewPromptCompleted) return;

      const now = Date.now();
      if (data && data.reviewPromptDismissedUntil && now < data.reviewPromptDismissedUntil) {
        return; // Snoozed
      }

      const drafts = (data && data.draftsCreatedCount) || 0;
      const exports = (data && data.csvExportsCount) || 0;

      // Peak Joy trigger: after 3rd draft or 1st CSV export
      if (drafts >= 3 || exports >= 1) {
        sentimentCard.style.display = "block";
        initReviewSentimentUI();
      }
    }
  );
}

function initReviewSentimentUI() {
  const sentimentCard = document.getElementById("review-sentiment-card");
  const stateAsk = document.getElementById("review-state-ask");
  const stateCws = document.getElementById("review-state-cws");
  const stateFeedback = document.getElementById("review-state-feedback");

  const btnClose = document.getElementById("review-close-btn");
  const btnHappy = document.getElementById("review-btn-happy");
  const btnUnhappy = document.getElementById("review-btn-unhappy");
  const btnStore = document.getElementById("review-btn-store");
  const btnLater = document.getElementById("review-btn-later");
  const btnForm = document.getElementById("review-btn-form");
  const btnNever = document.getElementById("review-btn-never");

  // Step 1: User says they are enjoying it
  if (btnHappy) {
    btnHappy.addEventListener("click", () => {
      if (stateAsk) stateAsk.style.display = "none";
      if (stateCws) stateCws.style.display = "block";
    });
  }

  // Step 1: User says "Not really"
  if (btnUnhappy) {
    btnUnhappy.addEventListener("click", () => {
      if (stateAsk) stateAsk.style.display = "none";
      if (stateFeedback) stateFeedback.style.display = "block";
    });
  }

  // Step 2A: User clicks "Leave a Review" -> direct CWS review dialog
  if (btnStore) {
    btnStore.addEventListener("click", () => {
      chrome.storage.local.set({ reviewPromptCompleted: true });
      if (sentimentCard) sentimentCard.style.display = "none";
    });
  }

  // Step 2B: User clicks "Send Feedback" -> Google Form
  if (btnForm) {
    btnForm.addEventListener("click", () => {
      chrome.storage.local.set({ reviewPromptCompleted: true });
      if (sentimentCard) sentimentCard.style.display = "none";
    });
  }

  // Dismiss / Maybe later: Snooze for 30 days
  const snooze30Days = () => {
    const snoozeUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
    chrome.storage.local.set({ reviewPromptDismissedUntil: snoozeUntil });
    if (sentimentCard) sentimentCard.style.display = "none";
  };

  if (btnClose) btnClose.addEventListener("click", snooze30Days);
  if (btnLater) btnLater.addEventListener("click", snooze30Days);

  // Don't ask again: Permanently dismiss
  if (btnNever) {
    btnNever.addEventListener("click", () => {
      chrome.storage.local.set({ reviewPromptCompleted: true });
      if (sentimentCard) sentimentCard.style.display = "none";
    });
  }
}

// Check eligibility on popup open
checkReviewPromptEligibility();




