// QuickMail Finder — Product Website Interactive Logic (app.js)

document.addEventListener('DOMContentLoaded', () => {
  initNavbarScroll();
  initHeroVideoPlayer();
  initDemoTabs();
  initTimeSavedCalculator();
  initFaqAccordion();
});

// 1. Sticky Navbar Blur & Shadow on Scroll
function initNavbarScroll() {
  const header = document.getElementById('mainHeader');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.style.background = 'rgba(7, 11, 20, 0.92)';
      header.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.4)';
    } else {
      header.style.background = 'rgba(7, 11, 20, 0.75)';
      header.style.boxShadow = 'none';
    }
  });
}

// 2. Interactive Feature Demo Tabs
function initDemoTabs() {
  const tabs = document.querySelectorAll('.demo-tab');
  const panels = document.querySelectorAll('.demo-content-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      // Update active tab button
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active panel
      panels.forEach(p => {
        p.classList.remove('active');
        if (p.id === `panel-${targetTab}`) {
          p.classList.add('active');
        }
      });
    });
  });

  // Interactive Excel & Google Sheets Spreadsheet Demo
  const copyBtn = document.getElementById('copySheetDataBtn');
  const formulaRef = document.getElementById('sheetActiveCellRef');
  const formulaVal = document.getElementById('sheetFormulaDisplay');
  const sheetRows = document.querySelectorAll('.sheet-row');

  // Row selection updates Excel Formula bar
  sheetRows.forEach(row => {
    row.addEventListener('click', () => {
      const cell = row.getAttribute('data-cell') || 'A1';
      const val = row.getAttribute('data-val') || '';
      if (formulaRef) formulaRef.textContent = cell;
      if (formulaVal) formulaVal.textContent = val;
    });
  });

  // 1-Click Copy Table Data (Pre-formatted for direct pasting into Excel or Google Sheets)
  if (copyBtn) {
    const originalCopyText = copyBtn.innerHTML;
    copyBtn.addEventListener('click', () => {
      const tsvData = "Email Address\tOutreach Status\tDate Logged\nrecruitment@meta.com\tSubmitted\tToday\nsarah@fintechgrowth.io\tDrafted\tYesterday";
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tsvData).catch(() => {});
      }

      copyBtn.classList.add('copied');
      copyBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Copied for Excel!</span>
      `;

      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = originalCopyText;
      }, 2000);
    });
  }
}

// 3. Interactive ROI / Time Saved Calculator
function initTimeSavedCalculator() {
  const slider = document.getElementById('emailsSlider');
  const sliderDisplay = document.getElementById('sliderValueDisplay');
  const hoursDisplay = document.getElementById('hoursSavedMonthly');
  const daysDisplay = document.getElementById('daysSavedYearly');

  if (!slider) return;

  function updateCalculator() {
    const emailsPerWeek = parseInt(slider.value, 10);
    sliderDisplay.textContent = `${emailsPerWeek} emails / wk`;

    // Manual approach: ~5 minutes (0.0833 hrs) per email
    // QuickMail Finder approach: ~15 seconds (0.0041 hrs) per email
    // Hours saved per email = ~0.08 hrs (4.8 minutes saved per email)
    const hoursSavedPerWeek = emailsPerWeek * 0.08;
    const hoursSavedPerMonth = (hoursSavedPerWeek * 4.33).toFixed(1);
    const daysSavedPerYear = ((hoursSavedPerWeek * 52) / 8).toFixed(1); // 8-hr work days

    hoursDisplay.textContent = `${hoursSavedPerMonth} hrs`;
    daysDisplay.textContent = `${daysSavedPerYear} days`;
  }

  slider.addEventListener('input', updateCalculator);
  updateCalculator(); // Initialize on load
}

// 4. Accessible FAQ Accordion
function initFaqAccordion() {
  const faqQuestions = document.querySelectorAll('.faq-question');

  faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';

      // Close all other items
      document.querySelectorAll('.faq-item').forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          const otherBtn = otherItem.querySelector('.faq-question');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current item
      if (isExpanded) {
        item.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

// 5. YouTube Hero Video Player Setup
function initHeroVideoPlayer() {
  const container = document.querySelector('.youtube-video-container');
  if (!container) return;

  // Detect if user opened the page directly as a local file (file:///)
  // YouTube strictly blocks embeds from 'file://' with Error 153 because there is no HTTP/HTTPS web origin.
  if (window.location.protocol === 'file:') {
    container.innerHTML = `
      <div class="file-protocol-preview" style="position:relative; width:100%; height:100%; min-height:360px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0b1120 url('https://i.ytimg.com/vi/sANlUtV-1nI/maxresdefault.jpg') center/cover no-repeat; overflow:hidden;">
        <div style="position:absolute; inset:0; background:rgba(11, 17, 32, 0.82); backdrop-filter:blur(6px);"></div>
        <div style="position:relative; z-index:2; text-align:center; padding:24px; max-width:580px;">
          <a href="https://youtu.be/sANlUtV-1nI" target="_blank" rel="noopener noreferrer" style="width:62px; height:62px; background:#ef4444; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 0 28px rgba(239,68,68,0.7); margin-bottom:16px; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </a>
          <h3 style="font-size:17px; color:#fff; margin-bottom:8px; font-weight:700;">The Secret Tool to Finding Recruiter Emails on LinkedIn</h3>
          <p style="font-size:12.5px; color:#cbd5e1; margin-bottom:16px; line-height:1.6;">
            <strong style="color:#f87171;">⚠️ Why Error 153 happened:</strong> YouTube embeds do not allow local <code style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:3px;">file:///</code> protocol (null origin).<br>
            On your live site (<code style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:3px;">https://ashishingle29.github.io/quickmail/</code>) or via a local server, it streams and autoplays smoothly!
          </p>
          <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
            <a href="http://localhost:8080/index.html" target="_blank" style="background:#2563eb; color:#fff; padding:10px 18px; border-radius:6px; font-size:13px; font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 14px rgba(37,99,235,0.4);">
              🌐 Preview via Localhost Server (Autoplays)
            </a>
            <a href="https://youtu.be/sANlUtV-1nI" target="_blank" rel="noopener noreferrer" style="background:#ef4444; color:#fff; padding:10px 18px; border-radius:6px; font-size:13px; font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
              📺 Watch on YouTube ↗
            </a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const iframe = document.getElementById('youtubeHeroVideo');
  const soundBtn = document.getElementById('videoSoundToggle');
  const replayBtn = document.getElementById('videoReplayBtn');

  if (!iframe) return;

  let isMuted = true;

  function sendYTCommand(func, args = []) {
    try {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: func, args: args }),
          '*'
        );
      }
    } catch (e) {}
  }

  // Sound toggle (Unmute / Mute)
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      if (isMuted) {
        sendYTCommand('unMute');
        sendYTCommand('setVolume', [100]);
        isMuted = false;
        soundBtn.innerHTML = '<span>🔇</span><span>Mute</span>';
        soundBtn.classList.add('unmuted');
      } else {
        sendYTCommand('mute');
        isMuted = true;
        soundBtn.innerHTML = '<span>🔊</span><span>Unmute</span>';
        soundBtn.classList.remove('unmuted');
      }
    });
  }

  // Restart video from 0:00
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      sendYTCommand('seekTo', [0, true]);
      sendYTCommand('playVideo');
    });
  }

  // Interactive Chapter Jump Chips
  const chapterChips = document.querySelectorAll('.chapter-chip');
  chapterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const seekSec = parseInt(chip.getAttribute('data-seek'), 10) || 0;
      sendYTCommand('seekTo', [seekSec, true]);
      sendYTCommand('playVideo');

      chapterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Bulletproof auto-loop listener
  window.addEventListener('message', (event) => {
    try {
      let data = event.data;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      // YT.PlayerState.ENDED is 0
      if (data && (data.event === 'onStateChange' || data.info === 0)) {
        if (data.info === 0) {
          sendYTCommand('seekTo', [0, true]);
          sendYTCommand('playVideo');
          // Reset first chapter chip to active
          chapterChips.forEach((c, idx) => {
            if (idx === 0) c.classList.add('active');
            else c.classList.remove('active');
          });
        }
      }
    } catch (e) {}
  });
}
