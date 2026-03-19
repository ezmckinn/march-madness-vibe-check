// ═══════════════════════════════════════════
// VIBE LOCK — bracket vibe always wins
// ═══════════════════════════════════════════
const BRACKET_VIBES = {};
Object.values(BRACKET).forEach(region => {
  region.matchups.forEach(m => {
    BRACKET_VIBES[m.top.name] = m.top.vibe;
    BRACKET_VIBES[m.bot.name] = m.bot.vibe;
  });
});

function getHotReason(teamName) {
  for (const region of Object.values(BRACKET)) {
    for (const m of region.matchups) {
      if (m.hot && m.hotReason && (m.top.name === teamName || m.bot.name === teamName)) {
        return { reason: m.hotReason, opponent: m.top.name === teamName ? m.bot.name : m.top.name };
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════
// RENDER REGION (detail view)
// ═══════════════════════════════════════════
function renderRegion(regionKey) {
  const region = BRACKET[regionKey];
  const container = document.getElementById(`${regionKey}-bracket`);
  container.innerHTML = '';

  region.matchups.forEach((matchup) => {
    const div = document.createElement('div');
    div.className = 'matchup' + (matchup.hot ? ' hot-game' : '');

    const makeTeamRow = (team, pos) => {
      const vc = VIBE_CONFIG[team.vibe] || VIBE_CONFIG.dominant;
      const seedCls = team.seed <= 4 ? `s${Math.min(team.seed,4)}` : '';
      const isFirst4 = matchup.first4 === pos;
      const nameEsc = team.name.replace(/'/g, "\\'");
      const confHtml = team.conf ? `<span style="font-size:10px;color:var(--text-dim);margin-left:2px">${team.conf}</span>` : '';
      return `
        <div class="team-row" onclick="openPanel('${nameEsc}', ${team.seed}, '${team.record}')">
          <div class="seed ${seedCls}">${team.seed}</div>
          <div class="team-name">${team.name}${isFirst4 ? ' <span class="first4">F4</span>' : ''}</div>
          <div class="record">${team.record}${confHtml}</div>
          <div class="vibe-badge ${vc.cls}">${vc.label}</div>
        </div>`;
    };

    let watchHTML = matchup.hot ? `<div class="watch-strip"><div class="watch-strip-dot"></div>WATCH THIS GAME</div>` : '';
    let hotReasonHTML = (matchup.hot && matchup.hotReason)
      ? `<div class="hot-reason">★ ${matchup.hotReason}</div>` : '';

    div.innerHTML = watchHTML +
      makeTeamRow(matchup.top, 'top') +
      `<div class="vs-divider">vs</div>` +
      makeTeamRow(matchup.bot, 'bot') +
      hotReasonHTML;

    container.appendChild(div);
  });
}

// ═══════════════════════════════════════════
// RENDER FULL BRACKET (classic NCAA view)
// ═══════════════════════════════════════════
function renderFullBracket() {
  const root = document.getElementById('full-bracket-root');
  if (!root) return;

  // Layout: East (left) | West (left-center) | [trophy] | Midwest (right-center) | South (right)
  // Pairs: East top-half + South bottom-half on left; West + Midwest on right
  // Standard NCAA: East faces West FF; South faces Midwest FF

  const REGION_ORDER = [
    { key:'east',    label:'East',    color:'var(--accent-east)',  flip:false },
    { key:'south',   label:'South',   color:'var(--accent-south)', flip:false },
    { key:'midwest', label:'Midwest', color:'var(--accent-mid)',   flip:true  },
    { key:'west',    label:'West',    color:'var(--accent-west)',  flip:true  },
  ];

  let html = `<div class="full-bracket-wrap">
    <div style="text-align:center;margin-bottom:1rem;">
      <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;letter-spacing:-0.02em;color:var(--gold)">2026 NCAA Tournament — First Round</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Click any team for their vibe profile · ★ = watch game · ✓ = conf tourney champ</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 80px 1fr 1fr;gap:0;align-items:start">`;

  REGION_ORDER.forEach((r, ri) => {
    const region = BRACKET[r.key];
    const flipClass = r.flip ? ' flip' : '';

    html += `<div class="fb-region-col${flipClass}">
      <div class="fb-region-label" style="color:${r.color}">${r.label}</div>`;

    region.matchups.forEach(m => {
      const makeRow = (team, pos) => {
        const vc = VIBE_CONFIG[team.vibe] || VIBE_CONFIG.dominant;
        const sc = team.seed <= 3 ? `s${team.seed}` : '';
        const nameEsc = team.name.replace(/'/g, "\\'");
        const isF4 = m.first4 === pos;
        const confShort = team.conf ? ` <span style="color:var(--text-dim);font-size:8px">${team.conf}</span>` : '';
        return `<div class="fb-team" onclick="openPanel('${nameEsc}',${team.seed},'${team.record}')">
          <div class="fb-seed ${sc}">${team.seed}</div>
          <div class="fb-name">${team.name}${isF4?' <span style="font-size:8px;opacity:.5">F4</span>':''}</div>
          <div style="display:flex;align-items:center;gap:3px;flex-shrink:0">
            <div class="fb-record">${team.record}${confShort}</div>
            <div class="fb-vdot" style="background:${vc.color}"></div>
          </div>
        </div>`;
      };

      html += `<div class="fb-matchup${m.hot?' hot-game':''}">
        ${m.hot ? '<div class="fb-watch">★</div>' : ''}
        ${makeRow(m.top,'top')}
        <div class="fb-vs">vs</div>
        ${makeRow(m.bot,'bot')}
      </div>`;
    });

    html += `</div>`;

    // Insert thin divider after 2nd region
    if (ri === 1) {
      html += `<div style="display:flex;align-items:center;justify-content:center;padding:2.5rem 4px 0;">
        <div style="width:1px;height:100%;background:var(--border);min-height:200px;"></div>
      </div>`;
    }
  });

  html += `</div></div>`;
  root.innerHTML = html;
}

// Render all regions on load
['east','west','midwest','south'].forEach(renderRegion);
renderFullBracket();

// ═══════════════════════════════════════════
// REGION SWITCHING
// ═══════════════════════════════════════════
function showRegion(regionKey) {
  document.querySelectorAll('.bracket-container').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`region-${regionKey}`).classList.add('active');
  const tabEl = document.querySelector(`.tab.${regionKey}`);
  if (tabEl) tabEl.classList.add('active');
}

// ═══════════════════════════════════════════
// PANEL
// ═══════════════════════════════════════════
let panelCache = {};

function openPanel(teamName, seed, record) {
  document.getElementById('panel-name').textContent = teamName;
  document.getElementById('panel-seed').textContent = `#${seed}`;
  document.getElementById('panel-record').textContent = record;
  document.getElementById('panel-overlay').classList.add('open');

  const body = document.getElementById('panel-body');

  if (panelCache[teamName]) {
    renderPanelContent(body, panelCache[teamName], teamName);
    return;
  }

  const staticData = TEAM_DATA[teamName];
  if (staticData) {
    // Enforce bracket vibe — static data vibe must match bracket
    const lockedVibe = BRACKET_VIBES[teamName] || staticData.vibe;
    const merged = Object.assign({}, staticData, { vibe: lockedVibe });
    panelCache[teamName] = { source: 'static', data: merged };
    renderPanelContent(body, panelCache[teamName], teamName);
    return;
  }

  // Static version — show basic profile from bracket data
  const fallbackVibe = BRACKET_VIBES[teamName] || 'iceberg';
  const vc = VIBE_CONFIG[fallbackVibe] || VIBE_CONFIG.dominant;
  const fallbackData = {
    vibe: fallbackVibe,
    vibeDesc: 'This team earned their spot. Click through the bracket to explore the matchup context below.',
    strengths: ['Tournament-qualified program'],
    weaknesses: ['Data loading unavailable'],
    stats: [],
    players: [],
    ceiling: 'Round of 32'
  };
  panelCache[teamName] = { data: fallbackData };
  renderPanelContent(body, panelCache[teamName], teamName);
}

function renderPanelContent(body, cached, teamName) {
  const d = cached.data;
  // Always use the bracket-locked vibe for display
  const lockedVibe = BRACKET_VIBES[teamName] || d.vibe || 'dominant';
  const vc = VIBE_CONFIG[lockedVibe] || VIBE_CONFIG.dominant;

  const hotInfo = getHotReason(teamName);

  let hotBannerHTML = '';
  if (hotInfo) {
    hotBannerHTML = `<div class="info-section">
      <div class="section-label">Why This Matchup is a Banger</div>
      <div class="hot-banner">
        <div style="font-size:11px;line-height:1.6;color:var(--text-muted)">${hotInfo.reason}</div>
      </div>
    </div>`;
  }

  let statsHTML = '';
  if (d.stats && d.stats.length) {
    statsHTML = `<div class="info-section">
      <div class="section-label">Key Stats</div>
      <div class="stats-grid">
        ${d.stats.map(s => `<div class="stat-card"><div class="stat-val">${s.val}</div><div class="stat-label">${s.lbl}</div></div>`).join('')}
      </div>
    </div>`;
  }

  let playersHTML = '';
  if (d.players && d.players.length) {
    playersHTML = `<div class="info-section">
      <div class="section-label">Players to Watch</div>
      <div class="players-list">
        ${d.players.map(p => {
          const init = p.name.split(' ').map(w => w[0]).join('').slice(0,2);
          return `<div class="player-row">
            <div class="player-avatar">${init}</div>
            <div class="player-name">${p.name}</div>
            <div class="player-stat">${p.stat}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  let strengthsHTML = '';
  if (d.strengths && d.strengths.length) {
    strengthsHTML = `<div class="info-section">
      <div class="section-label">Strengths</div>
      <div class="chip-list">${d.strengths.map(s => `<div class="chip strength">${s}</div>`).join('')}</div>
    </div>`;
  }

  let weaknessesHTML = '';
  if (d.weaknesses && d.weaknesses.length) {
    weaknessesHTML = `<div class="info-section">
      <div class="section-label">Weaknesses</div>
      <div class="chip-list">${d.weaknesses.map(w => `<div class="chip weakness">${w}</div>`).join('')}</div>
    </div>`;
  }

  body.innerHTML = `
    <div class="vibe-section" style="background:${vc.bg}; border: 1px solid ${vc.color}22;">
      <div class="vibe-icon">${vc.icon}</div>
      <div>
        <div class="vibe-label-big" style="color:${vc.color}">${vc.label}</div>
        <div class="vibe-desc" style="color:var(--text-muted)">${d.vibeDesc || ''}</div>
      </div>
    </div>
    ${hotBannerHTML}
    ${statsHTML}
    ${strengthsHTML}
    ${weaknessesHTML}
    ${playersHTML}
    ${d.ceiling ? `<div class="info-section"><div class="section-label">Tournament Ceiling</div><div class="section-content" style="font-weight:500">${d.ceiling}</div></div>` : ''}
    <div id="ai-section"></div>
  `;
}


function closePanel(e) {
  if (e && e.target !== document.getElementById('panel-overlay')) return;
  document.getElementById('panel-overlay').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('panel-overlay').classList.remove('open');
});
