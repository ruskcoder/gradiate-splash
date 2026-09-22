/* ============================================
   DISTRICTS PAGE
   Lists every supported district from districts.json and shades a US county
   map by how many districts (or Gradiate users) are in each county.
   ============================================ */

// Served from this site; the web and mobile apps fetch this same file.
const DISTRICTS_URL = 'districts.json';
// Users per district, for the map's Users view.
const USERS_URL = 'district-users.json';
// Pre-projected (Albers USA, 975x610) county + state shapes, so no projection library is needed.
const COUNTIES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-albers-10m.json';

const PLATFORM_NAMES = {
  hac: 'Home Access Center',
  powerschool: 'PowerSchool',
  'skyward-legacy': 'Skyward',
};

// loginType looks like "credentials/classlink:katyisd"; everything but plain credentials is SSO.
const SSO_NAMES = { classlink: 'ClassLink', microsoft: 'Microsoft', google: 'Google', clever: 'Clever' };

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

  // Every state a district touches, including out-of-state counties ("Philadelphia County, PA").
  const statesOf = districts.map((d) =>
    new Set([d.state, ...(d.counties || []).map((c) => parseCounty(c, d.state).state)].filter(Boolean)));
  const stateFilter = document.getElementById('state-filter');
  let activeState = '';

  document.getElementById('district-count').textContent = districts.length.toLocaleString();

  const filter = () => {
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    items.forEach((item, i) => {
      const match = (!activeState || statesOf[i].has(activeState)) && terms.every((t) => haystacks[i].includes(t));
      item.hidden = !match;
      if (match) shown++;
    });
    empty.hidden = shown > 0;
    results.textContent = terms.length || activeState
      ? `${shown.toLocaleString()} of ${districts.length.toLocaleString()}`
      : `${districts.length.toLocaleString()} districts`;
  };

  const selectState = (state) => {
    activeState = state;
    stateFilter.querySelectorAll('.state-chip').forEach((chip) =>
      chip.setAttribute('aria-pressed', String(chip.dataset.state === state)));
    filter();
  };

  // One chip per state, busiest first, after an "All" chip.
  const stateCounts = new Map();
  statesOf.forEach((states) => states.forEach((s) => stateCounts.set(s, (stateCounts.get(s) || 0) + 1)));
  const chip = (state, label, count) =>
    `<button type="button" class="state-chip" data-state="${escapeHtml(state)}" aria-pressed="false">` +
    `${escapeHtml(label)} <span class="state-chip__count">${count.toLocaleString()}</span></button>`;
  stateFilter.innerHTML = stateCounts.size
    ? chip('', 'All', districts.length) +
      [...stateCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s, n]) => chip(s, s, n)).join('')
    : '';
  stateFilter.addEventListener('click', (e) => {
    const target = e.target.closest('.state-chip');
    // Clicking the active state again goes back to all.
    if (target) selectState(target.dataset.state === activeState ? '' : target.dataset.state);
  });

  search.addEventListener('input', filter);
  selectState('');

  // Lets the map narrow the list to one county.
  return (county, state) => {
    search.value = county;
    selectState(state);
    search.closest('.districts-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

/* ---------- Map ---------- */

// Each view shades counties by a different number. `buckets` are the lower bound of each
// shade; keep five so they line up with the --map-* colors in districts.css.
const MAP_VIEWS = {
  districts: {
    buckets: [1, 2, 3, 5, 10],
    legend: 'Districts per county',
    unit: ['district', 'districts'],
  },
  users: {
    buckets: [1, 3, 10, 100, 1000],
    legend: 'Users per county',
    unit: ['user', 'users'],
  },
};

/** Planar (already projected) coordinates -> SVG path data. */
const line = (points) => 'M' + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L');

function polygonPath(geometry) {
  if (!geometry) return '';
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((rings) => rings.map((ring) => line(ring) + 'Z')).join('');
}

function bucketOf(count, buckets) {
  let b = 0;
  buckets.forEach((min, i) => { if (count >= min) b = i + 1; });
  return b;
}

const plural = (n, [one, many]) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * "texas|harris" -> { count, county, state, districts } for every county with a nonzero value.
 * `weight(d)` is what each district adds to the counties it serves (1 per district, or its users).
 * A district spanning several counties counts fully in each of them.
 */
function tallyCounties(districts, weight) {
  const tally = new Map();
  for (const d of districts) {
    const w = weight(d);
    if (!w) continue;
    for (const entry of d.counties || []) {
      const { county, state } = parseCounty(entry, d.state);
      const key = countyKey(county, state);
      const t = tally.get(key) || { count: 0, county, state, districts: [] };
      t.count += w;
      t.districts.push(d.name);
      tally.set(key, t);
    }
  }
  return tally;
}

function renderLegend(view) {
  const { buckets, legend } = MAP_VIEWS[view];
  const labels = buckets.map((min, i) => {
    const next = buckets[i + 1];
    if (next === undefined) return `${min.toLocaleString()}+`;
    return next - 1 === min ? `${min}` : `${min.toLocaleString()}–${(next - 1).toLocaleString()}`;
  });
  document.getElementById('map-legend').innerHTML =
    `<span class="districts-map__legend-title">${legend}</span>` +
    labels.map((l, i) => `<span class="districts-map__legend-item"><i class="districts-map__swatch" data-bucket="${i + 1}"></i>${l}</span>`).join('');
}

async function initMap(districts, userData, focusList) {
  const section = document.querySelector('.districts-map');
  const svg = document.getElementById('districts-map');
  const tooltip = document.getElementById('map-tooltip');
  const summary = document.getElementById('map-summary');
  const tabs = [...section.querySelectorAll('.map-tab')];
  if (typeof topojson === 'undefined') return;

  const usersByDistrict = new Map((userData?.districts || []).map((u) => [u.district, u.users]));
  // A district can be listed twice (e.g. separate HAC and ClassLink entries); count it once.
  const unique = [...new Map(districts.map((d) => [d.name, d])).values()];
  const tallies = {
    districts: tallyCounties(unique, () => 1),
    users: tallyCounties(unique, (d) => usersByDistrict.get(d.name) || 0),
  };

  let us;
  try {
    us = await (await fetch(COUNTIES_URL)).json();
  } catch (error) {
    console.error('Failed to load map:', error);
    return;
  }

  const stateNames = new Map(us.objects.states.geometries.map((g) => [g.id, g.properties.name]));
  const statePaths = topojson.feature(us, us.objects.states).features
    .map((s) => `<path class="districts-map__state" d="${polygonPath(s.geometry)}" />`).join('');
  const borders = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
  const bordersPath = `<path class="districts-map__borders" d="${borders.coordinates.map(line).join('')}" />`;
  const allCounties = topojson.feature(us, us.objects.counties).features
    .map((f) => ({ f, key: countyKey(f.properties.name, stateNames.get(f.id.slice(0, 2))) }));

  // No location data yet (older districts.json): show plain gray states with the "coming soon" note.
  if (!tallies.districts.size) {
    svg.innerHTML = statePaths + bordersPath;
    section.classList.add('districts-map--pending');
    return;
  }

  if (!usersByDistrict.size) tabs.find((t) => t.dataset.view === 'users')?.remove();

  let view = 'districts';
  let shown = []; // [{ f, t }] for the counties drawn in the current view

  const render = (next) => {
    view = next;
    const { buckets } = MAP_VIEWS[view];
    const tally = tallies[view];
    shown = allCounties.map(({ f, key }) => ({ f, t: tally.get(key) })).filter(({ t }) => t);

    // Only counties with a value get their own path; everything else is the gray state fill underneath.
    svg.innerHTML = statePaths +
      shown.map(({ f, t }, i) =>
        `<path class="districts-map__county" data-i="${i}" data-bucket="${bucketOf(t.count, buckets)}" d="${polygonPath(f.geometry)}" />`).join('') +
      bordersPath;

    if (view === 'districts') {
      const states = new Set([...tally.values()].map((t) => t.state));
      summary.textContent = `${plural(tally.size, ['county', 'counties'])} across ${states.size} states`;
    } else {
      const mapped = [...usersByDistrict.values()].reduce((a, n) => a + n, 0);
      const total = mapped + (userData.unmapped?.users || 0);
      summary.textContent = `${plural(total, ['user', 'users'])} across ${plural(usersByDistrict.size, ['district', 'districts'])}`;
    }
    renderLegend(view);
    tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.view === view)));
    tooltip.hidden = true;
  };

  tabs.forEach((t) => t.addEventListener('click', () => render(t.dataset.view)));
  render('districts');

  const countyAt = (target) => target.closest?.('.districts-map__county');

  svg.addEventListener('mousemove', (e) => {
    const el = countyAt(e.target);
    if (!el) {
      tooltip.hidden = true;
      return;
    }
    const { t } = shown[el.dataset.i];
    const detail = view === 'users' ? `<span>${escapeHtml(t.districts.join(', '))}</span>` : '';
    tooltip.innerHTML = `<strong>${escapeHtml(t.county)}, ${escapeHtml(t.state)}</strong>` +
      plural(t.count, MAP_VIEWS[view].unit) + detail;
    const box = section.getBoundingClientRect();
    tooltip.style.left = `${e.clientX - box.left}px`;
    tooltip.style.top = `${e.clientY - box.top}px`;
    tooltip.hidden = false;
  });
  svg.addEventListener('mouseleave', () => { tooltip.hidden = true; });

  svg.addEventListener('click', (e) => {
    const el = countyAt(e.target);
    if (!el) return;
    const { t } = shown[el.dataset.i];
    focusList(t.county, t.state);
  });
}

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${url} ${resp.status}`);
  return resp.json();
}

async function initDistricts() {
  let districts;
  try {
    districts = await fetchJson(DISTRICTS_URL);
  } catch (error) {
    console.error('Failed to load districts:', error);
    document.getElementById('district-list').innerHTML =
      '<li class="districts-list__status">Couldn\'t load the district list. Please try again later.</li>';
    return;
  }

  // Optional: without it the map just has no Users view.
  const userData = await fetchJson(USERS_URL).catch((error) => {
    console.error('Failed to load user counts:', error);
    return null;
  });

  districts.sort((a, b) => a.name.localeCompare(b.name));
  const focusList = initDistrictList(districts);
  initMap(districts, userData, focusList);
}

document.addEventListener('DOMContentLoaded', initDistricts);
