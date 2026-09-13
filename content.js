// content.js — runs on every page. Finds email addresses in visible text
// and injects a small clickable icon next to each one that opens a
// pre-filled draft panel.

(function () {
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

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

  let currentSettings = { ...DEFAULT_SETTINGS };

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

  function isCurrentPageRestricted() {
    return isDomainRestricted(location.hostname, currentSettings.restrictedDomains);
  }

  try {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      if (items) currentSettings = { ...currentSettings, ...items };
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes) {
        for (const [k, v] of Object.entries(changes)) {
          if (v && v.newValue !== undefined) {
            currentSettings[k] = v.newValue;
          }
        }
        if (changes.restrictedDomains || changes.restrictedEmails || changes.isEnabled) {
          if (!currentSettings.isEnabled || isCurrentPageRestricted()) {
            removeAllInjectedIcons();
          } else {
            scanRoot(document.body);
            scanSplitEmails();
            updateBadge();
          }
        }
      }
    });
  } catch (e) {}

  function buildComposeUrl(provider, to, subject, body, fromAccount) {
    const encTo = encodeURIComponent(to);
    const encSubject = encodeURIComponent(subject);
    const encBody = encodeURIComponent(body);
    const account = (fromAccount || "").trim();

    if (provider === "outlook") {
      let url = `https://outlook.office.com/mail/deeplink/compose?to=${encTo}&subject=${encSubject}&body=${encBody}`;
      if (account) url += `&login_hint=${encodeURIComponent(account)}`;
      return url;
    }

    const isAccountPosition = /^\d+$/.test(account);
    const accountSegment = isAccountPosition ? `u/${account}/` : (account ? "" : "u/0/");
    const authUser = account && !isAccountPosition ? `&authuser=${encodeURIComponent(account)}` : "";
    return `https://mail.google.com/mail/${accountSegment}?view=cm&fs=1&to=${encTo}&su=${encSubject}&body=${encBody}${authUser}`;
  }

  // Tags whose text content we should never touch / scan inside.
  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "IFRAME",
    "SVG",
    "CANVAS",
  ]);

  const processedNodes = new WeakSet();
  const foundEmails = new Set();
  let lastBadgeCount = -1;
  let extensionEnabled = true;
  let detectionMode = "auto";

  let activePanel = null;

  function closePanel() {
    if (activePanel) {
      activePanel.remove();
      activePanel = null;
    }
  }

  function removeAllInjectedIcons() {
    closePanel();
    document.querySelectorAll(".qmf-icon").forEach((icon) => icon.remove());
    document.querySelectorAll(".qmf-email-wrap").forEach((wrap) => {
      const parent = wrap.parentNode;
      if (parent) {
        while (wrap.firstChild) {
          parent.insertBefore(wrap.firstChild, wrap);
        }
        wrap.remove();
      }
    });
    foundEmails.clear();
    lastBadgeCount = -1;
    try {
      chrome.runtime.sendMessage({ type: "QMF_UPDATE_BADGE", count: 0, off: true });
    } catch (e) { }
  }

  document.addEventListener("click", (e) => {
    if (!activePanel) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(activePanel) || activePanel.contains(e.target) || (e.target && e.target.closest && e.target.closest(".qmf-icon, .qmf-panel"))) {
      return;
    }
    closePanel();
  }, true);

  function getSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => resolve(items));
      } catch (e) {
        resolve(DEFAULT_SETTINGS);
      }
    });
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

  function updateBadge() {
    if (!extensionEnabled) {
      try {
        chrome.runtime.sendMessage({ type: "QMF_UPDATE_BADGE", count: 0, off: true });
      } catch (e) { }
      return;
    }
    const count = foundEmails.size;
    if (count === lastBadgeCount) return;
    lastBadgeCount = count;
    try {
      chrome.runtime.sendMessage({ type: "QMF_UPDATE_BADGE", count });
    } catch (e) {
      /* extension context may be reloading */
    }
  }

  function recordHistory(email) {
    try {
      chrome.runtime.sendMessage({
        type: "QMF_RECORD_HISTORY",
        email,
        pageUrl: location.href,
        pageTitle: document.title,
        timestamp: Date.now(),
      });
    } catch (e) {
      /* ignore */
    }
  }

  // anchorEl === null means "no good on-page anchor" -> show as a
  // viewport-fixed panel (top-right) instead of positioning relative to
  // document flow, so it's never hidden off-screen.
  async function openPanel(anchorEl, email) {
    closePanel();
    const settings = await getSettings();
    const isAlreadyAdded = foundEmails.has(email);
    const addBtnHtml = (detectionMode === "manual" && !isAlreadyAdded)
      ? `<button class="qmf-add-manual-list-btn" style="width:100%; margin-bottom:10px; background:#16a34a; color:#ffffff; border:none; padding:7px 10px; border-radius:6px; font-weight:700; font-size:12px; cursor:pointer;">➕ Add to List &amp; History</button>`
      : "";

    const panel = document.createElement("div");
    panel.className = "qmf-panel";
    panel.innerHTML = `
      <div class="qmf-panel-header">
        <span>Draft email</span>
        <button class="qmf-close" title="Close">&times;</button>
      </div>
      ${addBtnHtml}
      <label>To</label>
      <input type="text" class="qmf-to" value="${email}" readonly />
      <label>From account <span class="qmf-optional">(optional)</span></label>
      <input type="text" class="qmf-from" placeholder="email or account number, e.g. 0" />
      <label>Subject</label>
      <input type="text" class="qmf-subject" />
      <label>Body</label>
      <textarea class="qmf-body" rows="6"></textarea>
      <div class="qmf-row">
        <select class="qmf-provider">
          <option value="gmail">Gmail</option>
          <option value="outlook">Outlook</option>
        </select>
        <button class="qmf-send">Open Compose →</button>
      </div>
    `;

    document.body.appendChild(panel);
    activePanel = panel;

    // Isolate panel events so scrolling or typing inside panel never triggers host page close scripts
    ["click", "mousedown", "mouseup", "scroll", "wheel", "pointerdown", "touchstart", "touchend"].forEach((evt) => {
      panel.addEventListener(evt, (e) => {
        e.stopPropagation();
      });
    });

    panel.querySelector(".qmf-subject").value = fillTemplate(settings.subjectTemplate, email, settings.driveLink, settings.yourName);
    panel.querySelector(".qmf-body").value = fillTemplate(settings.bodyTemplate, email, settings.driveLink, settings.yourName);
    panel.querySelector(".qmf-provider").value = settings.provider;
    panel.querySelector(".qmf-from").value = settings.fromAccount || "";

    const addListBtn = panel.querySelector(".qmf-add-manual-list-btn");
    if (addListBtn) {
      addListBtn.addEventListener("click", (e) => {
        foundEmails.add(email);
        recordHistory(email);
        updateBadge();
        e.target.textContent = "✅ Added to List & History";
        e.target.disabled = true;
        e.target.style.background = "#64748b";
      });
    }

    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      let top = rect.bottom + 6;
      let left = rect.left;

      const panelHeight = 360;
      const maxTop = window.innerHeight - panelHeight - 16;
      if (top > maxTop) top = Math.max(16, rect.top - panelHeight - 6);

      const maxLeft = window.innerWidth - 340;
      if (left > maxLeft) left = Math.max(16, maxLeft);

      panel.style.position = "fixed";
      panel.style.top = `${Math.max(16, top)}px`;
      panel.style.left = `${Math.max(16, left)}px`;
      panel.style.right = "auto";
    } else {
      panel.style.position = "fixed";
      panel.style.top = "16px";
      panel.style.right = "16px";
      panel.style.left = "auto";
    }

    panel.querySelector(".qmf-close").addEventListener("click", closePanel);
    panel.querySelector(".qmf-send").addEventListener("click", () => {
      const to = panel.querySelector(".qmf-to").value.trim();
      const subject = panel.querySelector(".qmf-subject").value;
      const body = panel.querySelector(".qmf-body").value;
      const provider = panel.querySelector(".qmf-provider").value;

      if (!foundEmails.has(to)) {
        foundEmails.add(to);
        recordHistory(to);
        updateBadge();
      }

      chrome.runtime.sendMessage({
        type: "QMF_UPDATE_STATUS",
        emails: [to],
        status: "Submitted"
      });

      const url = buildComposeUrl(provider, to, subject, body, panel.querySelector(".qmf-from").value);
      chrome.runtime.sendMessage({ type: "QMF_OPEN_COMPOSE", provider, email: to, url });
      closePanel();
    });
  }

  const IGNORED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "tiff"]);

  function sanitizeEmail(raw) {
    if (!raw || typeof raw !== "string") return "";
    let clean = raw.trim();

    // 1. Remove wrapping quotes, brackets, angle brackets, and punctuation
    clean = clean.replace(/^[<(\['"“‘\s]+/, "").replace(/[.,;)!?\]'">”’\s]+$/, "");

    // 2. Strip common URL/mail/protocol/label prefixes with colon, hyphen, space
    // Examples: mailto:, email:, e-mail:, to:, contact:, reach:, from:
    clean = clean.replace(/^(mailto|email|e-mail|mail|to|from|contact|reach|inquiries|attn)[:_\s-]+/i, "");

    // Check valid @ structure
    const atIdx = clean.lastIndexOf("@");
    if (atIdx <= 0 || atIdx === clean.length - 1) return "";

    let localPart = clean.slice(0, atIdx);
    const domainPart = clean.slice(atIdx + 1);

    // Check valid domain structure (at least one dot, valid chars)
    if (!domainPart.includes(".") || domainPart.startsWith(".") || domainPart.endsWith(".")) {
      return "";
    }

    // 3. Fix "To" glued to localPart:
    // 3a. "To" followed by PascalCase / Capitalized name: ToVaishali -> Vaishali, ToJohn -> John
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

    // 6. Clean any residual leading/trailing dots/underscores/hyphens in localPart
    localPart = localPart.replace(/^[._-]+/, "").replace(/[._-]+$/, "");

    if (!localPart || localPart.length < 2) return "";

    return `${localPart}@${domainPart}`;
  }

  function cleanAndValidateEmail(rawMatch) {
    if (!rawMatch) return null;
    let clean = sanitizeEmail(rawMatch);
    if (!clean) return null;

    const parts = clean.split("@");
    if (parts.length !== 2) return null;
    const domainParts = parts[1].split(".");
    const ext = domainParts[domainParts.length - 1].toLowerCase();
    if (IGNORED_EXTENSIONS.has(ext)) return null;
    if (clean.length < 5) return null;

    if (isEmailRestricted(clean, currentSettings.restrictedEmails)) {
      return null;
    }

    return clean;
  }

  function scanTextNode(textNode) {
    if (!extensionEnabled || isCurrentPageRestricted()) return;
    if (processedNodes.has(textNode)) return;
    const parent = textNode.parentNode;
    if (!parent || SKIP_TAGS.has(parent.tagName)) return;
    if (parent.closest && parent.closest(".qmf-panel, .qmf-email-wrap")) return;

    const fullText = textNode.textContent;
    if (!fullText || fullText.indexOf("@") === -1) return;

    EMAIL_REGEX.lastIndex = 0;
    const matches = [];
    let match;
    while ((match = EMAIL_REGEX.exec(fullText)) !== null) {
      const rawMatch = match[0];
      const startIdx = match.index;
      const validEmail = cleanAndValidateEmail(rawMatch);
      if (validEmail) {
        // Calculate the exact position of validEmail in fullText around startIdx
        const adjustedStartIdx = fullText.indexOf(validEmail, startIdx);
        const finalStartIdx = (adjustedStartIdx >= startIdx && adjustedStartIdx < startIdx + rawMatch.length)
          ? adjustedStartIdx
          : startIdx;
        matches.push({
          email: validEmail,
          rawMatch,
          startIdx: finalStartIdx,
          endIdx: finalStartIdx + validEmail.length,
        });
      }
    }

    if (matches.length === 0) return;

    processedNodes.add(textNode);

    const frag = document.createDocumentFragment();
    let currentIdx = 0;

    matches.forEach(({ email, startIdx, endIdx }) => {
      if (startIdx > currentIdx) {
        frag.appendChild(document.createTextNode(fullText.slice(currentIdx, startIdx)));
      }

      const wrapper = document.createElement("span");
      wrapper.className = "qmf-email-wrap";

      const emailSpan = document.createElement("span");
      emailSpan.className = "qmf-email-text";
      emailSpan.textContent = email;

      const icon = document.createElement("span");
      icon.className = "qmf-icon";
      icon.textContent = "✉";
      icon.dataset.qmfBound = "true";
      icon.title = "Draft email to " + email;
      icon.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        openPanel(icon, email);
      });

      wrapper.appendChild(emailSpan);
      wrapper.appendChild(icon);
      frag.appendChild(wrapper);

      currentIdx = endIdx;

      if (detectionMode === "auto") {
        const isNew = !foundEmails.has(email);
        foundEmails.add(email);
        if (isNew) recordHistory(email);
      }
    });

    if (currentIdx < fullText.length) {
      frag.appendChild(document.createTextNode(fullText.slice(currentIdx)));
    }

    parent.replaceChild(frag, textNode);

    if (detectionMode === "auto") {
      updateBadge();
    }
  }

  function harvestExistingEmails(root = document) {
    if (!root || !root.querySelectorAll) return;
    let added = false;
    try {
      root.querySelectorAll(".qmf-email-wrap").forEach((wrap) => {
        const emailEl = wrap.querySelector(".qmf-email-text");
        const iconEl = wrap.querySelector(".qmf-icon");
        const email = emailEl && emailEl.textContent && emailEl.textContent.trim();
        const validEmail = cleanAndValidateEmail(email);
        if (validEmail) {
          if (!foundEmails.has(validEmail)) {
            foundEmails.add(validEmail);
            added = true;
            if (detectionMode === "auto") recordHistory(validEmail);
          }
          if (iconEl && !iconEl.dataset.qmfBound) {
            iconEl.dataset.qmfBound = "true";
            iconEl.addEventListener("click", (e) => {
              e.stopPropagation();
              e.preventDefault();
              openPanel(iconEl, validEmail);
            });
          }
        }
      });

      root.querySelectorAll(".qmf-split-badge").forEach((badge) => {
        const email = badge.dataset && badge.dataset.email;
        const validEmail = cleanAndValidateEmail(email);
        if (validEmail) {
          if (!foundEmails.has(validEmail)) {
            foundEmails.add(validEmail);
            added = true;
            if (detectionMode === "auto") recordHistory(validEmail);
          }
          const iconEl = badge.querySelector(".qmf-icon");
          if (iconEl && !iconEl.dataset.qmfBound) {
            iconEl.dataset.qmfBound = "true";
            iconEl.addEventListener("click", (e) => {
              e.stopPropagation();
              e.preventDefault();
              openPanel(iconEl, validEmail);
            });
          }
        }
      });
    } catch (e) {}
    if (added && detectionMode === "auto") {
      updateBadge();
    }
  }

  function scanRoot(root) {
    if (!extensionEnabled || isCurrentPageRestricted() || !root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      scanTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.tagName && SKIP_TAGS.has(root.tagName)) return;

    harvestExistingEmails(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentNode;
        if (!p || SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest(".qmf-panel, .qmf-email-wrap")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(scanTextNode);
  }

  // --- Split-span email scanner ---
  // Many social sites (LinkedIn, Facebook, Naukri) split email text across
  // multiple child <span> nodes like:
  //   <span>bhumika.verma</span><span>@</span><span>xicom.biz</span>
  // A single text-node walk never sees the full email. Instead we read the
  // combined innerText of paragraph-level containers and look for emails there.

  const splitScannedElements = new WeakSet();

  // Block-level and common post-content tags to aggregate text from
  const SPLIT_SCAN_SELECTORS = [
    "p", "div", "li", "span[class]", "article", "section",
    // LinkedIn post body
    ".feed-shared-text", ".feed-shared-update-v2__description",
    ".update-components-text",
    // Facebook post body
    "[data-ad-preview='message']", "div[dir='auto']",
    // Naukri
    ".job-desc", ".jd-desc",
    // Generic
    ".post-text", ".post-content", ".content", ".description"
  ].join(",");

  function getSpacedContainerText(el) {
    if (!el) return "";
    let result = "";
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.nodeValue;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (SKIP_TAGS.has(node.tagName)) return;
        if (node.classList && (node.classList.contains("qmf-panel") || node.classList.contains("qmf-email-wrap"))) return;

        const isBlock = /^(DIV|P|LI|H[1-6]|TR|TD|TH|SECTION|ARTICLE|HEADER|FOOTER|NAV|ASIDE|MAIN)$/i.test(node.tagName);
        const isSeparate = isBlock || /^(BUTTON|LABEL|I|SVG|STRONG|B|SMALL|EM|A)$/i.test(node.tagName) ||
          (node.className && typeof node.className === "string" && /(avatar|badge|label|icon|prefix|title|name|status|count)/i.test(node.className));

        if (isSeparate && result.length > 0 && !/\s$/.test(result)) {
          result += " ";
        }

        for (let child = node.firstChild; child; child = child.nextSibling) {
          walk(child);
        }

        if (isSeparate && result.length > 0 && !/\s$/.test(result)) {
          result += " ";
        }
      }
    };
    walk(el);
    return result;
  }

  function scanSplitEmails() {
    if (!extensionEnabled || isCurrentPageRestricted()) return;

    // Collect all candidate container elements
    let candidates;
    try {
      candidates = document.querySelectorAll(SPLIT_SCAN_SELECTORS);
    } catch (e) {
      return;
    }

    candidates.forEach((el) => {
      // Skip our own injected elements
      if (el.closest(".qmf-panel, .qmf-email-wrap")) return;
      // Skip already processed containers
      if (splitScannedElements.has(el)) return;

      const text = getSpacedContainerText(el);
      if (!text || !text.includes("@")) return;

      EMAIL_REGEX.lastIndex = 0;
      let match;
      let found = false;
      while ((match = EMAIL_REGEX.exec(text)) !== null) {
        const validEmail = cleanAndValidateEmail(match[0]);
        if (!validEmail) continue;

        // Only process if not already found via text-node scanning
        if (!foundEmails.has(validEmail)) {
          found = true;
          if (detectionMode === "auto") {
            foundEmails.add(validEmail);
            recordHistory(validEmail);
          }

          // Inject a pill/badge at the end of the container so the user
          // can still click it to open the draft panel.
          // Avoid adding duplicate badges for the same email in same container.
          const existingBadge = el.querySelector(`.qmf-split-badge[data-email="${CSS.escape(validEmail)}"]`);
          if (!existingBadge) {
            const badge = document.createElement("span");
            badge.className = "qmf-split-badge";
            badge.dataset.email = validEmail;
            badge.innerHTML = ` <span class="qmf-icon" data-qmf-bound="true" title="Draft email to ${validEmail}" style="cursor:pointer;">✉</span>`;
            badge.querySelector(".qmf-icon").addEventListener("click", (e) => {
              e.stopPropagation();
              e.preventDefault();
              openPanel(badge.querySelector(".qmf-icon"), validEmail);
            });
            el.appendChild(badge);
          }
        }
      }

      if (found) {
        splitScannedElements.add(el);
        updateBadge();
      }
    });
  }

  // Initial state check & scan
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    if (items) currentSettings = { ...currentSettings, ...items };
    extensionEnabled = currentSettings.isEnabled !== false;
    detectionMode = currentSettings.detectionMode || "auto";

    if (isCurrentPageRestricted()) {
      removeAllInjectedIcons();
      return;
    }

    if (extensionEnabled) {
      scanRoot(document.body);
      scanSplitEmails();
      updateBadge();
    } else {
      removeAllInjectedIcons();
    }
  });

  // Watch for dynamically loaded / re-rendered content
  let debounceTimer = null;
  const pendingCharacterDataNodes = new Set();
  const observer = new MutationObserver((mutations) => {
    if (!extensionEnabled || isCurrentPageRestricted()) return;
    for (const m of mutations) {
      if (m.type === "childList") {
        m.addedNodes.forEach((node) => scanRoot(node));
      } else if (m.type === "characterData") {
        pendingCharacterDataNodes.add(m.target);
      }
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!extensionEnabled || isCurrentPageRestricted()) return;
      pendingCharacterDataNodes.forEach((node) => {
        processedNodes.delete(node);
        scanTextNode(node);
      });
      pendingCharacterDataNodes.clear();
      updateBadge();
    }, 250);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  const scanIntervalId = setInterval(() => {
    if (!chrome.runtime?.id) {
      clearInterval(scanIntervalId);
      try { observer.disconnect(); } catch (e) {}
      return;
    }
    if (!extensionEnabled || isCurrentPageRestricted() || document.hidden) return;
    scanRoot(document.body);
    scanSplitEmails();   // also catch split-span emails on LinkedIn / Naukri
    updateBadge();
  }, 2500);

  // Respond to messages from popup or background worker
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "QMF_TOGGLE_STATE") {
      extensionEnabled = msg.enabled !== false;
      if (!extensionEnabled || isCurrentPageRestricted()) {
        removeAllInjectedIcons();
      } else {
        scanRoot(document.body);
        scanSplitEmails();
        updateBadge();
      }
      sendResponse({ ok: true });
      return true;
    }

    if (msg && msg.type === "QMF_SET_DETECTION_MODE") {
      detectionMode = msg.mode || "auto";
      sendResponse({ ok: true });
      return true;
    }

    if (msg && msg.type === "QMF_GET_EMAILS") {
      harvestExistingEmails(document);
      const restricted = isCurrentPageRestricted();
      sendResponse({
        emails: (extensionEnabled && !restricted) ? Array.from(foundEmails) : [],
        isRestrictedDomain: restricted,
        hostname: location.hostname,
      });
      return true;
    }

    if (msg && msg.type === "QMF_ADD_MANUAL_EMAIL") {
      if (msg.email) {
        const cleanEmail = sanitizeEmail(msg.email);
        if (cleanEmail && !isEmailRestricted(cleanEmail, currentSettings.restrictedEmails) && !isCurrentPageRestricted()) {
          foundEmails.add(cleanEmail);
          updateBadge();
        }
      }
      sendResponse({ ok: true });
      return true;
    }
    if (msg && msg.type === "QMF_OPEN_PANEL_FOR_EMAIL") {
      if (!extensionEnabled) {
        sendResponse({ ok: false, reason: "Extension is OFF" });
        return true;
      }
      let anchor = null;
      const wraps = document.querySelectorAll(".qmf-icon");
      for (const icon of wraps) {
        if (icon.title.endsWith(msg.email)) {
          anchor = icon;
          break;
        }
      }
      if (anchor) {
        openPanel(anchor, msg.email);
      } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && sel.toString().includes("@")) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          const tempAnchor = document.createElement("span");
          tempAnchor.style.position = "absolute";
          tempAnchor.style.left = `${window.scrollX + rect.left}px`;
          tempAnchor.style.top = `${window.scrollY + rect.top}px`;
          document.body.appendChild(tempAnchor);
          openPanel(tempAnchor, msg.email).then(() => tempAnchor.remove());
        } else {
          openPanel(null, msg.email);
        }
      }
      sendResponse({ ok: true });
    }
    return true;
  });

  // --- Gmail & Outlook Compose Box Attachment Card Enhancer ---
  function createAttachmentCardElement(cleanUrl, docTitle, docStyle) {
    const safeTitle = (docTitle || "Attached_Document.pdf").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
    const safeUrl = (cleanUrl || "").replace(/"/g, "&quot;");

    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-qmf-card", "true");
    wrapper.setAttribute("contenteditable", "false");
    wrapper.style.clear = "both";
    wrapper.style.userSelect = "all";

    if (docStyle === "link") {
      wrapper.style.fontFamily = "Arial, sans-serif";
      wrapper.style.fontSize = "13px";
      wrapper.style.margin = "10px 0";
      wrapper.innerHTML = `📄 <b>Attached Document:</b> <a href="${safeUrl}" target="_blank" style="color: #1a73e8; text-decoration: underline; font-weight: 600;">${safeTitle}</a>`;
    } else if (docStyle === "pill") {
      wrapper.style.margin = "10px 0";
      wrapper.style.display = "inline-block";
      wrapper.innerHTML = `<a href="${safeUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; background-color: #f1f3f4; border: 1px solid #dadce0; border-radius: 16px; padding: 6px 14px; text-decoration: none; color: #202124; font-family: Arial, sans-serif; font-size: 12.5px; font-weight: 500;"><span style="color: #ea4335; font-weight: bold; font-size: 10px; background: #fce8e6; padding: 2px 5px; border-radius: 3px;">PDF</span><span>${safeTitle}</span><span style="color: #5f6368; font-size: 11px;">↗</span></a>`;
    } else {
      wrapper.style.margin = "14px 0";
      wrapper.style.fontFamily = "Arial, sans-serif";
      wrapper.innerHTML = `<table cellpadding="0" cellspacing="0" style="border: 1px solid #d1d5db; border-radius: 8px; background-color: #f8f9fa; padding: 12px 16px; max-width: 480px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"><tr><td style="vertical-align: middle; padding-right: 14px;"><div style="background-color: #ea4335; color: #ffffff; font-weight: bold; font-size: 11px; padding: 6px 9px; border-radius: 4px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">PDF</div></td><td style="vertical-align: middle;"><div style="font-weight: 700; font-size: 14px; color: #1f2937; margin-bottom: 3px; line-height: 1.2;">${safeTitle}</div><a href="${safeUrl}" target="_blank" style="color: #1a73e8; font-size: 13px; text-decoration: none; font-weight: 600; display: inline-block;">📎 Click to View &amp; Download File</a></td></tr></table><br>`;
    }
    return wrapper;
  }

  function enhanceComposeBoxAttachments() {
    const isGmail = location.hostname.includes("mail.google.com");
    const isOutlook = location.hostname.includes("outlook");
    if (!isGmail && !isOutlook) return;

    const selectors = [
      'div[role="textbox"][contenteditable="true"]',
      'div.g_editable[contenteditable="true"]',
      'div[aria-label="Message Body"][contenteditable="true"]',
      'div[aria-label="Message body"][contenteditable="true"]',
      'div[contenteditable="true"][aria-label*="Body"]',
      'div[contenteditable="true"][aria-label*="body"]',
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((editor) => {
        // Fast exit if already enhanced or currently processing
        if (editor.dataset.qmfEnhanced === "true" || editor.dataset.qmfProcessing === "true" || editor.querySelector('[data-qmf-card="true"]')) {
          editor.dataset.qmfEnhanced = "true";
          return;
        }

        editor.dataset.qmfProcessing = "true";
        let touched = false;

        const docTitle = currentSettings.driveTitle || "Attached_Document.pdf";
        const docStyle = currentSettings.driveStyle || "link";

        // 1. Process Google Drive links already turned into <a> tags by Gmail/Outlook
        const existingAnchors = Array.from(editor.querySelectorAll("a"));
        for (const anchor of existingAnchors) {
          if (anchor.closest('[data-qmf-card="true"]')) continue;

          const href = anchor.getAttribute("href") || "";
          const text = anchor.textContent || "";
          if (/(?:drive|docs)\.google\.com/i.test(href) || /(?:drive|docs)\.google\.com/i.test(text)) {
            let cleanUrl = href || text.trim();
            const qMatch = cleanUrl.match(/[?&]q=([^&]+)/);
            if (qMatch) {
              try { cleanUrl = decodeURIComponent(qMatch[1]); } catch (e) {}
            }
            cleanUrl = cleanUrl.replace(/[.,;)]+$/, "");

            const cardNode = createAttachmentCardElement(cleanUrl, docTitle, docStyle);
            const parent = anchor.parentElement;
            if (parent && parent !== editor && parent.textContent.trim() === anchor.textContent.trim()) {
              parent.replaceWith(cardNode);
            } else {
              anchor.replaceWith(cardNode);
            }
            touched = true;
          }
        }

        // 2. Process Google Drive links still in raw text nodes
        const driveRegex = /(https:\/\/(?:drive|docs)\.google\.com\/[^\s<")]+)/i;
        const driveWalker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
        const driveTextNodes = [];
        let dNode;
        while ((dNode = driveWalker.nextNode())) {
          if (dNode.parentElement && (dNode.parentElement.closest("a") || dNode.parentElement.closest('[data-qmf-card="true"]'))) {
            continue;
          }
          if (driveRegex.test(dNode.nodeValue)) {
            driveTextNodes.push(dNode);
          }
        }

        for (const node of driveTextNodes) {
          const val = node.nodeValue;
          const match = val.match(driveRegex);
          if (!match) continue;

          const cleanUrl = match[1].replace(/[.,;)]+$/, "");
          const index = match.index;
          const beforeText = val.substring(0, index);
          const afterText = val.substring(index + match[0].length);

          const cardNode = createAttachmentCardElement(cleanUrl, docTitle, docStyle);
          const parent = node.parentNode;
          if (parent) {
            if (beforeText) parent.insertBefore(document.createTextNode(beforeText), node);
            parent.insertBefore(cardNode, node);
            if (afterText) parent.insertBefore(document.createTextNode(afterText), node);
            parent.removeChild(node);
            touched = true;
          }
        }

        // 3. Process Markdown links [Text](URL) in text nodes
        const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s<")]+)\)/;
        const mdWalker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
        const mdTextNodes = [];
        let mNode;
        while ((mNode = mdWalker.nextNode())) {
          if (mNode.parentElement && (mNode.parentElement.closest("a") || mNode.parentElement.closest('[data-qmf-card="true"]'))) {
            continue;
          }
          if (mdRegex.test(mNode.nodeValue)) {
            mdTextNodes.push(mNode);
          }
        }

        for (const node of mdTextNodes) {
          const val = node.nodeValue;
          const match = val.match(mdRegex);
          if (!match) continue;

          const linkText = match[1];
          const linkUrl = match[2];
          const index = match.index;
          const beforeText = val.substring(0, index);
          const afterText = val.substring(index + match[0].length);

          const linkNode = document.createElement("a");
          linkNode.href = linkUrl;
          linkNode.target = "_blank";
          linkNode.textContent = linkText;
          linkNode.style.color = "#1a73e8";
          linkNode.style.textDecoration = "underline";
          linkNode.style.fontWeight = "500";

          const parent = node.parentNode;
          if (parent) {
            if (beforeText) parent.insertBefore(document.createTextNode(beforeText), node);
            parent.insertBefore(linkNode, node);
            if (afterText) parent.insertBefore(document.createTextNode(afterText), node);
            parent.removeChild(node);
            touched = true;
          }
        }

        if (touched || editor.querySelector('[data-qmf-card="true"]')) {
          editor.dataset.qmfEnhanced = "true";
        }
        delete editor.dataset.qmfProcessing;
      });
    });
  }

  if (location.hostname.includes("mail.google.com") || location.hostname.includes("outlook")) {
    const enhancerTimer = setInterval(() => {
      enhanceComposeBoxAttachments();
      const editors = document.querySelectorAll('div[role="textbox"][contenteditable="true"], div.g_editable[contenteditable="true"]');
      if (editors.length > 0 && Array.from(editors).every((ed) => ed.dataset.qmfEnhanced === "true")) {
        clearInterval(enhancerTimer);
      }
    }, 500);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO SCROLL ENGINE
  // Triggered by popup button. Slowly auto-scrolls the page so the extension
  // can scan all content as it loads. Shows a floating on-screen pill with a
  // live email counter and a Stop button — no need to open popup to stop.
  // ─────────────────────────────────────────────────────────────────────────

  let autoScanTimer = null;
  let autoScanActive = false;
  let autoScanFloatingBar = null;

  function createAutoScanFloatingBar() {
    // Remove any existing bar
    removeAutoScanFloatingBar();

    const bar = document.createElement("div");
    bar.id = "qmf-autoscan-bar";
    bar.innerHTML = `
      <span class="qmf-asb-icon">📡</span>
      <span class="qmf-asb-text">Auto Scrolling…</span>
      <span class="qmf-asb-count" id="qmf-asb-count">0 emails</span>
      <button class="qmf-asb-stop" id="qmf-asb-stop-btn">⏹ Stop</button>
    `;
    document.body.appendChild(bar);
    autoScanFloatingBar = bar;

    document.getElementById("qmf-asb-stop-btn").addEventListener("click", () => {
      stopAutoScan(true);
    });
  }

  function updateAutoScanFloatingBar(count) {
    const countEl = document.getElementById("qmf-asb-count");
    if (countEl) countEl.textContent = `${count} email${count !== 1 ? "s" : ""} found`;
  }

  function removeAutoScanFloatingBar() {
    const existing = document.getElementById("qmf-autoscan-bar");
    if (existing) existing.remove();
    autoScanFloatingBar = null;
  }

  function stopAutoScan(userStopped = false) {
    if (!autoScanActive) return;
    autoScanActive = false;
    clearInterval(autoScanTimer);
    autoScanTimer = null;

    const totalFound = foundEmails.size;

    // Update floating bar to "Done" state
    if (autoScanFloatingBar) {
      autoScanFloatingBar.innerHTML = `
        <span class="qmf-asb-icon">✅</span>
        <span class="qmf-asb-text">${userStopped ? "Scroll stopped" : "Scroll complete"}</span>
        <span class="qmf-asb-count">${totalFound} email${totalFound !== 1 ? "s" : ""} found</span>
        <button class="qmf-asb-stop qmf-asb-close" id="qmf-asb-close-btn">✕ Close</button>
      `;
      document.getElementById("qmf-asb-close-btn").addEventListener("click", removeAutoScanFloatingBar);
      // Auto-remove after 5 seconds
      setTimeout(removeAutoScanFloatingBar, 5000);
    }

    // Notify popup that scroll is done
    try {
      chrome.runtime.sendMessage({ type: "QMF_AUTO_SCAN_DONE", found: totalFound });
    } catch (e) {}

    updateBadge();
  }

  // Find the actual scrollable feed container on any page.
  // LinkedIn uses overflow:hidden on html/body — the real scroller is a child div.
  // We cache the result since it won't change during a scroll session.
  let _cachedScrollContainer = null;

  function findScrollContainer() {
    if (_cachedScrollContainer) return _cachedScrollContainer;

    // ── Site-specific known selectors ────────────────────────────────────
    if (location.hostname.includes("linkedin.com")) {
      const linkedInSelectors = [
        ".scaffold-layout__main",        // main feed wrapper
        ".feed-container-theme",         // feed page
        "main.scaffold-layout__main",
        ".artdeco-modal__content",       // modal pages
        "div.scaffold-finite-scroll__content",
      ];
      for (const sel of linkedInSelectors) {
        const el = document.querySelector(sel);
        if (el && el.scrollHeight > el.clientHeight + 100) {
          _cachedScrollContainer = el;
          return el;
        }
      }
    }

    if (location.hostname.includes("naukri.com")) {
      const el = document.querySelector(".naukri_inner, .styles_wrapper__ugRwm, main");
      if (el && el.scrollHeight > el.clientHeight + 100) {
        _cachedScrollContainer = el;
        return el;
      }
    }

    // ── Generic: check common layout containers ──────────────────────────
    const genericSelectors = [
      "main", "[role='main']", ".main-content", "#main-content",
      ".feed", "#feed", ".content-wrapper", "#content",
    ];
    for (const sel of genericSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const style = window.getComputedStyle(el);
        if (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 100
        ) {
          _cachedScrollContainer = el;
          return el;
        }
      }
    }

    // ── Last resort: use window ──────────────────────────────────────────
    return null; // null = window
  }

  function getContainerScrollTop(container) {
    if (!container) return window.scrollY || window.pageYOffset || 0;
    return container.scrollTop;
  }

  function getContainerScrollHeight(container) {
    if (!container) return document.documentElement.scrollHeight;
    return container.scrollHeight;
  }

  function getContainerClientHeight(container) {
    if (!container) return window.innerHeight;
    return container.clientHeight;
  }

  // Scroll down by `amount` pixels on the correct container only.
  // Never touch documentElement.scrollTop / body.scrollTop simultaneously
  // since that fights against SPA scroll management (LinkedIn, Naukri etc.)
  function forceScrollDown(amount) {
    _cachedScrollContainer = null; // refresh each call so we get the live element
    const container = findScrollContainer();
    if (container) {
      container.scrollTop += amount;
    } else {
      window.scrollBy(0, amount);
    }
  }

  function startAutoScan() {
    if (autoScanActive) return;
    if (!extensionEnabled) return;

    _cachedScrollContainer = null; // reset cache at start of each scan session
    autoScanActive = true;
    createAutoScanFloatingBar();
    updateAutoScanFloatingBar(foundEmails.size);

    // Scroll 400px every 1.5 seconds — instant (no smooth) so position
    // check immediately after scrolling gives an accurate reading.
    const SCROLL_STEP = 400;
    const SCROLL_INTERVAL = 1500;
    let noProgressCount = 0;

    autoScanTimer = setInterval(() => {
      if (!autoScanActive) return;

      // Get the container we'll scroll (same logic as forceScrollDown)
      _cachedScrollContainer = null;
      const container = findScrollContainer();

      // Snapshot position BEFORE scroll from the correct container
      const prevScrollPos = getContainerScrollTop(container);

      // Scroll it
      if (container) {
        container.scrollTop += SCROLL_STEP;
      } else {
        window.scrollBy(0, SCROLL_STEP);
      }

      // Wait 600ms for page to load new dynamic content, THEN scan
      setTimeout(() => {
        if (!autoScanActive) return;

        scanRoot(document.body);
        scanSplitEmails();
        updateBadge();
        updateAutoScanFloatingBar(foundEmails.size);

        // Read position AFTER scroll from the same container
        const nowScrollPos = getContainerScrollTop(container);
        const scrollHeight = getContainerScrollHeight(container);
        const clientHeight = getContainerClientHeight(container);

        const atBottom = nowScrollPos + clientHeight >= scrollHeight - 80;
        const noProgress = Math.abs(nowScrollPos - prevScrollPos) < 5;


        if (noProgress) {
          noProgressCount++;
        } else {
          noProgressCount = 0; // reset counter on successful scroll
        }

        // Stop only if we're at the bottom OR stuck for 3 consecutive steps
        if (atBottom || noProgressCount >= 3) {
          stopAutoScan(false);
        }
      }, 600);
    }, SCROLL_INTERVAL);
  }

  // Handle messages from popup for auto scroll
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;

    if (msg.type === "QMF_AUTO_SCAN_STATUS") {
      // Popup queries this on open to restore correct button state
      sendResponse({ active: autoScanActive });
      return true;
    }

    if (msg.type === "QMF_AUTO_SCAN_START") {
      startAutoScan();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "QMF_AUTO_SCAN_STOP") {
      stopAutoScan(true);
      sendResponse({ ok: true });
      return true;
    }
  });

  // --- Auto-close standalone compose tab after sending ---
  function setupAutoCloseOnSend() {
    const isGmailCompose = location.hostname.includes("mail.google.com") && (location.search.includes("view=cm") || location.search.includes("fs=1"));
    const isOutlookCompose = location.hostname.includes("outlook") && (location.href.includes("deeplink/compose") || location.href.includes("compose"));

    if (!isGmailCompose && !isOutlookCompose) return;

    let isSending = false;

    function handleSendTrigger() {
      if (isSending) return;
      isSending = true;

      const observer = new MutationObserver(() => {
        const text = (document.body && document.body.innerText) || "";
        if (text.includes("Your message has been sent") || text.includes("Message sent") || text.includes("Sending")) {
          observer.disconnect();
          setTimeout(() => {
            try { chrome.runtime.sendMessage({ type: "QMF_CLOSE_SENT_TAB" }); } catch (e) {}
          }, 400);
        }
      });

      try {
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) {}

      setTimeout(() => {
        try { observer.disconnect(); } catch (e) {}
        try { chrome.runtime.sendMessage({ type: "QMF_CLOSE_SENT_TAB" }); } catch (e) {}
      }, 1800);
    }

    document.addEventListener("click", (e) => {
      const sendBtn = e.target && e.target.closest && e.target.closest('div[role="button"][data-tooltip*="Send"], div[aria-label*="Send"], button[aria-label*="Send"], [data-tooltip*="Send"]');
      if (sendBtn) {
        handleSendTrigger();
      }
    }, true);

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        handleSendTrigger();
      }
    }, true);
  }

  setupAutoCloseOnSend();

})();

