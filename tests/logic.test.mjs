import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONE, FAIL, SKIP, dkey, addDays, currentStreak, bestStreak, successRate, dayProgress, weekday } from '../logic.js';

const T = new Date(2026, 9, 30); // vendredi 30 octobre 2026
const h = { id: 'a', days: [0,1,2,3,4,5,6], createdAt: dkey(addDays(T, -10)), archived: false };
const L = (arr) => { const log = {}; arr.forEach(([i, s]) => { (log[dkey(addDays(T, -i))] ||= {}).a = { s, note: '' }; }); return log; };

test('vendredi = 4', () => assert.equal(weekday(T), 4));
test('série : aujourd\'hui vide ne casse pas', () => assert.equal(currentStreak(h, L([[1,DONE],[2,DONE]]), T), 2));
test('série : sauté ne casse pas', () => assert.equal(currentStreak(h, L([[0,DONE],[1,SKIP],[2,DONE]]), T), 2));
test('série : pas fait casse', () => assert.equal(currentStreak(h, L([[0,DONE],[1,FAIL],[2,DONE]]), T), 1));
test('série : jour vide passé casse', () => assert.equal(currentStreak(h, L([[1,DONE],[3,DONE]]), T), 1));
test('série : jours non prévus ignorés', () => {
  const wk = { ...h, days: [0,2,4] }; // lun, mer, ven
  // ven 30 vide (aujourd'hui) ; mer 28, lun 26, ven 23 faits ; jeu, mar, sam, dim non prévus
  assert.equal(currentStreak(wk, L([[2,DONE],[4,DONE],[7,DONE]]), T), 3);
});
test('record', () => assert.equal(bestStreak(h, L([[9,DONE],[8,DONE],[7,DONE],[6,FAIL],[1,DONE]]), T), 3));
test('taux 30 j sans aujourd\'hui vide ni sautés', () => assert.equal(successRate(h, L([[1,DONE],[2,FAIL],[3,SKIP]]), T, 4), 50));
test('avancement du jour', () => {
  const b = { ...h, id: 'b' };
  const log = { [dkey(T)]: { a: { s: DONE }, b: { s: SKIP } } };
  assert.deepEqual(dayProgress([h, b], log, T), { done: 1, total: 1 });
});
test('archivée exclue', () => assert.deepEqual(dayProgress([{ ...h, archived: true }], {}, T), { done: 0, total: 0 }));

import { groupStatus, groupStreak, PARTIAL, EMPTY } from '../logic.js';
const s1 = { ...h, id: 'a' };
const s2 = { ...h, id: 'b' };
const G = (rows) => { const log = {}; rows.forEach(([i, a, b]) => { const k = dkey(addDays(T, -i)); log[k] = {}; if (a) log[k].a = { s: a }; if (b) log[k].b = { s: b }; }); return log; };
test('routine : complète, partielle, vide', () => {
  const log = G([[1, DONE, DONE], [2, DONE, null], [3, null, null], [4, DONE, SKIP], [5, SKIP, SKIP]]);
  assert.equal(groupStatus([s1, s2], log, addDays(T, -1)), DONE);
  assert.equal(groupStatus([s1, s2], log, addDays(T, -2)), PARTIAL);
  assert.equal(groupStatus([s1, s2], log, addDays(T, -3)), EMPTY);
  assert.equal(groupStatus([s1, s2], log, addDays(T, -4)), DONE);
  assert.equal(groupStatus([s1, s2], log, addDays(T, -5)), SKIP);
});
test('routine : série, aujourd\'hui partiel ne casse pas', () => {
  const log = G([[0, DONE, null], [1, DONE, DONE], [2, DONE, SKIP], [3, SKIP, SKIP], [4, DONE, DONE], [5, DONE, null]]);
  assert.equal(groupStreak([s1, s2], log, T), 3);
});

// ---------- Nouvelles règles ----------
import { QUIT, COUNT, statusFor, statusForValue, weekDone, atRisk, weekReview, startOfWeek as sow, parseKey } from '../logic.js';

test('à arrêter : tenu par défaut, écart casse la série', () => {
  const q = { id: 'q', type: QUIT, days: [0,1,2,3,4,5,6], createdAt: dkey(addDays(T, -9)) };
  assert.equal(statusFor(q, {}, dkey(T)), DONE);
  assert.equal(currentStreak(q, {}, T), 10); // du jour de création à aujourd'hui inclus
  const log = { [dkey(addDays(T, -3))]: { q: { s: FAIL } } };
  assert.equal(currentStreak(q, log, T), 3);
  assert.equal(bestStreak(q, log, T), 6);
});

test('chiffrée : faite quand l\'objectif est atteint', () => {
  const c = { id: 'c', type: COUNT, target: 2 };
  assert.equal(statusForValue(c, 1.5, null), null);
  assert.equal(statusForValue(c, 2, null), DONE);
  assert.equal(statusForValue(c, 0.5, SKIP), SKIP);
});

test('hebdo : série en semaines, semaine en cours neutre', () => {
  // T = vendredi 30/10. Semaines précédentes : lun 19 et lun 12.
  const w = { id: 'w', days: [0,1,2,3,4,5,6], perWeek: 2, createdAt: '2026-10-12' };
  const L2 = (keys) => { const log = {}; keys.forEach((k) => { log[k] = { w: { s: DONE } }; }); return log; };
  const log = L2(['2026-10-12', '2026-10-14', '2026-10-20', '2026-10-25', '2026-10-27']);
  assert.equal(weekDone(w, log, T), 1);
  assert.equal(currentStreak(w, log, T), 2); // 2 semaines passées réussies, celle-ci en cours
  log['2026-10-29'] = { w: { s: DONE } };
  assert.equal(currentStreak(w, log, T), 3);
});

test('hebdo : objectif atteint = sort de l\'anneau les autres jours', () => {
  const w = { id: 'w', days: [0,1,2,3,4,5,6], perWeek: 1, createdAt: '2026-10-01' };
  const log = { '2026-10-27': { w: { s: DONE } } };
  assert.deepEqual(dayProgress([w], log, T), { done: 0, total: 0 });
  assert.deepEqual(dayProgress([w], log, parseKey('2026-10-27')), { done: 1, total: 1 });
});

test('série en danger', () => {
  const d = { id: 'd', days: [0,1,2,3,4,5,6], createdAt: '2026-10-01' };
  const log = { [dkey(addDays(T, -1))]: { d: { s: DONE } }, [dkey(addDays(T, -2))]: { d: { s: DONE } } };
  assert.equal(atRisk([d], log, T).length, 1);
  log[dkey(T)] = { d: { s: DONE } };
  assert.equal(atRisk([d], log, T).length, 0);
  // Hebdo 3 fois, 0 fait, vendredi : il reste 3 jours -> en danger
  const w = { id: 'w', days: [0,1,2,3,4,5,6], perWeek: 3, createdAt: '2026-10-01' };
  assert.equal(atRisk([w], {}, T).length, 1);
});

test('bilan de la semaine', () => {
  const a = { id: 'a', days: [0,1,2,3,4,5,6], createdAt: '2026-09-01' };
  const b = { id: 'b', days: [0,1,2,3,4,5,6], createdAt: '2026-09-01' };
  const log = {};
  const moods = {};
  for (let i = 1; i <= 28; i++) {
    const k = dkey(addDays(T, -i));
    log[k] = { a: { s: DONE }, b: { s: i % 2 ? DONE : FAIL } };
    moods[k] = i % 2 ? 5 : 2; // humeur haute les jours où b est fait
  }
  const r = weekReview([a, b], log, moods, sow(T), T);
  assert.equal(r.best.h.id, 'a');
  assert.equal(r.weakest.h.id, 'b');
  assert.equal(r.moodLink.h.id, 'b');
  assert.ok(r.rate > 50 && r.rate < 100);
});

import { AMOUNT, STEPS, MANUAL, goalProgress, goalPace, goalsOverall } from '../logic.js';

test('objectif montant : actuel sur cible, plafonné à 100 %', () => {
  assert.equal(goalProgress({ kind: AMOUNT, current: 12000, target: 40000 }), 0.3);
  assert.equal(goalProgress({ kind: AMOUNT, current: 50000, target: 40000 }), 1);
  assert.equal(goalProgress({ kind: AMOUNT, current: 100, target: 0 }), 0);
});
test('objectif par étapes et à l\'estime', () => {
  assert.equal(goalProgress({ kind: STEPS, steps: [{ done: true }, { done: false }, { done: true }, { done: false }] }), 0.5);
  assert.equal(goalProgress({ kind: STEPS, steps: [] }), 0);
  assert.equal(goalProgress({ kind: MANUAL, pct: 35 }), 0.35);
});
test('rythme : en avance, dans les temps, en retard, échéance passée, atteint', () => {
  // Créé le 1er janvier, échéance le 31 décembre : fin octobre, environ 83 % de l'année est écoulé.
  const g = (current) => ({ kind: AMOUNT, current, target: 100, createdAt: '2026-01-01', due: '2026-12-31' });
  assert.equal(goalPace(g(95), T).state, 'ahead');
  assert.equal(goalPace(g(80), T).state, 'ontrack');
  assert.equal(goalPace(g(40), T).state, 'behind');
  assert.equal(goalPace(g(100), T).state, 'done');
  assert.equal(goalPace({ ...g(40), due: '2026-10-01' }, T).state, 'late');
});
test('avancement moyen', () => {
  assert.equal(goalsOverall([]), null);
  assert.equal(goalsOverall([{ kind: MANUAL, pct: 20 }, { kind: MANUAL, pct: 60 }]), 0.4);
});
test('rythme : part de l\'avancement au jour de la création', () => {
  const g = { kind: AMOUNT, current: 12000, target: 40000, createdAt: dkey(T), due: '2026-12-31' };
  assert.equal(goalPace(g, T).state, 'ahead'); // sans point de départ, 30 % dès le premier jour paraît en avance
  assert.equal(goalPace({ ...g, startPct: 0.3 }, T).state, 'ontrack');
  // Un an plus tard, à mi-parcours du temps, il faut être vers 65 % (30 % + la moitié du reste)
  const y = { ...g, startPct: 0.3, createdAt: '2026-01-01', due: '2027-12-31' };
  assert.equal(goalPace({ ...y, current: 12000 }, new Date(2027, 0, 1)).state, 'behind');
  assert.equal(goalPace({ ...y, current: 26000 }, new Date(2027, 0, 1)).state, 'ontrack');
});
