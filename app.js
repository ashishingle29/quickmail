// QuickMail Finder — Product Website Interactive Logic (app.js)

document.addEventListener('DOMContentLoaded', () => {
  initNavbarScroll();
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
