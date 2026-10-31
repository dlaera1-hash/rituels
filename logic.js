// Calculs purs (dates, séries, taux, bilan). Aucun accès à l'écran ni au stockage,
// ce qui permet de les tester avec Node.

export const DONE = 'done';
export const FAIL = 'fail';
export const SKIP = 'skip';

// Types d'habitude
export const CHECK = 'check'; // à cocher
export const COUNT = 'count'; // chiffrée (2 L, 20 pages) : faite quand l'objectif est atteint
export const QUIT = 'quit'; // à arrêter : chaque jour compte comme tenu, sauf écart noté

// ---------- Dates ----------

// Clé de jour "AAAA-MM-JJ" en heure locale.
export function dkey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Lundi = 0 ... dimanche = 6
export function weekday(d) {
  return (d.getDay() + 6) % 7;
}

export function startOfWeek(d) {
  return addDays(d, -weekday(d));
}

// ---------- Statut d'un jour ----------

export function kindOf(h) {
  return h.type || CHECK;
}

// Habitude "X fois par semaine" : prévue tous les jours, réussie à la semaine.
export function isWeekly(h) {
  return kindOf(h) !== QUIT && h.perWeek > 0;
}

export function isScheduled(h, d) {
  if (h.archived || dkey(d) < h.createdAt) return false;
  if (kindOf(h) === QUIT || isWeekly(h)) return true;
  return h.days.includes(weekday(d));
}

export function statusOf(log, h, key) {
  return log[key]?.[h.id]?.s || null;
}

export function valueOf(log, h, key) {
  return Number(log[key]?.[h.id]?.v) || 0;
}

// Statut effectif : une habitude à arrêter est tenue tant qu'aucun écart n'est noté.
export function statusFor(h, log, key) {
  const s = statusOf(log, h, key);
  if (kindOf(h) === QUIT) {
    if (key < h.createdAt) return null;
    return s === FAIL || s === SKIP ? s : DONE;
  }
  return s;
}

// Statut d'une habitude chiffrée après un changement de valeur.
export function statusForValue(h, v, previous) {
  if (v >= (h.target || 1)) return DONE;
  return previous === FAIL || previous === SKIP ? previous : null;
}

// ---------- Semaines (habitudes "X fois par semaine") ----------

// Nombre de jours faits dans la semaine de d, du lundi jusqu'à d inclus.
export function weekDone(h, log, d) {
  let n = 0;
  const end = dkey(d);
  for (let x = startOfWeek(d); dkey(x) <= end; x = addDays(x, 1)) {
    if (statusFor(h, log, dkey(x)) === DONE) n++;
  }
  return n;
}

// Semaines consécutives réussies. La semaine en cours compte si l'objectif
// est déjà atteint, et ne casse pas la série sinon.
function weeklyStreak(h, log, today) {
  let n = weekDone(h, log, today) >= h.perWeek ? 1 : 0;
  for (let ws = addDays(startOfWeek(today), -7); dkey(addDays(ws, 6)) >= h.createdAt; ws = addDays(ws, -7)) {
    if (weekDone(h, log, addDays(ws, 6)) >= h.perWeek) n++;
    else break;
  }
  return n;
}

function weeklyBest(h, log, today) {
  let best = 0;
  let run = 0;
  const cur = dkey(startOfWeek(today));
  for (let ws = startOfWeek(parseKey(h.createdAt)); dkey(ws) <= cur; ws = addDays(ws, 7)) {
    const isCurrent = dkey(ws) === cur;
    const ok = weekDone(h, log, isCurrent ? today : addDays(ws, 6)) >= h.perWeek;
    if (ok) { run++; best = Math.max(best, run); }
    else if (!isCurrent) run = 0;
  }
  return best;
}

// ---------- Séries et taux ----------

// Série en cours (en jours, ou en semaines pour une habitude hebdomadaire).
// "Sauté" ne casse pas la série. Aujourd'hui non renseigné ne la casse pas non plus.
export function currentStreak(h, log, today) {
  if (isWeekly(h)) return weeklyStreak(h, log, today);
  let n = 0;
  let d = today;
  for (let i = 0; i < 3700; i++) {
    const k = dkey(d);
    if (k < h.createdAt) break;
    if (isScheduled({ ...h, archived: false }, d)) {
      const s = statusFor(h, log, k);
      if (s === DONE) n++;
      else if (s === SKIP) { /* neutre */ }
      else if (i === 0 && !s) { /* aujourd'hui, pas encore fait */ }
      else break;
    }
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(h, log, today) {
  if (isWeekly(h)) return weeklyBest(h, log, today);
  let best = 0;
  let run = 0;
  const end = dkey(today);
  const live = { ...h, archived: false };
  for (let d = parseKey(h.createdAt); dkey(d) <= end; d = addDays(d, 1)) {
    if (!isScheduled(live, d)) continue;
    const s = statusFor(h, log, dkey(d));
    if (s === DONE) { run++; best = Math.max(best, run); }
    else if (s === SKIP) continue;
    else if (dkey(d) === end && !s) continue;
    else run = 0;
  }
  return best;
}

// Taux de réussite sur les N derniers jours (hors jours sautés, hors aujourd'hui
// s'il n'est pas encore renseigné). Renvoie null si aucun jour à compter.
export function successRate(h, log, today, days = 30) {
  if (isWeekly(h)) {
    let done = 0;
    let span = 0;
    for (let i = 0; i < days; i++) {
      const k = dkey(addDays(today, -i));
      if (k < h.createdAt) break;
      span++;
      if (statusFor(h, log, k) === DONE) done++;
    }
    if (!span) return null;
    return Math.min(100, Math.round((done / ((h.perWeek * span) / 7)) * 100));
  }
  let done = 0;
  let total = 0;
  const live = { ...h, archived: false };
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    const k = dkey(d);
    if (k < h.createdAt) break;
    if (!isScheduled(live, d)) continue;
    const s = statusFor(h, log, k);
    if (s === SKIP) continue;
    if (i === 0 && !s) continue;
    total++;
    if (s === DONE) done++;
  }
  return total ? Math.round((done / total) * 100) : null;
}

// Est-ce que l'habitude compte dans l'anneau de ce jour ?
// Sautée : non. Hebdomadaire dont l'objectif est déjà atteint et pas faite ce jour : non.
function countsForDay(h, log, d) {
  if (!isScheduled(h, d)) return false;
  const s = statusFor(h, log, dkey(d));
  if (s === SKIP) return false;
  if (isWeekly(h) && s !== DONE && weekDone(h, log, d) >= h.perWeek) return false;
  return true;
}

export function dayProgress(habits, log, d) {
  const k = dkey(d);
  let done = 0;
  let total = 0;
  for (const h of habits) {
    if (!countsForDay(h, log, d)) continue;
    total++;
    if (statusFor(h, log, k) === DONE) done++;
  }
  return { done, total };
}

// ---------- Routines ----------
// Une routine est un groupe d'habitudes. Son état du jour :
// null = rien de prévu, SKIP = tout sauté, DONE = tout fait,
// PARTIAL = commencé, EMPTY = rien de fait.
export const PARTIAL = 'partial';
export const EMPTY = 'empty';

export function groupStatus(steps, log, d) {
  const k = dkey(d);
  let total = 0;
  let done = 0;
  let any = false;
  for (const h of steps) {
    if (!isScheduled(h, d)) continue;
    any = true;
    const s = statusFor(h, log, k);
    if (s === SKIP) continue;
    total++;
    if (s === DONE) done++;
  }
  if (!any) return null;
  if (!total) return SKIP;
  if (done === total) return DONE;
  return done ? PARTIAL : EMPTY;
}

// Jours consécutifs où la routine a été faite en entier.
export function groupStreak(steps, log, today) {
  const start = steps.reduce((m, h) => (h.createdAt < m ? h.createdAt : m), '9999-12-31');
  let n = 0;
  let d = today;
  for (let i = 0; i < 3700; i++) {
    if (dkey(d) < start) break;
    const s = groupStatus(steps, log, d);
    if (s === DONE) n++;
    else if (s === null || s === SKIP) { /* neutre */ }
    else if (i === 0) { /* aujourd'hui en cours */ }
    else break;
    d = addDays(d, -1);
  }
  return n;
}

// ---------- Série en danger ----------

// Habitudes qui risquent de casser leur série aujourd'hui.
// Quotidiennes : série d'au moins 2 jours et rien de noté aujourd'hui.
// Hebdomadaires : il reste juste assez de jours (ou moins) pour atteindre l'objectif.
export function atRisk(habits, log, today) {
  const k = dkey(today);
  const out = [];
  for (const h of habits) {
    if (!isScheduled(h, today) || kindOf(h) === QUIT) continue;
    if (statusFor(h, log, k)) continue;
    if (isWeekly(h)) {
      const need = h.perWeek - weekDone(h, log, today);
      const left = 7 - weekday(today);
      if (need > 0 && need >= left) out.push({ h, need, left });
    } else {
      const streak = currentStreak(h, log, today);
      if (streak >= 2) out.push({ h, streak });
    }
  }
  return out;
}

// ---------- Bilan de la semaine ----------

// ws : lundi de la semaine. Les jours après "today" ne sont pas comptés.
export function weekReview(habits, log, moods, ws, today) {
  const t = dkey(today);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    if (dkey(d) <= t) days.push(d);
  }
  const active = habits.filter((h) => !h.archived);

  // Taux global de la semaine
  let done = 0;
  let total = 0;
  for (const d of days) {
    const p = dayProgress(active, log, d);
    // Aujourd'hui pas fini : ne compter que ce qui est fait
    if (dkey(d) === t) { done += p.done; total += p.done; continue; }
    done += p.done;
    total += p.total;
  }

  // Taux par habitude, pour repérer celle qui décroche
  const perHabit = active.map((h) => {
    if (isWeekly(h)) {
      const n = weekDone(h, log, days[days.length - 1] || ws);
      return { h, done: n, total: h.perWeek, rate: Math.min(1, n / h.perWeek) };
    }
    let d2 = 0;
    let t2 = 0;
    for (const d of days) {
      if (!isScheduled(h, d)) continue;
      const s = statusFor(h, log, dkey(d));
      if (s === SKIP || (dkey(d) === t && s !== DONE)) continue;
      t2++;
      if (s === DONE) d2++;
    }
    return { h, done: d2, total: t2, rate: t2 ? d2 / t2 : null };
  }).filter((x) => x.rate !== null && x.total > 0);
  const weakest = perHabit.length ? perHabit.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;

  // Meilleure série en cours
  let best = null;
  for (const h of active) {
    const n = currentStreak(h, log, today);
    if (n > 0 && (!best || n > best.streak)) best = { h, streak: n, weekly: isWeekly(h) };
  }

  // Jour de la semaine le plus faible sur les 4 dernières semaines (hors aujourd'hui)
  const byDay = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }));
  for (let i = 1; i <= 28; i++) {
    const d = addDays(today, -i);
    const p = dayProgress(active, log, d);
    byDay[weekday(d)].done += p.done;
    byDay[weekday(d)].total += p.total;
  }
  let weakDay = null;
  byDay.forEach((x, i) => {
    if (x.total < 2) return;
    const r = x.done / x.total;
    if (!weakDay || r < weakDay.rate) weakDay = { day: i, rate: r };
  });

  // Humeur : moyenne de la semaine, et l'habitude qui va avec les meilleurs jours (28 jours)
  const weekMoods = days.map((d) => moods[dkey(d)]).filter(Boolean);
  const moodAvg = weekMoods.length ? weekMoods.reduce((a, b) => a + b, 0) / weekMoods.length : null;
  let moodLink = null;
  for (const h of active) {
    const withH = [];
    const without = [];
    for (let i = 0; i < 28; i++) {
      const d = addDays(today, -i);
      const m = moods[dkey(d)];
      if (!m || !isScheduled(h, d)) continue;
      (statusFor(h, log, dkey(d)) === DONE ? withH : without).push(m);
    }
    if (withH.length < 3 || without.length < 3) continue;
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const diff = avg(withH) - avg(without);
    if (diff >= 0.5 && (!moodLink || diff > moodLink.diff)) moodLink = { h, with: avg(withH), without: avg(without), diff };
  }

  return {
    rate: total ? Math.round((done / total) * 100) : null,
    done,
    total,
    best,
    weakest: weakest && weakest.rate < 1 ? weakest : null,
    weakDay,
    moodAvg,
    moodLink,
  };
}

// ---------- Objectifs de vie ----------

// Façons de mesurer un objectif
export const AMOUNT = 'amount'; // montant ou quantité : actuel / cible (12 000 € sur 40 000 €)
export const STEPS = 'steps'; // étapes à cocher
export const MANUAL = 'manual'; // estimation à la main, en pourcentage

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Avancement entre 0 et 1.
export function goalProgress(g) {
  if (g.kind === STEPS) {
    const n = (g.steps || []).length;
    return n ? g.steps.filter((s) => s.done).length / n : 0;
  }
  if (g.kind === MANUAL) return clamp01((Number(g.pct) || 0) / 100);
  return g.target > 0 ? clamp01((Number(g.current) || 0) / g.target) : 0;
}

// Où en est-on par rapport au temps écoulé entre la création et l'échéance ?
// Le rythme attendu part de l'avancement au jour de la création (startPct, entre 0 et 1) :
// un apport déjà à 30 % le jour où on le note est « dans les temps », pas « en avance ».
// state : done (atteint), late (échéance passée), ahead (en avance), ontrack (dans les temps), behind (en retard).
export function goalPace(g, today) {
  const p = goalProgress(g);
  if (p >= 1) return { state: 'done', expected: 1 };
  if (dkey(today) > g.due) return { state: 'late', expected: 1 };
  const start = parseKey(g.createdAt);
  const span = parseKey(g.due) - start;
  const p0 = clamp01(Number(g.startPct) || 0);
  const expected = span > 0 ? p0 + (1 - p0) * clamp01((today - start) / span) : 1;
  const diff = p - expected;
  return { state: diff >= 0.05 ? 'ahead' : diff >= -0.1 ? 'ontrack' : 'behind', expected };
}

// Avancement moyen des objectifs en cours (0 à 1), null s'il n'y en a aucun.
export function goalsOverall(goals) {
  if (!goals.length) return null;
  return goals.reduce((s, g) => s + goalProgress(g), 0) / goals.length;
}

// ---------- Habitudes liées à un objectif chiffré ----------

// Ce que les habitudes liées ont apporté à l'objectif, jusqu'au jour « until » inclus (clé AAAA-MM-JJ).
// Habitude à cocher : + goalPer chaque fois qu'elle est faite.
// Habitude chiffrée : valeur notée × goalPer (1 par défaut : 50 € notés = 50 € ajoutés).
// Seuls les jours à partir de goalSince comptent : relier une habitude n'ajoute pas son passé.
export function goalLinked(g, habits, log, until = null) {
  let sum = 0;
  for (const h of habits) {
    if (h.goalId !== g.id || kindOf(h) === QUIT) continue;
    const count = kindOf(h) === COUNT;
    const per = Number(h.goalPer) || (count ? 1 : 0);
    if (!per) continue;
    const since = h.goalSince || h.createdAt;
    for (const k in log) {
      if (k < since || (until && k > until)) continue;
      const e = log[k][h.id];
      if (!e) continue;
      if (count) sum += (Number(e.v) || 0) * per;
      else if (e.s === DONE) sum += per;
    }
  }
  return sum;
}

// Points de la courbe d'un objectif chiffré : saisies à la main (hist) + apports des habitudes liées.
// hist : [{ d, v }] où v est la part saisie à la main ce jour-là.
export function goalSeries(g, habits, log, today) {
  const end = dkey(today);
  const hist = (g.hist && g.hist.length ? [...g.hist] : [{ d: g.createdAt, v: Number(g.current) || 0 }])
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  const days = new Set([g.createdAt, end, ...hist.map((x) => x.d)]);
  for (const h of habits) {
    if (h.goalId !== g.id) continue;
    for (const k in log) if (log[k][h.id]) days.add(k);
  }
  const manualAt = (k) => {
    let v = hist[0].v;
    for (const x of hist) if (x.d <= k) v = x.v;
    return v;
  };
  return [...days].filter((k) => k >= g.createdAt && k <= end).sort()
    .map((k) => ({ d: k, v: manualAt(k) + goalLinked(g, habits, log, k) }));
}
