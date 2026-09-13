// welcome.js — Script for the Quick Start Guide welcome tab
document.addEventListener("DOMContentLoaded", () => {
  const testBtn = document.getElementById("welcome-test-draft-btn");
  if (testBtn) {
    testBtn.addEventListener("click", () => {
      alert("Great job! When browsing any real website, clicking this icon opens a pre-filled Gmail or Outlook draft in 1 second.");
    });
  }
});
