/* ============================================
   DISTRICTS PAGE
   Lists every supported district from the web app's districts.json and draws
   a (placeholder) US state map.
   ============================================ */

const DISTRICTS_URL = 'https://web.gradiate.app/districts.json';
// Pre-projected (Albers USA, 975x610) state shapes, so no projection library is needed.
const STATES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json';

const PLATFORM_NAMES = {
  hac: 'Home Access Center',
  powerschool: 'PowerSchool',
  'skyward-legacy': 'Skyward',
};

// loginType looks like "credentials/classlink:katyisd"; everything but plain credentials is SSO.
const SSO_NAMES = { classlink: 'ClassLink', microsoft: 'Microsoft', google: 'Google', clever: 'Clever' };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function hostOf(link) {
  try {
    return new URL(link).hostname;
  } catch {
    return link;
  }
}

function ssoProviders(loginType = '') {
  return loginType
    .split('/')
    .map((t) => t.split(':')[0])
    .filter((t) => t && t !== 'credentials')
    .map((t) => SSO_NAMES[t] || t);
}

function districtItem(d) {
  const platform = PLATFORM_NAMES[d.platform] || d.platform;
  const tags = [platform, ...ssoProviders(d.loginType)]
    .map((t, i) => `<span class="district-card__tag${i ? ' district-card__tag--sso' : ''}">${escapeHtml(t)}</span>`)
    .join('');
  return `
    <li class="district-card">
      <span class="district-card__name">${escapeHtml(d.name)}</span>
      <div class="district-card__tags">${tags}</div>
      <a class="district-card__link" href="${escapeHtml(d.link)}" target="_blank" rel="noopener">
        ${escapeHtml(hostOf(d.link))}
      </a>
    </li>`;
}

async function initDistrictList() {
  const list = document.getElementById('district-list');
  const search = document.getElementById('district-search');
  const results = document.getElementById('district-results');

  let districts;
  try {
    const resp = await fetch(DISTRICTS_URL);
    if (!resp.ok) throw new Error(`districts ${resp.status}`);
    districts = await resp.json();
  } catch (error) {
    console.error('Failed to load districts:', error);
    list.innerHTML = '<li class="districts-list__status">Couldn\'t load the district list. Please try again later.</li>';
    return;
  }

  districts.sort((a, b) => a.name.localeCompare(b.name));
  // Render once, then filter by toggling visibility so typing stays fast.
  list.innerHTML = districts.map(districtItem).join('') +
    '<li class="districts-list__status" id="district-empty" hidden>No districts match your search.</li>';
  const items = [...list.querySelectorAll('.district-card')];
  const haystacks = districts.map((d) => `${d.name} ${PLATFORM_NAMES[d.platform] || ''} ${hostOf(d.link)}`.toLowerCase());
  const empty = document.getElementById('district-empty');

  document.getElementById('district-count').textContent = districts.length.toLocaleString();

  const filter = () => {
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    items.forEach((item, i) => {
      const match = terms.every((t) => haystacks[i].includes(t));
      item.hidden = !match;
      if (match) shown++;
    });
    empty.hidden = shown > 0;
    results.textContent = terms.length
      ? `${shown.toLocaleString()} of ${districts.length.toLocaleString()}`
      : `${districts.length.toLocaleString()} districts`;
  };

  search.addEventListener('input', filter);
  filter();
}

/** Planar (already projected) coordinates -> SVG path data. */
const line = (points) => 'M' + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L');

function polygonPath(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((rings) => rings.map((ring) => line(ring) + 'Z')).join('');
}

async function initMap() {
  const svg = document.getElementById('districts-map');
  if (typeof topojson === 'undefined') return;

  try {
    const us = await (await fetch(STATES_URL)).json();
    const states = topojson.feature(us, us.objects.states).features;
    const borders = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
    svg.innerHTML =
      states.map((s) => `<path class="districts-map__state" d="${polygonPath(s.geometry)}"><title>${escapeHtml(s.properties.name)}</title></path>`).join('') +
      `<path class="districts-map__borders" d="${borders.coordinates.map(line).join('')}" />`;
  } catch (error) {
    console.error('Failed to load state map:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initDistrictList();
  initMap();
});
