import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { applyClassicMove, normalizeClassicTttState } from '../lib/games.js';

const memory = new Map();
const sandbox = {
  console, URL, Date, Math, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
  localStorage: { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'), sandbox);

const call = (path, method = 'GET', body) => sandbox.localApi(path, { method, body: JSON.stringify(body) });
const as = (id) => memory.set('quiet_mailbox_user', String(id));

const created = await call('/api/create', 'POST', { name: 'Яночкин', pin: '1234' });
await call('/api/join', 'POST', { name: 'Саняня', pin: '5678', code: created.invite_code });

// Settings still update the current authenticated identity.
as(1);
await call('/api/pin', 'POST', { name: 'Яночкин (Питер)', pin: '4321' });
const state = await call('/api/state');
assert.equal(state.user.name, 'Яночкин (Питер)');
await call('/api/pin', 'POST', { name: 'Яночкин' });

// Personalization is deliberately owned by the current account, including every tab group.
const initialPrefs = await call('/api/preferences');
assert.equal(initialPrefs.preferences.theme, 'pink');
const savedPrefs = await call('/api/preferences', 'POST', {
  theme: 'blue',
  orders: { main: ['games', 'mailbox', 'dates', 'our'], mailbox: ['capsule', 'mailbox', 'conversation', 'homework'] },
});
assert.equal(savedPrefs.preferences.theme, 'blue');
// A custom tab order is personal and now survives; a key left out of the list
// is appended in its default place instead of disappearing.
assert.equal(JSON.stringify(savedPrefs.preferences.orders.main), JSON.stringify(['games', 'mailbox', 'dates', 'our']));
assert.equal(JSON.stringify(savedPrefs.preferences.orders.mailbox), JSON.stringify(['capsule', 'mailbox', 'conversation', 'homework', 'agreements']));
assert.equal((await call('/api/state')).preferences.theme, 'blue');
as(2);
assert.equal((await call('/api/preferences')).preferences.theme, 'pink', 'the partner keeps a separate appearance');

// Both people have their own private notes about the other person.
as(1);
const emptyPartnerCard = await call('/api/partner-profile');
assert.equal(emptyPartnerCard.partner.name, 'Саняня');
assert.equal(emptyPartnerCard.fields, null);
const firstPartnerCard = await call('/api/partner-profile', 'POST', { fields: [
  { id: 'favorite_color', label: 'Любимый цвет', value: 'Синий', accent: 'sky' },
  { id: 'custom_trip', label: 'Место мечты', value: 'Берег моря', accent: 'theme' },
] });
assert.equal(firstPartnerCard.fields.length, 2);
assert.equal(firstPartnerCard.fields[1].value, 'Берег моря');
assert.equal(firstPartnerCard.fields[0].accent, 'sky', 'a chosen memory accent is stored with the private field');
as(2);
assert.equal((await call('/api/partner-profile')).fields, null, 'partner notes never leak into the other account');
const secondPartnerCard = await call('/api/partner-profile', 'POST', { fields: [{ label: 'Любимое блюдо', value: 'Паста' }] });
assert.equal(secondPartnerCard.partner.name, 'Яночкин');
as(1);
const restoredPartnerCard = await call('/api/partner-profile');
assert.equal(restoredPartnerCard.fields[1].label, 'Место мечты');

// Game 1: a dream is hidden from its author until the partner guesses.
const afterCreate = await call('/api/games', 'POST', {
  action: 'truths_create',
  truth1: 'Я живу в Питере',
  truth2: 'Я обожаю наши ночные созвоны',
  dream: 'Проснуться в одном часовом поясе без будильников',
});
assert.equal(afterCreate.truths.rounds.length, 1);
const roundId = afterCreate.truths.rounds[0].id;
const dreamIdx = afterCreate.truths.rounds[0].dream_index;

as(2);
const partnerView = await call('/api/games');
assert.equal(partnerView.truths.rounds[0].dream_index, null);
const afterGuess = await call('/api/games', 'POST', {
  action: 'truths_guess', round_id: roundId, guessed_index: dreamIdx,
});
assert.equal(afterGuess.truths.rounds[0].is_correct, true);
assert.equal(afterGuess.truths.scores.mine, 1);
const afterTruthsReset = await call('/api/games', 'POST', { action: 'truths_reset' });
assert.equal(afterTruthsReset.truths.rounds.length, 0);
assert.equal(afterTruthsReset.truths.scores.mine, 0);

// Game 2: endless-run records are score-only and determined by the authenticated account.
const partnerRunner = await call('/api/games', 'POST', { action: 'runner_score', score: 950 });
assert.equal(partnerRunner.runner.mine.best_score, 950);
assert.equal('best_km_left' in partnerRunner.runner.mine, false);
as(1);
const mineRunner = await call('/api/games', 'POST', { action: 'runner_score', score: 470 });
assert.equal(mineRunner.runner.mine.best_score, 470);
assert.equal(mineRunner.runner.partner.best_score, 950);
const lowerRun = await call('/api/games', 'POST', { action: 'runner_score', score: 120 });
assert.equal(lowerRun.runner.mine.best_score, 470, 'a lower run cannot replace the personal record');

// Game 3 online: a fixed 3×3 board keeps every placed mark, awards normal wins, and can end in a draw.
const catView = await call('/api/games');
assert.equal(catView.tictactoe.my_side, 'cat');
let game = await call('/api/games', 'POST', { action: 'ttt_move', cell: 0 });
assert.equal(game.tictactoe.turn, 'heart');
as(2);
assert.equal((await call('/api/games')).tictactoe.my_side, 'heart');
game = await call('/api/games', 'POST', { action: 'ttt_move', cell: 4 });
as(1);
game = await call('/api/games', 'POST', { action: 'ttt_move', cell: 1 });
as(2);
game = await call('/api/games', 'POST', { action: 'ttt_move', cell: 3 });
as(1);
game = await call('/api/games', 'POST', { action: 'ttt_move', cell: 2 });
assert.equal(JSON.stringify(game.tictactoe.catMoves), JSON.stringify([0, 1, 2]));
assert.equal(JSON.stringify(game.tictactoe.heartMoves), JSON.stringify([4, 3]));
assert.equal(game.tictactoe.winner, 'cat');
assert.equal(game.tictactoe.draw, false);
assert.equal(game.tictactoe.scores.cat, 1);

// A reset preserves the score and a full non-winning board is explicitly a draw.
game = await call('/api/games', 'POST', { action: 'ttt_reset' });
assert.equal(game.tictactoe.scores.cat, 1);
const drawMoves = [
  [1, 0], [2, 1], [1, 2], [2, 4], [1, 3], [2, 5], [1, 7], [2, 6], [1, 8],
];
for (const [userId, cell] of drawMoves) {
  as(userId);
  game = await call('/api/games', 'POST', { action: 'ttt_move', cell });
}
assert.equal(game.tictactoe.winner, null);
assert.equal(game.tictactoe.draw, true);
assert.equal(game.tictactoe.catMoves.length + game.tictactoe.heartMoves.length, 9);

// The shared pure helper also keeps pieces in their cells and rejects a move after a draw.
let board = { catMoves: [], heartMoves: [], turn: 'cat', winner: null, draw: false };
for (const [side, cell] of [['cat', 0], ['heart', 1], ['cat', 2], ['heart', 4], ['cat', 3], ['heart', 5], ['cat', 7], ['heart', 6], ['cat', 8]]) {
  board = applyClassicMove(board, side, cell);
}
assert.equal(board.draw, true);
assert.equal(board.catMoves.length, 5);
assert.equal(board.heartMoves.length, 4);
assert.throws(() => applyClassicMove(board, 'heart', 7), /завершена/);
assert.deepEqual(normalizeClassicTttState({ catMoves: [0, 0, 1], heartMoves: [1, 2] }).catMoves, [0, 1]);

console.log('PASS: profile/PIN, per-account personalization, private partner cards, Truths reset, authenticated endless-run records, and conventional identity-bound Tic-Tac-Toe wins/draws.');

// Notes stay closed before opening; finishing a cycle removes notes, not homework/capsule.
as(1);
await call('/api/notes','POST',{category:'hard',body:'Тема для спокойного разговора'});
assert.equal((await call('/api/state')).notes.length,0);
as(2);assert.equal((await call('/api/state')).notes.length,0);
await call('/api/open','POST',{now:true});
const opened=await call('/api/state');assert.equal(opened.notes.length,1);
const homework=await call('/api/homework','POST',{action:'create',note_id:opened.notes[0].id});
const caseId=homework.cases[0].id;
await call('/api/homework','POST',{action:'answer',case_id:caseId,body:'Мой взгляд пока закрыт от партнёра'});
as(1);
assert.equal((await call('/api/homework')).cases[0].partner_answer,null);
await call('/api/capsule','POST',{body:'Тёплая запись остаётся после разговора'});
await call('/api/finish','POST',{});
assert.equal((await call('/api/state')).opened,false);
assert.equal((await call('/api/state')).notes.length,0);
assert.equal((await call('/api/homework')).cases.length,1);
assert.equal((await call('/api/capsule')).entries.length,1);
await call('/api/homework','POST',{action:'answer',case_id:caseId,body:'Теперь мы оба поделились своим взглядом'});
assert.equal((await call('/api/homework')).cases[0].ready,true);
assert((await call('/api/homework')).cases[0].partner_answer.body.includes('закрыт'));
// New settings remain personal, including night mode and home arrangement.
await call('/api/preferences','POST',{theme:'purple',mode:'dark',homeOrder:['intimate','wishes','agreements','decisions'],homeTitles:{wishes:'Наши мечты'}});
assert.equal((await call('/api/preferences')).preferences.mode,'dark');
await call('/api/preferences','POST',{homeHidden:['decisions']});
assert.equal((await call('/api/preferences')).preferences.mode,'dark');
as(2);assert.equal((await call('/api/preferences')).preferences.mode,'light');
console.log('PASS: closed letters, two-answer gate, cycle disappearance with preserved homework/capsule, personal v30 settings.');
