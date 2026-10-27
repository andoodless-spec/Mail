import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const memory = new Map();
const sandbox = {
  console, URL, Date, Math, JSON, Blob: class {}, setTimeout: () => 0, clearTimeout: () => {},
  setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  document: {
    documentElement: { dataset: {} },
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, append() {}, remove() {}, click() {} }),
    body: { append() {} },
  },
  localStorage: {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(new URL('../backup.js', import.meta.url), 'utf8'), sandbox);

// Резервная копия ходит через тот же API, что и интерфейс: в тесте его заменяет
// локальная модель, поэтому проверка не требует сети и базы.
sandbox.api = async (path, options = {}) => sandbox.localApi(path, options);

const call = (path, method = 'GET', body) => sandbox.localApi(path, { method, body: JSON.stringify(body) });
const as = (id) => memory.set('quiet_mailbox_user', String(id));

const created = await call('/api/create', 'POST', { name: 'Яночкин', pin: '1234' });
await call('/api/join', 'POST', { name: 'Саняня', pin: '5678', code: created.invite_code });
as(1);

await call('/api/wishes?kind=general', 'POST', { kind: 'general', text: 'Хочу однажды увидеть море вдвоём' });
await call('/api/wishes?kind=intimate', 'POST', { kind: 'intimate', text: 'Хочу попробовать что-то новое' });
await call('/api/agreements', 'POST', { text: 'Если оба устали, сначала заказываем еду' });
await call('/api/capsule', 'POST', { body: 'Сегодня был тёплый кружочек' });
await call('/api/decisions', 'POST', { kind: 'food', text: 'Паста с грибами' });
await call('/api/feedback', 'POST', { text: 'Добавить ещё один мягкий режим' });
await call('/api/date-history', 'POST', { kind: 'budget', place: 'outside', idea: 'Поехать смотреть закат', status: 'completed', reflection: 'Было хорошо' });
await call('/api/ideas?kind=budget&place=inside', 'POST', { kind: 'budget', place: 'inside', text: 'Собрать пазл вечером' });
await call('/api/anniversary-ideas', 'POST', { text: 'Завтрак в постель' });

const backup = await sandbox.backupCollect();
assert.equal(backup.format, 'quiet-mailbox-backup');
assert.equal(backup.format_version, 1);
assert.ok(backup.exported_at);
assert.equal(backup.sections.wishes_general.length, 1, 'желания попадают в копию');
assert.equal(backup.sections.wishes_intimate.length, 1, 'личные желания тоже');
assert.equal(backup.sections.agreements.length, 1);
assert.equal(backup.sections.capsule.length, 1);
assert.equal(backup.sections.decisions.length, 1, 'в копию идут только свои варианты, без встроенных');
assert.equal(backup.sections.feedback.length, 1);
assert.equal(backup.sections.date_history.length, 1);
assert.equal(backup.sections.date_ideas.length, 1);
assert.equal(backup.sections.anniversary_ideas.length, 1);
assert.ok(backup.sections.preferences && backup.sections.preferences.theme, 'оформление сохраняется');

// Текст не должен теряться: локальная модель и сервер называют поле по-разному.
assert.equal(backup.sections.wishes_general[0].text, 'Хочу однажды увидеть море вдвоём');
assert.equal(backup.sections.wishes_intimate[0].text, 'Хочу попробовать что-то новое');
assert.equal(backup.sections.agreements[0].text, 'Если оба устали, сначала заказываем еду');
assert.equal(backup.sections.capsule[0].text, 'Сегодня был тёплый кружочек');
assert.equal(backup.sections.decisions[0].text, 'Паста с грибами');
assert.equal(backup.sections.feedback[0].text, 'Добавить ещё один мягкий режим');
assert.equal(backup.sections.date_history[0].idea, 'Поехать смотреть закат');
assert.equal(backup.sections.date_ideas[0].text, 'Собрать пазл вечером');
assert.equal(backup.sections.anniversary_ideas[0].text, 'Завтрак в постель');

// Файл проверяется до применения: чужой файл и битый JSON не проходят.
const valid = sandbox.backupValidate(JSON.stringify(backup));
assert.equal(valid.ok, true);
assert.equal(valid.errors.length, 0);
assert.equal(sandbox.backupValidate('{не json').ok, false);
assert.equal(sandbox.backupValidate('{"hello":1}').ok, false);
assert.equal(sandbox.backupValidate({ format: 'quiet-mailbox-backup', format_version: 1 }).ok, false, 'без раздела записей копия не принимается');
const future = sandbox.backupValidate({ ...backup, format_version: 99 });
assert.equal(future.ok, true, 'копия из будущей версии читается');
assert.ok(future.warnings.some((text) => text.includes('более новой версией')));

// Повторный импорт не дублирует записи: сначала всё добавляется, затем всё пропускается.
const first = await sandbox.backupApply(backup);
const addedTotal = Object.values(first.added).reduce((sum, count) => sum + count, 0);
const skippedTotal = Object.values(first.skipped).reduce((sum, count) => sum + count, 0);
assert.equal(addedTotal, 0, 'в этом ящике записи уже есть');
assert.ok(skippedTotal >= 9, 'совпадения распознаны как уже существующие');

// Копия, сделанная в другом ящике, добавляется целиком, а прежние записи остаются.
const orphan = structuredClone(backup);
orphan.sections = {
  wishes_general: [{ text: 'Совсем новое желание' }],
  agreements: [{ text: 'Новая договорённость' }],
  capsule: [{ text: 'Новое тёплое воспоминание' }],
  date_ideas: [{ kind: 'treat', place: 'inside', text: 'Устроить домашний кинотеатр' }],
  anniversary_ideas: [{ text: 'Поехать в горы' }],
  notes: [{ category: 'sweet', body: 'Письмо из копии' }],
  homework: [{ problem: 'Старое задание' }],
  games: { ok: true },
};
const applied = await sandbox.backupApply(orphan);
assert.equal(applied.added.wishes_general, 1);
assert.equal(applied.added.agreements, 1);
assert.equal(applied.added.capsule, 1);
assert.equal(applied.added.date_ideas, 1);
assert.equal(applied.added.anniversary_ideas, 1);
assert.equal(applied.failed.length, 0, 'ни одной ошибки при добавлении');
assert.equal(applied.added.notes, undefined, 'письма не восстанавливаются автоматически');

const after = await sandbox.backupCollect();
assert.ok(after.sections.wishes_general.some((wish) => wish.text === 'Совсем новое желание'), 'текст добавленных записей сохранился');
assert.ok(after.sections.capsule.some((item) => item.text === 'Новое тёплое воспоминание'));
assert.equal(after.sections.wishes_general.length, 2, 'старое желание не потерялось');
assert.equal(after.sections.agreements.length, 2);
assert.equal(after.sections.capsule.length, 2);
assert.equal(after.sections.date_ideas.length, 2);
assert.ok(after.sections.notes.length >= 0);

// Мусор внутри разделов пропускается, а не ломает восстановление.
const junk = await sandbox.backupApply({ format: 'quiet-mailbox-backup', format_version: 1, sections: {
  wishes_general: ['строка вместо объекта', null, { text: '' }, { text: 'Ещё одно желание' }],
  agreements: 'не массив',
} });
assert.equal(junk.added.wishes_general, 1);
assert.equal(junk.failed.length, 0);
assert.equal(junk.added.agreements, undefined);


// --- Домашние задания и игры -------------------------------------------------
// Задание создаётся из записи-гадости, и запись при этом удаляется. Поэтому
// восстанавливаются ответы в существующие задания, а не сами задания.
const readStore = () => sandbox.localStore();
await call('/api/notes', 'POST', { category: 'hard', body: 'Ссора из-за немытой посуды' });
const noteId = readStore().notes.find((note) => note.body === 'Ссора из-за немытой посуды').id;
await call('/api/homework', 'POST', { action: 'create', note_id: noteId });
const openCase = (await sandbox.localApi('/api/homework')).cases[0];
assert.ok(openCase, 'домашнее задание создано');
await call('/api/homework', 'POST', { action: 'answer', case_id: openCase.id, body: 'Сначала обнимаемся, потом делим посуду' });

// второе задание остаётся без ответа — на нём проверим восстановление ответа
await call('/api/notes', 'POST', { category: 'hard', body: 'Вторая тема для разбора' });
const secondNote = readStore().notes.find((note) => note.body === 'Вторая тема для разбора').id;
await call('/api/homework', 'POST', { action: 'create', note_id: secondNote });

await call('/api/games', 'POST', { action: 'truths_create', truth1: 'Я умею жонглировать', truth2: 'У меня есть третий размер', dream: 'Хочу на море' });
await call('/api/games', 'POST', { action: 'runner_score', score: 42 });

const withGames = await sandbox.backupCollect();
assert.equal(withGames.sections.homework.length, 2);
const exportedCase = withGames.sections.homework.find((item) => item.problem === 'Ссора из-за немытой посуды');
assert.equal(exportedCase.my_answer.body, 'Сначала обнимаемся, потом делим посуду');
assert.equal(exportedCase.partner_answer, undefined, 'чужой ответ в копию не попадает');
assert.equal(withGames.sections.games.truths_rounds.length, 1, 'свой раунд попал в копию');
assert.equal(withGames.sections.games.runner_best, 42);

// Повтор ничего не дублирует: задание уже отвечено, раунд и рекорд уже есть.
const repeat = await sandbox.backupApply(withGames);
assert.equal(Number(repeat.added.games || 0), 0, 'раунд и рекорд не задвоились');
assert.ok(Number(repeat.skipped.games || 0) >= 1);
assert.equal(repeat.failed.length, 0);

// Ответ возвращается в открытое задание с тем же текстом.
const restored = await sandbox.backupApply({ format: 'quiet-mailbox-backup', format_version: 1, sections: {
  homework: [
    { problem: 'Вторая тема для разбора', my_answer: { body: 'Мой восстановленный ответ' } },
    { problem: 'Тема, которой больше нет', my_answer: { body: 'Ответ' } },
  ],
  games: { truths_rounds: [{ options: ['Раз', 'Два', 'Три'], dream_index: 2 }], runner_best: 200, tictactoe_scores: { cat: 3, heart: 1 } },
} });
assert.equal(Number(restored.added.homework || 0), 1, 'ответ в существующее задание вернулся');
assert.equal(Number(restored.skipped.homework || 0), 1, 'задание без основы пропущено');
assert.equal(Number(restored.added.games || 0), 2, 'раунд и рекорд восстановлены');
const homeworkAfter = await sandbox.localApi('/api/homework');
assert.ok(homeworkAfter.cases.some((item) => item.problem === 'Вторая тема для разбора' && item.my_answer?.body === 'Мой восстановленный ответ'));
const gamesAfter = await sandbox.localApi('/api/games');
assert.ok(gamesAfter.truths.rounds.some((round) => round.options.includes('Три')), 'раунд вернулся');
assert.equal(gamesAfter.runner.mine.best_score, 200, 'рекорд вернулся');
const restoredReport = sandbox.backupReportText(restored);
assert.ok(restoredReport.includes('крестиков-ноликов'), 'честно сказано про счёт, который не восстановить');
assert.ok(restoredReport.includes('без исходной записи'), 'честно сказано про потерянные задания');

const report = sandbox.backupReportText(applied);
assert.ok(report.includes('Добавлено'), 'отчёт понятен человеку');
console.log('PASS: единый формат копии, проверка файла до применения, восстановление только добавляет записи (включая ответы домашних заданий, раунды и рекорд), повторы не дублируются, битые данные не ломают импорт.');
