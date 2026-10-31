import {
  DONE, FAIL, SKIP, dkey, parseKey, addDays, weekday, startOfWeek,
  isScheduled, statusOf, currentStreak, bestStreak, successRate, dayProgress,
  groupStatus, groupStreak, PARTIAL,
  CHECK, COUNT, QUIT, kindOf, isWeekly, valueOf, statusFor, statusForValue, weekDone, atRisk, weekReview,
  isMonthly, periodOf, periodDone, periodTarget,
  AMOUNT, STEPS, MANUAL, goalProgress, goalPace, goalsOverall, goalLinked, goalSeries, goalProgressSeries,
} from './logic.js?v=13'; // numéro à changer avec VERSION dans sw.js : évite un vieux fichier en cache

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
  return { version: 1, habits: [], log: {}, moods: {}, goals: [] };
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
    data.goals ||= [];
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
const $scroller = document.getElementById('scroller');
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
  if (isMonthly(h)) return `${goal}${h.perMonth} fois par mois`;
  return goal + daysLabel(h.days);
}

function streakLabel(h, n) {
  if (isWeekly(h)) return n ? `${n} sem. de suite` : 'Pas de série';
  if (isMonthly(h)) return n ? `${n} mois de suite` : 'Pas de série';
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
  // Habitude « X fois par semaine / par mois » : où en est la période en cours.
  const weekly = !!periodOf(h);
  const wd = weekly ? periodDone(h, data.log, d) : 0;
  const per = periodTarget(h);
  const pu = isMonthly(h) ? 'mois' : 'sem.';
  const met = weekly && s !== DONE && wd >= per;
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
        <span class="tile-sub">${fmtNum(v)} / ${fmtNum(h.target)} ${esc(h.unit || '')}${weekly ? ` · ${wd}/${per} ${pu}` : ''}${noteTag}</span>
        ${barHtml('bar-' + h.id + key, pct)}
      </button>
      <button class="tile-more" data-act="day-sheet" data-id="${h.id}" aria-label="Plus d'options">•••</button>
      ${v > 0 ? `<button class="tile-minus" data-act="minus" data-id="${h.id}" aria-label="Retirer ${fmtNum(h.step || 1)}">−</button>` : ''}
    </div>`;
  }

  const badge = s === DONE ? 'Fait' : s === FAIL ? 'Pas fait' : s === SKIP ? 'Sauté' : met ? 'Objectif atteint' : '';
  const sub = weekly ? `${wd}/${per} ${isMonthly(h) ? 'ce mois-ci' : 'cette semaine'}` : streakLabel(h, streak);
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
function celebrate(msg = 'Journée complète, bravo') {
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
  toast(msg);
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
  if (r.best) lines.push(`<li>${emo(r.best.h.icon, 'sm')} Meilleure série : <strong>${esc(r.best.h.name)}</strong>, ${r.best.streak} ${r.best.monthly ? 'mois' : `${r.best.weekly ? 'semaine' : 'jour'}${r.best.streak > 1 ? 's' : ''}`}</li>`);
  if (r.weakest) lines.push(`<li>${emo(r.weakest.h.icon, 'sm')} À relancer : <strong>${esc(r.weakest.h.name)}</strong>, ${r.weakest.done} sur ${r.weakest.total}</li>`);
  if (r.weakDay) lines.push(`<li>📅 Votre jour le plus difficile : <strong>le ${WEEKDAY_NAMES[r.weakDay.day]}</strong> (${Math.round(r.weakDay.rate * 100)} % sur 4 semaines)</li>`);
  if (r.moodAvg) lines.push(`<li>${emo(MOODS[Math.round(r.moodAvg) - 1], 'sm')} Humeur moyenne : <strong>${r.moodAvg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} / 5</strong></li>`);
  if (r.moodLink) lines.push(`<li>💡 Les jours avec <strong>${esc(r.moodLink.h.name)}</strong>, votre humeur est de ${r.moodLink.with.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} contre ${r.moodLink.without.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</li>`);
  return `<article class="card review-card" id="review">
    <div class="review-head">
      <div><h2>Bilan · ${label}</h2><p class="muted small">${range}</p></div>
      <div class="segs two-s mini">
        <button class="seg${ui.reviewWeek === -1 ? ' on' : ''}" data-act="review-week" data-week="-1">Précédente</button>
        <button class="seg${ui.reviewWeek === 0 ? ' on' : ''}" data-act="review-week" data-week="0">En cours</button>
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
          : k === dkey(t) ? 'todo' : periodOf(h) ? 'rest' : 'miss';
      }
      const clickable = cls !== 'off';
      cells += `<span class="cell ${cls}"${clickable ? ` data-act="goto" data-key="${k}"` : ''}></span>`;
    }
    const cur = currentStreak(h, data.log, t);
    const best = bestStreak(h, data.log, t);
    const rate = successRate(h, data.log, t, 30);
    const u = isWeekly(h) ? 'sem.' : isMonthly(h) ? 'mois' : 'j';
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
      <span class="row-streak">${h.archived ? 'Archivée' : currentStreak(h, data.log, t) + (isWeekly(h) ? ' sem.' : isMonthly(h) ? ' mois' : ' j')}</span>
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


// ---------- Écran 3 : Objectifs de vie ----------

// [id, libellé, émoji, couleur]
const GOAL_CATS = [
  ['financier', 'Financier', '💶', '#1D9E75'],
  ['patrimoine', 'Patrimoine', '🏛️', '#7F77DD'],
  ['immobilier', 'Immobilier', '🏡', '#BA7517'],
  ['pro', 'Pro', '💼', '#378ADD'],
  ['sante', 'Santé', '💪', '#D85A30'],
  ['perso', 'Perso', '✨', '#D4537E'],
];
const PACE = {
  done: 'Atteint', late: 'Échéance passée', ahead: 'En avance', ontrack: 'Dans les temps', behind: 'En retard',
};

function goalCat(g) {
  return GOAL_CATS.find((c) => c[0] === g.cat) || GOAL_CATS[5];
}

// Objectif chiffré vu avec les apports de ses habitudes liées.
function liveGoal(g) {
  if (g.kind !== AMOUNT) return g;
  return { ...g, current: (Number(g.current) || 0) + goalLinked(g, data.habits, data.log) };
}

function linkedHabits(g) {
  return data.habits.filter((h) => h.goalId === g.id && kindOf(h) !== QUIT);
}

function pctLabel(p) {
  return `${Math.round(p * 100)}\u00a0%`; // espace insécable : le % ne passe jamais seul à la ligne
}

function dueLabel(due) {
  if (due.endsWith('-12-31')) return `fin ${due.slice(0, 4)}`;
  return fmtDate(parseKey(due), { day: 'numeric', month: 'short', year: 'numeric' });
}

function goalDetail(g) {
  if (g.kind === STEPS) {
    const n = (g.steps || []).length;
    const k = (g.steps || []).filter((x) => x.done).length;
    return `${k} étape${k > 1 ? 's' : ''} sur ${n}`;
  }
  if (g.kind === MANUAL) return 'Estimation';
  const u = g.unit ? ` ${esc(g.unit)}` : '';
  return `${fmtNum(g.current)}${u} sur ${fmtNum(g.target)}${u}`;
}

// Mini courbe de la carte : l'avancement dans le temps, de la création à aujourd'hui.
// Rien à montrer (un seul point, ou aucun changement) : la barre suffit.
function goalSpark(g, t) {
  const stored = data.goals.find((x) => x.id === g.id) || g;
  const pts = goalProgressSeries(stored, data.habits, data.log, t);
  if (pts.length < 2 || pts.every((p) => p.p === pts[0].p)) return '';
  const W = 300, H = 52, T = 5, B = 4;
  const t0 = parseKey(pts[0].d).getTime();
  const t1 = Math.max(parseKey(pts[pts.length - 1].d).getTime(), t0 + 864e5);
  const X = (k) => 3 + ((parseKey(k).getTime() - t0) / (t1 - t0)) * (W - 7);
  const Y = (p) => T + (1 - p) * (H - T - B);
  let line = `M${X(pts[0].d).toFixed(1)},${Y(pts[0].p).toFixed(1)}`;
  for (const p of pts.slice(1)) line += `H${X(p.d).toFixed(1)}V${Y(p.p).toFixed(1)}`;
  const last = pts[pts.length - 1];
  const gid = `sp-${g.id}`;
  return `<svg class="g-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progression : de ${pctLabel(pts[0].p)} à ${pctLabel(last.p)}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c);stop-opacity:0.3"/><stop offset="1" style="stop-color:var(--c);stop-opacity:0"/></linearGradient></defs>
    <line class="sp-goal" x1="0" x2="${W}" y1="${T}" y2="${T}"/>
    <path d="${line}V${H - B}H${X(pts[0].d).toFixed(1)}Z" fill="url(#${gid})"/>
    <path class="sp-line" d="${line}"/>
    <circle class="sp-dot" cx="${X(last.d).toFixed(1)}" cy="${Y(last.p).toFixed(1)}" r="3.5"/>
  </svg>`;
}

function goalCard(g, t) {
  const [, label, e, color] = goalCat(g);
  const p = goalProgress(g);
  const pace = goalPace(g, t);
  return `<button class="goal${p >= 1 ? ' reached' : ''}" data-act="goal" data-gid="${g.id}" style="--c:${color}">
    <span class="goal-top">
      <span class="row-ic">${emo(g.icon || e)}</span>
      <span class="goal-txt"><strong>${esc(g.name)}</strong><span>${label} · ${dueLabel(g.due)}</span></span>
      <span class="goal-pct">${pctLabel(p)}</span>
    </span>
    ${goalSpark(g, t) || barHtml('goal-' + g.id, p)}
    <span class="goal-foot"><span>${goalDetail(g)}${linkedHabits(g).length ? ' <span class="g-chain" title="Habitude liée" aria-label="Habitude liée">🔗</span>' : ''}</span><span class="pace pace-${pace.state}">${PACE[pace.state]}</span></span>
  </button>`;
}

function renderGoals() {
  const t = today();
  const y = t.getFullYear();
  const goals = data.goals.map(liveGoal).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  const overall = goalsOverall(goals);
  const reached = goals.filter((g) => goalProgress(g) >= 1).length;
  const count = (st) => goals.filter((g) => goalPace(g, t).state === st).length;
  const summary = [[count('ahead'), 'en avance'], [count('ontrack'), 'dans les temps'], [count('behind') + count('late'), 'en retard']]
    .filter(([n]) => n).map(([n, l]) => `${n} ${l}`).join(' · ');
  const sections = [
    [`Cette année · ${y}`, (g) => g.due.slice(0, 4) <= String(y)],
    [`L'an prochain · ${y + 1}`, (g) => g.due.slice(0, 4) === String(y + 1)],
    ['Plus tard', (g) => g.due.slice(0, 4) > String(y + 1)],
  ].map(([title, keep]) => {
    const list = goals.filter(keep);
    return list.length ? `<h3 class="sec">${title}</h3><section class="goal-list">${list.map((g) => goalCard(g, t)).join('')}</section>` : '';
  }).join('');

  $view.innerHTML = `
    <header class="head"><p class="eyebrow">${goals.length ? `${reached} atteint${reached > 1 ? 's' : ''} sur ${goals.length}` : 'Ce que vous voulez accomplir'}</p><h1>Objectifs</h1></header>
    ${goals.length ? `<article class="card goal-hero">
      <div class="r-ring big">${ring(Math.round(overall * 100), 100, 72, 8, undefined, 'goals-all')}<span>${pctLabel(overall)}</span></div>
      <div><h2>Avancement moyen</h2><p class="muted small">${summary || 'Pas encore commencé'}</p></div>
    </article>` : `<p class="muted goal-empty">Les choses que vous voulez faire cette année ou l'an prochain : constituer un apport, acheter un bien, ouvrir un PEA, courir un semi-marathon… Chaque objectif affiche où vous en êtes, en pourcentage, et si vous êtes dans les temps.</p>`}
    ${sections}
    <button class="btn dashed full" data-act="new-goal">+ Nouvel objectif</button>
    ${goals.length ? '<p class="hint">Touchez un objectif pour mettre à jour où vous en êtes.</p>' : ''}
  `;
}

let goalDraft = null;
let goalIsNew = false;

function openGoalSheet(g) {
  goalIsNew = !g;
  const y = today().getFullYear();
  goalDraft = g ? JSON.parse(JSON.stringify(liveGoal(g))) : {
    id: uid(), name: '', cat: 'financier', kind: AMOUNT, due: `${y}-12-31`, dueMode: 'y0',
    current: 0, target: null, unit: '€', steps: [], pct: 0, why: '', createdAt: dkey(today()),
  };
  if (g) goalDraft.dueMode = g.due === `${y}-12-31` ? 'y0' : g.due === `${y + 1}-12-31` ? 'y1' : 'date';
  $sheetBody.innerHTML = '';
  drawGoalSheet();
  openSheet();
}

// Garde ce qui a été tapé quand la fiche se redessine.
function readGoal(d) {
  const v = (id) => document.getElementById(id);
  if (v('g-name')) d.name = v('g-name').value;
  if (v('g-why')) d.why = v('g-why').value;
  if (v('g-date') && d.dueMode === 'date') d.due = v('g-date').value || d.due;
  if (v('g-current')) d.current = Number(v('g-current').value) || 0;
  if (v('g-target')) d.target = Number(v('g-target').value) || null;
  if (v('g-unit')) d.unit = v('g-unit').value.trim();
  if (v('g-pct')) d.pct = Number(v('g-pct').value) || 0;
  if (v('g-steps')) {
    const before = d.steps || [];
    d.steps = v('g-steps').value.split('\n').map((x) => x.trim()).filter(Boolean)
      .map((t) => ({ t, done: !!before.find((s) => s.t === t)?.done }));
  }
}

function goalNowBlock(d) {
  const p = goalProgress(d);
  const pace = goalPace({ ...d, createdAt: d.createdAt || dkey(today()) }, today());
  const expected = pace.state === 'done' ? '' : ` · attendu à ce jour : ${pctLabel(pace.expected)}`;
  return `<div class="goal-now" style="--c:${goalCat(d)[3]}">
    <div class="r-ring big">${ring(Math.round(p * 100), 100, 72, 8, 'var(--c)')}<span id="g-now-pct">${pctLabel(p)}</span></div>
    <div><span class="pace pace-${pace.state}">${PACE[pace.state]}</span><p class="muted small">${goalDetail(d)}${expected}</p></div>
  </div>`;
}

function drawGoalSheet() {
  const d = goalDraft;
  readGoal(d);
  const y = today().getFullYear();
  const seg = (act, v, cur, label) => `<button class="seg${cur === v ? ' on' : ''}" data-act="${act}" data-v="${v}">${label}</button>`;
  const links = goalIsNew ? [] : linkedHabits(d);
  const linkedSum = goalIsNew ? 0 : goalLinked(d, data.habits, data.log);
  const amountNow = `<label class="field"><span>Où j'en suis aujourd'hui${d.unit ? ` (${esc(d.unit)})` : ''}</span>
      <input id="g-current" type="number" inputmode="decimal" step="any" min="0" value="${d.current || ''}" placeholder="0"></label>
    ${linkedSum ? `<p class="muted small g-linked">Dont ${fmtNum(linkedSum)}${d.unit ? ' ' + esc(d.unit) : ''} apportés par ${links.map((h) => `« ${esc(h.name)} »`).join(', ')}.</p>` : ''}`;
  const linksBlock = d.kind !== AMOUNT || goalIsNew ? '' : `<h3 class="sec">Habitudes qui le font avancer</h3>
    ${links.length ? `<div class="list">${links.map((h) => `<div class="row" style="--c:${h.color}"><span class="row-ic">${emo(h.icon)}</span>
      <span class="row-txt"><strong>${esc(h.name)}</strong><span>${kindOf(h) === COUNT ? `Chaque ${esc(h.unit || 'unité')} noté compte ×${fmtNum(h.goalPer || 1)}` : `+ ${fmtNum(h.goalPer)}${d.unit ? ' ' + esc(d.unit) : ''} chaque fois que c'est fait`}</span></span></div>`).join('')}</div>`
      : '<p class="muted small">Aucune pour l\'instant. Dans une habitude, choisissez « Fait avancer un objectif » : par exemple « Virer 125 € sur l\'épargne », une fois par semaine.</p>'}`;
  const manualNow = `<label class="field"><span>Où j'en suis, à l'estime : <strong id="g-pct-v">${d.pct || 0} %</strong></span>
      <input id="g-pct" type="range" min="0" max="100" step="5" value="${d.pct || 0}"></label>`;
  const stepsNow = (d.steps || []).length ? `<div class="g-steps">${d.steps.map((st, i) => `<button type="button" class="g-step${st.done ? ' on' : ''}" data-act="g-step" data-i="${i}" aria-pressed="${st.done}">
      <span class="chk"></span><span>${esc(st.t)}</span></button>`).join('')}</div>` : '';
  const now = goalIsNew ? '' : `${goalNowBlock(d)}
    ${d.kind === AMOUNT ? goalChart(d) + amountNow : d.kind === MANUAL ? manualNow : stepsNow}`;
  const measure = d.kind === AMOUNT ? `<div class="two-f">
      <label class="field"><span>Cible</span><input id="g-target" type="number" inputmode="decimal" step="any" min="0" value="${d.target || ''}" placeholder="40000"></label>
      <label class="field"><span>Unité</span><input id="g-unit" value="${esc(d.unit || '')}" placeholder="€" maxlength="10" autocomplete="off"></label>
    </div>${goalIsNew ? amountNow : ''}`
    : d.kind === STEPS ? `<label class="field"><span>Étapes (une par ligne)</span>
      <textarea id="g-steps" rows="4" placeholder="Simuler mon prêt&#10;Rencontrer deux banques&#10;Signer le compromis">${esc((d.steps || []).map((x) => x.t).join('\n'))}</textarea></label>`
    : (goalIsNew ? manualNow : '<p class="muted small">Vous estimez vous-même le pourcentage, en haut de la fiche.</p>');

  $sheetBody.innerHTML = `
    <div class="sheet-top">
      <button class="top-btn" data-act="close-sheet" autofocus>Annuler</button>
      <h2>${goalIsNew ? 'Nouvel objectif' : 'Objectif'}</h2>
      <button class="top-btn strong" data-act="g-save">${goalIsNew ? 'Ajouter' : 'OK'}</button>
    </div>
    ${now}
    <label class="field"><span>Objectif</span>
      <input id="g-name" value="${esc(d.name)}" placeholder="Constituer mon apport" maxlength="60" autocomplete="off"></label>
    <div class="field"><span>Domaine</span><div class="gcats">
      ${GOAL_CATS.map(([id, label, e, c]) => `<button type="button" class="gcat${d.cat === id ? ' on' : ''}" style="--c:${c}" data-act="g-cat" data-v="${id}" aria-pressed="${d.cat === id}">${emo(e)}<span>${label}</span></button>`).join('')}
    </div></div>
    <div class="field"><span>Échéance</span><div class="segs three-s">
      ${seg('g-due', 'y0', d.dueMode, `Fin ${y}`)}${seg('g-due', 'y1', d.dueMode, `Fin ${y + 1}`)}${seg('g-due', 'date', d.dueMode, 'Une date')}
    </div>
    ${d.dueMode === 'date' ? `<input id="g-date" type="date" value="${d.due}" min="${dkey(today())}">` : ''}</div>
    <div class="field"><span>Comment le mesurer</span><div class="segs three-s">
      ${seg('g-kind', AMOUNT, d.kind, 'Montant')}${seg('g-kind', STEPS, d.kind, 'Étapes')}${seg('g-kind', MANUAL, d.kind, 'Estimation')}
    </div></div>
    ${measure}
    ${linksBlock}
    <label class="field"><span>Pourquoi c'est important (facultatif)</span>
      <textarea id="g-why" rows="2" placeholder="Acheter une maison avec jardin">${esc(d.why || '')}</textarea></label>
    <button class="btn primary full" data-act="g-save">${goalIsNew ? 'Ajouter' : 'Enregistrer'}</button>
    ${goalIsNew ? '' : '<button class="btn danger full" data-act="g-delete">Supprimer cet objectif</button>'}`;
}

// Courbe d'un objectif chiffré : montant atteint dans le temps (en escalier : il change par à-coups),
// la cible en ligne de repère, et le rythme attendu en pointillés. Toucher la courbe affiche la valeur.
function goalChart(d) {
  const g = data.goals.find((x) => x.id === d.id);
  if (!g || !(g.target > 0)) return '';
  const t = today();
  const pts = goalSeries(g, data.habits, data.log, t);
  const W = 320, H = 150, L = 6, R = 6, T = 18, B = 24;
  const t0 = parseKey(g.createdAt).getTime();
  const t1 = Math.max(parseKey(g.due).getTime(), t.getTime(), t0 + 864e5);
  const top = Math.max(g.target, ...pts.map((p) => p.v)) * 1.08 || 1;
  const X = (k) => L + ((parseKey(k).getTime() - t0) / (t1 - t0)) * (W - L - R);
  const Y = (v) => T + (1 - Math.max(0, v) / top) * (H - T - B);
  const xy = pts.map((p) => [X(p.d), Y(p.v)]);
  let line = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
  for (let i = 1; i < xy.length; i++) line += `H${xy[i][0].toFixed(1)}V${xy[i][1].toFixed(1)}`;
  const last = xy[xy.length - 1];
  const area = `${line}V${Y(0).toFixed(1)}H${xy[0][0].toFixed(1)}Z`;
  const p0 = (Number(g.startPct) || 0) * g.target;
  const u = g.unit ? ` ${g.unit}` : '';
  const short = (k) => fmtDate(parseKey(k), { day: 'numeric', month: 'short' });
  const now = pts[pts.length - 1];
  const tips = pts.map((p) => ({ x: X(p.d) / W, d: fmtDate(parseKey(p.d), { day: 'numeric', month: 'long', year: 'numeric' }), v: `${fmtNum(p.v)}${u}` }));
  return `<figure class="g-chart" style="--c:${goalCat(g)[3]}" data-tips="${esc(JSON.stringify(tips))}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Évolution : ${fmtNum(pts[0].v)}${u} le ${short(pts[0].d)}, ${fmtNum(now.v)}${u} aujourd'hui, cible ${fmtNum(g.target)}${u}`)}">
      <defs><linearGradient id="g-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color:var(--c);stop-opacity:0.28"/><stop offset="1" style="stop-color:var(--c);stop-opacity:0.02"/>
      </linearGradient></defs>
      <line class="gc-base" x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}"/>
      <line class="gc-target" x1="${L}" x2="${W - R}" y1="${Y(g.target)}" y2="${Y(g.target)}"/>
      <text class="gc-lab" x="${W - R}" y="${Y(g.target) - 5}" text-anchor="end">Cible ${esc(fmtNum(g.target) + u)}</text>
      <line class="gc-pace" x1="${X(g.createdAt)}" y1="${Y(p0)}" x2="${X(g.due)}" y2="${Y(g.target)}"/>
      <path d="${area}" fill="url(#g-fill)"/>
      <path class="gc-line" d="${line}"/>
      <circle class="gc-dot" cx="${last[0]}" cy="${last[1]}" r="4.5"/>
      <line class="gc-cross" x1="0" x2="0" y1="${T}" y2="${Y(0)}"/>
      <text class="gc-axis" x="${L}" y="${H - 6}">${esc(short(g.createdAt))}</text>
      <text class="gc-axis" x="${W - R}" y="${H - 6}" text-anchor="end">${esc(dueLabel(g.due))}</text>
    </svg>
    <figcaption class="gc-tip" hidden></figcaption>
    <p class="gc-legend"><span class="gc-k gc-k-line"></span>Montant atteint <span class="gc-k gc-k-pace"></span>Rythme attendu</p>
  </figure>`;
}

// Toucher ou survoler la courbe : trait vertical et valeur du point le plus proche.
function chartHover(e) {
  const fig = e.target.closest('.g-chart');
  if (!fig) return;
  const tips = JSON.parse(fig.dataset.tips);
  const r = fig.querySelector('svg').getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width;
  let best = tips[0];
  for (const tp of tips) if (tp.x <= fx + 0.02) best = tp;
  const tip = fig.querySelector('.gc-tip');
  const cross = fig.querySelector('.gc-cross');
  cross.setAttribute('x1', best.x * 320);
  cross.setAttribute('x2', best.x * 320);
  cross.style.opacity = '1';
  tip.hidden = false;
  tip.innerHTML = `<strong>${esc(best.v)}</strong><span>${esc(best.d)}</span>`;
  tip.style.left = `${Math.min(Math.max(best.x * r.width, 60), r.width - 60)}px`;
}
document.addEventListener('pointermove', chartHover, { passive: true });
document.addEventListener('pointerdown', chartHover, { passive: true });
document.addEventListener('pointerleave', (e) => {
  if (!(e.target instanceof Element) || !e.target.matches('.g-chart')) return;
  e.target.querySelector('.gc-tip').hidden = true;
  e.target.querySelector('.gc-cross').style.opacity = '0';
}, true);

// Met à jour le pourcentage en haut de la fiche sans la redessiner.
function refreshGoalNow() {
  if (goalIsNew || !goalDraft) return;
  readGoal(goalDraft);
  const box = $sheetBody.querySelector('.goal-now');
  if (box) box.outerHTML = goalNowBlock(goalDraft);
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
  readLink(d);
  const typed = document.getElementById('h-emoji')?.value.trim();
  if (typed) d.icon = typed;
  readContent(d);
  readKind(d);
  const kind = d.type || CHECK;
  const groups = [...new Set([...data.habits.map((h) => h.group).filter(Boolean)])];
  const typeSeg = (v, label) => `<button class="seg${kind === v ? ' on' : ''}" data-act="d-type" data-v="${v}">${label}</button>`;
  const freqMode = d.perWeek ? 'week' : d.perMonth ? 'month' : 'days';
  const freqSeg = (v, label) => `<button class="seg${freqMode === v ? ' on' : ''}" data-act="d-freq" data-v="${v}">${label}</button>`;
  const countFields = kind === COUNT ? `<div class="three-f">
      <label class="field"><span>Objectif</span><input id="h-target" type="number" inputmode="decimal" step="any" min="0" value="${d.target || ''}" placeholder="2"></label>
      <label class="field"><span>Unité</span><input id="h-unit" value="${esc(d.unit || '')}" placeholder="L, pages" maxlength="12" autocomplete="off"></label>
      <label class="field"><span>Par appui</span><input id="h-step" type="number" inputmode="decimal" step="any" min="0" value="${d.step || ''}" placeholder="1"></label>
    </div>` : '';
  const freq = kind === QUIT ? '<p class="muted small">Suivie tous les jours : chaque jour sans écart compte.</p>' : `
    <div class="field"><span>Fréquence</span><div class="segs three-s">${freqSeg('days', 'Jours fixes')}${freqSeg('week', 'Par semaine')}${freqSeg('month', 'Par mois')}</div></div>
    ${freqMode !== 'days' ? `<div class="field"><span>Nombre de fois par ${freqMode === 'week' ? 'semaine' : 'mois'}</span><div class="stepper">
        <button class="btn" data-act="d-per" data-dir="-1" aria-label="Moins">−</button>
        <strong class="stepper-v">${d.perWeek || d.perMonth}</strong>
        <button class="btn" data-act="d-per" data-dir="1" aria-label="Plus">+</button>
      </div></div>` : `<div class="field"><span>Jours</span><div class="dpick">
      ${DAY_LETTERS.map((l, i) => `<button class="dp${d.days.includes(i) ? ' on' : ''}" data-act="d-day" data-i="${i}" aria-pressed="${d.days.includes(i)}">${l}</button>`).join('')}
    </div></div>`}`;
  const amountGoals = data.goals.filter((g) => g.kind === AMOUNT);
  const lg = amountGoals.find((g) => g.id === d.goalId);
  const link = kind === QUIT || !amountGoals.length ? '' : `<div class="field"><span>Fait avancer un objectif</span>
      <select id="h-goal"><option value="">Aucun</option>${amountGoals.map((g) => `<option value="${g.id}"${g.id === d.goalId ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select></div>
    ${lg ? `<label class="field"><span>${kind === COUNT ? `Pour 1 ${esc(d.unit || 'unité')} noté, ajouter à l'objectif` : "Ajouté à l'objectif chaque fois que c'est fait"}${lg.unit ? ` (${esc(lg.unit)})` : ''}</span>
      <input id="h-goalper" type="number" inputmode="decimal" step="any" min="0" value="${d.goalPer || ''}" placeholder="${kind === COUNT ? '1' : '125'}"></label>` : ''}`;
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
    ${link}
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

// Objectif lié, gardé quand on redessine la fiche.
function readLink(d) {
  const sel = document.getElementById('h-goal');
  if (!sel) return;
  d.goalId = sel.value || null;
  const per = document.getElementById('h-goalper');
  if (per) d.goalPer = Number(per.value) || null;
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
    data.moods ||= {};
    data.goals ||= [];
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
  $sheet.classList.remove('kb', 'dragging');
  $sheet.style.transform = '';
  $sheet.style.removeProperty('--drag');
});

// Glisser la fiche vers le bas pour la fermer, comme sur iPhone.
// Le geste démarre depuis l'en-tête, ou n'importe où quand la fiche est tout en haut.
let drag = null;
$sheet.addEventListener('touchstart', (e) => {
  drag = null;
  if (e.touches.length !== 1 || $sheet.classList.contains('closing')) return;
  if (e.target.closest('input[type="range"], textarea')) return;
  const t = e.touches[0];
  drag = {
    x0: t.clientX, y0: t.clientY, dy: 0, on: false,
    ok: $sheet.scrollTop <= 0 || !!e.target.closest('.grabber, .sheet-top, .sheet-head'),
    last: [{ y: 0, t: e.timeStamp }],
  };
}, { passive: true });

$sheet.addEventListener('touchmove', (e) => {
  if (!drag) return;
  const t = e.touches[0];
  const dy = t.clientY - drag.y0;
  const dx = t.clientX - drag.x0;
  if (!drag.on) {
    if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
    if (!drag.ok || dy <= 0 || Math.abs(dx) > Math.abs(dy)) { drag = null; return; }
    drag.on = true;
    drag.y0 = t.clientY;
    $sheet.classList.add('dragging');
  }
  e.preventDefault();
  // Un peu de résistance vers le haut, aucune vers le bas.
  const raw = t.clientY - drag.y0;
  drag.dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 2;
  drag.last.push({ y: drag.dy, t: e.timeStamp });
  if (drag.last.length > 5) drag.last.shift();
  $sheet.style.transform = `translateY(${drag.dy}px)`;
  $sheet.style.setProperty('--drag', Math.max(0, Math.min(1, drag.dy / $sheet.offsetHeight)).toFixed(3));
}, { passive: false });

function endDrag() {
  if (!drag || !drag.on) { drag = null; return; }
  const { dy, last } = drag;
  drag = null;
  const a = last[0];
  const b = last[last.length - 1];
  const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0; // pixels par milliseconde
  const h = $sheet.offsetHeight;
  $sheet.classList.remove('dragging');
  if (dy > Math.min(150, h * 0.3) || (v > 0.5 && dy > 20)) {
    const ms = Math.max(140, Math.min(280, (h - dy) / Math.max(v, 1.2)));
    const anim = $sheet.animate([{ transform: `translateY(${dy}px)` }, { transform: `translateY(${h + 40}px)` }],
      { duration: ms, easing: 'cubic-bezier(0.3, 0, 0.8, 0.6)', fill: 'forwards' });
    anim.onfinish = () => { $sheet.close(); anim.cancel(); };
  } else {
    $sheet.style.transform = '';
    $sheet.style.removeProperty('--drag');
    $sheet.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
      { duration: 480, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
  }
}
$sheet.addEventListener('touchend', endDrag);
$sheet.addEventListener('touchcancel', endDrag);

// ---------- Navigation et actions ----------

// Pastille de verre sous l'onglet actif : elle glisse et s'étire d'un onglet à l'autre.
const $pill = document.querySelector('.tab-pill');
let pillAt = null;
function movePill(name, animate = true) {
  const tab = document.querySelector(`.tab[data-tab="${name}"]`);
  if (!$pill || !tab) return;
  const bar = $pill.parentElement.getBoundingClientRect();
  const r = tab.getBoundingClientRect();
  const to = { x: r.left - bar.left + 4, y: r.top - bar.top + 2 };
  $pill.style.width = `${r.width - 8}px`;
  $pill.style.height = `${r.height - 4}px`;
  $pill.style.setProperty('--px', `${to.x}px`);
  $pill.style.setProperty('--py', `${to.y}px`);
  const from = pillAt;
  pillAt = { name, x: to.x };
  if (!animate || !from || from.name === name || reducedMotion.matches || !$pill.animate) return;
  const d = to.x - from.x;
  const at = (x, sx, sy) => ({ transform: `translate(${x}px, ${to.y}px) scale(${sx}, ${sy})` });
  $pill.getAnimations().forEach((a) => a.cancel());
  $pill.animate([
    at(from.x, 1, 1),
    { ...at(from.x + d * 0.55, 1.22, 0.86), offset: 0.4 },
    { ...at(to.x + Math.sign(d) * 5, 0.96, 1.05), offset: 0.72 },
    at(to.x, 1, 1),
  ], { duration: 520, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' });
}
addEventListener('resize', () => pillAt && movePill(pillAt.name, false));

function render() {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  movePill(ui.tab);
  if (ui.tab === 'today') renderToday();
  else if (ui.tab === 'calendar') renderCalendar();
  else if (ui.tab === 'goals') renderGoals();
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
    const order = ['today', 'calendar', 'goals', 'habits'];
    const dir = order.indexOf(tab.dataset.tab) >= order.indexOf(ui.tab) ? 'left' : 'right';
    if (tab.dataset.tab === ui.tab && ui.tab !== 'today') { $scroller.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    movePill(tab.dataset.tab);
    swap(() => {
      ui.tab = tab.dataset.tab;
      if (ui.tab === 'today') ui.date = today();
      render();
      $scroller.scrollTo(0, 0);
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
    case 'open-review': swap(() => { ui.tab = 'calendar'; ui.reviewWeek = 0; render(); $scroller.scrollTo(0, 0); }, 'left'); break;
    case 'review-week': ui.reviewWeek = Number(el.dataset.week); renderCalendar(); break;
    case 'd-type': sheetDraft.type = el.dataset.v; drawEditSheet(); break;
    case 'd-freq': {
      const v = el.dataset.v;
      sheetDraft.perWeek = v === 'week' ? sheetDraft.perWeek || 3 : null;
      sheetDraft.perMonth = v === 'month' ? sheetDraft.perMonth || 1 : null;
      drawEditSheet();
      break;
    }
    case 'd-per':
      if (sheetDraft.perMonth) sheetDraft.perMonth = Math.min(20, Math.max(1, sheetDraft.perMonth + Number(el.dataset.dir)));
      else sheetDraft.perWeek = Math.min(6, Math.max(1, (sheetDraft.perWeek || 3) + Number(el.dataset.dir)));
      drawEditSheet();
      break;
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
    case 'goto': swap(() => { ui.date = parseKey(el.dataset.key); ui.tab = 'today'; render(); $scroller.scrollTo(0, 0); }, 'right'); break;
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
      if (kind !== QUIT && !sheetDraft.perWeek && !sheetDraft.perMonth && !sheetDraft.days.length) { toast('Choisissez au moins un jour'); break; }
      readLink(sheetDraft);
      if (sheetDraft.goalId && kind === CHECK && !(sheetDraft.goalPer > 0)) { toast("Indiquez combien chaque fois ajoute à l'objectif"); break; }
      if (kind === QUIT || !sheetDraft.goalId) { delete sheetDraft.goalId; delete sheetDraft.goalPer; delete sheetDraft.goalSince; }
      else if (sheetDraft.goalId !== habitById(sheetDraft.id)?.goalId) sheetDraft.goalSince = sheetIsNew ? sheetDraft.createdAt : dkey(today());
      if (kind === QUIT) { sheetDraft.perWeek = null; sheetDraft.perMonth = null; }
      if (kind === QUIT || sheetDraft.perWeek || sheetDraft.perMonth) sheetDraft.days = [0, 1, 2, 3, 4, 5, 6];
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
    case 'new-goal': openGoalSheet(null); break;
    case 'goal': openGoalSheet(data.goals.find((g) => g.id === el.dataset.gid)); break;
    case 'g-cat':
      goalDraft.cat = el.dataset.v;
      $sheetBody.querySelectorAll('.gcat').forEach((b) => { b.classList.toggle('on', b === el); b.setAttribute('aria-pressed', b === el); });
      refreshGoalNow();
      break;
    case 'g-due': {
      const y = today().getFullYear();
      readGoal(goalDraft);
      goalDraft.dueMode = el.dataset.v;
      if (el.dataset.v === 'y0') goalDraft.due = `${y}-12-31`;
      else if (el.dataset.v === 'y1') goalDraft.due = `${y + 1}-12-31`;
      drawGoalSheet();
      break;
    }
    case 'g-kind': goalDraft.kind = el.dataset.v; drawGoalSheet(); break;
    case 'g-step': {
      const st = goalDraft.steps[Number(el.dataset.i)];
      st.done = !st.done;
      el.classList.toggle('on', st.done);
      el.setAttribute('aria-pressed', st.done);
      if (navigator.vibrate) navigator.vibrate(8);
      refreshGoalNow();
      break;
    }
    case 'g-save': {
      const d = goalDraft;
      readGoal(d);
      d.name = d.name.trim();
      d.why = (d.why || '').trim();
      if (!d.name) { toast('Donnez un nom à votre objectif'); break; }
      if (d.kind === AMOUNT && !(d.target > 0)) { toast('Indiquez une cible chiffrée'); break; }
      if (d.kind === STEPS && !d.steps.length) { toast('Ajoutez au moins une étape'); break; }
      if (!d.due) { toast('Choisissez une échéance'); break; }
      const old = data.goals.find((g) => g.id === d.id);
      const was = old ? goalProgress(liveGoal(old)) : 0;
      const { dueMode, ...clean } = d;
      if (clean.kind === AMOUNT) {
        // On saisit le total ; on garde à part ce qui a été noté à la main.
        clean.current = (Number(d.current) || 0) - (old ? goalLinked(old, data.habits, data.log) : 0);
        const hist = (old && old.hist) ? [...old.hist] : [{ d: (old || d).createdAt, v: old ? Number(old.current) || 0 : clean.current }];
        if (!old || clean.current !== (Number(old.current) || 0)) {
          const k = dkey(today());
          const i = hist.findIndex((x) => x.d === k);
          if (i >= 0) hist[i] = { d: k, v: clean.current };
          else hist.push({ d: k, v: clean.current });
        }
        clean.hist = hist;
      } else {
        // Étapes ou estimation : garder l'avancement de chaque jour où il change, pour la mini courbe.
        const now = goalProgress(clean);
        const phist = (old && old.phist) ? [...old.phist] : [{ d: (old || d).createdAt, p: old ? Number(old.startPct) || 0 : now }];
        if (!old || now !== goalProgress(old)) {
          const k = dkey(today());
          const i = phist.findIndex((x) => x.d === k);
          if (i >= 0) phist[i] = { d: k, p: now };
          else phist.push({ d: k, p: now });
        }
        clean.phist = phist;
      }
      if (old) Object.assign(old, clean);
      else data.goals.push({ ...clean, startPct: goalProgress(clean) });
      save();
      closeSheet();
      render();
      if (goalProgress(liveGoal(clean)) >= 1 && was < 1) celebrate('Objectif atteint, bravo');
      break;
    }
    case 'g-delete': {
      if (!confirm('Supprimer cet objectif ?')) break;
      data.goals = data.goals.filter((g) => g.id !== goalDraft.id);
      for (const h of data.habits) if (h.goalId === goalDraft.id) { delete h.goalId; delete h.goalPer; delete h.goalSince; }
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
  if (e.target.id === 'g-pct') {
    const out = document.getElementById('g-pct-v');
    if (out) out.textContent = `${e.target.value} %`;
  }
  if (['g-current', 'g-pct', 'g-target'].includes(e.target.id)) refreshGoalNow();
  if (e.target.id !== 'run-note' || !run) return;
  setNote(runSteps()[run.idx], dkey(today()), e.target.value);
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'h-goal' && sheetDraft) { sheetDraft.goalId = e.target.value || null; drawEditSheet(); }
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

// ---------- Appui façon Liquid Glass ----------
// La lueur suit le doigt ; l'état « appuyé » dure au moins un instant, même sur un toucher bref.
const PRESS_SEL = '.btn, .seg, .dp, .cp, .ip, .day, .row, .theme-opt, .step-main, .nav, .x, .top-btn, .gcat, .g-step, .goal, .mood-b, .tab, .tile-more, .tile-minus, .tile-main';
let pressed = null;
function glowAt(el, e) {
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
}
document.addEventListener('pointerdown', (e) => {
  let el = e.target.closest(PRESS_SEL);
  if (!el || el.disabled) return;
  if (el.classList.contains('tile-main')) el = el.closest('.tile') || el;
  pressed = { el, t: performance.now() };
  glowAt(el, e);
  el.classList.add('pressing');
  if (el.classList.contains('tab')) el.parentElement.classList.add('lens');
}, { passive: true });
document.addEventListener('pointermove', (e) => { if (pressed) glowAt(pressed.el, e); }, { passive: true });
function releasePress() {
  if (!pressed) return;
  const { el, t } = pressed;
  pressed = null;
  setTimeout(() => {
    el.classList.remove('pressing');
    el.parentElement?.classList.remove('lens');
  }, Math.max(0, 140 - (performance.now() - t)));
}
['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, releasePress, { passive: true }));

// Un choix qui vient de s'allumer rebondit (segments, jours, couleurs, domaines…).
document.addEventListener('click', (e) => {
  const el = e.target.closest('.seg, .dp, .cp, .gcat, .ip, .theme-opt, .g-step');
  if (!el) return;
  requestAnimationFrame(() => {
    // La fiche a pu être redessinée : retrouver le bouton équivalent.
    const sel = ['act', 'v', 'i', 'c', 'k', 't', 'w', 'week'].map((k) => (el.dataset[k] !== undefined ? `[data-${k}="${CSS.escape(el.dataset[k])}"]` : '')).join('');
    const now = el.isConnected ? el : document.querySelector(`.${el.classList[0]}${sel}`);
    if (!now || !now.classList.contains('on')) return;
    now.classList.remove('lit');
    void now.offsetWidth;
    now.classList.add('lit');
  });
});

// Bloque le zoom à deux doigts sur iPhone : l'appli reste à sa taille.
['gesturestart', 'gesturechange'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
