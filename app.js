/**
 * ══════════════════════════════════════════════════════════════
 *  AeroCargoIQ — Expert System Core Logic (app.js)
 *
 *  Architecture mirrors the Python CargoExpertSystem class:
 *    - score{}        : container scoring dictionary
 *    - answers{}      : user answer store
 *    - applyScore()   : equivalent to ask_questions() scoring
 *    - evaluate()     : expert scoring + classification logic
 *    - renderReport() : professional result output (like result())
 *
 *  UI Flow:
 *    Boot → askStep(0) → collect answers → evaluate() →
 *    renderReport() → update Session Log & Verdict Report panels
 * ══════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
const STATE = {
  score:     { glass: 0, metal: 0, refrigerated: 0, standard: 0 },
  answers:   {},
  step:      0,
  totalSteps: 8,
  complete:  false,
  sessionId: generateId(),
  startTime: new Date(),
};

// ─────────────────────────────────────────────────────────────
// QUESTION DEFINITIONS
// Each step maps to a question the Python system asks
// ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'cargo_type',
    bot: 'Welcome to <strong>AeroCargoIQ</strong>. I\'m your AI cargo advisor.<br><br>Let\'s begin — what type of cargo are you transporting?',
    type: 'options',
    choices: [
      { icon: '🍎', label: 'Food',        value: 'food'        },
      { icon: '💻', label: 'Electronics', value: 'electronics' },
      { icon: '⚙️', label: 'Machinery',   value: 'machinery'   },
      { icon: '⚗️', label: 'Chemicals',   value: 'chemicals'   },
    ],
  },
  {
    id: 'fragile',
    bot: '<strong>Question 1 of 7 — Fragility</strong><br><br>Is your cargo fragile? This includes delicate items such as glassware, precision instruments, or sensitive electronics.',
    type: 'yesno',
    choices: [
      { icon: '⚠️', label: 'Yes — it is fragile',      value: 'yes' },
      { icon: '💪', label: 'No — it is robust',         value: 'no'  },
    ],
  },
  {
    id: 'heavy',
    bot: '<strong>Question 2 of 7 — Weight</strong><br><br>Would you classify the cargo as <em>heavy</em>? For example, industrial machinery, engine parts, or dense materials.',
    type: 'yesno',
    choices: [
      { icon: '⚖️', label: 'Yes — it is heavy',         value: 'yes' },
      { icon: '🪶', label: 'No — it is lightweight',    value: 'no'  },
    ],
  },
  {
    id: 'perishable',
    bot: '<strong>Question 3 of 7 — Perishability</strong><br><br>Is the cargo perishable? This includes food items, dairy products, fresh produce, biologics, or pharmaceuticals.',
    type: 'yesno',
    choices: [
      { icon: '🌡️', label: 'Yes — it will perish',      value: 'yes' },
      { icon: '🏺', label: 'No — it is non-perishable', value: 'no'  },
    ],
  },
  {
    id: 'distance',
    bot: '<strong>Question 4 of 7 — Route Distance</strong><br><br>What is the total flight distance for this shipment, in <strong>kilometres</strong>?<br><small style="color:#64748b">Examples: Mumbai → Delhi ≈ 1,150 km · Mumbai → London ≈ 7,200 km</small>',
    type: 'number',
    placeholder: 'Enter distance (e.g. 2500)',
    unit: 'km',
  },
  {
    id: 'weather_sensitive',
    bot: '<strong>Question 5 of 7 — Temperature Sensitivity</strong><br><br>Is the cargo sensitive to temperature fluctuations or adverse weather conditions during transit?',
    type: 'yesno',
    choices: [
      { icon: '❄️', label: 'Yes — temperature sensitive', value: 'yes' },
      { icon: '☀️', label: 'No — not sensitive',           value: 'no'  },
    ],
  },
  {
    id: 'urgency',
    bot: '<strong>Question 6 of 7 — Delivery Urgency</strong><br><br>Does this shipment require <em>urgent or priority delivery</em>? For example, same-day, express, or time-critical cargo.',
    type: 'yesno',
    choices: [
      { icon: '🚀', label: 'Yes — urgent delivery',      value: 'yes' },
      { icon: '🗓', label: 'No — standard timeline',     value: 'no'  },
    ],
  },
  {
    id: 'traffic',
    bot: '<strong>Question 7 of 7 — Airport Congestion</strong><br><br>Is the destination airport typically experiencing <em>high traffic or congestion</em> during standard operating hours?',
    type: 'yesno',
    choices: [
      { icon: '🔴', label: 'Yes — high congestion',      value: 'yes' },
      { icon: '🟢', label: 'No — low to moderate',       value: 'no'  },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────────────────────
const chatScroll  = document.getElementById('chat-scroll');
const chatFooter  = document.getElementById('chat-footer');
const progFill    = document.getElementById('prog-fill');
const progLabel   = document.getElementById('prog-label');
const progPct     = document.getElementById('prog-pct');
const progSteps   = document.getElementById('progress-steps');
const agentStatus = document.getElementById('agent-status');
const restartBtn  = document.getElementById('restart-btn');

// ─────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  buildStepDots();
  setTimeout(() => askStep(0), 600);
});

// ─────────────────────────────────────────────────────────────
// NAVIGATION (panel switching)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// PROGRESS DOTS
// ─────────────────────────────────────────────────────────────
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
  progPct.textContent   = pct + '%';

  // colour dots
  for (let i = 0; i < STATE.totalSteps; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    dot.classList.remove('done', 'active');
    if (i < completedStep) dot.classList.add('done');
    else if (i === completedStep) dot.classList.add('active');
  }
}

// ─────────────────────────────────────────────────────────────
// CORE CHAT FLOW
// ─────────────────────────────────────────────────────────────
function askStep(index) {
  if (index >= STEPS.length) {
    evaluate();
    return;
  }
  STATE.step = index;
  updateProgress(index);
  agentStatus.textContent = index === 0 ? 'Starting assessment…' : `Question ${index} of ${STEPS.length - 1}`;

  showTyping(() => {
    addBotMessage(STEPS[index].bot);
    renderInputFor(STEPS[index]);
  });
}

function handleAnswer(stepId, rawValue) {
  // record answer
  STATE.answers[stepId] = rawValue;
  applyScore(stepId, rawValue);

  // show user bubble
  addUserMessage(formatDisplay(stepId, rawValue));
  chatFooter.innerHTML = '';

  // advance
  setTimeout(() => askStep(STATE.step + 1), 550);
}

// ─────────────────────────────────────────────────────────────
// SCORING — mirrors Python ask_questions() score updates
// ─────────────────────────────────────────────────────────────
function applyScore(id, value) {
  const s = STATE.score;
  const v = String(value).toLowerCase();

  switch (id) {
    case 'fragile':
      if (v === 'yes') s.glass       += 2; else s.metal        += 1; break;
    case 'heavy':
      if (v === 'yes') s.metal       += 2; else s.glass        += 1; break;
    case 'perishable':
      if (v === 'yes') s.refrigerated += 3; else s.standard    += 1; break;
    case 'distance':
      if (Number(v) > 2000) s.refrigerated += 1; else s.standard += 1; break;
    case 'weather_sensitive':
      if (v === 'yes') s.refrigerated += 2; else s.metal       += 1; break;
  }
}

// ─────────────────────────────────────────────────────────────
// EVALUATE — mirrors Python evaluate() + result()
// ─────────────────────────────────────────────────────────────
function evaluate() {
  STATE.complete = true;
  updateProgress(STATE.totalSteps);
  agentStatus.textContent = 'Assessment complete ✓';
  restartBtn.style.display = 'flex';

  const s   = STATE.score;
  const ans = STATE.answers;

  // ① Best container
  const best = Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];

  // ② Aircraft selection
  const dist = Number(ans.distance);
  let aircraft, aircraftIcon;
  if      (dist > 3000) { aircraft = 'Boeing 777F';                 aircraftIcon = '✈️'; }
  else if (dist > 1000) { aircraft = 'Boeing 737F';                 aircraftIcon = '🛫'; }
  else                  { aircraft = 'ATR 72-600F / Cessna Caravan'; aircraftIcon = '🛩'; }

  // ③ Priority
  const isHighPriority = ans.perishable === 'yes' || ans.urgency === 'yes';
  const priority       = isHighPriority ? 'High Priority' : 'Normal Priority';

  // ④ Scheduling
  const timing    = ans.traffic          === 'yes' ? 'Night slot — avoids peak congestion'  : 'Daytime slot — standard hours';
  let   frequency;
  if      (ans.urgency    === 'yes') frequency = 'Daily flights';
  else if (ans.perishable === 'yes') frequency = 'Daily flights (fresh cargo)';
  else                               frequency = '2–3 flights per week';

  // ⑤ Buffer & loading
  const buffer  = ans.weather_sensitive === 'yes' ? 'Add buffer time for weather safety' : 'No extra buffer required';
  let   loading;
  if      (ans.fragile === 'yes') loading = 'Handle with care — load last · unload first';
  else if (ans.heavy   === 'yes') loading = 'Load first (bottom placement for stability)';
  else                            loading  = 'Standard loading sequence';

  // Container metadata
  const containerMeta = {
    glass:        { emoji:'🔷', type:'GLASS CONTAINER',        color:'#3b82f6', bg:'rgba(59,130,246,.1)',  border:'rgba(59,130,246,.3)',  desc:'Shock-proof containers with padded interiors, anti-vibration mounts, and optional humidity control. Ideal for high-value fragile goods.' },
    metal:        { emoji:'🔶', type:'METAL CONTAINER',        color:'#f59e0b', bg:'rgba(245,158,11,.1)',  border:'rgba(245,158,11,.3)',  desc:'Reinforced steel containers built for heavy industrial loads. Rated for high payloads with structural integrity under aircraft movement.' },
    refrigerated: { emoji:'🔵', type:'REFRIGERATED CONTAINER', color:'#06b6d4', bg:'rgba(6,182,212,.1)',  border:'rgba(6,182,212,.3)',   desc:'Temperature-controlled units maintaining −25 °C to +25 °C with real-time telemetry. Essential for perishables, pharma, and biologics.' },
    standard:     { emoji:'🟢', type:'STANDARD CONTAINER',     color:'#10b981', bg:'rgba(16,185,129,.1)', border:'rgba(16,185,129,.3)',  desc:'General-purpose containers suitable for all non-perishable, non-fragile goods. Most cost-effective and widely available option.' },
  }[best];

  const maxScore   = Math.max(...Object.values(s)) || 1;

  // ─── Chat confirmation message ───
  showTyping(() => {
    addBotMessage('✅ <strong>Assessment complete.</strong> Your expert cargo report has been generated. Open the <strong>Verdict Report</strong> panel for the full recommendation.');
    chatFooter.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn-primary" style="font-size:13px;padding:11px 22px" onclick="switchPanel('report')">View Verdict Report →</button>
        <button class="btn-restart" style="display:flex!important" onclick="restartSystem()">↺ New Assessment</button>
      </div>`;

    // ─── Build Verdict Report panel ───
    renderReport({ best, containerMeta, aircraft, aircraftIcon, dist, priority, isHighPriority, timing, frequency, buffer, loading, maxScore });

    // ─── Build Session Log ───
    renderSessionLog();
  });
}

// ─────────────────────────────────────────────────────────────
// RENDER VERDICT REPORT
// This is the professional end-result — equivalent to result()
// ─────────────────────────────────────────────────────────────
function renderReport({ best, containerMeta, aircraft, aircraftIcon, dist, priority, isHighPriority, timing, frequency, buffer, loading, maxScore }) {
  const s   = STATE.score;
  const ans = STATE.answers;
  const now = new Date();

  const reportHTML = `
<div class="report-page">

  <!-- ① Report Header Card -->
  <div class="report-header-card">
    <div class="report-header-left">
      <h3>Cargo Expert Assessment Report</h3>
      <p>Automated analysis generated by AeroCargoIQ intelligent scoring engine.</p>
      <p class="report-id">Session ID: <strong>${STATE.sessionId}</strong></p>
    </div>
    <div class="report-timestamp">
      <div class="report-stamp-val">${now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div>
      <div>${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
      <div style="margin-top:8px;font-size:11px">Cargo Type: <strong style="color:#e2e8f0">${cap(ans.cargo_type)}</strong></div>
      <div style="font-size:11px">Route Distance: <strong style="color:#e2e8f0">${dist.toLocaleString()} km</strong></div>
    </div>
  </div>

  <!-- ② Container Recommendation Hero -->
  <div class="container-hero" style="background:${containerMeta.bg};border-color:${containerMeta.border}">
    <div class="container-hero-icon">${containerMeta.emoji}</div>
    <div>
      <div class="container-hero-type" style="color:${containerMeta.color}">RECOMMENDED CONTAINER TYPE</div>
      <div class="container-hero-name">${containerMeta.type}</div>
      <div class="container-hero-desc">${containerMeta.desc}</div>
    </div>
    <div class="score-chips">
      ${['glass','metal','refrigerated','standard'].map(ct => `
        <div class="score-chip">
          <span style="width:80px;text-align:right;font-weight:${ct===best?'700':'400'};color:${ct===best?'#e2e8f0':''}">
            ${cap(ct)}
          </span>
          <div class="bar">
            <div class="bar-fill" style="width:${Math.round((s[ct]/maxScore)*100)}%;background:${ct===best?containerMeta.color:'rgba(255,255,255,.15)'}"></div>
          </div>
          <span class="sc-val">${s[ct]}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- ③ Sections Grid -->
  <div class="report-sections">

    <!-- Aircraft & Route -->
    <div class="report-section">
      <div class="rs-header">
        <span class="rs-icon">✈️</span>
        <span class="rs-title">AIRCRAFT &amp; ROUTE RECOMMENDATION</span>
      </div>
      <div class="rs-body">
        <div class="detail-row">
          <span class="dk">Recommended Aircraft</span>
          <span class="dv">${aircraftIcon} ${aircraft}</span>
        </div>
        <div class="detail-row">
          <span class="dk">Route Class</span>
          <span class="dv">${dist > 3000 ? 'Long-Haul (Intercontinental)' : dist > 1000 ? 'Medium-Haul (Regional)' : 'Short-Haul (Domestic)'}</span>
        </div>
        <div class="detail-row">
          <span class="dk">Flight Distance</span>
          <span class="dv">${dist.toLocaleString()} km</span>
        </div>
        <div class="detail-row">
          <span class="dk">Cargo Type</span>
          <span class="dv">${cap(ans.cargo_type)}</span>
        </div>
      </div>
    </div>

    <!-- Delivery Priority -->
    <div class="report-section">
      <div class="rs-header">
        <span class="rs-icon">🎯</span>
        <span class="rs-title">DELIVERY PRIORITY &amp; CLASSIFICATION</span>
      </div>
      <div class="rs-body">
        <div class="detail-row">
          <span class="dk">Priority Level</span>
          <span class="dv">
            ${isHighPriority
              ? '<span class="priority-high">🔴 High Priority</span>'
              : '<span class="priority-normal">🟢 Normal Priority</span>'}
          </span>
        </div>
        <div class="detail-row">
          <span class="dk">Reason for Priority</span>
          <span class="dv">${isHighPriority ? (ans.perishable==='yes' ? 'Perishable cargo' : 'Urgent delivery') : 'Standard shipment'}</span>
        </div>
        <div class="detail-row">
          <span class="dk">Perishable</span>
          <span class="dv">${yesNoTag(ans.perishable)}</span>
        </div>
        <div class="detail-row">
          <span class="dk">Urgency Requested</span>
          <span class="dv">${yesNoTag(ans.urgency)}</span>
        </div>
      </div>
    </div>

    <!-- Scheduling -->
    <div class="report-section">
      <div class="rs-header">
        <span class="rs-icon">🗓</span>
        <span class="rs-title">FLIGHT SCHEDULING PLAN</span>
      </div>
      <div class="rs-body">
        <div class="detail-row">
          <span class="dk">Flight Timing</span>
          <span class="dv">${timing}</span>
        </div>
        <div class="detail-row">
          <span class="dk">Flight Frequency</span>
          <span class="dv">${frequency}</span>
        </div>
        <div class="detail-row">
          <span class="dk">Airport Traffic</span>
          <span class="dv">${ans.traffic === 'yes' ? '🔴 High congestion' : '🟢 Low / Moderate'}</span>
        </div>
        <div class="detail-row">
          <span class="dk">Buffer Time</span>
          <span class="dv">${buffer}</span>
        </div>
      </div>
    </div>

    <!-- Cargo Handling -->
    <div class="report-section">
      <div class="rs-header">
        <span class="rs-icon">📦</span>
        <span class="rs-title">CARGO HANDLING &amp; LOADING</span>
      </div>
      <div class="rs-body">
        <div class="detail-row">
          <span class="dk">Loading Strategy</span>
          <span class="dv">${loading}</span>
        </div>
        <div class="detail-row">
          <span class="dk">Fragile Cargo</span>
          <span class="dv">${yesNoTag(ans.fragile)}</span>
        </div>
        <div class="detail-row">
          <span class="dk">Heavy Cargo</span>
          <span class="dv">${yesNoTag(ans.heavy)}</span>
        </div>
        <div class="detail-row">
          <span class="dk">Weather Sensitive</span>
          <span class="dv">${yesNoTag(ans.weather_sensitive)}</span>
        </div>
      </div>
    </div>

  </div><!-- /report-sections -->

  <!-- ④ Explanatory Note -->
  <div class="report-note">
    <strong>How this recommendation was generated:</strong> The AeroCargoIQ scoring engine evaluated your cargo across four container categories — Glass, Metal, Refrigerated, and Standard — using a weighted point system. Each answer contributed points to the relevant categories. The container with the highest composite score was selected as the primary recommendation. Aircraft class was independently determined by route distance. Scheduling parameters were derived from urgency, perishability, and congestion flags.
  </div>

</div><!-- /report-page -->
  `;

  document.getElementById('report-placeholder').style.display = 'none';
  const reportContent = document.getElementById('report-content');
  reportContent.style.display = 'block';
  reportContent.innerHTML = reportHTML;

  // Show print button
  document.getElementById('btn-print').style.display = 'inline-flex';
}

// ─────────────────────────────────────────────────────────────
// SESSION LOG TABLE
// ─────────────────────────────────────────────────────────────
function renderSessionLog() {
  const ans = STATE.answers;
  const rows = [
    ['Cargo Type',            cap(ans.cargo_type || '—'),                        '🚚'],
    ['Fragile?',              yesNoTag(ans.fragile),                             '⚠️'],
    ['Heavy?',                yesNoTag(ans.heavy),                               '⚖️'],
    ['Perishable?',           yesNoTag(ans.perishable),                          '🌡️'],
    ['Route Distance',        `${Number(ans.distance).toLocaleString()} km`,     '📍'],
    ['Weather Sensitive?',    yesNoTag(ans.weather_sensitive),                   '🌤'],
    ['Urgent Delivery?',      yesNoTag(ans.urgency),                             '🚀'],
    ['High Airport Traffic?', yesNoTag(ans.traffic),                             '✈️'],
    ['Score — Glass',         STATE.score.glass,                                 '🔷'],
    ['Score — Metal',         STATE.score.metal,                                 '🔶'],
    ['Score — Refrigerated',  STATE.score.refrigerated,                          '❄️'],
    ['Score — Standard',      STATE.score.standard,                              '📦'],
  ];

  document.getElementById('log-content').innerHTML = `
    <div class="log-table-wrap">
      <table>
        <thead><tr><th></th><th>PARAMETER</th><th>RECORDED VALUE</th></tr></thead>
        <tbody>
          ${rows.map(([k,v,icon]) => `
            <tr>
              <td style="width:36px;text-align:center;font-size:15px">${icon}</td>
              <td style="color:#94a3b8">${k}</td>
              <td>${v}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// RESTART
// ─────────────────────────────────────────────────────────────
function restartSystem() {
  STATE.score     = { glass: 0, metal: 0, refrigerated: 0, standard: 0 };
  STATE.answers   = {};
  STATE.step      = 0;
  STATE.complete  = false;
  STATE.sessionId = generateId();
  STATE.startTime = new Date();

  chatScroll.innerHTML  = '';
  chatFooter.innerHTML  = '';
  restartBtn.style.display = 'none';
  agentStatus.textContent  = 'Initialising…';

  // reset report panel
  document.getElementById('report-placeholder').style.display = '';
  document.getElementById('report-content').style.display      = 'none';
  document.getElementById('report-content').innerHTML          = '';
  document.getElementById('btn-print').style.display           = 'none';

  // reset session log
  document.getElementById('log-content').innerHTML = `
    <div class="empty-card">
      <div class="empty-icon">🗒</div>
      <h3>No Session Data</h3>
      <p>Complete an assessment to see your answers summarised here.</p>
      <button class="btn-primary" onclick="switchPanel('advisor')">Start Assessment →</button>
    </div>`;

  updateProgress(0);
  switchPanel('advisor');
  setTimeout(() => askStep(0), 400);
}

// ─────────────────────────────────────────────────────────────
// INPUT RENDERERS
// ─────────────────────────────────────────────────────────────
function renderInputFor(step) {
  chatFooter.innerHTML = '';

  if (step.type === 'options' || step.type === 'yesno') {
    const label = el('div', 'footer-label', 'SELECT AN OPTION:');
    const grid  = el('div', 'opts-grid');

    step.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.innerHTML = `<span class="opt-icon">${choice.icon}</span>${choice.label}`;
      btn.onclick   = () => {
        grid.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        // disable all
        grid.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);
        setTimeout(() => handleAnswer(step.id, choice.value), 380);
      };
      grid.appendChild(btn);
    });

    chatFooter.appendChild(label);
    chatFooter.appendChild(grid);
  }

  else if (step.type === 'number') {
    const label = el('div', 'footer-label', `ENTER VALUE IN ${step.unit.toUpperCase()}:`);
    const row   = el('div', 'num-row');

    const input  = document.createElement('input');
    input.type        = 'number';
    input.min         = '1';
    input.className   = 'num-input';
    input.placeholder = step.placeholder;
    input.id          = 'num-inp';

    const send = document.createElement('button');
    send.className = 'btn-send';
    send.textContent = '→';
    send.onclick = () => submitNumber(step.id, input);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submitNumber(step.id, input); });

    row.appendChild(input);
    row.appendChild(send);
    chatFooter.appendChild(label);
    chatFooter.appendChild(row);
    setTimeout(() => input.focus(), 80);
  }
}

function submitNumber(stepId, input) {
  const val = parseInt(input.value, 10);
  if (!val || val < 1) {
    input.classList.add('error');
    input.placeholder = '⚠ Please enter a valid positive number';
    input.value = '';
    setTimeout(() => { input.classList.remove('error'); input.placeholder = STEPS.find(s=>s.id===stepId).placeholder; }, 1500);
    return;
  }
  handleAnswer(stepId, val);
}

// ─────────────────────────────────────────────────────────────
// CHAT MESSAGE BUILDERS
// ─────────────────────────────────────────────────────────────
function showTyping(callback) {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  row.innerHTML = `
    <div class="msg-ava">🤖</div>
    <div class="msg-content">
      <div class="msg-bubble">
        <div class="typing-indicator"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  chatScroll.appendChild(row);
  scrollChat();

  setTimeout(() => {
    chatScroll.removeChild(row);
    callback();
  }, 850);
}

function addBotMessage(html) {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  row.innerHTML = `
    <div class="msg-ava">🤖</div>
    <div class="msg-content">
      <div class="msg-bubble">${html}</div>
      <div class="msg-time">${time()}</div>
    </div>`;
  chatScroll.appendChild(row);
  scrollChat();
}

function addUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="msg-ava">👤</div>
    <div class="msg-content">
      <div class="msg-bubble">${text}</div>
      <div class="msg-time">${time()}</div>
    </div>`;
  chatScroll.appendChild(row);
  scrollChat();
}

function scrollChat() {
  chatScroll.scrollTop = chatScroll.scrollHeight;
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────
function cap(str)  { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
function time()    { return new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }

function yesNoTag(val) {
  return val === 'yes'
    ? '<span class="yes-tag">✓ Yes</span>'
    : '<span class="no-tag">✗ No</span>';
}

function formatDisplay(id, value) {
  if (id === 'distance')   return `📍 ${Number(value).toLocaleString()} km`;
  if (id === 'cargo_type') return `📦 ${cap(value)}`;
  return value === 'yes' ? '✅ Yes' : '❌ No';
}

function el(tag, cls, text = '') {
  const e = document.createElement(tag);
  e.className   = cls;
  e.textContent = text;
  return e;
}

function generateId() {
  return 'ACQ-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
}
