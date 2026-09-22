/* ============================================
   DISTRICTS PAGE
   Lists every supported district from districts.json and shades
   a US county map by how many districts serve each county.
   ============================================ */

// Served from this site; the web and mobile apps fetch this same file.
const DISTRICTS_URL = 'districts.json';
// Pre-projected (Albers USA, 975x610) county + state shapes, so no projection library is needed.
const COUNTIES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-albers-10m.json';

const PLATFORM_NAMES = {
  hac: 'Home Access Center',
  powerschool: 'PowerSchool',
  'skyward-legacy': 'Skyward',
};

// loginType looks like "credentials/classlink:katyisd"; everything but plain credentials is SSO.
const SSO_NAMES = { classlink: 'ClassLink', microsoft: 'Microsoft', google: 'Google', clever: 'Clever' };

// Lower bound of each map shade; keep in sync with the --map-* colors in districts.css.
const MAP_BUCKETS = [1, 2, 3, 5, 10];

// A county entry is "Harris County", or "Philadelphia County, PA" when it's outside the district's state.
const STATE_ABBR = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

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

/** "Philadelphia County, PA" in a New Jersey district -> { county: "Philadelphia County", state: "Pennsylvania" } */
function parseCounty(entry, districtState) {
  const [county, abbr] = entry.split(/,\s*/);
  return { county, state: (abbr && STATE_ABBR[abbr]) || districtState };
}

/** Key shared by districts.json entries and the atlas: "texas|harris". */
function countyKey(county, state) {
  return `${state}|${county.replace(/\s+(County|Parish|Borough|city)$/i, '')}`.toLowerCase();
}

/* ---------- List ---------- */

function districtItem(d) {
  const platform = PLATFORM_NAMES[d.platform] || d.platform;
  const tags = [platform, ...ssoProviders(d.loginType)]
    .map((t, i) => `<span class="district-card__tag${i ? ' district-card__tag--sso' : ''}">${escapeHtml(t)}</span>`)
    .join('');
  const where = d.state
    ? `<span class="district-card__location">${escapeHtml(d.state)}${d.counties?.length ? ` · ${escapeHtml(d.counties.join(', '))}` : ''}</span>`
    : '';
  return `
    <li class="district-card">
      <span class="district-card__name">${escapeHtml(d.name)}</span>
      ${where}
      <div class="district-card__tags">${tags}</div>
      <a class="district-card__link" href="${escapeHtml(d.link)}" target="_blank" rel="noopener">
        ${escapeHtml(hostOf(d.link))}
      </a>
    </li>`;
}

function initDistrictList(districts) {
  const list = document.getElementById('district-list');
  const search = document.getElementById('district-search');
  const results = document.getElementById('district-results');

  // Render once, then filter by toggling visibility so typing stays fast.
  list.innerHTML = districts.map(districtItem).join('') +
    '<li class="districts-list__status" id="district-empty" hidden>No districts match your search.</li>';
  const items = [...list.querySelectorAll('.district-card')];
  const haystacks = districts.map((d) =>
    [d.name, PLATFORM_NAMES[d.platform], hostOf(d.link), d.state,
      ...(d.counties || []).flatMap((c) => [c, parseCounty(c, d.state).state])].join(' ').toLowerCase());
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

  // Lets the map narrow the list to one county.
  return (query) => {
    search.value = query;
    filter();
    search.closest('.districts-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

/* ---------- Map ---------- */

/** Planar (already projected) coordinates -> SVG path data. */
const line = (points) => 'M' + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L');

function polygonPath(geometry) {
  if (!geometry) return '';
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((rings) => rings.map((ring) => line(ring) + 'Z')).join('');
}

function bucketOf(count) {
  let b = 0;
  MAP_BUCKETS.forEach((min, i) => { if (count >= min) b = i + 1; });
  return b;
}

/** "texas|harris" -> { count, label } for every county some district serves. */
function tallyCounties(districts) {
  const tally = new Map();
  for (const d of districts) {
    for (const entry of d.counties || []) {
      const { county, state } = parseCounty(entry, d.state);
      const key = countyKey(county, state);
      const t = tally.get(key) || { count: 0, county, state };
      t.count++;
      tally.set(key, t);
    }
  }
  return tally;
}

function renderLegend() {
  const labels = MAP_BUCKETS.map((min, i) => {
    const next = MAP_BUCKETS[i + 1];
    return next === undefined ? `${min}+` : next - 1 === min ? `${min}` : `${min}–${next - 1}`;
  });
  document.getElementById('map-legend').innerHTML =
    '<span class="districts-map__legend-title">Districts per county</span>' +
    labels.map((l, i) => `<span class="districts-map__legend-item"><i class="districts-map__swatch" data-bucket="${i + 1}"></i>${l}</span>`).join('');
}

async function initMap(districts, focusList) {
  const section = document.querySelector('.districts-map');
  const svg = document.getElementById('districts-map');
  const tooltip = document.getElementById('map-tooltip');
  if (typeof topojson === 'undefined') return;

  const tally = tallyCounties(districts);

  let us;
  try {
    us = await (await fetch(COUNTIES_URL)).json();
  } catch (error) {
    console.error('Failed to load map:', error);
    return;
  }

  const stateNames = new Map(us.objects.states.geometries.map((g) => [g.id, g.properties.name]));
  const states = topojson.feature(us, us.objects.states).features;
  const stateBorders = topojson.mesh(us, us.objects.states, (a, b) => a !== b);

  // No location data yet (older districts.json): show plain gray states with the "coming soon" note.
  if (!tally.size) {
    svg.innerHTML =
      states.map((s) => `<path class="districts-map__state" d="${polygonPath(s.geometry)}" />`).join('') +
      `<path class="districts-map__borders" d="${stateBorders.coordinates.map(line).join('')}" />`;
    section.classList.add('districts-map--pending');
    return;
  }

  // Only served counties get their own path; everything else is the gray state fill underneath.
  const counties = topojson.feature(us, us.objects.counties).features
    .map((f) => ({ f, t: tally.get(countyKey(f.properties.name, stateNames.get(f.id.slice(0, 2)))) }))
    .filter(({ t }) => t);

  svg.innerHTML =
    states.map((s) => `<path class="districts-map__state" d="${polygonPath(s.geometry)}" />`).join('') +
    counties.map(({ f, t }, i) =>
      `<path class="districts-map__county" data-i="${i}" data-bucket="${bucketOf(t.count)}" d="${polygonPath(f.geometry)}" />`).join('') +
    `<path class="districts-map__borders" d="${stateBorders.coordinates.map(line).join('')}" />`;

  const servedStates = new Set([...tally.values()].map((t) => t.state));
  document.getElementById('map-summary').textContent =
    `${tally.size.toLocaleString()} counties across ${servedStates.size} states`;
  renderLegend();

  const countyAt = (target) => target.closest?.('.districts-map__county');

  svg.addEventListener('mousemove', (e) => {
    const el = countyAt(e.target);
    if (!el) {
      tooltip.hidden = true;
      return;
    }
    const { t } = counties[el.dataset.i];
    tooltip.innerHTML = `<strong>${escapeHtml(t.county)}, ${escapeHtml(t.state)}</strong>${t.count} district${t.count === 1 ? '' : 's'}`;
    const box = section.getBoundingClientRect();
    tooltip.style.left = `${e.clientX - box.left}px`;
    tooltip.style.top = `${e.clientY - box.top}px`;
    tooltip.hidden = false;
  });
  svg.addEventListener('mouseleave', () => { tooltip.hidden = true; });

  svg.addEventListener('click', (e) => {
    const el = countyAt(e.target);
    if (!el) return;
    const { t } = counties[el.dataset.i];
    focusList(`${t.county} ${t.state}`);
  });
}

async function initDistricts() {
  let districts;
  try {
    const resp = await fetch(DISTRICTS_URL);
    if (!resp.ok) throw new Error(`districts ${resp.status}`);
    districts = await resp.json();
  } catch (error) {
    console.error('Failed to load districts:', error);
    document.getElementById('district-list').innerHTML =
      '<li class="districts-list__status">Couldn\'t load the district list. Please try again later.</li>';
    return;
  }

  districts.sort((a, b) => a.name.localeCompare(b.name));
  const focusList = initDistrictList(districts);
  initMap(districts, focusList);
}

document.addEventListener('DOMContentLoaded', initDistricts);
