// background.js — service worker. Handles:
//  1. Right-click "Draft email to..." context menu
//  2. Live badge count (emails found on the active tab)
//  3. Persistent detected-email history (with timestamps)
//  4. Opening each compose as its own small popup window, so one draft
//     never silently overwrites another

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_HISTORY = 1000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.setUninstallURL("https://forms.gle/2UYCV6p4bWYiG4jPA");

  chrome.contextMenus.create({
    id: "qmf-draft-email",
    title: 'Draft email to "%s"',
    contexts: ["selection"],
  });

  chrome.storage.sync.get(
    ["provider", "fromAccount", "yourName", "subjectTemplate", "bodyTemplate", "draftWindowStyle", "restrictedDomains", "restrictedEmails"],
    (items) => {
      const updates = {};
      if (!items.provider) updates.provider = "gmail";
      if (!items.draftWindowStyle) updates.draftWindowStyle = "batch_window";
      if (items.restrictedDomains === undefined) updates.restrictedDomains = "mail.google.com, outlook.live.com, outlook.office.com";
      if (items.restrictedEmails === undefined) updates.restrictedEmails = "";
      if (items.fromAccount === undefined) updates.fromAccount = "";
      if (items.yourName === undefined) updates.yourName = "";
      if (!items.subjectTemplate)
        updates.subjectTemplate = "Regarding an opportunity at {company}";
      if (!items.bodyTemplate)
        updates.bodyTemplate =
          "Hi {name},\n\nI came across your profile and wanted to reach out regarding an opportunity at {company}.\n\nWould you be open to a quick chat?\n\nBest regards,\n{yourName}";
      if (Object.keys(updates).length) chrome.storage.sync.set(updates);
    }
  );
});

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

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "qmf-draft-email" || !tab || !tab.id) return;
  const selected = sanitizeEmail(info.selectionText || "");
  if (!EMAIL_REGEX.test(selected)) return;

  chrome.tabs.sendMessage(tab.id, {
    type: "QMF_OPEN_PANEL_FOR_EMAIL",
    email: selected,
  });
});

// ---------- Badge (real-time email count per tab) ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "QMF_UPDATE_BADGE" && sender.tab && sender.tab.id != null) {
    try {
      if (msg.off) {
        chrome.action.setBadgeText({ tabId: sender.tab.id, text: "OFF" });
        chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#64748b" });
      } else {
        const text = msg.count > 0 ? String(msg.count > 99 ? "99+" : msg.count) : "";
        chrome.action.setBadgeText({ tabId: sender.tab.id, text });
        chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#2563eb" });
      }
    } catch (e) {}
  }

  if (msg && msg.type === "QMF_TOGGLE_STATE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        try {
          if (!msg.enabled) {
            chrome.action.setBadgeText({ tabId: tabs[0].id, text: "OFF" });
            chrome.action.setBadgeBackgroundColor({ tabId: tabs[0].id, color: "#64748b" });
          }
        } catch (e) {}
      }
    });
  }

  if (msg && msg.type === "QMF_RECORD_HISTORY") {
    recordHistoryEntry(msg);
  }

  if (msg && msg.type === "QMF_OPEN_COMPOSE") {
    if (msg.email) {
      const emailList = msg.email.split(",").map((e) => e.trim()).filter(Boolean);
      if (emailList.length > 0) {
        updateHistory((history) => {
          let updated = false;
          const now = Date.now();
          emailList.forEach((email) => {
            const key = email.toLowerCase();
            let item = history.find((h) => h.email.toLowerCase() === key);
            if (item) {
              item.status = "Submitted";
              item.submittedAt = now;
              updated = true;
            } else {
              history.unshift({
                email,
                status: "Submitted",
                firstSeen: now,
                lastSeen: now,
                submittedAt: now,
                totalCount: 1,
                sources: []
              });
              updated = true;
            }
          });
          return updated ? history : null;
        });
      }
    }
    openComposeWindow(msg.provider, msg.email, msg.url, msg.draftWindowStyle, msg.screenMetrics, msg.windowIndex).then(() => sendResponse({ ok: true }));
    return true; // keep sendResponse alive for the async work above
  }

  if (msg && msg.type === "QMF_CLOSE_SENT_TAB" && sender.tab && sender.tab.id != null) {
    try {
      chrome.tabs.remove(sender.tab.id);
    } catch (e) {}
    sendResponse({ ok: true });
    return true;
  }

  if (msg && msg.type === "QMF_OPEN_BULK_DRAFTS") {
    const drafts = msg.drafts || [];
    if (drafts.length === 0) {
      sendResponse({ ok: true });
      return true;
    }

    // 1. Mark all drafted emails as Submitted in history
    const allEmails = drafts.map((d) => d.email).filter(Boolean);
    if (allEmails.length > 0) {
      updateHistory((history) => {
        let updated = false;
        const now = Date.now();
        allEmails.forEach((email) => {
          const key = email.toLowerCase();
          let item = history.find((h) => h.email.toLowerCase() === key);
          if (item) {
            item.status = "Submitted";
            item.submittedAt = now;
            updated = true;
          } else {
            history.unshift({
              email,
              status: "Submitted",
              firstSeen: now,
              lastSeen: now,
              submittedAt: now,
              totalCount: 1,
              sources: [],
            });
            updated = true;
          }
        });
        return updated ? history : null;
      });
    }

    // 2. Open Dedicated Single Window with Parallel Preloaded Tabs
    (async () => {
      try {
        const firstDraft = drafts[0];
        const remainingDrafts = drafts.slice(1);

        let screenWidth = 1920;
        let screenHeight = 1080;
        try {
          const cur = await chrome.windows.getCurrent();
          if (cur) {
            screenWidth = cur.width || 1920;
            screenHeight = cur.height || 1080;
          }
        } catch (e) {}

        const winWidth = Math.min(1100, Math.max(800, screenWidth - 100));
        const winHeight = Math.min(850, Math.max(600, screenHeight - 80));
        const left = Math.round((screenWidth - winWidth) / 2);
        const top = Math.max(30, Math.round((screenHeight - winHeight) / 2));

        // Create the single outreach window with first draft active
        const outreachWin = await chrome.windows.create({
          url: firstDraft.url,
          type: "normal",
          width: winWidth,
          height: winHeight,
          left: Math.max(20, left),
          top: Math.max(20, top),
          focused: true,
        });

        // Open all remaining drafts as background tabs in this window (parallel loading)
        for (const d of remainingDrafts) {
          await chrome.tabs.create({
            windowId: outreachWin.id,
            url: d.url,
            active: false,
          });
        }
      } catch (err) {
        console.error("Error opening bulk drafts:", err);
      }
    })();

    sendResponse({ ok: true });
    return true;
  }

  if (msg && msg.type === "QMF_UPDATE_STATUS") {
    updateHistory((history) => {
      let updated = false;
      const statusesToUpdate = Array.isArray(msg.emails) ? msg.emails : [msg.emails];
      statusesToUpdate.forEach((email) => {
        const key = email.toLowerCase();
        let item = history.find((h) => h.email.toLowerCase() === key);
        if (item) {
          if (item.status !== msg.status) {
            item.status = msg.status;
            if (msg.status === "Submitted") item.submittedAt = Date.now();
            updated = true;
          } else if (msg.status === "Submitted") {
            item.submittedAt = Date.now();
            updated = true;
          }
        } else {
          history.unshift({
            email,
            status: msg.status,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            submittedAt: msg.status === "Submitted" ? Date.now() : null,
            totalCount: 1,
            sources: []
          });
          updated = true;
        }
      });
      return updated ? history : null;
    });
    sendResponse({ ok: true });
  }

  if (msg && msg.type === "QMF_DELETE_GROUP") {
    updateHistory((history) => {
      const initialLen = history.length;
      const filtered = history.filter((e) => e.email.toLowerCase() !== msg.email.toLowerCase());
      return filtered.length !== initialLen ? filtered : null;
    });
    sendResponse({ ok: true });
  }

  if (msg && msg.type === "QMF_REMOVE_SOURCE") {
    updateHistory((history) => {
      const item = history.find((e) => e.email.toLowerCase() === msg.email.toLowerCase());
      if (item && item.sources) {
        item.sources = item.sources.filter((s) => s.pageUrl !== msg.pageUrl);
        if (item.sources.length === 0) {
          return history.filter((e) => e.email.toLowerCase() !== msg.email.toLowerCase());
        } else {
          item.totalCount = item.sources.reduce((acc, s) => acc + (s.count || 1), 0);
          return history;
        }
      }
      return null;
    });
    sendResponse({ ok: true });
  }

  if (msg && msg.type === "QMF_CLEAR_HISTORY") {
    updateHistory(() => {
      return [];
    });
    sendResponse({ ok: true });
  }
});

// Clear the badge while a page is (re)loading so stale counts don't linger
// between navigations; content.js will send a fresh count once it scans.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    try {
      chrome.action.setBadgeText({ tabId, text: "" });
    } catch (e) {}
  }
});

// ---------- History (chrome.storage.local, grouped by unique email) ----------

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

let historyUpdatePromise = Promise.resolve();

function updateHistory(updaterFn) {
  historyUpdatePromise = historyUpdatePromise
    .catch((err) => {
      console.error("Recovered from history queue error:", err);
    })
    .then(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get({ emailHistory: [] }, ({ emailHistory }) => {
          try {
            let history = migrateAndGroupHistory(emailHistory);
            const newHistory = updaterFn(history);
            if (newHistory) {
              chrome.storage.local.set({ emailHistory: newHistory }, resolve);
            } else {
              resolve();
            }
          } catch (err) {
            console.error("Error in history updater logic:", err);
            resolve();
          }
        });
      });
    });
}

function recordHistoryEntry({ email, pageUrl, pageTitle, timestamp }) {
  if (!email) return;
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail) return;

  chrome.storage.sync.get(
    { restrictedEmails: "", restrictedDomains: "mail.google.com, outlook.live.com, outlook.office.com" },
    ({ restrictedEmails, restrictedDomains }) => {
      if (isEmailRestricted(cleanEmail, restrictedEmails)) return;
      try {
        if (pageUrl) {
          const host = new URL(pageUrl).hostname;
          if (isDomainRestricted(host, restrictedDomains)) return;
        }
      } catch (e) {}

      updateHistory((history) => {
        const key = cleanEmail.toLowerCase();
        const existingGroup = history.find((e) => e.email.toLowerCase() === key);

        const ts = timestamp || Date.now();
        const title = pageTitle || pageUrl || "Unknown Page";

        if (existingGroup) {
          existingGroup.lastSeen = Math.max(existingGroup.lastSeen, ts);
          existingGroup.totalCount = (existingGroup.totalCount || 0) + 1;

          const sourceIdx = existingGroup.sources.findIndex((s) => s.pageUrl === pageUrl);
          if (sourceIdx >= 0) {
            existingGroup.sources[sourceIdx].count = (existingGroup.sources[sourceIdx].count || 1) + 1;
            existingGroup.sources[sourceIdx].lastSeen = Math.max(existingGroup.sources[sourceIdx].lastSeen, ts);
            existingGroup.sources[sourceIdx].pageTitle = title;
          } else {
            existingGroup.sources.push({
              pageUrl,
              pageTitle: title,
              count: 1,
              lastSeen: ts,
            });
          }
          existingGroup.sources.sort((a, b) => b.lastSeen - a.lastSeen);
        } else {
          history.unshift({
            email: cleanEmail,
            status: "Pending",
            firstSeen: ts,
            lastSeen: ts,
            totalCount: 1,
            sources: [
              {
                pageUrl,
                pageTitle: title,
                count: 1,
                lastSeen: ts,
              },
            ],
          });
        }

        history.sort((a, b) => b.lastSeen - a.lastSeen);
        if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;

        return history;
      });
    }
  );
}

// ---------- One small popup window per draft (never overwrites another) ----------
// Navigating one shared tab to a new compose URL seemed efficient, but
// Gmail's own SPA just swaps the fields of whatever compose form is
// already open in that tab in place — so an unsent draft silently gets
// overwritten by the next one. Instead, each distinct email gets its own
// small popup window:
//   - Different email  -> always a fresh popup window (nothing shared,
//     nothing to overwrite)
//   - Same email again, window still open -> just refocus that window,
//     don't touch its contents
//   - Window was closed -> tracking entry is cleaned up automatically

let composeSequenceCounter = 0;

async function openComposeWindow(provider, email, url, preferredStyle, screenMetrics, windowIndex) {
  const safeEmail = (email || "draft").toLowerCase();
  const storageKey = `composeWin_${provider}_${safeEmail}`;
  const stored = await chrome.storage.session.get(storageKey);
  const existingId = stored[storageKey];

  // Resolve layout style
  let style = preferredStyle;
  if (!style) {
    const syncData = await chrome.storage.sync.get({ draftWindowStyle: "batch_window" });
    style = syncData.draftWindowStyle || "batch_window";
  }

  // 1. Browser Tabs Mode: opens directly as Chrome tabs
  if (style === "tabs") {
    if (existingId != null) {
      try {
        const tab = await chrome.tabs.get(existingId);
        if (tab) {
          await chrome.tabs.update(existingId, { active: true });
          return;
        }
      } catch (e) {
        // Tab was closed
      }
    }
    const newTab = await chrome.tabs.create({ url, active: false });
    await chrome.storage.session.set({ [storageKey]: newTab.id });
    return;
  }

  // 2. Window Modes (Bouncing Ball Cascade)
  if (existingId != null) {
    try {
      const win = await chrome.windows.get(existingId);
      if (win) {
        await chrome.windows.update(existingId, { focused: true });
        return;
      }
    } catch (e) {
      // Window was closed
    }
  }

  const sessionAll = await chrome.storage.session.get(null);
  const openCount = Object.keys(sessionAll).filter((k) => k.startsWith("composeWin_")).length;
  if (openCount === 0) {
    composeSequenceCounter = 0;
  }

  const stepIndex = (typeof windowIndex === "number" && windowIndex >= 0)
    ? windowIndex
    : (composeSequenceCounter++);

  const screenWidth = (screenMetrics && screenMetrics.width) || 1920;
  const screenHeight = (screenMetrics && screenMetrics.height) || 1080;

  const winWidth = 520;
  const winHeight = Math.min(680, Math.max(540, screenHeight - 90));

  const minLeft = 24;
  const maxLeft = Math.max(minLeft + 180, screenWidth - winWidth - 24);

  // 180px horizontal step leaves the bottom-left Send button of previous window completely visible!
  const stepX = 180;
  const numSteps = Math.max(1, Math.floor((maxLeft - minLeft) / stepX));

  // Ping-Pong Bouncing Ball Cycle:
  // Step 0 -> 1 -> 2 ... -> numSteps (Hits right wall) -> (numSteps-1) -> ... -> 0 (Hits left wall)
  const cyclePeriod = numSteps * 2;
  const cyclePos = stepIndex % cyclePeriod;
  const pingPongIndex = cyclePos <= numSteps ? cyclePos : (cyclePeriod - cyclePos);

  const leftPos = minLeft + (pingPongIndex * stepX);

  const maxTop = Math.max(60, screenHeight - winHeight - 50);
  const topStagger = (stepIndex * 32) % maxTop;
  const topPos = 30 + topStagger;

  const newWin = await chrome.windows.create({
    url,
    type: "popup",
    width: winWidth,
    height: winHeight,
    left: Math.round(leftPos),
    top: Math.round(topPos),
  });
  await chrome.storage.session.set({ [storageKey]: newWin.id });
}

// Clean up session storage when compose windows or tabs are closed
chrome.windows.onRemoved.addListener(async (closedWinId) => {
  const all = await chrome.storage.session.get(null);
  for (const [key, winId] of Object.entries(all)) {
    if (key.startsWith("composeWin_") && winId === closedWinId) {
      chrome.storage.session.remove(key);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (closedTabId) => {
  const all = await chrome.storage.session.get(null);
  for (const [key, tabId] of Object.entries(all)) {
    if (key.startsWith("composeWin_") && tabId === closedTabId) {
      chrome.storage.session.remove(key);
    }
  }
});

// Proactively sanitize and merge any legacy corrupted history entries on startup
try {
  chrome.storage.local.get({ emailHistory: [] }, ({ emailHistory }) => {
    if (Array.isArray(emailHistory) && emailHistory.length > 0) {
      const cleaned = migrateAndGroupHistory(emailHistory);
      if (JSON.stringify(cleaned) !== JSON.stringify(emailHistory)) {
        chrome.storage.local.set({ emailHistory: cleaned });
      }
    }
  });
} catch (e) {}

