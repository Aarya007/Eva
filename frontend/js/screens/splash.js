function $(id) {
  return document.getElementById(id);
}

/**
 * Runs splash animation; resolves when splash is hidden (same timing as before).
 * @returns {Promise<void>}
 */
export function runSplash() {
  return new Promise((resolve) => {
    const splash = $('splash');
    const pct = $('splash-pct');
    const bar = $('splash-bar');
    if (!splash) {
      resolve();
      return;
    }

    let value = 0;
    const tick = window.setInterval(() => {
      value = Math.min(100, value + Math.floor(Math.random() * 8) + 2);
      if (pct) pct.textContent = `${value}%`;
      if (bar) bar.style.width = `${value}%`;
      if (value >= 100) {
        window.clearInterval(tick);
        window.setTimeout(() => {
          splash.classList.add('is-leaving', 'fade-out');
          window.setTimeout(() => {
            splash.style.display = 'none';
            resolve();
          }, 800);
        }, 300);
      }
    }, 80);
  });
}
