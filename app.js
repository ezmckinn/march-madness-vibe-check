// ═══════════════════════════════════════════
// MARCH MADNESS 2026 — VIBE CHECK  v3
// ═══════════════════════════════════════════

const ROUNDS = [
  { key:'r64',  label:'First Round',  games:32 },
  { key:'r32',  label:'Round of 32',  games:16 },
  { key:'s16',  label:'Sweet 16',     games:8  },
  { key:'e8',   label:'Elite Eight',  games:4  },
  { key:'ff',   label:'Final Four',   games:2  },
  { key:'champ',label:'Championship', games:1  },
];

const REGION_KEYS = ['east','west','midwest','south'];
const REGION_COLORS = { east:'var(--accent-east)', west:'var(--accent-west)', midwest:'var(--accent-mid)', south:'var(--accent-south)' };
const REGION_HEX    = { east:'#4fa8e8', west:'#e87c4f', midwest:'#c94fe8', south:'#4fd97e' };
const REGION_LABELS = { east:'East', west:'West', midwest:'Midwest', south:'South' };
const FF_MATCHUPS   = [{ r1:'east', r2:'south' }, { r1:'midwest', r2:'west' }];

// ── STATE ──────────────────────────────────
let PICKS = {};
let CURRENT_ROUND = 'r64';
let CURRENT_VIEW  = 'east';
let EXPANDED_TEAM = null;  // { region, round, gameIdx, teamName }
let WATCH_ON = true;       // watch recommendations on by default

function initState() {
  try { PICKS = JSON.parse(localStorage.getItem('mm2026_picks') || '{}'); } catch(e) { PICKS = {}; }
  REGION_KEYS.forEach(r => { if (!PICKS[r]) PICKS[r] = {}; });
  if (!PICKS.ff)    PICKS.ff    = {};
  if (!PICKS.champ) PICKS.champ = null;
}
function saveState() {
  try { localStorage.setItem('mm2026_picks', JSON.stringify(PICKS)); } catch(e) {}
}
function resetBracket() {
  if (!confirm('Reset all picks? This cannot be undone.')) return;
  try { localStorage.removeItem('mm2026_picks'); } catch(e) {}
  PICKS = {}; EXPANDED_TEAM = null; WATCH_ON = true;
  initState(); renderAll();
}

// ── BRACKET LOGIC ──────────────────────────
function getR64Teams(regionKey) {
  return BRACKET[regionKey].matchups.map(m => ({ top:m.top, bot:m.bot, hot:m.hot, hotReason:m.hotReason }));
}

function getMatchupsForRound(regionKey, roundKey) {
  const order = ['r64','r32','s16','e8'];
  if (roundKey === 'r64') return getR64Teams(regionKey);
  const ri = order.indexOf(roundKey);
  if (ri < 1) return [];
  const survivors = getPickedWinners(regionKey, order[ri-1]);
  const out = [];
  for (let i=0; i<survivors.length; i+=2) out.push({ top:survivors[i]||null, bot:survivors[i+1]||null });
  return out;
}

function getPickedWinners(regionKey, roundKey) {
  const order = ['r64','r32','s16','e8'];
  if (roundKey === 'r64') {
    const picks = PICKS[regionKey]['r64'] || [];
    return getR64Teams(regionKey).map((m,i) => {
      const p = picks[i];
      if (p === m.top.name) return m.top;
      if (p === m.bot.name) return m.bot;
      return null;
    });
  }
  const matchups = getMatchupsForRound(regionKey, roundKey);
  const picks = PICKS[regionKey][roundKey] || [];
  return matchups.map((m,i) => {
    const p = picks[i];
    if (!m.top||!m.bot) return null;
    if (p === m.top.name) return m.top;
    if (p === m.bot.name) return m.bot;
    return null;
  });
}

function getRegionalChamp(regionKey) { return getPickedWinners(regionKey,'e8')[0]||null; }

function getFFMatchup(idx) {
  const m = FF_MATCHUPS[idx];
  return { top:getRegionalChamp(m.r1), bot:getRegionalChamp(m.r2), topRegion:m.r1, botRegion:m.r2 };
}
function getFFWinner(idx) {
  const name = PICKS.ff['game'+idx];
  if (!name) return null;
  const m = getFFMatchup(idx);
  if (m.top&&m.top.name===name) return m.top;
  if (m.bot&&m.bot.name===name) return m.bot;
  return null;
}

function pickWinner(regionKey, roundKey, gameIdx, teamName) {
  if (!PICKS[regionKey][roundKey]) PICKS[regionKey][roundKey] = [];
  const old = PICKS[regionKey][roundKey][gameIdx];
  if (old && old !== teamName) invalidateDownstream(regionKey, roundKey, gameIdx);
  PICKS[regionKey][roundKey][gameIdx] = teamName;
  EXPANDED_TEAM = null;
  saveState(); renderAll();
}
function pickFFWinner(gameIdx, teamName) {
  if (PICKS.ff['game'+gameIdx] && PICKS.ff['game'+gameIdx] !== teamName) PICKS.champ = null;
  PICKS.ff['game'+gameIdx] = teamName;
  EXPANDED_TEAM = null;
  saveState(); renderAll();
}
function pickChampion(teamName) {
  PICKS.champ = teamName; EXPANDED_TEAM = null;
  saveState(); renderAll();
}

function invalidateDownstream(regionKey, roundKey, gameIdx) {
  const order = ['r64','r32','s16','e8'];
  const si = order.indexOf(roundKey);
  if (si<0) return;
  let slot = Math.floor(gameIdx/2);
  for (let ri=si+1; ri<order.length; ri++) {
    const rk = order[ri];
    if (PICKS[regionKey][rk]) PICKS[regionKey][rk][slot] = undefined;
    slot = Math.floor(slot/2);
  }
  FF_MATCHUPS.forEach((fm,i) => {
    if (fm.r1===regionKey||fm.r2===regionKey) { PICKS.ff['game'+i]=null; PICKS.champ=null; }
  });
}

function countPicks(roundKey) {
  if (roundKey==='r64') return REGION_KEYS.reduce((s,r)=>s+((PICKS[r]['r64']||[]).filter(Boolean).length),0);
  if (roundKey==='r32') return REGION_KEYS.reduce((s,r)=>s+((PICKS[r]['r32']||[]).filter(Boolean).length),0);
  if (roundKey==='s16') return REGION_KEYS.reduce((s,r)=>s+((PICKS[r]['s16']||[]).filter(Boolean).length),0);
  if (roundKey==='e8')  return REGION_KEYS.reduce((s,r)=>s+((PICKS[r]['e8'] ||[]).filter(Boolean).length),0);
  if (roundKey==='ff')  return [0,1].filter(i=>PICKS.ff['game'+i]).length;
  if (roundKey==='champ') return PICKS.champ?1:0;
  return 0;
}

// ── WATCH SCORE SYSTEM ─────────────────────
// Rates each matchup 0-100 for "watchability"
function watchScore(teamA, teamB, isHot, seedDiff) {
  if (!teamA||!teamB) return 0;
  const va = teamA.vibe, vb = teamB.vibe;
  const vibeScore = {
    'fire-fire':40, 'jekyll-jekyll':38, 'fire-jekyll':36, 'jekyll-fire':36,
    'fire-dominant':30, 'dominant-fire':30, 'dominant-darkhorse':28, 'darkhorse-dominant':28,
    'shaky-fire':26, 'fire-shaky':26, 'jekyll-darkhorse':24, 'darkhorse-jekyll':24,
    'dominant-dominant':20, 'shaky-darkhorse':20, 'darkhorse-shaky':20,
    'fire-darkhorse':18, 'darkhorse-fire':18, 'shaky-shaky':15,
    'dominant-shaky':10, 'shaky-dominant':10, 'dominant-iceberg':8,
    'fire-iceberg':6, 'darkhorse-darkhorse':15,
  };
  let score = vibeScore[`${va}-${vb}`] || vibeScore[`${vb}-${va}`] || 10;
  if (isHot) score += 30;
  const sd = Math.abs((teamA.seed||8)-(teamB.seed||8));
  if (sd<=2) score += 15; else if (sd<=4) score += 8; else if (sd>=8) score += 12;
  return Math.min(score, 100);
}

// Returns set of "gameKey" strings like "east-r64-2" that are recommended.
// Only recommends games where BOTH teams are populated.
function getWatchRecommendations(roundKey) {
  const countMap = { r64:2, r32:2, s16:1, e8:1, ff:1 };
  const perRegion = countMap[roundKey] || 0;
  const recommended = new Set();

  if (['r64','r32','s16','e8'].includes(roundKey)) {
    REGION_KEYS.forEach(regionKey => {
      const matchups = getMatchupsForRound(regionKey, roundKey);
      const scored = matchups
        .map((m, i) => ({
          key: `${regionKey}-${roundKey}-${i}`,
          score: (m.top && m.bot) ? watchScore(m.top, m.bot, !!m.hot, 0) : -1,
        }))
        .filter(s => s.score >= 0)          // only fully-populated games
        .sort((a, b) => b.score - a.score);
      scored.slice(0, perRegion).forEach(s => recommended.add(s.key));
    });
  } else if (roundKey === 'ff') {
    const scored = [0, 1].map(i => {
      const m = getFFMatchup(i);
      return { key: `ff-${i}`, score: (m.top && m.bot) ? watchScore(m.top, m.bot, false, 0) : -1 };
    }).filter(s => s.score >= 0).sort((a, b) => b.score - a.score);
    if (scored.length) recommended.add(scored[0].key);
  }
  return recommended;
}

// ── NAV ────────────────────────────────────
function renderNav() {
  const nav = document.getElementById('round-nav');
  const totalDone = countPicks('r64')+countPicks('r32')+countPicks('s16')+countPicks('e8')+countPicks('ff')+countPicks('champ');
  nav.innerHTML = ROUNDS.map(r => {
    const done = countPicks(r.key), total = r.games;
    const pct = total>0 ? Math.round((done/total)*100) : 0;
    const isActive = r.key===CURRENT_ROUND;
    return `<button class="round-tab${isActive?' active':''}" onclick="switchRound('${r.key}')">
      <span class="round-tab-label">${r.label}</span>
      <span class="round-tab-progress">${done}/${total}</span>
      <div class="round-tab-bar"><div class="round-tab-fill" style="width:${pct}%"></div></div>
    </button>`;
  }).join('')
  + `<button class="round-tab${CURRENT_ROUND==='mybracket'?' active':''}" onclick="switchRound('mybracket')">
    <span class="round-tab-label">My Bracket</span>
    <span class="round-tab-progress">${totalDone}/63</span>
    <div class="round-tab-bar"><div class="round-tab-fill" style="width:${Math.round(totalDone/63*100)}%"></div></div>
  </button>`
  + `<button class="round-tab watch-nav-btn${WATCH_ON?' watch-on':''}" onclick="toggleWatch()" title="${WATCH_ON?'Hide recommendations':'Show recommended games to watch'}">
    <span class="round-tab-label">★ Watch</span>
    <span class="round-tab-progress">${WATCH_ON?'on':'off'}</span>
    <div class="round-tab-bar"><div class="round-tab-fill" style="width:${WATCH_ON?100:0}%;background:var(--gold)"></div></div>
  </button>`;

  const subNav = document.getElementById('region-subnav');
  const showSub = ['r64','r32','s16','e8'].includes(CURRENT_ROUND);
  subNav.style.display = showSub ? 'flex' : 'none';
  if (showSub) {
    subNav.innerHTML = REGION_KEYS.map(r => {
      const color = REGION_COLORS[r], isActive = CURRENT_VIEW===r;
      return `<button class="sub-tab${isActive?' active':''}" style="${isActive?`background:${color};border-color:${color};color:#000`:''}" onclick="switchView('${r}')">${REGION_LABELS[r]}</button>`;
    }).join('')
    + `<button class="sub-tab${CURRENT_VIEW==='all'?' active-all':''}" onclick="switchView('all')">All Regions</button>`;
  }
}

function switchRound(k) {
  CURRENT_ROUND = k; EXPANDED_TEAM = null;
  if (!['r64','r32','s16','e8'].includes(k)) CURRENT_VIEW = 'all';
  else if (!REGION_KEYS.includes(CURRENT_VIEW)) CURRENT_VIEW = 'east';
  renderAll();
}
function switchView(v) { CURRENT_VIEW = v; EXPANDED_TEAM = null; renderAll(); }
function toggleWatch() { WATCH_ON = !WATCH_ON; renderAll(); }

// ── MAIN RENDER ────────────────────────────
function renderAll() { renderNav(); renderMainContent(); }

function renderMainContent() {
  const el = document.getElementById('main-content');
  if (CURRENT_ROUND==='mybracket') { el.innerHTML = renderMyBracket(); return; }
  if (CURRENT_ROUND==='ff')        { el.innerHTML = renderFinalFour(); return; }
  if (CURRENT_ROUND==='champ')     { el.innerHTML = renderChampionship(); return; }

  const watchRecs = WATCH_ON ? getWatchRecommendations(CURRENT_ROUND) : new Set();

  if (CURRENT_VIEW==='all') {
    el.innerHTML = renderFullBracketView(CURRENT_ROUND, watchRecs);
  } else {
    const loc = roundSubtitle(CURRENT_ROUND, CURRENT_VIEW);
    el.innerHTML = `<div class="region-header">
        <div class="region-title" style="color:${REGION_COLORS[CURRENT_VIEW]}">${REGION_LABELS[CURRENT_VIEW]}</div>
        ${loc?`<div class="region-1seed">${loc}</div>`:''}
      </div>
      <div class="bracket-grid">${renderRegionRound(CURRENT_VIEW, CURRENT_ROUND, watchRecs)}</div>`;
  }
}

function roundSubtitle(rk, reg) {
  const m = {
    r64:{ east:'Lexington & Providence', west:'Sacramento & Omaha', midwest:'Cleveland & Indianapolis', south:'Atlanta & Wichita' },
    r32:{ east:'Lexington & Providence', west:'Sacramento & Omaha', midwest:'Cleveland & Indianapolis', south:'Atlanta & Wichita' },
    s16:{ east:'Washington D.C.', west:'Portland', midwest:'St. Louis', south:'Tampa' },
    e8: { east:'Washington D.C.', west:'Portland', midwest:'St. Louis', south:'Tampa' },
  };
  return m[rk]?.[reg]||'';
}

// ── FULL BRACKET VIEW (compact, all regions) ─
function renderFullBracketView(roundKey, watchRecs) {
  const roundLabels = { r64:'First Round', r32:'Round of 32', s16:'Sweet 16', e8:'Elite Eight' };
  let html = `<div class="full-bracket-wrap">
    <div class="full-bracket-header">
      <span style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;letter-spacing:-0.02em;color:var(--gold)">${roundLabels[roundKey]||roundKey} — All Regions</span>
      <span style="font-size:11px;color:var(--text-muted)">Click any team to preview · ★ = watch game · ✓ = conf tourney champ</span>
    </div>
    <div class="full-bracket-grid">`;

  REGION_KEYS.forEach(regionKey => {
    const matchups = getMatchupsForRound(regionKey, roundKey);
    const picks = PICKS[regionKey][roundKey]||[];
    const color = REGION_HEX[regionKey];

    html += `<div class="fb-region-col">
      <div class="fb-region-label" style="color:${color}">${REGION_LABELS[regionKey]}</div>`;

    matchups.forEach((m,i) => {
      const picked = picks[i];
      const gameKey = `${regionKey}-${roundKey}-${i}`;
      const isWatch = watchRecs.has(gameKey);
      const topTeam = m.top||{name:'TBD',seed:'?',vibe:'iceberg'};
      const botTeam = m.bot||{name:'TBD',seed:'?',vibe:'iceberg'};
      const topPick = picked===topTeam.name, botPick=picked===botTeam.name;

      const fbRow = (team, isPick, isElim) => {
        const vc = VIBE_CONFIG[team.vibe]||VIBE_CONFIG.dominant;
        const sc = (typeof team.seed==='number'&&team.seed<=3)?` s${team.seed}`:'';
        const ne = team.name.replace(/'/g,"\\'");
        const isKnown = team.name!=='TBD';
        return `<div class="fb-team${isPick?' fb-picked':''}${isElim?' fb-elim':''}" ${isKnown?`onclick="expandTeam('${ne}','${regionKey}','${roundKey}',${i},${team.seed},'${team.record||''}')"`:''}>
          <div class="fb-seed${sc}">${team.seed}</div>
          <div class="fb-name">${team.name}</div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            ${team.record?`<div class="fb-record">${team.record}</div>`:''}
            <div class="fb-vdot" style="background:${vc.color}"></div>
          </div>
          ${isPick?'<div style="font-size:10px;color:var(--dominant);font-weight:700;flex-shrink:0">✓</div>':''}
        </div>`;
      };

      html += `<div class="fb-matchup${isWatch?' fb-watch-game':''}${picked?' fb-decided':''}">
        ${isWatch ? `<div class="fb-watch-strip">★ WATCH</div>` : ''}
        ${fbRow(topTeam, topPick, picked&&!topPick)}
        <div class="fb-vs">vs</div>
        ${fbRow(botTeam, botPick, picked&&!botPick)}
      </div>`;
    });

    html += `</div>`;
  });

  html += `</div></div>`;
  return html;
}

// ── REGION DETAIL VIEW ─────────────────────
function renderRegionRound(regionKey, roundKey, watchRecs) {
  const matchups = getMatchupsForRound(regionKey, roundKey);
  const picks = PICKS[regionKey][roundKey]||[];
  return matchups.map((m,i) => renderMatchupCard(m, regionKey, roundKey, i, picks[i], watchRecs||new Set())).join('');
}

function renderMatchupCard(m, regionKey, roundKey, gameIdx, pickedName, watchRecs) {
  const topTeam  = m.top||{name:'TBD',seed:'?',record:'',vibe:'iceberg'};
  const botTeam  = m.bot||{name:'TBD',seed:'?',record:'',vibe:'iceberg'};
  const topKnown = !!m.top, botKnown = !!m.bot;
  const topPick  = pickedName===topTeam.name, botPick=pickedName===botTeam.name;
  // isHot: raw data flag, but only shown when WATCH_ON is active
  const isHot    = WATCH_ON && m.hot && roundKey==='r64';
  const gameKey  = `${regionKey}-${roundKey}-${gameIdx}`;
  const isWatch  = watchRecs.has(gameKey);

  const isTopExpanded  = EXPANDED_TEAM && EXPANDED_TEAM.gameIdx===gameIdx && EXPANDED_TEAM.region===regionKey && EXPANDED_TEAM.round===roundKey && EXPANDED_TEAM.teamName===topTeam.name;
  const isBotExpanded  = EXPANDED_TEAM && EXPANDED_TEAM.gameIdx===gameIdx && EXPANDED_TEAM.region===regionKey && EXPANDED_TEAM.round===roundKey && EXPANDED_TEAM.teamName===botTeam.name;

  const makeRow = (team, isPick, isElim, isKnown, isExp) => {
    const vc = VIBE_CONFIG[team.vibe]||VIBE_CONFIG.dominant;
    const sc = (typeof team.seed==='number'&&team.seed<=4)?`s${Math.min(team.seed,4)}`:'';
    const ne = team.name.replace(/'/g,"\\'");
    const canClick = isKnown && team.name!=='TBD';
    const rec   = team.record ? `<span class="record">${team.record}</span>` : '';
    const conf  = team.conf&&roundKey==='r64' ? `<span style="font-size:10px;color:var(--text-dim);margin-left:3px">${team.conf}</span>` : '';

    let expandPreview = '';
    if (isExp && !isPick) {
      const td = TEAM_DATA[team.name]||{};
      expandPreview = `<div class="team-expand-preview">
        <div class="tep-vibe" style="color:${vc.color}">${vc.icon} ${vc.label}</div>
        <div class="tep-desc">${td.vibeDesc ? td.vibeDesc.split('.')[0]+'.' : 'Tournament-qualified team.'}</div>
        ${td.stats&&td.stats.length ? `<div class="tep-stats">${td.stats.slice(0,3).map(s=>`<div class="tep-stat"><div class="tep-val">${s.val}</div><div class="tep-lbl">${s.lbl}</div></div>`).join('')}</div>` : ''}
        <div class="tep-actions">
          <button class="tep-pick-btn" onclick="event.stopPropagation();pickWinner('${regionKey}','${roundKey}',${gameIdx},'${ne}')">Pick to advance →</button>
          <button class="tep-profile-btn" onclick="event.stopPropagation();openPanel('${ne}',${team.seed},'${team.record||''}')">Full profile</button>
        </div>
      </div>`;
    }

    return `<div class="team-row-wrap">
      <div class="team-row${isPick?' picked':''}${isElim?' eliminated':''}${canClick?' clickable':''}${isExp&&!isPick?' expanded':''}"
        ${canClick?`onclick="expandTeam('${ne}','${regionKey}','${roundKey}',${gameIdx},${team.seed},'${team.record||''}')"`:''}>
        <div class="seed ${sc}">${team.seed}</div>
        <div class="team-name">${team.name}</div>
        ${rec}${conf}
        ${isKnown?`<div class="vibe-badge ${vc.cls}">${vc.label}</div>`:''}
        ${isPick?'<div class="pick-check">✓</div>':''}
        ${canClick&&!isPick&&!isElim?`<div class="expand-hint">${isExp?'▲':'▼'}</div>`:''}
      </div>
      ${expandPreview}
    </div>`;
  };

  const hotHTML = isHot || isWatch
    ? `<div class="watch-strip"><div class="watch-strip-dot"></div>★ WATCH</div>` : '';
  const hotReasonHTML = (isHot || isWatch) && m.hotReason
    ? `<div class="hot-reason">★ ${m.hotReason}</div>` : '';

  let matchupContext = '';
  if (roundKey!=='r64') {
    if (topKnown && botKnown) matchupContext = renderMatchupContext(topTeam, botTeam);
    else matchupContext = `<div class="tbd-note">Pick ${REGION_LABELS[regionKey]} ${prevRoundLabel(roundKey)} games to reveal this matchup</div>`;
  }

  // Watch recommendation reason for non-r64 rounds
  let watchReasonHTML = '';
  if (isWatch && roundKey!=='r64' && topKnown && botKnown) {
    watchReasonHTML = `<div class="hot-reason">★ ${generateEdgeLine(topTeam, botTeam, {}, {})}</div>`;
  }

  return `<div class="matchup${(isHot||isWatch)?' watch-rec':''}${pickedName?' decided':''}">
    ${hotHTML}
    ${makeRow(topTeam, topPick, pickedName&&!topPick, topKnown, isTopExpanded)}
    <div class="vs-divider">vs</div>
    ${makeRow(botTeam, botPick, pickedName&&!botPick, botKnown, isBotExpanded)}
    ${matchupContext}
    ${hotReasonHTML||watchReasonHTML}
  </div>`;
}

function prevRoundLabel(rk) {
  return {r32:'First Round',s16:'Round of 32',e8:'Sweet 16'}[rk]||'earlier round';
}

// ── EXPAND TEAM (browse before pick) ──────
function expandTeam(teamName, regionKey, roundKey, gameIdx, seed, record) {
  const already = EXPANDED_TEAM &&
    EXPANDED_TEAM.teamName===teamName &&
    EXPANDED_TEAM.gameIdx===gameIdx &&
    EXPANDED_TEAM.region===regionKey;

  // If already picked: open the full panel
  const picked = (PICKS[regionKey][roundKey]||[])[gameIdx];
  if (picked===teamName) { openPanel(teamName,seed,record); return; }

  // Toggle expand
  EXPANDED_TEAM = already ? null : { teamName, region:regionKey, round:roundKey, gameIdx, seed, record };
  renderAll();
}

// ── H2H ───────────────────────────────────
function renderMatchupContext(tA, tB) {
  const dA=TEAM_DATA[tA.name]||{}, dB=TEAM_DATA[tB.name]||{};
  const vcA=VIBE_CONFIG[tA.vibe]||VIBE_CONFIG.dominant, vcB=VIBE_CONFIG[tB.vibe]||VIBE_CONFIG.dominant;
  return `<div class="h2h-context">
    <div class="h2h-label">Matchup preview</div>
    <div class="h2h-grid">
      <div class="h2h-team">
        <div class="h2h-vibe-badge" style="background:${vcA.bg};color:${vcA.color};border:1px solid ${vcA.color}33">${vcA.icon} ${vcA.label}</div>
        <div class="h2h-name">${tA.name}</div>
        <div class="h2h-desc">${dA.vibeDesc?dA.vibeDesc.split('.')[0]+'.':''}</div>
      </div>
      <div class="h2h-vs">vs</div>
      <div class="h2h-team">
        <div class="h2h-vibe-badge" style="background:${vcB.bg};color:${vcB.color};border:1px solid ${vcB.color}33">${vcB.icon} ${vcB.label}</div>
        <div class="h2h-name">${tB.name}</div>
        <div class="h2h-desc">${dB.vibeDesc?dB.vibeDesc.split('.')[0]+'.':''}</div>
      </div>
    </div>
    <div class="h2h-edge">${generateEdgeLine(tA,tB,dA,dB)}</div>
  </div>`;
}

function generateEdgeLine(tA, tB) {
  const combos = {
    'dominant-dominant':`Two elite programs. Coin flip.`,
    'dominant-fire':`${tA.name} has the pedigree, but ${tB.name} is peaking at exactly the right time.`,
    'dominant-shaky':`${tA.name} should handle this — unless ${tB.name} finds their best form.`,
    'dominant-jekyll':`${tA.name} wins if ${tB.name} shows up as the bad version.`,
    'dominant-darkhorse':`${tA.name} is the favorite, but ${tB.name}'s analytics say they're dangerous.`,
    'dominant-iceberg':`${tA.name} is the class of the field — but icebergs sink ships.`,
    'fire-dominant':`${tA.name} is riding a wave — can they sustain it against ${tB.name}?`,
    'fire-fire':`Two hot teams, both peaking. Right to the wire.`,
    'fire-shaky':`${tA.name} has the momentum edge — ${tB.name} needs to get right.`,
    'fire-jekyll':`${tA.name}'s momentum vs ${tB.name}'s unpredictability — must-watch TV.`,
    'fire-darkhorse':`Hot team meets hidden gem. Closer than it looks.`,
    'fire-iceberg':`${tA.name} has the energy — ${tB.name} has the hidden depth.`,
    'shaky-shaky':`Neither team has looked convincing. Whoever panics first loses.`,
    'shaky-fire':`${tB.name}'s momentum is the story.`,
    'shaky-darkhorse':`${tA.name} is vulnerable — exactly when darkhorse teams pull upsets.`,
    'jekyll-jekyll':`Total chaos. Book it.`,
    'jekyll-dominant':`${tB.name} wins if they come to play. ${tA.name}'s chaos is the wild card.`,
    'jekyll-fire':`${tB.name}'s momentum vs ${tA.name}'s chaos — great watch.`,
    'darkhorse-dominant':`${tB.name} is favored, but ${tA.name}'s analytics say it should be closer.`,
    'darkhorse-darkhorse':`Two disrespected teams. One's about to make a run.`,
    'darkhorse-fire':`${tB.name} is hot, ${tA.name} is hungry. The underdog wants it more.`,
    'iceberg-dominant':`${tB.name} is the pick — but ${tA.name} has more under the surface.`,
    'iceberg-fire':`${tB.name} has the energy. Icebergs don't care about momentum.`,
  };
  const va=tA.vibe, vb=tB.vibe;
  return '⚡ '+(combos[`${va}-${vb}`]||combos[`${vb}-${va}`]||`${tA.name} vs ${tB.name} — a true tournament test.`);
}

// ── FINAL FOUR ─────────────────────────────
function renderFinalFour() {
  const watchRecs = WATCH_ON ? getWatchRecommendations('ff') : new Set();
  let html = `<div class="ff-container">
    <div class="ff-header">
      <div style="font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;color:var(--gold)">Final Four</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">San Antonio, TX · April 4, 2026</div>
    </div>
    <div class="ff-matchups">` ;

  FF_MATCHUPS.forEach((ffm, idx) => {
    const m = getFFMatchup(idx);
    const picked = PICKS.ff['game'+idx];
    const topTeam = m.top||{name:`${REGION_LABELS[ffm.r1]} Winner`,seed:'?',vibe:'iceberg'};
    const botTeam = m.bot||{name:`${REGION_LABELS[ffm.r2]} Winner`,seed:'?',vibe:'iceberg'};
    const topKnown=!!m.top, botKnown=!!m.bot;
    const topPick=picked&&topKnown&&picked===topTeam.name;
    const botPick=picked&&botKnown&&picked===botTeam.name;
    const isWatch = watchRecs.has(`ff-${idx}`);

    const makeFFRow = (team, isKnown, isPick, region) => {
      if (!isKnown) return `<div class="team-row tbd-row">
        <div class="tbd-region-badge" style="background:${REGION_COLORS[region]}22;color:${REGION_COLORS[region]};border:1px solid ${REGION_COLORS[region]}44">${REGION_LABELS[region]}</div>
        <div class="team-name" style="color:var(--text-dim)">Winner TBD</div>
        <div style="font-size:11px;color:var(--text-dim)">Pick Elite Eight to advance</div>
      </div>`;
      const vc=VIBE_CONFIG[team.vibe]||VIBE_CONFIG.dominant;
      const ne=team.name.replace(/'/g,"\\'");
      const elim=picked&&!isPick;
      const isExp=EXPANDED_TEAM&&EXPANDED_TEAM.teamName===team.name&&EXPANDED_TEAM.gameIdx===idx&&EXPANDED_TEAM.region==='ff';
      const expandPreview = (isExp&&!isPick) ? `<div class="team-expand-preview">
        <div class="tep-vibe" style="color:${vc.color}">${vc.icon} ${vc.label}</div>
        <div class="tep-desc">${(TEAM_DATA[team.name]||{}).vibeDesc?.split('.')[0]||''}</div>
        <div class="tep-actions">
          <button class="tep-pick-btn" onclick="event.stopPropagation();pickFFWinner(${idx},'${ne}')">Pick to Final →</button>
          <button class="tep-profile-btn" onclick="event.stopPropagation();openPanel('${ne}',${team.seed||9},'')">Full profile</button>
        </div>
      </div>` : '';
      return `<div class="team-row-wrap">
        <div class="team-row${isPick?' picked':''}${elim?' eliminated':''}${isKnown?' clickable':''}${isExp&&!isPick?' expanded':''}"
          onclick="expandTeam('${ne}','ff','ff',${idx},${team.seed||9},'')">
          <div class="seed s${Math.min(team.seed||9,4)}">${team.seed}</div>
          <div class="team-name">${team.name}</div>
          <div class="tbd-region-badge" style="background:${REGION_COLORS[region]}22;color:${REGION_COLORS[region]};border:1px solid ${REGION_COLORS[region]}44">${REGION_LABELS[region]}</div>
          <div class="vibe-badge ${vc.cls}">${vc.label}</div>
          ${isPick?'<div class="pick-check">✓</div>':''}
          ${!isPick&&!elim?`<div class="expand-hint">${isExp?'▲':'▼'}</div>`:''}
        </div>${expandPreview}
      </div>`;
    };

    html += `<div class="ff-game matchup${isWatch?' watch-rec':''}${picked?' decided':''}">
      <div class="ff-game-label">Semifinal ${idx+1}${isWatch?' ★':''}</div>
      ${makeFFRow(topTeam,topKnown,topPick,ffm.r1)}
      <div class="vs-divider">vs</div>
      ${makeFFRow(botTeam,botKnown,botPick,ffm.r2)}
      ${(topKnown&&botKnown)?renderMatchupContext(topTeam,botTeam):''}
    </div>`;
  });

  html += `</div></div>`;
  return html;
}

// ── CHAMPIONSHIP ───────────────────────────
function renderChampionship() {
  const ff1=getFFWinner(0), ff2=getFFWinner(1), champ=PICKS.champ;
  const makeRow = (team, isKnown, gi) => {
    if (!isKnown) {
      const regions = gi===0 ? [FF_MATCHUPS[0].r1,FF_MATCHUPS[0].r2] : [FF_MATCHUPS[1].r1,FF_MATCHUPS[1].r2];
      return `<div class="team-row tbd-row"><div class="team-name" style="color:var(--text-dim)">Final Four Winner TBD</div>
        <div style="font-size:11px;color:var(--text-dim)">${regions.map(r=>REGION_LABELS[r]).join(' / ')}</div></div>`;
    }
    const vc=VIBE_CONFIG[team.vibe]||VIBE_CONFIG.dominant;
    const isPick=champ===team.name, elim=champ&&!isPick;
    const ne=team.name.replace(/'/g,"\\'");
    const isExp=EXPANDED_TEAM&&EXPANDED_TEAM.teamName===team.name&&EXPANDED_TEAM.gameIdx===0&&EXPANDED_TEAM.region==='champ';
    const expandPreview = (isExp&&!isPick) ? `<div class="team-expand-preview">
      <div class="tep-vibe" style="color:${vc.color}">${vc.icon} ${vc.label}</div>
      <div class="tep-desc">${(TEAM_DATA[team.name]||{}).vibeDesc?.split('.')[0]||''}</div>
      <div class="tep-actions">
        <button class="tep-pick-btn" onclick="event.stopPropagation();pickChampion('${ne}')">Pick as champion →</button>
        <button class="tep-profile-btn" onclick="event.stopPropagation();openPanel('${ne}',${team.seed||9},'')">Full profile</button>
      </div>
    </div>` : '';
    return `<div class="team-row-wrap">
      <div class="team-row${isPick?' picked':''}${elim?' eliminated':''}${isKnown?' clickable':''}${isExp&&!isPick?' expanded':''}"
        onclick="expandTeam('${ne}','champ','champ',0,${team.seed||9},'')">
        <div class="seed s${Math.min(team.seed||9,4)}">${team.seed}</div>
        <div class="team-name">${team.name}</div>
        <div class="vibe-badge ${vc.cls}">${vc.label}</div>
        ${isPick?'<div class="pick-check">✓</div>':''}
        ${!isPick&&!elim?`<div class="expand-hint">${isExp?'▲':'▼'}</div>`:''}
      </div>${expandPreview}
    </div>`;
  };

  let winnerHTML = '';
  if (champ) {
    const ct = ff1?.name===champ?ff1:ff2;
    const vc = VIBE_CONFIG[ct?.vibe]||VIBE_CONFIG.dominant;
    winnerHTML = `<div class="champ-winner">
      <div style="font-size:2rem">🏆</div>
      <div class="champ-winner-label">Your National Champion</div>
      <div class="champ-winner-name" style="color:${vc.color}">${champ}</div>
      <div class="vibe-badge ${vc.cls}" style="margin:6px auto 0;display:inline-block">${vc.icon} ${vc.label}</div>
    </div>`;
  }

  return `<div class="ff-container">
    <div class="ff-header">
      <div style="font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;color:var(--gold)">National Championship</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">San Antonio, TX · April 6, 2026</div>
    </div>
    ${winnerHTML}
    <div class="ff-matchups">
      <div class="ff-game matchup${champ?' decided':''}">
        <div class="ff-game-label">Championship Game</div>
        ${makeRow(ff1,!!ff1,0)}
        <div class="vs-divider">vs</div>
        ${makeRow(ff2,!!ff2,1)}
        ${(ff1&&ff2)?renderMatchupContext(ff1,ff2):''}
      </div>
    </div>
  </div>`;
}

// ── MY BRACKET VIEW ────────────────────────
function renderMyBracket() {
  const watchRecs = WATCH_ON ? getWatchRecommendations('r64') : new Set();
  const totalPicks = ['r64','r32','s16','e8'].reduce((s,rk)=>s+countPicks(rk),0)+countPicks('ff')+countPicks('champ');

  // Returns HTML for a single team slot in the printable bracket
  const slot = (team, isPick, isElim, canPick, onClickFn) => {
    if (!team) return `<div class="pb-slot pb-tbd"><span class="pb-seed">?</span><span class="pb-name">TBD</span></div>`;
    const vc = VIBE_CONFIG[team.vibe]||VIBE_CONFIG.dominant;
    const ne = team.name.replace(/'/g,"\\'");
    return `<div class="pb-slot${isPick?' pb-pick':''}${isElim?' pb-elim':''}${canPick?' pb-clickable':''}"
      ${canPick?`onclick="${onClickFn}"`:''}>
      <span class="pb-seed${team.seed<=4?' pb-seed-hi':''}">${team.seed}</span>
      <span class="pb-name">${team.name}</span>
      <div class="pb-dot" style="background:${vc.color}"></div>
      ${isPick?'<span class="pb-check">✓</span>':''}
    </div>`;
  }

  // Returns HTML for one game (top+bot) with a pick line between
  const game = (top, bot, picked, onPickTop, onPickBot, isWatch) => {
    const topPick = picked && top && picked===top.name;
    const botPick = picked && bot && picked===bot.name;
    const both = top && bot;
    return `<div class="pb-game${isWatch?' pb-watch':''}${picked?' pb-decided':''}">
      ${slot(top, topPick, picked&&!topPick, both&&!topPick, onPickTop)}
      <div class="pb-mid"></div>
      ${slot(bot, botPick, picked&&!botPick, both&&!botPick, onPickBot)}
    </div>`;
  }

  // Build one region's columns: R64 (8 games) → R32 (4) → S16 (2) → E8 (1)
  const regionCols = (regionKey) => {
    const rounds = ['r64','r32','s16','e8'];
    return rounds.map(roundKey => {
      const matchups = getMatchupsForRound(regionKey, roundKey);
      const picks = PICKS[regionKey][roundKey]||[];
      const watchSet = WATCH_ON ? getWatchRecommendations(roundKey) : new Set();
      const gamesHtml = matchups.map((m, i) => {
        const gameKey = `${regionKey}-${roundKey}-${i}`;
        const isWatch = watchSet.has(gameKey);
        const top = m.top||null, bot = m.bot||null;
        const topNe = top ? top.name.replace(/'/g,"\\'") : '';
        const botNe = bot ? bot.name.replace(/'/g,"\\'") : '';
        return game(top, bot, picks[i],
          `pickWinner('${regionKey}','${roundKey}',${i},'${topNe}')`,
          `pickWinner('${regionKey}','${roundKey}',${i},'${botNe}')`,
          isWatch
        );
      }).join('');
      return `<div class="pb-col" data-round="${roundKey}">${gamesHtml}</div>`;
    });
  }

  // Champion center slot
  const ff1=getFFWinner(0), ff2=getFFWinner(1);
  const champ = PICKS.champ;
  const champVc = champ ? (VIBE_CONFIG[BRACKET_VIBES[champ]||'dominant']||VIBE_CONFIG.dominant) : null;

  const ff1Ne = ff1 ? ff1.name.replace(/'/g,"\\'") : '';
  const ff2Ne = ff2 ? ff2.name.replace(/'/g,"\\'") : '';

  // FF game 0: East vs South (left half)
  const ffm0 = getFFMatchup(0);
  const ffPick0 = PICKS.ff['game0'];
  const ff0Top = ffm0.top, ff0Bot = ffm0.bot;
  const ff0TopNe = ff0Top ? ff0Top.name.replace(/'/g,"\\'") : '';
  const ff0BotNe = ff0Bot ? ff0Bot.name.replace(/'/g,"\\'") : '';

  // FF game 1: Midwest vs West (right half)
  const ffm1 = getFFMatchup(1);
  const ffPick1 = PICKS.ff['game1'];
  const ff1Top = ffm1.top, ff1Bot = ffm1.bot;
  const ff1TopNe = ff1Top ? ff1Top.name.replace(/'/g,"\\'") : '';
  const ff1BotNe = ff1Bot ? ff1Bot.name.replace(/'/g,"\\'") : '';

  const ffGame0Html = game(ff0Top, ff0Bot, ffPick0,
    `pickFFWinner(0,'${ff0TopNe}')`, `pickFFWinner(0,'${ff0BotNe}')`,
    WATCH_ON && getWatchRecommendations('ff').has('ff-0')
  );
  const ffGame1Html = game(ff1Top, ff1Bot, ffPick1,
    `pickFFWinner(1,'${ff1TopNe}')`, `pickFFWinner(1,'${ff1BotNe}')`,
    WATCH_ON && getWatchRecommendations('ff').has('ff-1')
  );

  const champTopNe = ff1 ? ff1.name.replace(/'/g,"\\'") : '';
  const champBotNe = ff2 ? ff2.name.replace(/'/g,"\\'") : '';

  const eastCols  = regionCols('east');
  const southCols = regionCols('south');
  const midCols   = regionCols('midwest');
  const westCols  = regionCols('west');

  return `<div class="pb-wrap">
    <div class="pb-header">
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;letter-spacing:-0.02em;color:var(--gold)">My Bracket</div>
      <div style="font-size:11px;color:var(--text-muted)">${totalPicks}/63 picks · click any game to pick a winner</div>
    </div>

    <div class="pb-bracket">

      <!-- LEFT HALF: East (top) + South (bottom) reading left→right toward center -->
      <div class="pb-half pb-half-left">

        <!-- EAST region label + rounds L→R -->
        <div class="pb-region-block">
          <div class="pb-region-label" style="color:${REGION_HEX.east}">East</div>
          <div class="pb-region-cols">
            ${eastCols[0]}${eastCols[1]}${eastCols[2]}${eastCols[3]}
          </div>
        </div>

        <!-- FF Game 0: East champ vs South champ -->
        <div class="pb-ff-col">
          <div class="pb-ff-label">Final Four</div>
          ${ffGame0Html}
          <div class="pb-ff-winner-arrow">→ Final</div>
        </div>

        <!-- SOUTH region rounds R→L (reversed so games flow toward center) -->
        <div class="pb-region-block pb-region-flipped">
          <div class="pb-region-label" style="color:${REGION_HEX.south}">South</div>
          <div class="pb-region-cols">
            ${southCols[3]}${southCols[2]}${southCols[1]}${southCols[0]}
          </div>
        </div>

      </div>

      <!-- CENTER: Championship -->
      <div class="pb-center">
        <div class="pb-center-label">🏆 Championship</div>
        <div class="pb-champ-game">
          ${ff1
            ? `<div class="pb-slot${champ===ff1.name?' pb-pick':''}${champ&&champ!==ff1.name?' pb-elim':''}${ff1&&ff2&&!champ?' pb-clickable':''}"
                ${ff1&&ff2&&!champ?`onclick="pickChampion('${ff1.name.replace(/'/g,"\\'")}')"`:''}
                style="border-left:3px solid ${REGION_HEX[FF_MATCHUPS[0].r1]}">
                <span class="pb-seed pb-seed-hi">${ff1.seed}</span>
                <span class="pb-name">${ff1.name}</span>
                <div class="pb-dot" style="background:${(VIBE_CONFIG[ff1.vibe]||VIBE_CONFIG.dominant).color}"></div>
                ${champ===ff1.name?'<span class="pb-check">✓</span>':''}
              </div>`
            : `<div class="pb-slot pb-tbd" style="border-left:3px solid ${REGION_HEX[FF_MATCHUPS[0].r1]}"><span class="pb-name" style="color:var(--text-dim)">East/South TBD</span></div>`
          }
          <div class="pb-champ-vs">vs</div>
          ${ff2
            ? `<div class="pb-slot${champ===ff2.name?' pb-pick':''}${champ&&champ!==ff2.name?' pb-elim':''}${ff1&&ff2&&!champ?' pb-clickable':''}"
                ${ff1&&ff2&&!champ?`onclick="pickChampion('${ff2.name.replace(/'/g,"\\'")}')"`:''}
                style="border-left:3px solid ${REGION_HEX[FF_MATCHUPS[1].r1]}">
                <span class="pb-seed pb-seed-hi">${ff2.seed}</span>
                <span class="pb-name">${ff2.name}</span>
                <div class="pb-dot" style="background:${(VIBE_CONFIG[ff2.vibe]||VIBE_CONFIG.dominant).color}"></div>
                ${champ===ff2.name?'<span class="pb-check">✓</span>':''}
              </div>`
            : `<div class="pb-slot pb-tbd" style="border-left:3px solid ${REGION_HEX[FF_MATCHUPS[1].r1]}"><span class="pb-name" style="color:var(--text-dim)">Midwest/West TBD</span></div>`
          }
        </div>
        ${champ && champVc ? `<div class="pb-champ-winner">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Your Champion</div>
          <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;color:${champVc.color};letter-spacing:-0.02em">${champ}</div>
          <div class="vibe-badge ${champVc.cls}" style="margin-top:6px;display:inline-block">${champVc.icon} ${champVc.label}</div>
        </div>` : `<div style="font-size:10px;color:var(--text-dim);text-align:center;margin-top:8px">Pick Final Four winners<br>to set your champion</div>`}
      </div>

      <!-- RIGHT HALF: Midwest (top) + West (bottom) reading right→left toward center -->
      <div class="pb-half pb-half-right">

        <!-- MIDWEST rounds R→L (E8 first, closest to center) -->
        <div class="pb-region-block pb-region-flipped">
          <div class="pb-region-label" style="color:${REGION_HEX.midwest}">Midwest</div>
          <div class="pb-region-cols">
            ${midCols[3]}${midCols[2]}${midCols[1]}${midCols[0]}
          </div>
        </div>

        <!-- FF Game 1: Midwest champ vs West champ -->
        <div class="pb-ff-col">
          <div class="pb-ff-label">Final Four</div>
          ${ffGame1Html}
          <div class="pb-ff-winner-arrow">← Final</div>
        </div>

        <!-- WEST region L→R (R64 first, reading outward) -->
        <div class="pb-region-block">
          <div class="pb-region-label" style="color:${REGION_HEX.west}">West</div>
          <div class="pb-region-cols">
            ${westCols[0]}${westCols[1]}${westCols[2]}${westCols[3]}
          </div>
        </div>

      </div>

    </div><!-- pb-bracket -->
  </div><!-- pb-wrap -->`;
}

// ── PANEL ──────────────────────────────────
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
      if (m.hot && m.hotReason && (m.top.name===teamName||m.bot.name===teamName))
        return m.hotReason;
    }
  }
  return null;
}

let panelCache = {};

function openPanel(teamName, seed, record) {
  if (!teamName||teamName==='TBD') return;
  document.getElementById('panel-name').textContent = teamName;
  document.getElementById('panel-seed').textContent = '#'+seed;
  document.getElementById('panel-record').textContent = record||'';
  document.getElementById('panel-overlay').classList.add('open');
  const body = document.getElementById('panel-body');
  if (panelCache[teamName]) { renderPanelContent(body, panelCache[teamName], teamName); return; }
  const sd = TEAM_DATA[teamName];
  if (sd) {
    const locked = Object.assign({}, sd, { vibe: BRACKET_VIBES[teamName]||sd.vibe });
    panelCache[teamName] = { data: locked };
    renderPanelContent(body, panelCache[teamName], teamName);
    return;
  }
  const fv = BRACKET_VIBES[teamName]||'iceberg';
  panelCache[teamName] = { data:{ vibe:fv, vibeDesc:'Tournament-qualified team.', strengths:[], weaknesses:[], stats:[], players:[], ceiling:'Round of 32' } };
  renderPanelContent(body, panelCache[teamName], teamName);
}

function renderPanelContent(body, cached, teamName) {
  const d = cached.data;
  const lv = BRACKET_VIBES[teamName]||d.vibe||'dominant';
  const vc = VIBE_CONFIG[lv]||VIBE_CONFIG.dominant;
  const hotR = getHotReason(teamName);
  const hotBanner = hotR ? `<div class="info-section"><div class="section-label">Why this first round game is a banger</div><div class="hot-banner"><div style="font-size:11px;line-height:1.6;color:var(--text-muted)">${hotR}</div></div></div>` : '';
  const statsHTML = d.stats?.length ? `<div class="info-section"><div class="section-label">Key stats</div><div class="stats-grid">${d.stats.map(s=>`<div class="stat-card"><div class="stat-val">${s.val}</div><div class="stat-label">${s.lbl}</div></div>`).join('')}</div></div>` : '';
  const playersHTML = d.players?.length ? `<div class="info-section"><div class="section-label">Players to watch</div><div class="players-list">${d.players.map(p=>{const i=p.name.split(' ').map(w=>w[0]).join('').slice(0,2);return`<div class="player-row"><div class="player-avatar">${i}</div><div class="player-name">${p.name}</div><div class="player-stat">${p.stat}</div></div>`;}).join('')}</div></div>` : '';
  const strengthsHTML = d.strengths?.length ? `<div class="info-section"><div class="section-label">Strengths</div><div class="chip-list">${d.strengths.map(s=>`<div class="chip strength">${s}</div>`).join('')}</div></div>` : '';
  const weaknessesHTML = d.weaknesses?.length ? `<div class="info-section"><div class="section-label">Weaknesses</div><div class="chip-list">${d.weaknesses.map(w=>`<div class="chip weakness">${w}</div>`).join('')}</div></div>` : '';
  body.innerHTML = `
    <div class="vibe-section" style="background:${vc.bg};border:1px solid ${vc.color}22;">
      <div class="vibe-icon">${vc.icon}</div>
      <div><div class="vibe-label-big" style="color:${vc.color}">${vc.label}</div>
      <div class="vibe-desc" style="color:var(--text-muted)">${d.vibeDesc||''}</div></div>
    </div>
    ${hotBanner}${statsHTML}${strengthsHTML}${weaknessesHTML}${playersHTML}
    ${d.ceiling?`<div class="info-section"><div class="section-label">Tournament ceiling</div><div class="section-content" style="font-weight:500">${d.ceiling}</div></div>`:''}`;
}

function closePanel(e) {
  if (e&&e.target!==document.getElementById('panel-overlay')) return;
  document.getElementById('panel-overlay').classList.remove('open');
}
document.addEventListener('keydown', e => {
  if (e.key==='Escape') document.getElementById('panel-overlay').classList.remove('open');
});

initState();
renderAll();
