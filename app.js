import {
  DONE, FAIL, SKIP, dkey, parseKey, addDays, weekday, startOfWeek,
  isScheduled, statusOf, currentStreak, bestStreak, successRate, dayProgress,
  groupStatus, groupStreak, PARTIAL,
  CHECK, COUNT, QUIT, kindOf, isWeekly, valueOf, statusFor, statusForValue, weekDone, atRisk, weekReview,
} from './logic.js';

// ---------- Données ----------

const STORE_KEY = 'rituels:v1';

const COLORS = ['#1D9E75', '#7F77DD', '#D85A30', '#378ADD', '#D4537E', '#BA7517', '#639922', '#888780'];

const ICONS = {
  check: 'M5 12l5 5 9-10',
  drop: 'M12 3c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z',
  book: 'M4 19V5a2 2 0 0 1 2-2h13v14H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13v-4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  weight: 'M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12',
  leaf: 'M5 19C5 10 11 5 19 5c0 8-5 14-14 14zm0 0l7-7',
  pen: 'M4 20l4-1L19 8l-3-3L5 16l-1 4z',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
  smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 14c1.6 1.6 4.4 1.6 6 0M9 9.5h.01M15 9.5h.01',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  cup: 'M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8zM16 10h2a2 2 0 0 1 0 4h-2',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  quote: 'M6 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6',
};

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Émojis proposés dans le choix d'icône (n'importe quel autre peut être tapé).
const EMOJIS = ['✅', '💧', '📚', '🧘', '🏃', '🏋️', '🚴', '🥗',
  '🍎', '😴', '🌙', '☀️', '✍️', '💬', '🎯', '🧠',
  '💊', '🚭', '📵', '🎸', '🧹', '💰', '🙏', '❤️'];

// Anciennes icônes dessinées -> émoji (pour les données déjà enregistrées).
const OLD_ICON_EMOJI = {
  check: '✅', drop: '💧', book: '📚', moon: '🌙', sun: '☀️', heart: '❤️', weight: '🏋️', leaf: '🧘',
  pen: '✍️', bolt: '🏃', smile: '🙂', phone: '📵', cup: '☕', star: '⭐', eye: '🌈', quote: '💬',
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyData() {
  return { version: 1, habits: [], log: {}, moods: {} };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyData();
    const data = JSON.parse(raw);
    if (!Array.isArray(data.habits) || typeof data.log !== 'object') return emptyData();
    for (const h of data.habits) {
      if (OLD_ICON_EMOJI[h.icon]) h.icon = OLD_ICON_EMOJI[h.icon];
    }
    data.moods ||= {};
    return data;
  } catch {
    return emptyData();
  }
}

let data = load();

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    toast("Impossible d'enregistrer sur cet appareil");
  }
}

function activeHabits() {
  return data.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
}

// Une entrée du journal : { s: statut, v: valeur chiffrée, note }.
function updateEntry(h, key, patch) {
  const day = data.log[key] || (data.log[key] = {});
  const e = { s: null, note: '', ...day[h.id], ...patch };
  if (!e.s && !e.note && !e.v) delete day[h.id];
  else day[h.id] = e;
  if (!Object.keys(day).length) delete data.log[key];
  save();
}

function setStatus(h, key, s) {
  const patch = { s: s || null };
  if (kindOf(h) === COUNT) {
    if (s === DONE) patch.v = Math.max(valueOf(data.log, h, key), h.target || 1);
    if (!s) patch.v = 0;
  }
  updateEntry(h, key, patch);
}

function setNote(h, key, note) {
  updateEntry(h, key, { note });
}

function setValue(h, key, v) {
  const val = Math.max(0, Math.round(v * 100) / 100);
  updateEntry(h, key, { v: val, s: statusForValue(h, val, statusOf(data.log, h, key)) });
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

// ---------- État de l'interface ----------

const ui = {
  tab: 'today',
  date: today(),
  reviewWeek: 0, // 0 = semaine en cours, -1 = précédente
};

function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

const $view = document.getElementById('view');
const $sheet = document.getElementById('sheet');
const $sheetBody = document.getElementById('sheet-body');

// ---------- Petits outils d'affichage ----------

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function icon(name, cls = 'ic') {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ICONS.check}"/></svg>`;
}

function emo(e, cls = '') {
  return `<span class="emo ${cls}" aria-hidden="true">${esc(e || '✅')}</span>`;
}

// Dernière valeur affichée de chaque anneau ou barre, pour animer le passage à la nouvelle.
const lastShown = new Map();

function fromTo(key, now) {
  if (!key) return [now, now];
  const prev = lastShown.has(key) ? lastShown.get(key) : 0;
  lastShown.set(key, now);
  return [prev, now];
}

// key : si fourni, l'anneau se remplit depuis sa valeur précédente.
function ring(done, total, size, stroke, color = 'var(--accent)', key = '') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [from, pct] = fromTo(key, total ? done / total : 0);
  const arc = (p) => (p * c).toFixed(2);
  const hl = (p) => Math.max(0, p * c - stroke).toFixed(2);
  const anim = from !== pct;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="${stroke}"/>
    <circle class="arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${arc(from)} ${c.toFixed(2)}"${anim ? ` data-to="${arc(pct)} ${c.toFixed(2)}"` : ''}
      transform="rotate(-90 ${size / 2} ${size / 2})" style="${from || pct ? '' : 'opacity:0'}"${!pct ? ' data-hide="1"' : ''}/>
    <circle class="ring-hl arc" cx="${size / 2}" cy="${size / 2}" r="${r - stroke * 0.18}" fill="none" stroke="#fff"
      stroke-width="${(stroke * 0.28).toFixed(1)}" stroke-linecap="round"
      stroke-dasharray="${hl(from)} ${c.toFixed(2)}"${anim ? ` data-to="${hl(pct)} ${c.toFixed(2)}"` : ''} stroke-dashoffset="${(-stroke / 2).toFixed(2)}"
      transform="rotate(-90 ${size / 2} ${size / 2})" style="${Math.max(from, pct) * c > stroke ? '' : 'opacity:0'}"${pct * c > stroke ? '' : ' data-hide="1"'}/>
  </svg>`;
}

// Lance les animations préparées (anneaux, barres) juste après l'affichage.
function animateIn() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('[data-to]').forEach((el) => {
      el.setAttribute('stroke-dasharray', el.dataset.to);
      el.removeAttribute('data-to');
    });
    document.querySelectorAll('[data-w]').forEach((el) => {
      el.style.width = el.dataset.w;
      el.removeAttribute('data-w');
    });
    // Un anneau qui revient à zéro disparaît une fois l'animation finie (pas de point rond).
    setTimeout(() => document.querySelectorAll('[data-hide]').forEach((el) => { el.style.opacity = '0'; }), 650);
  }));
}

// Petit rebond sur l'élément qui vient de changer.
function pop(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.remove('just');
  void el.offsetWidth;
  el.classList.add('just');
}

// Changement d'écran ou de jour : fondu glissé (View Transitions si le navigateur le permet).
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// "still" : l'écran est installé, les mises à jour sur place ne rejouent pas la cascade d'entrée.
let stillTimer;
function settleSoon() {
  clearTimeout(stillTimer);
  stillTimer = setTimeout(() => $view.classList.add('still'), 600);
}

function swap(fn, dir = 'up') {
  document.documentElement.dataset.vt = dir;
  $view.classList.remove('still');
  settleSoon();
  if (document.startViewTransition && !reducedMotion.matches) {
    document.startViewTransition(fn);
  } else {
    fn();
    if (!reducedMotion.matches) {
      $view.classList.remove('enter');
      void $view.offsetWidth;
      $view.classList.add('enter');
    }
  }
}

function fmtDate(d, opts) {
  return d.toLocaleDateString('fr-FR', opts);
}

function freqLabel(h) {
  if (kindOf(h) === QUIT) return 'À arrêter';
  const goal = kindOf(h) === COUNT ? `Objectif ${fmtNum(h.target)}${h.unit ? ' ' + h.unit : ''} · ` : '';
  if (isWeekly(h)) return `${goal}${h.perWeek} fois par semaine`;
  return goal + daysLabel(h.days);
}

function streakLabel(h, n) {
  if (isWeekly(h)) return n ? `${n} sem. de suite` : 'Pas de série';
  if (kindOf(h) === QUIT) return `${n} j sans`;
  return n ? `${n} j de suite` : 'Pas de série';
}

function daysLabel(days) {
  if (days.length === 7) return 'Tous les jours';
  if (days.join() === '0,1,2,3,4') return 'En semaine';
  if (days.join() === '5,6') return 'Le week-end';
  return days.map((i) => ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'][i]).join(', ');
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Écran 1 : Aujourd'hui ----------

function renderToday() {
  const t = today();
  const sel = ui.date;
  const key = dkey(sel);
  const isToday = key === dkey(t);
  const habits = activeHabits().filter((h) => isScheduled(h, sel));
  const { done, total } = dayProgress(data.habits, data.log, sel);

  const ws = startOfWeek(sel);
  const canNext = dkey(addDays(ws, 7)) <= dkey(t);
  let strip = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    const k = dkey(d);
    const future = k > dkey(t);
    const p = dayProgress(data.habits, data.log, d);
    strip += `<button class="day${k === key ? ' sel' : ''}" data-act="pick-day" data-key="${k}" ${future ? 'disabled' : ''}>
      <span class="day-l">${DAY_LETTERS[i]}</span>
      <span class="day-ring">${ring(p.done, p.total, 30, 3.5, undefined, 'day-' + k)}<span>${d.getDate()}</span></span>
    </button>`;
  }

  let msg;
  if (!total) msg = habits.length ? 'Tout est sauté pour ce jour' : 'Rien de prévu ce jour';
  else if (done === total) msg = 'Journée complète';
  else msg = `Encore ${total - done} à faire`;

  const routines = groupHabits(habits).map(({ name, steps }) => routineCard(name, steps, sel, isToday)).join('');
  const loose = habits.filter((h) => !h.group);
  const tiles = loose.map((h) => tileHtml(h, sel)).join('');

  const empty = !activeHabits().length
    ? `<div class="empty">
        <p class="empty-t">Commencez par une habitude</p>
        <p class="muted">Ajoutez ce que vous voulez suivre chaque jour.</p>
        <button class="btn primary" data-act="new-habit">Nouvelle habitude</button>
        <button class="btn" data-act="seed">Essayer avec des exemples</button>
      </div>`
    : '';

  $view.innerHTML = `
    <header class="head">
      <p class="eyebrow">${isToday ? fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Jour passé'}</p>
      <h1>${isToday ? "Aujourd'hui" : fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
    </header>
    <div class="week">
      <button class="nav" data-act="week" data-dir="-1" aria-label="Semaine précédente">‹</button>
      <div class="days">${strip}</div>
      <button class="nav" data-act="week" data-dir="1" aria-label="Semaine suivante" ${canNext ? '' : 'disabled'}>›</button>
    </div>
    ${empty || `
    <section class="hero">
      <div class="hero-ring">${ring(done, total, 168, 16, undefined, 'hero-' + key)}
        <div class="hero-txt"><strong>${done}/${total}</strong><span>${msg}</span></div>
      </div>
    </section>
    ${isToday ? dangerBanner() + reviewBanner() : ''}
    <p class="hint">Touchez pour cocher. ••• pour « pas fait », « sauté » ou une note.</p>
    ${routines}
    ${loose.length ? `${routines ? '<h3 class="sec">Autres habitudes</h3>' : ''}<section class="tiles">${tiles}</section>` : ''}
    ${habits.length ? '' : '<p class="muted center">Aucune habitude prévue ce jour.</p>'}
    ${moodRow(key)}`}
  `;
}

function barHtml(k, pct) {
  const [from, to] = fromTo(k, pct);
  const w = (x) => `${(x * 100).toFixed(0)}%`;
  return `<span class="bar"><span style="width:${w(from)}"${from !== to ? ` data-w="${w(to)}"` : ''}></span></span>`;
}

function tileHtml(h, d) {
  const key = dkey(d);
  const t = today();
  const kind = kindOf(h);
  const s = statusFor(h, data.log, key);
  const note = data.log[key]?.[h.id]?.note;
  const streak = currentStreak(h, data.log, t);
  const weekly = isWeekly(h);
  const wd = weekly ? weekDone(h, data.log, d) : 0;
  const met = weekly && s !== DONE && wd >= h.perWeek;
  const noteTag = note ? ' · note' : '';

  if (kind === QUIT) {
    const slip = s === FAIL;
    return `<div class="tile quit ${slip ? 'fail' : 'held'}" data-tile="${h.id}" style="--c:${h.color}">
      <button class="tile-main" data-act="day-sheet" data-id="${h.id}" aria-label="${esc(h.name)}">
        <span class="tile-top">${emo(h.icon)}<span class="badge">${slip ? 'Écart' : 'Tenu'}</span></span>
        <span class="tile-name">${esc(h.name)}</span>
        <span class="tile-big">${streak} <small>j sans</small></span>
      </button>
      <button class="tile-more" data-act="day-sheet" data-id="${h.id}" aria-label="Plus d'options">•••</button>
    </div>`;
  }

  if (kind === COUNT) {
    const v = valueOf(data.log, h, key);
    const pct = Math.min(1, v / (h.target || 1));
    const badge = s === DONE ? 'Fait' : s === FAIL ? 'Pas fait' : s === SKIP ? 'Sauté' : met ? 'Objectif atteint' : '';
    return `<div class="tile count ${s || (v ? 'part' : 'todo')}${met ? ' met' : ''}" data-tile="${h.id}" style="--c:${h.color}">
      <button class="tile-main" data-act="plus" data-id="${h.id}" aria-label="Ajouter ${fmtNum(h.step || 1)} à ${esc(h.name)}">
        <span class="tile-top">${emo(h.icon)}${badge ? `<span class="badge">${badge}</span>` : ''}</span>
        <span class="tile-name">${esc(h.name)}</span>
        <span class="tile-sub">${fmtNum(v)} / ${fmtNum(h.target)} ${esc(h.unit || '')}${weekly ? ` · ${wd}/${h.perWeek} sem.` : ''}${noteTag}</span>
        ${barHtml('bar-' + h.id + key, pct)}
      </button>
      <button class="tile-more" data-act="day-sheet" data-id="${h.id}" aria-label="Plus d'options">•••</button>
      ${v > 0 ? `<button class="tile-minus" data-act="minus" data-id="${h.id}" aria-label="Retirer ${fmtNum(h.step || 1)}">−</button>` : ''}
    </div>`;
  }

  const badge = s === DONE ? 'Fait' : s === FAIL ? 'Pas fait' : s === SKIP ? 'Sauté' : met ? 'Objectif atteint' : '';
  const sub = weekly ? `${wd}/${h.perWeek} cette semaine` : streakLabel(h, streak);
  return `<div class="tile ${s || 'todo'}${met ? ' met' : ''}" data-tile="${h.id}" style="--c:${h.color}">
    <button class="tile-main" data-act="toggle" data-id="${h.id}" aria-label="${esc(h.name)} : ${badge || 'à faire'}">
      <span class="tile-top">${emo(h.icon)}${badge ? `<span class="badge">${badge}</span>` : ''}</span>
      <span class="tile-name">${esc(h.name)}</span>
      <span class="tile-sub">${sub}${noteTag}</span>
    </button>
    <button class="tile-more" data-act="day-sheet" data-id="${h.id}" aria-label="Plus d'options">•••</button>
  </div>`;
}

// Série en danger : affichée à partir de 18 h pour les séries quotidiennes,
// à tout moment quand un objectif hebdomadaire devient juste.
function dangerBanner() {
  const late = new Date().getHours() >= 18;
  const list = atRisk(activeHabits(), data.log, today()).filter((x) => x.need || late);
  if (!list.length) return '';
  const items = list.map(({ h, streak, need, left }) => need
    ? `<li>${emo(h.icon, 'sm')} <strong>${esc(h.name)}</strong> : encore ${need} fois, il reste ${left} jour${left > 1 ? 's' : ''}</li>`
    : `<li>${emo(h.icon, 'sm')} <strong>${esc(h.name)}</strong> : ${streak} j de suite à garder</li>`).join('');
  return `<section class="banner danger"><p class="banner-t">Série en danger</p><ul>${items}</ul></section>`;
}

// Le dimanche, rappel que le bilan de la semaine est prêt.
function reviewBanner() {
  if (weekday(today()) !== 6) return '';
  return `<button class="banner review" data-act="open-review"><span class="banner-t">Votre bilan de la semaine est prêt</span><span class="muted small">Voir le bilan ›</span></button>`;
}

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

function moodRow(key) {
  const cur = data.moods[key];
  return `<section class="mood">
    <p class="mood-t">Humeur du jour</p>
    <div class="mood-row">${MOODS.map((m, i) => `<button class="mood-b${cur === i + 1 ? ' on' : ''}" data-act="mood" data-m="${i + 1}" aria-label="Humeur ${i + 1} sur 5">${emo(m)}</button>`).join('')}</div>
  </section>`;
}

// Petite fête quand la journée devient complète.
function celebrate() {
  if (navigator.vibrate) navigator.vibrate([20, 40, 20, 40, 60]);
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#D4537E', '#EF9F27'];
  for (let i = 0; i < 48; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.3}s`;
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 160}px`);
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2200);
  toast('Journée complète, bravo');
}

// Lance la fête si l'action a fait passer la journée à complète.
function withCelebration(fn) {
  const d = ui.date;
  const before = dayProgress(data.habits, data.log, d);
  fn();
  const after = dayProgress(data.habits, data.log, d);
  const complete = (p) => p.total > 0 && p.done === p.total;
  if (dkey(d) === dkey(today()) && complete(after) && !complete(before)) celebrate();
}

// Regroupe les habitudes d'une même routine, dans l'ordre d'affichage.
function groupHabits(list) {
  const map = new Map();
  for (const h of list) {
    if (!h.group) continue;
    if (!map.has(h.group)) map.set(h.group, []);
    map.get(h.group).push(h);
  }
  return [...map].map(([name, steps]) => ({ name, steps }));
}

function routineCard(name, steps, d, isToday) {
  const key = dkey(d);
  const st = steps.map((h) => statusFor(h, data.log, key));
  const counted = st.filter((s) => s !== SKIP).length;
  const done = st.filter((s) => s === DONE).length;
  const mins = steps.reduce((a, h) => a + (h.minutes || 0), 0);
  const left = st.some((s) => !s);
  const streak = groupStreak(activeHabits().filter((h) => h.group === name), data.log, today());
  const rows = steps.map((h, i) => {
    const s = st[i];
    const mark = s === DONE ? icon('check', 'ic sm') : s === FAIL ? '✕' : s === SKIP ? '–' : '';
    return `<div class="step ${s || 'todo'}" data-tile="${h.id}">
      <button class="step-main" data-act="toggle" data-id="${h.id}">
        <span class="chk">${mark}</span>${emo(h.icon, 'sm')}<span class="step-name">${esc(h.name)}</span>
        ${h.minutes ? `<span class="step-min">${h.minutes} min</span>` : ''}
      </button>
      <button class="step-more" data-act="day-sheet" data-id="${h.id}" aria-label="Plus d'options">•••</button>
    </div>`;
  }).join('');
  return `<section class="routine" style="--c:${steps[0].color}">
    <div class="r-head">
      <div class="r-ring">${ring(done, counted, 52, 6, 'var(--c)', 'r-' + name + key)}<span>${done}/${counted}</span></div>
      <div class="r-title"><h2>${esc(name)}</h2>
        <p>${mins ? `${mins} min · ` : ''}${streak ? `${streak} j complets de suite` : 'Pas encore de série'}</p></div>
    </div>
    <div class="r-steps">${rows}</div>
    ${isToday && left ? `<button class="btn r-start" data-act="start-routine" data-g="${esc(name)}">${done ? 'Reprendre' : 'Commencer'} la routine</button>` : ''}
  </section>`;
}

// ---------- Routine guidée (minuteur étape par étape) ----------

let run = null;
let runTimer = null;
let wakeLock = null;

function runSteps() {
  const t = today();
  return activeHabits().filter((h) => h.group === run.g && isScheduled(h, t));
}

function nextTodo(steps, from) {
  const key = dkey(today());
  for (let n = 1; n <= steps.length; n++) {
    const i = (from + n) % steps.length;
    if (!statusOf(data.log, steps[i], key)) return i;
  }
  return -1;
}

function loadStep(idx) {
  const h = runSteps()[idx];
  const total = Math.max(1, h.minutes || 5) * 60;
  run.idx = idx;
  run.total = total;
  run.left = total;
  run.endAt = Date.now() + total * 1000;
  run.paused = false;
  run.rang = false;
  run.editItems = false;
  run.breathStart = Date.now();
}

async function startRoutine(g) {
  run = { g };
  const steps = runSteps();
  const first = nextTodo(steps, -1);
  if (first < 0) { run = null; toast('Routine déjà terminée'); return; }
  loadStep(first);
  drawRun();
  openSheet();
  clearInterval(runTimer);
  runTimer = setInterval(tickRun, 250);
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}

function stopRun() {
  clearInterval(runTimer);
  runTimer = null;
  run = null;
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

function secondsLeft() {
  return run.paused ? run.left : Math.max(0, (run.endAt - Date.now()) / 1000);
}

function fmtTime(sec) {
  const s = Math.ceil(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const RUN_R = 92;
const RUN_C = 2 * Math.PI * RUN_R;

function drawRun() {
  const steps = runSteps();
  if (run.finished) {
    $sheetBody.innerHTML = `<div class="run done-run" style="--c:${steps[0]?.color || 'var(--accent)'}">
      ${emo('☀️', 'huge')}
      <h2>${esc(run.g)} terminé</h2>
      <p class="muted">Belle façon de commencer la journée.</p>
      <button class="btn primary full" data-act="run-close" autofocus>Fermer</button>
    </div>`;
    return;
  }
  const h = steps[run.idx];
  const dots = steps.map((x, i) => {
    const s = statusOf(data.log, x, dkey(today()));
    return `<span class="dot${i === run.idx ? ' cur' : ''}${s === DONE ? ' ok' : ''}"></span>`;
  }).join('');
  $sheetBody.innerHTML = `<div class="run" style="--c:${h.color}">
    <div class="run-top"><span class="muted small">${esc(run.g)} · étape ${run.idx + 1}/${steps.length}</span>
      <button class="x" data-act="run-close" aria-label="Fermer" autofocus>✕</button></div>
    <div class="dots">${dots}</div>
    <div class="run-ring">
      <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="${RUN_R}" fill="none" stroke="var(--ring-track)" stroke-width="10"/>
        <circle id="run-arc" cx="100" cy="100" r="${RUN_R}" fill="none" stroke="var(--c)" stroke-width="10"
          stroke-linecap="round" stroke-dasharray="0 ${RUN_C}" transform="rotate(-90 100 100)"/>
      </svg>
      <div class="run-mid">${emo(h.icon, 'big')}<strong id="run-time">${fmtTime(secondsLeft())}</strong></div>
    </div>
    <h2 class="run-name">${esc(h.name)}</h2>
    ${h.breath ? `<div class="breath"><span id="breath-dot"></span><em id="breath-txt">Inspirez</em></div>` : ''}
    ${h.guide ? `<p class="guide">${esc(h.guide)}</p>` : ''}
    ${itemsBlock(h)}
    ${h.journal ? `<label class="field run-field"><span>${esc(h.journalLabel || 'Note du jour')}</span>
      <textarea id="run-note" rows="5" placeholder="${esc(h.journalHint || '')}">${esc(data.log[dkey(today())]?.[h.id]?.note || '')}</textarea></label>` : ''}
    <button class="btn primary full" data-act="run-done">Étape terminée</button>
    <div class="two">
      <button class="btn" data-act="run-pause" id="run-pause">${run.paused ? 'Reprendre' : 'Pause'}</button>
      <button class="btn" data-act="run-next">Plus tard</button>
    </div>
  </div>`;
  tickRun();
}

function itemsBlock(h) {
  const label = h.itemsLabel || 'ma liste';
  const items = h.items || [];
  if (run.editItems) {
    return `<label class="field run-field"><span>Modifier ${esc(label)} (une ligne par élément)</span>
      <textarea id="run-items" rows="6">${esc(items.join('\n'))}</textarea></label>
      <button class="btn full" data-act="run-save-items">Enregistrer</button>`;
  }
  if (!items.length) {
    return h.itemsLabel ? `<button class="link" data-act="run-edit-items">Écrire ${esc(label)}</button>` : '';
  }
  return `<ol class="items">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    <button class="link" data-act="run-edit-items">Modifier ${esc(label)}</button>`;
}

const BREATH = ['Inspirez', 'Retenez', 'Expirez', 'Retenez'];

function tickBreath() {
  const dot = document.getElementById('breath-dot');
  if (!dot) return;
  const t = ((Date.now() - run.breathStart) / 1000) % 16;
  const phase = Math.floor(t / 4);
  const p = (t % 4) / 4;
  const scale = phase === 0 ? 0.55 + 0.45 * p : phase === 1 ? 1 : phase === 2 ? 1 - 0.45 * p : 0.55;
  dot.style.transform = `scale(${scale.toFixed(3)})`;
  document.getElementById('breath-txt').textContent = BREATH[phase];
}

function tickRun() {
  if (run && !run.finished) tickBreath();
  if (!run || run.finished) return;
  const left = secondsLeft();
  const el = document.getElementById('run-time');
  const arc = document.getElementById('run-arc');
  if (el) el.textContent = left > 0 ? fmtTime(left) : 'Temps écoulé';
  if (arc) {
    const done = ((run.total - left) / run.total) * RUN_C;
    arc.setAttribute('stroke-dasharray', `${done.toFixed(1)} ${RUN_C.toFixed(1)}`);
    // Pas de point rond tant que le temps n'a presque pas avancé.
    arc.style.opacity = done < 10 ? '0' : '1';
  }
  if (left <= 0 && !run.rang) {
    run.rang = true;
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
}

function openDaySheet(h) {
  const key = dkey(ui.date);
  const kind = kindOf(h);
  const s = statusOf(data.log, h, key);
  const note = data.log[key]?.[h.id]?.note || '';
  const opt = (val, label, on = s === val) => `<button class="seg${on ? ' on' : ''}" data-act="set-status" data-id="${h.id}" data-s="${val || ''}">${label}</button>`;
  let body;
  if (kind === QUIT) {
    body = `<div class="segs two-s">${opt(null, 'Tenu', s !== FAIL)}${opt(FAIL, "J'ai craqué")}</div>
      <p class="muted small">Chaque jour compte comme tenu, sauf si vous notez un écart. Votre compteur repart alors de zéro.</p>`;
  } else {
    const value = kind === COUNT ? `<label class="field"><span>Quantité (${esc(h.unit || 'objectif ' + fmtNum(h.target))})</span>
        <div class="stepper">
          <button class="btn" data-act="minus" data-id="${h.id}" aria-label="Moins">−</button>
          <input id="val" type="number" inputmode="decimal" step="any" min="0" value="${valueOf(data.log, h, key) || ''}" placeholder="0">
          <button class="btn" data-act="plus" data-id="${h.id}" aria-label="Plus">+</button>
        </div></label>` : '';
    body = `${value}<div class="segs">${opt(DONE, 'Fait')}${opt(FAIL, 'Pas fait')}${opt(SKIP, 'Sauté')}${opt(null, 'Effacer')}</div>
      <p class="muted small">« Sauté » ne casse pas votre série (malade, en voyage, jour de repos).</p>`;
  }
  $sheetBody.innerHTML = `
    <div class="sheet-head" style="--c:${h.color}">${emo(h.icon, 'big')}<div><h2>${esc(h.name)}</h2>
      <p class="muted">${fmtDate(ui.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
      <button class="x head-x" data-act="close-sheet" aria-label="Fermer" autofocus>✕</button></div>
    ${body}
    <label class="field"><span>Note du jour</span>
      <textarea id="note" rows="3" placeholder="Comment ça s'est passé ?">${esc(note)}</textarea></label>
    <button class="btn primary full" data-act="save-note" data-id="${h.id}">Enregistrer</button>`;
  openSheet();
}

// ---------- Écran 2 : Calendrier ----------

const WEEKS = 15;
const MIN_WEEKS = 6;

// Nombre de semaines affichées : depuis le début du suivi, entre 6 et 15.
function heatRange(since) {
  const sw = startOfWeek(today());
  const weeks = Math.max(MIN_WEEKS, Math.min(WEEKS, Math.round((sw - startOfWeek(parseKey(since))) / 6048e5) + 1));
  return { start: addDays(sw, -7 * (weeks - 1)), weeks };
}

function routineCalCard(name, steps) {
  const t = today();
  const since = steps.reduce((m, h) => (h.createdAt < m ? h.createdAt : m), '9999-12-31');
  const { start, weeks } = heatRange(since);
  let cells = '';
  let full = 0;
  let counted = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const k = dkey(d);
    let cls = 'off';
    if (k <= dkey(t) && k >= since) {
      const s = groupStatus(steps, data.log, d);
      cls = s === DONE ? 'done' : s === PARTIAL ? 'skip' : s === SKIP ? 'skip' : s === null ? 'rest' : k === dkey(t) ? 'todo' : 'miss';
      if (k > dkey(addDays(t, -30)) && s !== null && s !== SKIP && !(k === dkey(t) && s !== DONE)) {
        counted++;
        if (s === DONE) full++;
      }
    }
    cells += `<span class="cell ${cls}"${cls !== 'off' ? ` data-act="goto" data-key="${k}"` : ''}></span>`;
  }
  return `<article class="card routine-cal" style="--c:${steps[0].color}">
    <div class="card-head">${emo('☀️')}<h2>${esc(name)}</h2></div>
    <div class="stats">
      <div><strong>${groupStreak(steps, data.log, t)} j</strong><span>Complets</span></div>
      <div><strong>${steps.length}</strong><span>Étapes</span></div>
      <div><strong>${counted ? Math.round((full / counted) * 100) + ' %' : '–'}</strong><span>30 jours</span></div>
    </div>
    <div class="heat" style="--w:${weeks}">${cells}</div>
    <p class="muted small cal-note">Plein : routine complète. Clair : en partie.</p>
  </article>`;
}

const WEEKDAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function reviewCard() {
  const t = today();
  const ws = addDays(startOfWeek(t), 7 * ui.reviewWeek);
  const r = weekReview(data.habits, data.log, data.moods, ws, t);
  const label = ui.reviewWeek === 0 ? 'Cette semaine' : 'Semaine dernière';
  const range = `du ${fmtDate(ws, { day: 'numeric', month: 'short' })} au ${fmtDate(addDays(ws, 6), { day: 'numeric', month: 'short' })}`;
  const lines = [];
  if (r.best) lines.push(`<li>${emo(r.best.h.icon, 'sm')} Meilleure série : <strong>${esc(r.best.h.name)}</strong>, ${r.best.streak} ${r.best.weekly ? 'semaine' : 'jour'}${r.best.streak > 1 ? 's' : ''}</li>`);
  if (r.weakest) lines.push(`<li>${emo(r.weakest.h.icon, 'sm')} À relancer : <strong>${esc(r.weakest.h.name)}</strong>, ${r.weakest.done} sur ${r.weakest.total}</li>`);
  if (r.weakDay) lines.push(`<li>📅 Votre jour le plus difficile : <strong>le ${WEEKDAY_NAMES[r.weakDay.day]}</strong> (${Math.round(r.weakDay.rate * 100)} % sur 4 semaines)</li>`);
  if (r.moodAvg) lines.push(`<li>${emo(MOODS[Math.round(r.moodAvg) - 1], 'sm')} Humeur moyenne : <strong>${r.moodAvg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} / 5</strong></li>`);
  if (r.moodLink) lines.push(`<li>💡 Les jours avec <strong>${esc(r.moodLink.h.name)}</strong>, votre humeur est de ${r.moodLink.with.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} contre ${r.moodLink.without.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</li>`);
  return `<article class="card review-card" id="review">
    <div class="review-head">
      <div><h2>Bilan · ${label}</h2><p class="muted small">${range}</p></div>
      <div class="segs two-s mini">
        <button class="seg${ui.reviewWeek === -1 ? ' on' : ''}" data-act="review-week" data-w="-1">Précédente</button>
        <button class="seg${ui.reviewWeek === 0 ? ' on' : ''}" data-act="review-week" data-w="0">En cours</button>
      </div>
    </div>
    <div class="review-main">
      <div class="r-ring big">${ring(r.done, r.total, 72, 8, undefined, 'review' + ui.reviewWeek)}<span>${r.rate === null ? '–' : r.rate + ' %'}</span></div>
      <p>${r.total ? `${r.done} réussites sur ${r.total}` : 'Pas encore de données cette semaine.'}</p>
    </div>
    ${lines.length ? `<ul class="review-list">${lines.join('')}</ul>` : ''}
  </article>`;
}

function renderCalendar() {
  const t = today();
  const habits = activeHabits();
  const routines = groupHabits(habits).map(({ name, steps }) => routineCalCard(name, steps)).join('');

  const cards = habits.map((h) => {
    const { start, weeks } = heatRange(h.createdAt);
    let cells = '';
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i);
      const k = dkey(d);
      let cls = 'off';
      if (k > dkey(t) || k < h.createdAt) cls = 'off';
      else if (!isScheduled({ ...h, archived: false }, d)) cls = 'rest';
      else {
        const s = statusFor(h, data.log, k);
        const part = kindOf(h) === COUNT && valueOf(data.log, h, k) > 0;
        cls = s === DONE ? 'done' : s === SKIP ? 'skip' : s === FAIL ? 'fail' : part ? 'part'
          : k === dkey(t) ? 'todo' : isWeekly(h) ? 'rest' : 'miss';
      }
      const clickable = cls !== 'off';
      cells += `<span class="cell ${cls}"${clickable ? ` data-act="goto" data-key="${k}"` : ''}></span>`;
    }
    const cur = currentStreak(h, data.log, t);
    const best = bestStreak(h, data.log, t);
    const rate = successRate(h, data.log, t, 30);
    const u = isWeekly(h) ? 'sem.' : 'j';
    return `<article class="card" style="--c:${h.color}">
      <div class="card-head">${emo(h.icon)}<h2>${esc(h.name)}</h2><span class="card-sub">${esc(freqLabel(h))}</span></div>
      <div class="stats">
        <div><strong>${cur} ${u}</strong><span>${kindOf(h) === QUIT ? 'Sans écart' : 'Série'}</span></div>
        <div><strong>${best} ${u}</strong><span>Record</span></div>
        <div><strong>${rate === null ? '–' : rate + ' %'}</strong><span>30 jours</span></div>
      </div>
      <div class="heat" style="--w:${weeks}">${cells}</div>
    </article>`;
  }).join('');

  $view.innerHTML = `
    <header class="head"><p class="eyebrow">Vos séries</p><h1>Calendrier</h1></header>
    ${habits.length ? reviewCard() : ''}
    ${habits.length ? `<div class="legend">
        <span><i class="cell done"></i>Fait</span><span><i class="cell fail"></i>Pas fait</span>
        <span><i class="cell skip"></i>Sauté</span><span><i class="cell part"></i>En partie</span><span><i class="cell miss"></i>Non renseigné</span>
      </div>
      <p class="hint">Touchez un jour pour le modifier.</p><div class="cards">${routines}${cards}</div>`
    : '<p class="muted center pad">Ajoutez une habitude pour voir vos séries ici.</p>'}
  `;
}

// ---------- Écran 3 : Habitudes ----------

function renderHabits() {
  const t = today();
  const active = activeHabits();
  const archived = data.habits.filter((h) => h.archived);
  const row = (h) => `<button class="row" data-act="edit" data-id="${h.id}" style="--c:${h.color}">
      <span class="row-ic">${emo(h.icon)}</span>
      <span class="row-txt"><strong>${esc(h.name)}</strong><span>${h.group ? `${esc(h.group)} · ` : ''}${esc(freqLabel(h))}</span></span>
      <span class="row-streak">${h.archived ? 'Archivée' : currentStreak(h, data.log, t) + (isWeekly(h) ? ' sem.' : ' j')}</span>
    </button>`;

  $view.innerHTML = `
    <header class="head"><p class="eyebrow">${active.length} active${active.length > 1 ? 's' : ''}</p><h1>Habitudes</h1></header>
    <section class="list">${active.map(row).join('') || '<p class="muted pad">Aucune habitude pour le moment.</p>'}</section>
    <button class="btn dashed full" data-act="new-habit">+ Nouvelle habitude</button>
    ${archived.length ? `<h3 class="sec">Archivées</h3><section class="list">${archived.map(row).join('')}</section>` : ''}
    <h3 class="sec">Apparence</h3>
    <div class="themes">${THEMES.map(([id, label]) => `<button class="theme-opt${currentTheme() === id ? ' on' : ''}" data-act="theme" data-t="${id}">
      <span class="sw sw-${id}"></span>${label}</button>`).join('')}</div>
    <h3 class="sec">Sauvegarde</h3>
    <p class="muted small">Vos données restent sur ce téléphone. Exportez-les de temps en temps pour ne rien perdre.</p>
    <div class="two">
      <button class="btn" data-act="export">Exporter</button>
      <label class="btn">Importer<input type="file" accept="application/json,.json" id="import" hidden></label>
    </div>
  `;
}

function openEditSheet(h) {
  const isNew = !h;
  const draft = h ? { ...h, days: [...h.days] } : {
    id: uid(), name: '', icon: '✅', color: COLORS[data.habits.length % COLORS.length],
    days: [0, 1, 2, 3, 4, 5, 6], createdAt: dkey(today()), archived: false,
    order: data.habits.length ? Math.max(...data.habits.map((x) => x.order)) + 1 : 0,
  };
  sheetDraft = draft;
  sheetIsNew = isNew;
  $sheetBody.innerHTML = '';
  drawEditSheet();
  openSheet();
}

let sheetDraft = null;
let sheetIsNew = false;

function drawEditSheet() {
  const d = sheetDraft;
  // Garder ce qui a déjà été tapé quand on redessine la feuille.
  d.name = document.getElementById('h-name')?.value ?? d.name;
  d.group = (document.getElementById('h-group')?.value ?? d.group ?? '').trim();
  const minIn = document.getElementById('h-min')?.value;
  if (minIn !== undefined) d.minutes = Number(minIn) || null;
  d.createdAt = document.getElementById('h-since')?.value || d.createdAt;
  const typed = document.getElementById('h-emoji')?.value.trim();
  if (typed) d.icon = typed;
  readContent(d);
  readKind(d);
  const kind = d.type || CHECK;
  const groups = [...new Set([...data.habits.map((h) => h.group).filter(Boolean)])];
  const typeSeg = (v, label) => `<button class="seg${kind === v ? ' on' : ''}" data-act="d-type" data-v="${v}">${label}</button>`;
  const freqSeg = (weekly, label) => `<button class="seg${!!d.perWeek === weekly ? ' on' : ''}" data-act="d-freq" data-v="${weekly ? 'week' : 'days'}">${label}</button>`;
  const countFields = kind === COUNT ? `<div class="three-f">
      <label class="field"><span>Objectif</span><input id="h-target" type="number" inputmode="decimal" step="any" min="0" value="${d.target || ''}" placeholder="2"></label>
      <label class="field"><span>Unité</span><input id="h-unit" value="${esc(d.unit || '')}" placeholder="L, pages" maxlength="12" autocomplete="off"></label>
      <label class="field"><span>Par appui</span><input id="h-step" type="number" inputmode="decimal" step="any" min="0" value="${d.step || ''}" placeholder="1"></label>
    </div>` : '';
  const freq = kind === QUIT ? '<p class="muted small">Suivie tous les jours : chaque jour sans écart compte.</p>' : `
    <div class="field"><span>Fréquence</span><div class="segs two-s">${freqSeg(false, 'Jours fixes')}${freqSeg(true, 'X fois par semaine')}</div></div>
    ${d.perWeek ? `<div class="field"><span>Nombre de fois par semaine</span><div class="stepper">
        <button class="btn" data-act="d-per" data-dir="-1" aria-label="Moins">−</button>
        <strong class="stepper-v">${d.perWeek}</strong>
        <button class="btn" data-act="d-per" data-dir="1" aria-label="Plus">+</button>
      </div></div>` : `<div class="field"><span>Jours</span><div class="dpick">
      ${DAY_LETTERS.map((l, i) => `<button class="dp${d.days.includes(i) ? ' on' : ''}" data-act="d-day" data-i="${i}" aria-pressed="${d.days.includes(i)}">${l}</button>`).join('')}
    </div></div>`}`;
  $sheetBody.innerHTML = `
    <div class="sheet-top">
      <button class="top-btn" data-act="close-sheet" autofocus>Annuler</button>
      <h2>${sheetIsNew ? 'Nouvelle habitude' : "Modifier l'habitude"}</h2>
      <button class="top-btn strong" data-act="d-save">${sheetIsNew ? 'Ajouter' : 'OK'}</button>
    </div>
    <label class="field"><span>Nom</span>
      <input id="h-name" value="${esc(d.name)}" placeholder="Lire 20 pages" maxlength="40" autocomplete="off"></label>
    <div class="field"><span>Type</span><div class="segs three-s">${typeSeg(CHECK, 'À cocher')}${typeSeg(COUNT, 'Chiffrée')}${typeSeg(QUIT, 'À arrêter')}</div></div>
    ${countFields}
    ${freq}
    <div class="field"><span>Couleur</span><div class="cpick">
      ${COLORS.map((c) => `<button class="cp${d.color === c ? ' on' : ''}" style="--c:${c}" data-act="d-color" data-c="${c}" aria-label="Couleur"></button>`).join('')}
    </div></div>
    <div class="field"><span>Émoji</span><div class="ipick" style="--c:${d.color}">
      ${EMOJIS.map((k) => `<button type="button" class="ip${d.icon === k ? ' on' : ''}" data-act="d-icon" data-k="${k}" aria-pressed="${d.icon === k}" aria-label="Émoji ${k}">${emo(k)}</button>`).join('')}
    </div>
      <input id="h-emoji" class="emoji-in" value="${EMOJIS.includes(d.icon) ? '' : esc(d.icon)}" placeholder="Ou tapez le vôtre" maxlength="16" autocomplete="off">
    </div>
    <div class="two-f">
      <label class="field"><span>Routine (facultatif)</span>
        <input id="h-group" list="groups" value="${esc(d.group || '')}" placeholder="Aucune" autocomplete="off">
        <datalist id="groups">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></label>
      <label class="field"><span>Durée (min)</span>
        <input id="h-min" type="number" inputmode="numeric" min="1" max="240" value="${d.minutes || ''}" placeholder="–"></label>
    </div>
    <h3 class="sec">Contenu pendant l'étape</h3>
    <label class="field"><span>Consigne</span>
      <textarea id="h-guide" rows="3" placeholder="Ce qu'il faut faire, en une ou deux phrases">${esc(d.guide || '')}</textarea></label>
    <label class="field"><span>Ma liste (une ligne par élément)</span>
      <textarea id="h-items" rows="4" placeholder="Affirmations, objectifs, exercices…">${esc((d.items || []).join('\n'))}</textarea></label>
    <label class="check"><input type="checkbox" id="h-journal" ${d.journal ? 'checked' : ''}> Écrire une note pendant l'étape</label>
    <label class="check"><input type="checkbox" id="h-breath" ${d.breath ? 'checked' : ''}> Guide de respiration</label>
    <label class="field"><span>Suivie depuis le</span><input id="h-since" type="date" value="${d.createdAt}" max="${dkey(today())}"></label>
    <button class="btn primary full" data-act="d-save">${sheetIsNew ? 'Ajouter' : 'Enregistrer'}</button>
    ${sheetIsNew ? '' : `<div class="two">
      <button class="btn" data-act="d-move" data-dir="-1">Monter</button>
      <button class="btn" data-act="d-move" data-dir="1">Descendre</button>
    </div>
    <div class="two">
      <button class="btn" data-act="d-archive">${d.archived ? 'Réactiver' : 'Archiver'}</button>
      <button class="btn danger" data-act="d-delete">Supprimer</button>
    </div>`}`;
}

// Champs de l'habitude chiffrée, gardés quand on redessine la fiche.
function readKind(d) {
  const t = document.getElementById('h-target');
  if (!t) return;
  d.target = Number(t.value) || null;
  d.unit = document.getElementById('h-unit').value.trim();
  d.step = Number(document.getElementById('h-step').value) || null;
}

function readContent(d) {
  const g = document.getElementById('h-guide');
  if (!g) return;
  d.guide = g.value.trim();
  d.items = document.getElementById('h-items').value.split('\n').map((x) => x.trim()).filter(Boolean);
  d.journal = document.getElementById('h-journal').checked;
  d.breath = document.getElementById('h-breath').checked;
}

function moveHabit(h, dir) {
  const list = activeHabits();
  const i = list.findIndex((x) => x.id === h.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i].order, list[j].order] = [list[j].order, list[i].order];
  save();
}

function seed() {
  const k = dkey(addDays(today(), -20));
  const all = [0, 1, 2, 3, 4, 5, 6];
  const base = [
    { name: 'Méditer 10 min', icon: '🧘', color: COLORS[1] },
    { name: "Boire de l'eau", icon: '💧', color: COLORS[3], type: COUNT, target: 2, unit: 'L', step: 0.25 },
    { name: 'Lire', icon: '📚', color: COLORS[2], type: COUNT, target: 20, unit: 'pages', step: 5 },
    { name: 'Sport', icon: '🏋️', color: COLORS[0], perWeek: 3 },
    { name: 'Sucre', icon: '🍬', color: COLORS[4], type: QUIT },
  ];
  data.habits = base.map((b, i) => ({ id: uid(), days: all, createdAt: k, archived: false, order: i, ...b }));
  data.log = {};
  data.moods = {};
  for (let i = 1; i <= 20; i++) {
    const key = dkey(addDays(today(), -i));
    const day = (data.log[key] = {});
    data.habits.forEach((h, j) => {
      const r = Math.sin(i * 7 + j * 13) * 0.5 + 0.5;
      if (kindOf(h) === QUIT) { if (i === 9) day[h.id] = { s: FAIL, note: '' }; return; }
      if (isWeekly(h)) { if (r > 0.55) day[h.id] = { s: DONE, note: '' }; return; }
      const s = r > 0.35 ? DONE : r > 0.2 ? SKIP : FAIL;
      day[h.id] = { s, note: '' };
      if (kindOf(h) === COUNT) day[h.id].v = s === DONE ? h.target : Math.round(h.target * r * 2) / 4;
    });
    data.moods[key] = 1 + Math.round(((Math.sin(i * 3) + 1) / 2) * 4);
  }
  save();
}

// ---------- Apparence ----------

const THEMES = [['classique', 'Classique'], ['verre', 'Verre'], ['nuit', 'Verre nuit']];
const THEME_KEY = 'rituels:theme';

function currentTheme() {
  return document.documentElement.dataset.theme || 'classique';
}

function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'classique') { delete root.dataset.theme; delete root.dataset.glass; }
  else { root.dataset.theme = t; root.dataset.glass = ''; }
  try { localStorage.setItem(THEME_KEY, t); } catch { /* sans effet */ }
}

// ---------- Sauvegarde ----------

async function exportData() {
  const json = JSON.stringify(data, null, 2);
  const name = `rituels-${dkey(today())}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Sauvegarde Rituels' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.habits) || typeof parsed.log !== 'object') throw new Error('format');
    if (!confirm('Remplacer toutes vos données par celles du fichier ?')) return;
    data = parsed;
    save();
    toast('Données importées');
    render();
  } catch {
    toast("Ce fichier n'est pas une sauvegarde Rituels");
  }
}

// ---------- Feuille du bas ----------

function openSheet() {
  if (!$sheet.open) {
    $sheet.scrollTop = 0;
    $sheet.showModal();
    document.documentElement.classList.add('sheet-open');
  }
  // Sur iPhone, un champ qui reçoit le focus fait monter le clavier et pousse la fiche hors de l'écran.
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) a.blur();
  fitSheet();
}

// Garde la fiche dans la partie visible de l'écran, au-dessus du clavier.
function fitSheet() {
  const vv = window.visualViewport;
  if (!vv || !$sheet.open) return;
  const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  $sheet.style.setProperty('--vvh', `${vv.height}px`);
  $sheet.style.setProperty('--kb', `${kb}px`);
  $sheet.classList.toggle('kb', kb > 80);
}

if (window.visualViewport) {
  visualViewport.addEventListener('resize', fitSheet);
  visualViewport.addEventListener('scroll', fitSheet);
}

// Le champ touché reste visible quand le clavier monte.
$sheet.addEventListener('focusin', (e) => {
  if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  setTimeout(() => { fitSheet(); e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300);
});

function closeSheet() {
  if (!$sheet.open || $sheet.classList.contains('closing')) return;
  if (reducedMotion.matches) { $sheet.close(); return; }
  $sheet.classList.add('closing');
  setTimeout(() => { $sheet.classList.remove('closing'); $sheet.close(); }, 180);
}

// Toucher le fond sombre ferme la fiche (et non une marge à l'intérieur de la fiche).
$sheet.addEventListener('click', (e) => {
  if (e.target !== $sheet) return;
  const r = $sheet.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!inside) closeSheet();
});

// Échap ou geste retour : même fermeture animée.
$sheet.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeSheet();
});

$sheet.addEventListener('close', () => {
  if (run) stopRun();
  document.documentElement.classList.remove('sheet-open');
  $sheet.classList.remove('kb');
});

// ---------- Navigation et actions ----------

function render() {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  if (ui.tab === 'today') renderToday();
  else if (ui.tab === 'calendar') renderCalendar();
  else renderHabits();
}

// À chaque nouvel affichage de l'écran, lancer les animations préparées.
new MutationObserver(animateIn).observe($view, { childList: true });

function habitById(id) {
  return data.habits.find((h) => h.id === id);
}

document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) {
    const order = ['today', 'calendar', 'habits'];
    const dir = order.indexOf(tab.dataset.tab) >= order.indexOf(ui.tab) ? 'left' : 'right';
    if (tab.dataset.tab === ui.tab && ui.tab !== 'today') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    swap(() => {
      ui.tab = tab.dataset.tab;
      if (ui.tab === 'today') ui.date = today();
      render();
      window.scrollTo(0, 0);
    }, dir);
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const h = el.dataset.id ? habitById(el.dataset.id) : null;
  const key = dkey(ui.date);

  switch (act) {
    case 'toggle': {
      const s = statusOf(data.log, h, key);
      withCelebration(() => setStatus(h, key, s === DONE ? null : DONE));
      if (navigator.vibrate) navigator.vibrate(10);
      renderToday();
      pop(`[data-tile="${h.id}"]`);
      break;
    }
    case 'plus':
    case 'minus': {
      const inp = document.getElementById('val');
      const base = inp && $sheet.open ? Number(inp.value) || 0 : valueOf(data.log, h, key);
      const step = (h.step || 1) * (act === 'plus' ? 1 : -1);
      withCelebration(() => setValue(h, key, base + step));
      if (navigator.vibrate) navigator.vibrate(8);
      if ($sheet.open) openDaySheet(h);
      renderToday();
      if (!$sheet.open) pop(`[data-tile="${h.id}"]`);
      break;
    }
    case 'day-sheet': openDaySheet(h); break;
    case 'set-status':
      withCelebration(() => setStatus(h, key, el.dataset.s || null));
      openDaySheet(h);
      renderToday();
      break;
    case 'save-note': {
      const inp = document.getElementById('val');
      if (inp && inp.value !== '') withCelebration(() => setValue(h, key, Number(inp.value) || 0));
      setNote(h, key, document.getElementById('note').value.trim());
      closeSheet();
      renderToday();
      break;
    }
    case 'mood': {
      const m = Number(el.dataset.m);
      if (data.moods[key] === m) delete data.moods[key];
      else data.moods[key] = m;
      save();
      renderToday();
      pop(`.mood-b[data-m="${m}"]`);
      break;
    }
    case 'open-review': swap(() => { ui.tab = 'calendar'; ui.reviewWeek = 0; render(); window.scrollTo(0, 0); }, 'left'); break;
    case 'review-week': ui.reviewWeek = Number(el.dataset.w); renderCalendar(); break;
    case 'd-type': sheetDraft.type = el.dataset.v; drawEditSheet(); break;
    case 'd-freq': sheetDraft.perWeek = el.dataset.v === 'week' ? sheetDraft.perWeek || 3 : null; drawEditSheet(); break;
    case 'd-per': sheetDraft.perWeek = Math.min(6, Math.max(1, (sheetDraft.perWeek || 3) + Number(el.dataset.dir))); drawEditSheet(); break;
    case 'pick-day': {
      const nd = parseKey(el.dataset.key);
      if (dkey(nd) === key) break;
      swap(() => { ui.date = nd; renderToday(); }, nd < ui.date ? 'right' : 'left');
      break;
    }
    case 'week': {
      const d = addDays(ui.date, 7 * Number(el.dataset.dir));
      swap(() => { ui.date = dkey(d) > dkey(today()) ? today() : d; renderToday(); }, Number(el.dataset.dir) < 0 ? 'right' : 'left');
      break;
    }
    case 'goto': swap(() => { ui.date = parseKey(el.dataset.key); ui.tab = 'today'; render(); window.scrollTo(0, 0); }, 'right'); break;
    case 'new-habit': openEditSheet(null); break;
    case 'seed': seed(); render(); break;
    case 'start-routine': startRoutine(el.dataset.g); break;
    case 'run-pause':
      if (run.paused) { run.endAt = Date.now() + run.left * 1000; run.paused = false; }
      else { run.left = secondsLeft(); run.paused = true; }
      el.textContent = run.paused ? 'Reprendre' : 'Pause';
      break;
    case 'run-done': {
      const steps = runSteps();
      setStatus(steps[run.idx], dkey(today()), DONE);
      if (navigator.vibrate) navigator.vibrate(15);
      const next = nextTodo(steps, run.idx);
      if (next < 0) run.finished = true;
      else loadStep(next);
      drawRun();
      if (ui.tab === 'today') renderToday();
      break;
    }
    case 'run-next': {
      const next = nextTodo(runSteps(), run.idx);
      if (next < 0 || next === run.idx) { toast("C'est la dernière étape restante"); break; }
      loadStep(next);
      drawRun();
      break;
    }
    case 'run-close': closeSheet(); break;
    case 'run-edit-items': run.editItems = true; drawRun(); document.getElementById('run-items')?.focus(); break;
    case 'run-save-items': {
      const h = runSteps()[run.idx];
      h.items = document.getElementById('run-items').value.split('\n').map((x) => x.trim()).filter(Boolean);
      save();
      run.editItems = false;
      drawRun();
      toast('Liste enregistrée');
      break;
    }
    case 'edit': openEditSheet(h); break;
    case 'd-day': {
      const i = Number(el.dataset.i);
      const days = sheetDraft.days;
      sheetDraft.days = days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort();
      el.classList.toggle('on', sheetDraft.days.includes(i));
      el.setAttribute('aria-pressed', sheetDraft.days.includes(i));
      break;
    }
    case 'd-color': {
      sheetDraft.color = el.dataset.c;
      $sheetBody.querySelectorAll('.cp').forEach((b) => b.classList.toggle('on', b === el));
      $sheetBody.querySelector('.ipick')?.style.setProperty('--c', sheetDraft.color);
      break;
    }
    case 'd-icon': {
      const inp = document.getElementById('h-emoji');
      if (inp) inp.value = '';
      sheetDraft.icon = el.dataset.k;
      $sheetBody.querySelectorAll('.ip').forEach((b) => {
        b.classList.toggle('on', b === el);
        b.setAttribute('aria-pressed', b === el);
      });
      if (navigator.vibrate) navigator.vibrate(8);
      break;
    }
    case 'close-sheet': closeSheet(); break;
    case 'd-save': {
      const name = document.getElementById('h-name').value.trim();
      const since = document.getElementById('h-since').value;
      readKind(sheetDraft);
      const kind = sheetDraft.type || CHECK;
      if (!name) { toast('Donnez un nom à votre habitude'); break; }
      if (kind === COUNT && !(sheetDraft.target > 0)) { toast('Indiquez un objectif chiffré'); break; }
      if (kind !== QUIT && !sheetDraft.perWeek && !sheetDraft.days.length) { toast('Choisissez au moins un jour'); break; }
      if (kind === QUIT) sheetDraft.perWeek = null;
      if (kind === QUIT || sheetDraft.perWeek) sheetDraft.days = [0, 1, 2, 3, 4, 5, 6];
      sheetDraft.name = name;
      if (since) sheetDraft.createdAt = since;
      sheetDraft.group = document.getElementById('h-group').value.trim();
      sheetDraft.icon = document.getElementById('h-emoji').value.trim() || sheetDraft.icon;
      readContent(sheetDraft);
      sheetDraft.minutes = Number(document.getElementById('h-min').value) || null;
      const i = data.habits.findIndex((x) => x.id === sheetDraft.id);
      if (i >= 0) data.habits[i] = sheetDraft;
      else data.habits.push(sheetDraft);
      save();
      closeSheet();
      render();
      break;
    }
    case 'd-move': {
      const x = habitById(sheetDraft.id);
      moveHabit(x, Number(el.dataset.dir));
      sheetDraft.order = x.order;
      render();
      toast('Ordre modifié');
      break;
    }
    case 'd-archive': {
      const x = habitById(sheetDraft.id);
      x.archived = !x.archived;
      save();
      closeSheet();
      render();
      break;
    }
    case 'd-delete': {
      if (!confirm('Supprimer cette habitude et tout son historique ?')) break;
      const id = sheetDraft.id;
      data.habits = data.habits.filter((x) => x.id !== id);
      for (const k of Object.keys(data.log)) {
        delete data.log[k][id];
        if (!Object.keys(data.log[k]).length) delete data.log[k];
      }
      save();
      closeSheet();
      render();
      break;
    }
    case 'export': exportData(); break;
    case 'theme': applyTheme(el.dataset.t); renderHabits(); break;
    default: break;
  }
});

// Le journal de l'étape s'enregistre pendant la frappe.
document.addEventListener('input', (e) => {
  // Un émoji tapé à la main remplace celui de la grille.
  if (e.target.id === 'h-emoji' && e.target.value.trim()) {
    $sheetBody.querySelectorAll('.ip.on').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-pressed', false); });
  }
  if (e.target.id !== 'run-note' || !run) return;
  setNote(runSteps()[run.idx], dkey(today()), e.target.value);
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'import' && e.target.files[0]) importData(e.target.files[0]);
});

// Revenir sur l'appli le lendemain doit afficher le bon jour.
let lastDay = dkey(today());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = dkey(today());
  if (now !== lastDay) {
    lastDay = now;
    ui.date = today();
    render();
  }
});

render();
settleSoon();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js');
}
