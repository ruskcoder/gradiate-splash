/* ============================================
   USER STATS
   Fetches the API's GET /stats once on page load (total + per-school counts,
   no individual data).
   ============================================ */

// Local dev (localhost, 127.0.0.1, LAN IPs) talks to a locally running API.
const IS_LOCAL = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname) || location.protocol === 'file:';
const STATS_URL = IS_LOCAL
  ? `http://${location.hostname || 'localhost'}:3000/stats`
  : 'https://api.gradiate.app/stats';

const TOP_SCHOOLS = 10;
const COUNT_DURATION = 900;

/** "BRYANT HIGH SCHOOL" -> "Bryant High School", "STRATFORD H S" -> "Stratford HS". */
function prettySchool(name) {
  let s = name.trim().replace(/\bH\s?S\b/gi, 'HS');
  if (s === s.toUpperCase()) {
    s = s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bHs\b/g, 'HS');
  }
  return s;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function animateCounter(el, to) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = to.toLocaleString();
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / COUNT_DURATION, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(to * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function barRow(label, count, sum, max) {
  const pct = sum ? (count / sum) * 100 : 0;
  const width = max ? (count / max) * 100 : 0;
  return `
    <span class="stats-chart__label" title="${label}">${label}</span>
    <div class="stats-chart__track">
      <div class="stats-chart__bar" style="--w:${width}%"></div>
    </div>
    <span class="stats-chart__value">${count.toLocaleString()} <small>${pct.toFixed(1)}%</small></span>`;
}

function renderChart(chart, panel, schools) {
  const sum = schools.reduce((a, [, c]) => a + c, 0);
  const top = schools.slice(0, TOP_SCHOOLS);
  const rest = schools.slice(TOP_SCHOOLS);
  const restSum = rest.reduce((a, [, c]) => a + c, 0);
  const max = Math.max(top[0]?.[1] ?? 0, restSum);

  let html = top.map(([name, c]) => `<div class="stats-chart__row">${barRow(name, c, sum, max)}</div>`).join('');
  if (rest.length) {
    html += `
      <button type="button" class="stats-chart__row stats-chart__other-toggle" aria-expanded="false" aria-controls="school-other">
        ${barRow(`Other (${rest.length} schools)`, restSum, sum, max)}
      </button>`;
    panel.innerHTML = `
      <ul class="stats-chart__other-list">
        ${rest.map(([name, c]) => `<li><span>${name}</span><span>${c}</span></li>`).join('')}
      </ul>`;
  }
  chart.innerHTML = html;

  const toggle = chart.querySelector('.stats-chart__other-toggle');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('stats-chart__other-panel--open', open);
  });
}

async function initStats() {
  const section = document.getElementById('stats');
  if (!section) return;

  let stats;
  try {
    const resp = await fetch(STATS_URL);
    if (!resp.ok) throw new Error(`stats ${resp.status}`);
    stats = await resp.json();
  } catch (error) {
    console.error('Failed to load user stats:', error);
    section.hidden = true;
    return;
  }

  // Users without a recorded school still count toward the total, but get no bar.
  const schools = stats.schools
    .filter(([school, count]) => school.trim() && count > 0)
    .map(([school, count]) => [escapeHtml(prettySchool(school)), count]);

  renderChart(document.getElementById('school-chart'), document.getElementById('school-other'), schools);
  document.getElementById('school-count').textContent = schools.length;

  // Count up from 0 the first time the section scrolls into view.
  new IntersectionObserver((entries, obs) => {
    if (entries.some((e) => e.isIntersecting)) {
      section.classList.add('stats--visible');
      animateCounter(document.getElementById('user-count'), stats.total);
      obs.disconnect();
    }
  }, { threshold: 0.3 }).observe(section);
}

document.addEventListener('DOMContentLoaded', initStats);
