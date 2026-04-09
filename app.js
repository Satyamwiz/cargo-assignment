/**
 * ══════════════════════════════════════════════════════════════════
 *  AeroCargoIQ — Expert System Core Logic (app.js)
 *
 *  AI ALGORITHMS USED:
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │  1. GREEDY ALGORITHM                                         │
 *  │     Used for: Container Type Selection                       │
 *  │     How: At each question, greedily accumulate scores.       │
 *  │     Final pick = argmax(scores) — the locally & globally     │
 *  │     optimal choice given all weighted evidence.              │
 *  │                                                              │
 *  │  2. A* SEARCH ALGORITHM                                      │
 *  │     Used for: Optimal Flight Route Planning                  │
 *  │     How: Finds the lowest-cost path through an airport graph │
 *  │     using f(n) = g(n) + h(n)                                 │
 *  │       g(n) = actual distance travelled so far                │
 *  │       h(n) = straight-line heuristic to destination          │
 *  └──────────────────────────────────────────────────────────────┘
 *
 *  Both algorithms run automatically and their traces are shown
 *  in the Verdict Report panel.
 * ══════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════
//  AIRPORT GRAPH  (used by A* Search)
//  Each node is an airport; edges are bidirectional with distance (km)
// ═════════════════════════════════════════════════════════════════
const AIRPORTS = {
  BOM: { name: 'Mumbai', city: 'Mumbai', country: 'India', lat: 19.08, lon: 72.87 },
  DEL: { name: 'Delhi IGI', city: 'Delhi', country: 'India', lat: 28.55, lon: 77.10 },
  BLR: { name: 'Bangalore', city: 'Bangalore', country: 'India', lat: 13.19, lon: 77.70 },
  HYD: { name: 'Hyderabad', city: 'Hyderabad', country: 'India', lat: 17.23, lon: 78.42 },
  MAA: { name: 'Chennai', city: 'Chennai', country: 'India', lat: 12.98, lon: 80.16 },
  CCU: { name: 'Kolkata', city: 'Kolkata', country: 'India', lat: 22.65, lon: 88.44 },
  JAI: { name: 'Jaipur', city: 'Jaipur', country: 'India', lat: 26.82, lon: 75.81 },
  AMD: { name: 'Ahmedabad', city: 'Ahmedabad', country: 'India', lat: 23.07, lon: 72.63 },
  DXB: { name: 'Dubai Intl', city: 'Dubai', country: 'UAE', lat: 25.25, lon: 55.36 },
  SIN: { name: 'Changi', city: 'Singapore', country: 'Singapore', lat: 1.35, lon: 103.98 },
  LHR: { name: 'Heathrow', city: 'London', country: 'UK', lat: 51.47, lon: -0.46 },
  DOH: { name: 'Hamad Intl', city: 'Doha', country: 'Qatar', lat: 25.27, lon: 51.60 },
};

// Adjacency list: [neighbor, distance_km, cost_score]
// cost_score = distance * a fuel factor (used as edge weight in A*)
const GRAPH = {
  BOM: [['DEL', 1150], ['BLR', 980], ['HYD', 710], ['AMD', 520], ['DXB', 1950], ['DOH', 2200]],
  DEL: [['BOM', 1150], ['CCU', 1300], ['JAI', 260], ['AMD', 870], ['DXB', 2200], ['SIN', 4150]],
  BLR: [['BOM', 980], ['HYD', 570], ['MAA', 330], ['SIN', 3400], ['CCU', 1870]],
  HYD: [['BOM', 710], ['BLR', 570], ['MAA', 620], ['CCU', 1490], ['DEL', 1480]],
  MAA: [['BLR', 330], ['HYD', 620], ['CCU', 1660], ['SIN', 2880]],
  CCU: [['DEL', 1300], ['BOM', 1900], ['HYD', 1490], ['MAA', 1660], ['SIN', 2900]],
  JAI: [['DEL', 260], ['AMD', 610], ['BOM', 1310]],
  AMD: [['BOM', 520], ['DEL', 870], ['JAI', 610], ['DXB', 1750]],
  DXB: [['BOM', 1950], ['DEL', 2200], ['AMD', 1750], ['DOH', 320], ['LHR', 5500]],
  DOH: [['DXB', 320], ['BOM', 2200], ['DEL', 2360], ['LHR', 5200]],
  SIN: [['BLR', 3400], ['MAA', 2880], ['CCU', 2900], ['DEL', 4150], ['LHR', 10800]],
  LHR: [['DXB', 5500], ['DOH', 5200], ['SIN', 10800]],
};

// ─────────────────────────────────────────────────────────────────
//  A* HEURISTIC — straight-line (Haversine) distance between nodes
//  h(n) = estimated remaining cost to goal (admissible: never overestimates)
// ─────────────────────────────────────────────────────────────────
function haversine(a, b) {
  const R = 6371;
  const d1 = (b.lat - a.lat) * Math.PI / 180;
  const d2 = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(d1 / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(d2 / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * A* SEARCH
 * ─────────────────────────────────────────────────────────────────
 * Finds the optimal (minimum distance) path from `startCode` to
 * `goalCode` through the GRAPH airport network.
 *
 * f(n) = g(n) + h(n)
 *   g(n) = cumulative actual distance from start to node n
 *   h(n) = haversine heuristic — straight-line km to goal (admissible)
 *
 * Returns: { path: [codes], totalDist, steps: [...exploration log] }
 * ─────────────────────────────────────────────────────────────────
 */
function aStarSearch(startCode, goalCode) {
  const steps = [];   // exploration trace for display

  // Initialise open set as a min-heap (simulated with array + sort)
  // Each entry: { code, g, f, parent }
  const open = new Map();   // code → node
  const closed = new Set();
  const parent = {};
  const gScore = {};

  gScore[startCode] = 0;
  open.set(startCode, {
    code: startCode,
    g: 0,
    f: haversine(AIRPORTS[startCode], AIRPORTS[goalCode]),
  });

  while (open.size > 0) {
    // Pick node with lowest f(n) from open set  (greedy pick on f)
    const current = [...open.values()].sort((a, b) => a.f - b.f)[0];
    open.delete(current.code);

    steps.push({
      node: current.code,
      g: Math.round(current.g),
      h: Math.round(current.f - current.g),
      f: Math.round(current.f),
    });

    if (current.code === goalCode) {
      // Reconstruct path
      const path = [];
      let node = goalCode;
      while (node) { path.unshift(node); node = parent[node]; }
      return { path, totalDist: Math.round(current.g), steps };
    }

    closed.add(current.code);

    for (const [neighborCode, dist] of (GRAPH[current.code] || [])) {
      if (closed.has(neighborCode)) continue;

      const tentativeG = current.g + dist;
      if (tentativeG < (gScore[neighborCode] ?? Infinity)) {
        gScore[neighborCode] = tentativeG;
        parent[neighborCode] = current.code;
        const h = haversine(AIRPORTS[neighborCode], AIRPORTS[goalCode]);
        open.set(neighborCode, { code: neighborCode, g: tentativeG, f: tentativeG + h });
      }
    }
  }

  return { path: [startCode, goalCode], totalDist: null, steps }; // no path found
}

// ─────────────────────────────────────────────────────────────────
//  SELECT AIRPORT PAIR based on distance entered by user
//  Maps entered km range → realistic source / destination
// ─────────────────────────────────────────────────────────────────
function selectAirportPair(distKm) {
  if (distKm <= 350) return { src: 'BLR', dst: 'MAA' };  // Bangalore → Chennai
  else if (distKm <= 700) return { src: 'BOM', dst: 'HYD' };  // Mumbai → Hyderabad
  else if (distKm <= 950) return { src: 'BOM', dst: 'BLR' };  // Mumbai → Bangalore
  else if (distKm <= 1200) return { src: 'BOM', dst: 'DEL' };  // Mumbai → Delhi
  else if (distKm <= 1500) return { src: 'DEL', dst: 'CCU' };  // Delhi → Kolkata
  else if (distKm <= 2100) return { src: 'BOM', dst: 'DXB' };  // Mumbai → Dubai
  else if (distKm <= 2500) return { src: 'DEL', dst: 'DXB' };  // Delhi → Dubai
  else if (distKm <= 3600) return { src: 'BLR', dst: 'SIN' };  // Bangalore → Singapore
  else if (distKm <= 5000) return { src: 'DEL', dst: 'SIN' };  // Delhi → Singapore
  else return { src: 'BOM', dst: 'LHR' };  // Mumbai → London
}

// ═════════════════════════════════════════════════════════════════
//  GREEDY ALGORITHM — Container Selection
// ═════════════════════════════════════════════════════════════════
/**
 * GREEDY BEST-FIRST SCORING
 * At each rule-firing step, we greedily add weighted evidence to the
 * container with the highest local relevance.
 * Final decision: argmax(score) — the container with maximum
 * accumulated score wins unconditionally (classic greedy choice).
 *
 * This is a greedy algorithm because:
 *  - It never backtracks
 *  - Each decision is locally optimal (most-evidenced container)
 *  - It makes the final pick from the current best state
 */
const GREEDY_TRACE = [];   // stores step-by-step scoring trace

function applyScore(id, value) {
  const s = STATE.score;
  const v = String(value).toLowerCase();

  const before = { ...s };  // snapshot before

  switch (id) {
    case 'fragile':
      if (v === 'yes') s.glass += 2; else s.metal += 1; break;
    case 'heavy':
      if (v === 'yes') s.metal += 2; else s.glass += 1; break;
    case 'perishable':
      if (v === 'yes') s.refrigerated += 3; else s.standard += 1; break;
    case 'distance':
      if (Number(v) > 2000) s.refrigerated += 1; else s.standard += 1; break;
    case 'weather_sensitive':
      if (v === 'yes') s.refrigerated += 2; else s.metal += 1; break;
  }

  const after = { ...s };
  const changed = Object.keys(after).filter(k => after[k] !== before[k]);
  if (changed.length) {
    GREEDY_TRACE.push({
      rule: id,
      value: v,
      updated: changed.map(c => `${c}: ${before[c]} → ${after[c]}`),
      scores: { ...after },
      best: Object.entries(after).sort((a, b) => b[1] - a[1])[0][0],
    });
  }
}

// ═════════════════════════════════════════════════════════════════
//  EXPERT SYSTEM STATE
// ═════════════════════════════════════════════════════════════════
const STATE = {
  score: { glass: 0, metal: 0, refrigerated: 0, standard: 0 },
  answers: {},
  routeStars: 0,          // derived star rating shown in chat bubble
  step: 0,
  totalSteps: 10,         // was 8; now 10 with 3 routing sub-steps (origin, dest, journey)
  complete: false,
  sessionId: generateId(),
  startTime: new Date(),
};

// ═════════════════════════════════════════════════════════════════
//  QUESTION DEFINITIONS (8 steps)
// ═════════════════════════════════════════════════════════════════
const STEPS = [
  {
    id: 'cargo_type',
    bot: 'Welcome to <strong>AeroCargoIQ</strong>. I\'m your AI cargo advisor.<br><br>Let\'s begin — what type of cargo are you transporting?',
    type: 'options',
    choices: [
      { icon: '🍎', label: 'Food', value: 'food' },
      { icon: '💻', label: 'Electronics', value: 'electronics' },
      { icon: '⚙️', label: 'Machinery', value: 'machinery' },
      { icon: '⚗️', label: 'Chemicals', value: 'chemicals' },
    ],
  },
  {
    id: 'fragile',
    bot: '<strong>Question 1 of 9 — Fragility</strong><br><br>Is your cargo fragile? This includes glassware, precision instruments, or sensitive electronics.',
    type: 'yesno',
    choices: [
      { icon: '⚠️', label: 'Yes — it is fragile', value: 'yes' },
      { icon: '💪', label: 'No — it is robust', value: 'no' },
    ],
  },
  {
    id: 'heavy',
    bot: '<strong>Question 2 of 9 — Weight</strong><br><br>Is the cargo heavy? For example, industrial machinery, engine parts, or dense materials.',
    type: 'yesno',
    choices: [
      { icon: '⚖️', label: 'Yes — it is heavy', value: 'yes' },
      { icon: '🪶', label: 'No — it is lightweight', value: 'no' },
    ],
  },
  {
    id: 'perishable',
    bot: '<strong>Question 3 of 9 — Perishability</strong><br><br>Is the cargo perishable? This includes food, dairy, fresh produce, biologics, or pharmaceuticals.',
    type: 'yesno',
    choices: [
      { icon: '🌡️', label: 'Yes — it will perish', value: 'yes' },
      { icon: '🏺', label: 'No — it is non-perishable', value: 'no' },
    ],
  },

  // ── ROUTING: 3 conversational sub-steps (replace raw km input) ─────────
  {
    id: 'route_origin',
    bot: '<strong>Question 4 of 9 — Departure Region</strong><br><br>Where is your shipment <em>departing from</em>?',
    type: 'options',
    choices: [
      { icon: '🏙️', label: 'Major domestic city', value: 'domestic_major' },
      { icon: '🌆', label: 'Smaller domestic city', value: 'domestic_minor' },
      { icon: '🌍', label: 'A nearby international hub', value: 'intl_near' },
      { icon: '🌐', label: 'A far international hub', value: 'intl_far' },
    ],
  },
  {
    id: 'route_dest',
    bot: '<strong>Question 5 of 9 — Destination</strong><br><br>Where is the cargo <em>headed</em>?',
    type: 'options',
    choices: [
      { icon: '🏠', label: 'Same country', value: 'same_country' },
      { icon: '🤝', label: 'Neighbouring country or region', value: 'neighbour' },
      { icon: '🌏', label: 'Different continent', value: 'continental' },
      { icon: '🌎', label: 'Intercontinental / transoceanic', value: 'intercontinental' },
    ],
  },
  {
    id: 'route_journey',
    bot: '<strong>Question 6 of 9 — Journey Length</strong><br><br>How would you describe the overall length of this flight?',
    type: 'options',
    choices: [
      { icon: '🛵', label: 'Short hop (under 1 hour)', value: 'short' },
      { icon: '🚗', label: 'Regional (1–3 hours)', value: 'regional' },
      { icon: '✈️', label: 'Cross-country (3–6 hours)', value: 'crosscountry' },
      { icon: '🌙', label: 'Long-haul (6–12 hours)', value: 'longhaul' },
      { icon: '🌏', label: 'Ultra long-haul (12 h+)', value: 'ultralonghaul' },
    ],
  },
  // ─────────────────────────────────────────────────────────────────────────

  {
    id: 'weather_sensitive',
    bot: '<strong>Question 7 of 9 — Temperature Sensitivity</strong><br><br>Is the cargo sensitive to temperature fluctuations or weather conditions during transit?',
    type: 'yesno',
    choices: [
      { icon: '❄️', label: 'Yes — temperature sensitive', value: 'yes' },
      { icon: '☀️', label: 'No — not sensitive', value: 'no' },
    ],
  },
  {
    id: 'urgency',
    bot: '<strong>Question 8 of 9 — Delivery Urgency</strong><br><br>Does this shipment require urgent or priority delivery? e.g. same-day, express, or time-critical cargo.',
    type: 'yesno',
    choices: [
      { icon: '🚀', label: 'Yes — urgent delivery', value: 'yes' },
      { icon: '🗓', label: 'No — standard timeline', value: 'no' },
    ],
  },
  {
    id: 'traffic',
    bot: '<strong>Question 9 of 9 — Airport Congestion</strong><br><br>Is the destination airport typically experiencing high traffic or congestion during standard hours?',
    type: 'yesno',
    choices: [
      { icon: '🔴', label: 'Yes — high congestion', value: 'yes' },
      { icon: '🟢', label: 'No — low to moderate', value: 'no' },
    ],
  },
];

// ═════════════════════════════════════════════════════════════════
//  ROUTING DISTANCE DERIVATION
//  Maps user's 3 conversational routing answers → a realistic km value
//  and a 1-5 star complexity rating (shown visually in chat)
// ═════════════════════════════════════════════════════════════════
function deriveRouteDistance(origin, dest, journey) {
  // Star lookup per journey type (1=closest, 5=furthest)
  const journeyStars = {
    short: 1, regional: 2, crosscountry: 3, longhaul: 4, ultralonghaul: 5,
  };

  // Base km per star (weighted by dest context)
  const baseKm = {
    short:         { same_country: 280,  neighbour: 400,  continental: 600,   intercontinental: 900  },
    regional:      { same_country: 900,  neighbour: 1400, continental: 2000,  intercontinental: 2800 },
    crosscountry:  { same_country: 1600, neighbour: 2400, continental: 3500,  intercontinental: 4800 },
    longhaul:      { same_country: 2800, neighbour: 3800, continental: 5500,  intercontinental: 7200 },
    ultralonghaul: { same_country: 4500, neighbour: 6000, continental: 8500,  intercontinental: 11000 },
  };

  const km = (baseKm[journey] || baseKm['regional'])[dest] || 1500;
  const stars = journeyStars[journey] || 2;
  return { km, stars };
}

// ═════════════════════════════════════════════════════════════════
//  DOM REFERENCES
// ═════════════════════════════════════════════════════════════════
const chatScroll = document.getElementById('chat-scroll');
const chatFooter = document.getElementById('chat-footer');
const progFill = document.getElementById('prog-fill');
const progLabel = document.getElementById('prog-label');
const progPct = document.getElementById('prog-pct');
const progSteps = document.getElementById('progress-steps');
const agentStatus = document.getElementById('agent-status');
const restartBtn = document.getElementById('restart-btn');

// ═════════════════════════════════════════════════════════════════
//  BOOT
// ═════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  buildStepDots();
  setTimeout(() => askStep(0), 600);
});

// ═════════════════════════════════════════════════════════════════
//  NAVIGATION
// ═════════════════════════════════════════════════════════════════
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
}

function scrollToAdvisor() {
  switchPanel('advisor');
  document.getElementById('chatbox-anchor').scrollIntoView({ behavior: 'smooth' });
}

// ═════════════════════════════════════════════════════════════════
//  PROGRESS DOTS
// ═════════════════════════════════════════════════════════════════
function buildStepDots() {
  progSteps.innerHTML = '';
  for (let i = 0; i < STATE.totalSteps; i++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    dot.id = `dot-${i}`;
    progSteps.appendChild(dot);
  }
}

function updateProgress(completedStep) {
  const pct = Math.round((completedStep / STATE.totalSteps) * 100);
  progFill.style.width = pct + '%';
  progLabel.textContent = `Step ${completedStep} of ${STATE.totalSteps}`;
  progPct.textContent = pct + '%';
  for (let i = 0; i < STATE.totalSteps; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    dot.classList.remove('done', 'active');
    if (i < completedStep) dot.classList.add('done');
    else if (i === completedStep) dot.classList.add('active');
  }
}

// ═════════════════════════════════════════════════════════════════
//  CORE FLOW
// ═════════════════════════════════════════════════════════════════
function askStep(index) {
  if (index >= STEPS.length) { evaluate(); return; }
  STATE.step = index;
  updateProgress(index);
  agentStatus.textContent = index === 0 ? 'Starting assessment…' : `Question ${index} of ${STEPS.length - 1}`;

  showTyping(() => {
    addBotMessage(STEPS[index].bot);
    renderInputFor(STEPS[index]);
  });
}

function handleAnswer(stepId, rawValue) {
  STATE.answers[stepId] = rawValue;

  // ── After the last routing sub-step, derive distance and show star bubble ──
  if (stepId === 'route_journey') {
    const { km, stars } = deriveRouteDistance(
      STATE.answers.route_origin,
      STATE.answers.route_dest,
      rawValue
    );
    STATE.answers.distance = km;   // used by scoring + A* + report
    STATE.routeStars = stars;
    applyScore('distance', km);    // scoring step
    addRouteStarMessage(stars, km); // visual star bubble in chat
  } else {
    applyScore(stepId, rawValue);
    addUserMessage(formatDisplay(stepId, rawValue));
  }

  chatFooter.innerHTML = '';
  setTimeout(() => askStep(STATE.step + 1), 550);
}

// ═════════════════════════════════════════════════════════════════
//  EVALUATE — Expert Reasoning Engine
// ═════════════════════════════════════════════════════════════════
function evaluate() {
  STATE.complete = true;
  updateProgress(STATE.totalSteps);
  agentStatus.textContent = 'Assessment complete ✓';
  restartBtn.style.display = 'flex';

  const s = STATE.score;
  const ans = STATE.answers;

  // ── GREEDY: argmax(scores) ──────────────────────────────────
  const sorted = Object.entries(s).sort((a, b) => b[1] - a[1]);
  const best = sorted[0][0];
  const maxScore = sorted[0][1] || 1;

  // ── RULE-BASED: Aircraft selection ──────────────────────────
  const dist = Number(ans.distance);
  let aircraft, aircraftIcon, aircraftRange;
  if (dist > 3000) {
    aircraft = 'Boeing 777F'; aircraftIcon = '✈️'; aircraftRange = 'Long-Haul (> 3,000 km)';
  } else if (dist > 1000) {
    aircraft = 'Boeing 737F'; aircraftIcon = '🛫'; aircraftRange = 'Medium-Haul (1,000–3,000 km)';
  } else {
    aircraft = 'ATR 72-600F / Cessna Caravan'; aircraftIcon = '🛩'; aircraftRange = 'Short-Haul (< 1,000 km)';
  }

  // ── A* SEARCH: Optimal airport route ────────────────────────
  const pair = selectAirportPair(dist);
  const astarResult = aStarSearch(pair.src, pair.dst);

  // ── Scheduling rules ────────────────────────────────────────
  const isHighPriority = ans.perishable === 'yes' || ans.urgency === 'yes';
  const timing = ans.traffic === 'yes' ? 'Night slot — avoids peak congestion' : 'Daytime slot — standard hours';
  let frequency;
  if (ans.urgency === 'yes') frequency = 'Daily flights';
  else if (ans.perishable === 'yes') frequency = 'Daily flights (fresh cargo)';
  else frequency = '2–3 flights per week';
  const buffer = ans.weather_sensitive === 'yes' ? 'Add buffer time for weather safety' : 'No extra buffer required';
  let loading;
  if (ans.fragile === 'yes') loading = 'Handle with care — load last · unload first';
  else if (ans.heavy === 'yes') loading = 'Load first (bottom placement for stability)';
  else loading = 'Standard loading sequence';

  const containerMeta = {
    glass: { emoji: '🔷', type: 'GLASS CONTAINER', color: '#3b82f6', bg: 'rgba(59,130,246,.1)', border: 'rgba(59,130,246,.3)', desc: 'Shock-proof containers with padded interiors and anti-vibration mounts. Ideal for high-value fragile goods.' },
    metal: { emoji: '🔶', type: 'METAL CONTAINER', color: '#f59e0b', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.3)', desc: 'Reinforced steel containers for heavy industrial loads. Rated for high payloads with structural integrity.' },
    refrigerated: { emoji: '🔵', type: 'REFRIGERATED CONTAINER', color: '#06b6d4', bg: 'rgba(6,182,212,.1)', border: 'rgba(6,182,212,.3)', desc: 'Temperature-controlled units (−25 °C to +25 °C) with real-time telemetry for perishables and pharma.' },
    standard: { emoji: '🟢', type: 'STANDARD CONTAINER', color: '#10b981', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.3)', desc: 'General-purpose containers for non-perishable, non-fragile goods. Most cost-effective option.' },
  }[best];

  // ── Render chat confirmation + redirect to report ────────────
  showTyping(() => {
    addBotMessage('✅ <strong>Assessment complete.</strong> Your full cargo recommendation report has been generated. Open the <strong>Verdict Report</strong> panel to view your results.');
    chatFooter.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn-primary" style="font-size:13px;padding:11px 22px" onclick="switchPanel('report')">View Verdict Report →</button>
        <button class="btn-restart" style="display:flex!important" onclick="restartSystem()">↺ New Assessment</button>
      </div>`;
    renderReport({ best, containerMeta, aircraft, aircraftIcon, aircraftRange, dist, isHighPriority, timing, frequency, buffer, loading, maxScore, sorted, astarResult, pair });
    renderSessionLog();
  });
}

// ═════════════════════════════════════════════════════════════════
//  RENDER VERDICT REPORT — Professional multi-section output
// ═════════════════════════════════════════════════════════════════
function renderReport({ best, containerMeta, aircraft, aircraftIcon, aircraftRange, dist, isHighPriority, timing, frequency, buffer, loading, maxScore, sorted, astarResult, pair }) {
  const s = STATE.score;
  const ans = STATE.answers;
  const now = new Date();

  // ── A* path display — uses ap-node / ap-start / ap-end CSS classes ──
  const pathDisplay = astarResult.path.map((code, i) => {
    const isFirst = i === 0;
    const isLast = i === astarResult.path.length - 1;
    const cls = isFirst ? 'ap-node ap-start' : isLast ? 'ap-node ap-end' : 'ap-node';
    const arrow = i < astarResult.path.length - 1 ? '<span class="ap-arrow">→</span>' : '';
    return `<span class="${cls}">${code}<span class="ap-city">${AIRPORTS[code].city}</span></span>${arrow}`;
  }).join('');

  // ── A* exploration steps table ────────────────────────────
  const stepsRows = astarResult.steps.map(st => `
    <tr>
      <td>${st.node} <span style="color:#64748b;font-size:11px">(${AIRPORTS[st.node]?.city || ''})</span></td>
      <td>${st.g.toLocaleString()} km</td>
      <td>${st.h.toLocaleString()} km</td>
      <td style="color:#4f8cff;font-weight:600">${st.f.toLocaleString()} km</td>
    </tr>`).join('');

  // ── Greedy trace table ────────────────────────────────────
  const greedyRows = GREEDY_TRACE.map(t => `
    <tr>
      <td style="color:#94a3b8">${t.rule}</td>
      <td>${t.value === 'yes' ? '<span class="yes-tag">Yes</span>' : t.value === 'no' ? '<span class="no-tag">No</span>' : `<strong style="color:#fff">${t.value} km</strong>`}</td>
      <td style="font-size:12px;color:#e2e8f0">${t.updated.join(', ')}</td>
      <td style="font-weight:700;color:#a78bfa;text-transform:capitalize">${t.best}</td>
    </tr>`).join('');

  const reportHTML = `
<div class="report-page">

  <!-- ① Algorithm Badges — clearly labels both AI algorithms used -->
  <div class="algo-pills">
    <span class="algo-pill greedy">🧮 Algorithm 1: Weighted Scoring — Container Classification</span>
    <span class="algo-pill astar">🗺 Algorithm 2: A* Search  f(n) = g(n) + h(n) — Route Optimisation</span>
  </div>

  <!-- ② Report Header -->
  <div class="report-header-card">
    <div class="report-header-left">
      <h3>Cargo Expert Assessment Report</h3>
      <p>Generated by AeroCargoIQ — Intelligent Cargo Classification &amp; Route Planning</p>
      <p class="report-id">Session ID: <strong>${STATE.sessionId}</strong></p>
    </div>
    <div class="report-timestamp">
      <div class="report-stamp-val">${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      <div>${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
      <div style="margin-top:8px;font-size:11px">Cargo: <strong style="color:#e2e8f0">${cap(ans.cargo_type)}</strong></div>
      <div style="font-size:11px">Distance: <strong style="color:#e2e8f0">${dist.toLocaleString()} km</strong></div>
    </div>
  </div>

  <!-- ② Container Hero (Scoring Result) -->
  <div class="container-hero" style="background:${containerMeta.bg};border-color:${containerMeta.border}">
    <div class="container-hero-icon">${containerMeta.emoji}</div>
    <div>
      <div class="container-hero-type" style="color:${containerMeta.color}">
        📦 AI RECOMMENDATION — BEST-FIT CONTAINER TYPE
      </div>
      <div class="container-hero-name">${containerMeta.type}</div>
      <div class="container-hero-desc">${containerMeta.desc}</div>
    </div>
    <div class="score-chips">
      ${['glass', 'metal', 'refrigerated', 'standard'].map(ct => `
        <div class="score-chip">
          <span style="width:84px;text-align:right;font-weight:${ct === best ? '700' : '400'};color:${ct === best ? '#e2e8f0' : ''}">${cap(ct)}</span>
          <div class="bar">
            <div class="bar-fill" style="width:${Math.round((s[ct] / (maxScore || 1)) * 100)}%;background:${ct === best ? containerMeta.color : 'rgba(255,255,255,.12)'}"></div>
          </div>
          <span class="sc-val">${s[ct]}</span>
        </div>`).join('')}
    </div>
  </div>

  <!-- ③ A* Route Result -->
  <div class="report-section" style="border-color:rgba(167,139,250,.3)">
    <div class="rs-header" style="background:rgba(167,139,250,.08)">
      <span class="rs-icon">🗺</span>
      <span class="rs-title" style="color:#a78bfa">A* SEARCH ALGORITHM — OPTIMAL FLIGHT ROUTE</span>
    </div>
    <div style="padding:20px 22px">

      <div style="font-size:12px;color:#64748b;margin-bottom:16px">
        <strong style="color:#a78bfa">A* formula:</strong> &nbsp; f(n) = g(n) + h(n) &nbsp;·&nbsp;
        <em>g(n)</em> = actual distance from origin &nbsp;·&nbsp;
        <em>h(n)</em> = Haversine heuristic to destination
      </div>

      <!-- Path visual -->
      <div class="astar-path">${pathDisplay}</div>
      <div style="font-size:13px;color:#94a3b8;margin:14px 0 4px">
        <strong style="color:#fff">Optimal Route Distance (A*):</strong>
        ${astarResult.totalDist ? astarResult.totalDist.toLocaleString() + ' km' : 'Direct route'}
        &nbsp; · &nbsp; ${astarResult.path.length - 1} leg${astarResult.path.length > 2 ? 's' : ''}
      </div>
      <div style="font-size:12px;color:#64748b;margin-bottom:18px">
        ${AIRPORTS[pair.src].name}, ${AIRPORTS[pair.src].country}
        &nbsp;→&nbsp;
        ${AIRPORTS[pair.dst].name}, ${AIRPORTS[pair.dst].country}
      </div>

      <!-- A* Exploration Trace -->
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#64748b;margin-bottom:10px">A* NODE EXPLORATION TRACE (min-f open set)</div>
      <div class="log-table-wrap">
        <table>
          <thead><tr><th>NODE EXPLORED</th><th>g(n) — actual</th><th>h(n) — heuristic</th><th>f(n) = g+h</th></tr></thead>
          <tbody>${stepsRows}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ④ Recommendation Grid -->
  <div class="report-sections">

    <div class="report-section">
      <div class="rs-header"><span class="rs-icon">✈️</span><span class="rs-title">AIRCRAFT &amp; ROUTE</span></div>
      <div class="rs-body">
        <div class="detail-row"><span class="dk">Recommended Aircraft</span><span class="dv">${aircraftIcon} ${aircraft}</span></div>
        <div class="detail-row"><span class="dk">Route Class</span><span class="dv">${aircraftRange}</span></div>
        <div class="detail-row"><span class="dk">Input Distance</span><span class="dv">${dist.toLocaleString()} km</span></div>
        <div class="detail-row"><span class="dk">A* Route Distance</span><span class="dv">${astarResult.totalDist ? astarResult.totalDist.toLocaleString() + ' km' : '—'}</span></div>
        <div class="detail-row"><span class="dk">Route Stops</span><span class="dv">${astarResult.path.map(c => `${c}(${AIRPORTS[c].city})`).join(' → ')}</span></div>
      </div>
    </div>

    <div class="report-section">
      <div class="rs-header"><span class="rs-icon">🎯</span><span class="rs-title">DELIVERY PRIORITY</span></div>
      <div class="rs-body">
        <div class="detail-row"><span class="dk">Priority Level</span><span class="dv">
          ${isHighPriority ? '<span class="priority-high">🔴 High Priority</span>' : '<span class="priority-normal">🟢 Normal Priority</span>'}
        </span></div>
        <div class="detail-row"><span class="dk">Reason</span><span class="dv">${isHighPriority ? (STATE.answers.perishable === 'yes' ? 'Perishable cargo' : 'Urgent delivery') : 'Standard shipment'}</span></div>
        <div class="detail-row"><span class="dk">Perishable</span><span class="dv">${yesNoTag(STATE.answers.perishable)}</span></div>
        <div class="detail-row"><span class="dk">Urgency Requested</span><span class="dv">${yesNoTag(STATE.answers.urgency)}</span></div>
      </div>
    </div>

    <div class="report-section">
      <div class="rs-header"><span class="rs-icon">🗓</span><span class="rs-title">FLIGHT SCHEDULING</span></div>
      <div class="rs-body">
        <div class="detail-row"><span class="dk">Flight Timing</span><span class="dv">${timing}</span></div>
        <div class="detail-row"><span class="dk">Flight Frequency</span><span class="dv">${frequency}</span></div>
        <div class="detail-row"><span class="dk">Airport Traffic</span><span class="dv">${STATE.answers.traffic === 'yes' ? '🔴 High congestion' : '🟢 Low / Moderate'}</span></div>
        <div class="detail-row"><span class="dk">Buffer Time</span><span class="dv">${buffer}</span></div>
      </div>
    </div>

    <div class="report-section">
      <div class="rs-header"><span class="rs-icon">📦</span><span class="rs-title">CARGO HANDLING</span></div>
      <div class="rs-body">
        <div class="detail-row"><span class="dk">Loading Strategy</span><span class="dv">${loading}</span></div>
        <div class="detail-row"><span class="dk">Fragile Cargo</span><span class="dv">${yesNoTag(STATE.answers.fragile)}</span></div>
        <div class="detail-row"><span class="dk">Heavy Cargo</span><span class="dv">${yesNoTag(STATE.answers.heavy)}</span></div>
        <div class="detail-row"><span class="dk">Weather Sensitive</span><span class="dv">${yesNoTag(STATE.answers.weather_sensitive)}</span></div>
      </div>
    </div>

  </div>

  <!-- ⑤ Scoring Trace Table -->
  <div class="report-section" style="border-color:rgba(79,140,255,.25)">
    <div class="rs-header" style="background:rgba(79,140,255,.07)">
      <span class="rs-icon">🧮</span>
      <span class="rs-title" style="color:#4f8cff">CONTAINER SCORING — STEP-BY-STEP EVIDENCE TRACE</span>
    </div>
    <div style="padding:16px 20px">
      <div style="font-size:12px;color:#64748b;margin-bottom:14px">
        For each question answered, the system accumulates weighted evidence points per container category.
        Final recommendation = container with the <strong style="color:#4f8cff">highest total score</strong>.
      </div>
      <div class="log-table-wrap">
        <table>
          <thead><tr><th>RULE / QUESTION</th><th>ANSWER</th><th>SCORE UPDATE</th><th>LEADING CONTAINER</th></tr></thead>
          <tbody>${greedyRows || '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:20px">No scoring steps fired</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ⑥ Algorithm Summary Note -->
  <div class="report-note">
    <strong>📐 Algorithms Used:</strong><br><br>
    <strong style="color:#4f8cff">① Weighted Evidence Scoring (Container Selection)</strong> — 
    A rule-based weighted scoring system fires on each user answer and accumulates evidence points for each container category (Glass, Metal, Refrigerated, Standard). The final recommendation is the container with the highest cumulative score — optimal because each scoring rule is independent.<br><br>
    <strong style="color:#a78bfa">② A* Search Algorithm (Route Optimisation)</strong> — 
    A* finds the minimum-cost flight path through the airport network graph (12 nodes, real distances).
    <em>f(n) = g(n) + h(n)</em> where g(n) is the actual distance travelled and h(n) is the Haversine great-circle distance heuristic to the destination (admissible — never overestimates). A* is guaranteed to find the shortest path when the heuristic is admissible.
  </div>

</div>`;

  document.getElementById('report-placeholder').style.display = 'none';
  const rc = document.getElementById('report-content');
  rc.style.display = 'block';
  rc.innerHTML = reportHTML;
  document.getElementById('btn-print').style.display = 'inline-flex';
}

// ═════════════════════════════════════════════════════════════════
//  SESSION LOG
// ═════════════════════════════════════════════════════════════════
function renderSessionLog() {
  const ans = STATE.answers;
  const originLabel = { domestic_major:'Major domestic city', domestic_minor:'Smaller domestic city', intl_near:'Nearby international hub', intl_far:'Far international hub' }[ans.route_origin] || ans.route_origin;
  const destLabel   = { same_country:'Same country', neighbour:'Neighbouring country/region', continental:'Different continent', intercontinental:'Intercontinental' }[ans.route_dest] || ans.route_dest;
  const journeyLabel= { short:'Short hop', regional:'Regional', crosscountry:'Cross-country', longhaul:'Long-haul', ultralonghaul:'Ultra long-haul' }[ans.route_journey] || ans.route_journey;
  const rows = [
    ['Cargo Type',           cap(ans.cargo_type || '—'),                 '🚚'],
    ['Fragile?',             yesNoTag(ans.fragile),                       '⚠️'],
    ['Heavy?',               yesNoTag(ans.heavy),                         '⚖️'],
    ['Perishable?',          yesNoTag(ans.perishable),                    '🌡️'],
    ['Departure Region',     originLabel,                                 '🛫'],
    ['Destination',          destLabel,                                   '🛬'],
    ['Journey Type',         journeyLabel,                                '🗺'],
    ['Route Distance (est)', `${Number(ans.distance).toLocaleString()} km`,'📍'],
    ['Route Complexity',     '★'.repeat(STATE.routeStars) + '☆'.repeat(5 - STATE.routeStars), '⭐'],
    ['Weather Sensitive?',   yesNoTag(ans.weather_sensitive),             '🌤'],
    ['Urgent Delivery?',     yesNoTag(ans.urgency),                       '🚀'],
    ['High Airport Traffic?',yesNoTag(ans.traffic),                       '✈️'],
    ['Score — Glass',        STATE.score.glass,                           '🔷'],
    ['Score — Metal',        STATE.score.metal,                           '🔶'],
    ['Score — Refrigerated', STATE.score.refrigerated,                    '❄️'],
    ['Score — Standard',     STATE.score.standard,                        '📦'],
  ];
  document.getElementById('log-content').innerHTML = `
    <div class="log-table-wrap">
      <table>
        <thead><tr><th></th><th>PARAMETER</th><th>RECORDED VALUE</th></tr></thead>
        <tbody>${rows.map(([k, v, i]) => `<tr><td style="width:36px;text-align:center;font-size:15px">${i}</td><td style="color:#94a3b8">${k}</td><td>${v}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
}

// ═════════════════════════════════════════════════════════════════
//  RESTART
// ═════════════════════════════════════════════════════════════════
function restartSystem() {
  STATE.score = { glass: 0, metal: 0, refrigerated: 0, standard: 0 };
  STATE.answers = {};
  STATE.routeStars = 0;
  STATE.step = 0;
  STATE.complete = false;
  STATE.sessionId = generateId();
  STATE.startTime = new Date();
  GREEDY_TRACE.length = 0;

  chatScroll.innerHTML = '';
  chatFooter.innerHTML = '';
  restartBtn.style.display = 'none';
  agentStatus.textContent = 'Initialising…';

  document.getElementById('report-placeholder').style.display = '';
  document.getElementById('report-content').style.display = 'none';
  document.getElementById('report-content').innerHTML = '';
  document.getElementById('btn-print').style.display = 'none';
  document.getElementById('log-content').innerHTML = `<div class="empty-card"><div class="empty-icon">🗒</div><h3>No Session Data</h3><p>Complete an assessment to see your answers.</p><button class="btn-primary" onclick="switchPanel('advisor')">Start Assessment →</button></div>`;

  updateProgress(0);
  switchPanel('advisor');
  setTimeout(() => askStep(0), 400);
}

// ═════════════════════════════════════════════════════════════════
//  INPUT RENDERERS
// ═════════════════════════════════════════════════════════════════
function renderInputFor(step) {
  chatFooter.innerHTML = '';
  if (step.type === 'options' || step.type === 'yesno') {
    chatFooter.appendChild(el('div', 'footer-label', 'SELECT AN OPTION:'));
    const grid = el('div', 'opts-grid');
    step.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.innerHTML = `<span class="opt-icon">${choice.icon}</span>${choice.label}`;
      btn.onclick = () => {
        grid.querySelectorAll('.opt-btn').forEach(b => { b.classList.remove('selected'); b.disabled = true; });
        btn.classList.add('selected');
        setTimeout(() => handleAnswer(step.id, choice.value), 380);
      };
      grid.appendChild(btn);
    });
    chatFooter.appendChild(grid);
  } else if (step.type === 'number') {
    chatFooter.appendChild(el('div', 'footer-label', `ENTER VALUE IN ${step.unit.toUpperCase()}:`));
    const row = el('div', 'num-row');
    const input = document.createElement('input');
    input.type = 'number'; input.min = '1'; input.className = 'num-input';
    input.placeholder = step.placeholder; input.id = 'num-inp';
    const send = document.createElement('button');
    send.className = 'btn-send'; send.textContent = '→';
    send.onclick = () => submitNumber(step.id, input);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submitNumber(step.id, input); });
    row.appendChild(input); row.appendChild(send);
    chatFooter.appendChild(row);
    setTimeout(() => input.focus(), 80);
  }
}

function submitNumber(stepId, input) {
  const val = parseInt(input.value, 10);
  if (!val || val < 1) {
    input.classList.add('error');
    input.placeholder = '⚠ Enter a valid positive number';
    input.value = '';
    setTimeout(() => { input.classList.remove('error'); input.placeholder = STEPS.find(s => s.id === stepId).placeholder; }, 1500);
    return;
  }
  handleAnswer(stepId, val);
}

// ═════════════════════════════════════════════════════════════════
//  CHAT MESSAGE BUILDERS
// ═════════════════════════════════════════════════════════════════
function showTyping(cb) {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  row.innerHTML = `<div class="msg-ava">🤖</div><div class="msg-content"><div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div></div>`;
  chatScroll.appendChild(row); scrollChat();
  setTimeout(() => { chatScroll.removeChild(row); cb(); }, 850);
}

function addBotMessage(html) {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  row.innerHTML = `<div class="msg-ava">🤖</div><div class="msg-content"><div class="msg-bubble">${html}</div><div class="msg-time">${time()}</div></div>`;
  chatScroll.appendChild(row); scrollChat();
}

function addUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `<div class="msg-ava">👤</div><div class="msg-content"><div class="msg-bubble">${text}</div><div class="msg-time">${time()}</div></div>`;
  chatScroll.appendChild(row); scrollChat();
}

// ─────────────────────────────────────────────────────────────────
//  STAR BUBBLE — shown after the 3rd routing answer
//  Displays a visual star rating + estimated distance in the user bubble
// ─────────────────────────────────────────────────────────────────
function addRouteStarMessage(stars, km) {
  const filledStars = '★'.repeat(stars);
  const emptyStars  = '☆'.repeat(5 - stars);
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="msg-ava">👤</div>
    <div class="msg-content">
      <div class="msg-bubble route-star-bubble">
        <div class="route-star-label">Route Complexity</div>
        <div class="route-stars">${filledStars}<span class="route-stars-empty">${emptyStars}</span></div>
        <div class="route-km-est">~${Number(km).toLocaleString()} km estimated</div>
      </div>
      <div class="msg-time">${time()}</div>
    </div>`;
  chatScroll.appendChild(row); scrollChat();
}

function scrollChat() { chatScroll.scrollTop = chatScroll.scrollHeight; }

// ═════════════════════════════════════════════════════════════════
//  UTILITIES
// ═════════════════════════════════════════════════════════════════
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function time() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function yesNoTag(v) { return v === 'yes' ? '<span class="yes-tag">✓ Yes</span>' : '<span class="no-tag">✗ No</span>'; }
function formatDisplay(id, v) {
  if (id === 'cargo_type') return `📦 ${cap(v)}`;
  if (['route_origin','route_dest','route_journey'].includes(id)) return `🗺 ${cap(v.replace(/_/g,' '))}`;
  return v === 'yes' ? '✅ Yes' : '❌ No';
}
function el(tag, cls, text = '') {
  const e = document.createElement(tag);
  e.className = cls; e.textContent = text; return e;
}
function generateId() {
  return 'ACQ-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
}