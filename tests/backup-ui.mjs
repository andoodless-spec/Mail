import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = process.env.TEST_URL || 'http://127.0.0.1:8002';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, hasTouch: true });
const page = await context.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const api = (p, method = 'GET', data = {}) => page.evaluate(({ p, method, data }) => localApi(p, { method, body: JSON.stringify(data) }), { p, method, data });
// Порядок вкладок живёт на вкладке «Расположение» в панели настроек.
const openPersonalization = async () => {
  await page.locator('#quickAppearance').click();
  await page.locator('#settingsModal').waitFor({ state: 'visible' });
  await page.locator('[data-settings-tab=layout]').click();
  await page.locator('#settingsPanelLayout').waitFor({ state: 'visible' });
};
const tabOrder = () => page.locator('.main-tab').evaluateAll((nodes) => nodes.map((node) => node.dataset.view));
const draftOrder = (group) => page.evaluate((g) => personalizationDraft.orders[g].slice(), group);

try {
  await page.goto(base);
  await page.locator('#createForm input[name=name]').fill('Маша');
  await page.locator('#createForm input[name=pin]').fill('1234');
  await page.locator('#createForm button[type=submit]').click();
  await page.locator('#appView:not(.hidden)').waitFor();

  // --- Порядок вкладок: все четыре группы доступны, прежний порядок по умолчанию ---
  await openPersonalization();
  assert.equal(await page.locator('[data-order-group]').count(), 4, 'настраиваются все группы вкладок');
  assert.deepEqual(await draftOrder('main'), ['our', 'mailbox', 'dates', 'games']);
  assert.deepEqual(await tabOrder(), ['our', 'mailbox', 'dates', 'games']);

  // --- Перетаскивание мышью: первая вкладка уезжает ниже второй ---
  const grip = page.locator('[data-order-list="main"] [data-order-item]').first().locator('[data-order-grip]');
  const second = page.locator('[data-order-list="main"] [data-order-item]').nth(1);
  const gripBox = await grip.boundingBox();
  const secondBox = await second.boundingBox();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + ((secondBox.y + secondBox.height - 6 - gripBox.y) * step) / 6);
  }
  await page.mouse.up();
  assert.deepEqual(await draftOrder('main'), ['mailbox', 'our', 'dates', 'games'], 'мышью порядок меняется');

  // --- Клавиатура: ручка двигает строку стрелкой ---
  await page.locator('[data-order-list="games"] [data-order-item]').first().locator('[data-order-grip]').focus();
  await page.keyboard.press('ArrowDown');
  assert.deepEqual(await draftOrder('games'), ['runner', 'truths', 'tictactoe'], 'стрелка на ручке двигает строку');

  // --- Перетаскивание пальцем на телефоне ---
  await page.setViewportSize({ width: 390, height: 780 });
  const touchGrip = page.locator('[data-order-list="dates"] [data-order-item]').first().locator('[data-order-grip]');
  const touchSecond = page.locator('[data-order-list="dates"] [data-order-item]').nth(1);
  const t1 = await touchGrip.boundingBox();
  const t2 = await touchSecond.boundingBox();
  await touchGrip.dispatchEvent('pointerdown', { pointerType: 'touch', button: 0, clientY: t1.y + 10, clientX: t1.x + 10, isPrimary: true, bubbles: true });
  await page.evaluate(({ y1, y2, x }) => {
    const fire = (type, y) => document.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', clientY: y, clientX: x, bubbles: true, isPrimary: true }));
    // Ведём палец ниже середины второй строки, иначе список не переставится.
    fire('pointermove', y1 + 6);
    fire('pointermove', y2 + 20);
    fire('pointermove', y2 + 40);
    fire('pointerup', y2 + 40);
  }, { y1: t1.y, y2: t2.y, x: t1.x + 10 });
  assert.deepEqual(await draftOrder('dates'), ['successful', 'random'], 'пальцем порядок тоже меняется');

  // --- Сохранение и переживание перезагрузки ---
  await page.locator('[data-settings-tab=appearance]').click();
  await page.locator('#settingsPanelAppearance').waitFor({ state: 'visible' });
  await page.locator('#savePersonalizationButton').click();
  await page.waitForFunction(() => personalizationDraft && personalizationDraft.orders.main[0] === 'mailbox');
  await page.locator('#settingsModal .modal-close').click();
  await page.locator('#settingsModal').waitFor({ state: 'hidden' });
  assert.deepEqual(await tabOrder(), ['mailbox', 'our', 'dates', 'games'], 'порядок применён к навигации');
  await page.reload();
  await page.locator('#appView:not(.hidden)').waitFor();
  assert.deepEqual(await tabOrder(), ['mailbox', 'our', 'dates', 'games'], 'порядок сохранился после перезагрузки');
  assert.deepEqual(await page.locator('.game-subtab').evaluateAll((nodes) => nodes.map((node) => node.dataset.gameSubtab)), ['runner', 'truths', 'tictactoe']);

  // Партнёр видит свой, отдельный порядок.
  const state = await api('/api/state');
  await api('/api/join', 'POST', { name: 'Саша', pin: '5678', code: state.pair_code });
  await page.evaluate(() => localStorage.setItem('quiet_mailbox_user', '2'));
  await page.evaluate(() => refresh());
  assert.deepEqual(await tabOrder(), ['our', 'mailbox', 'dates', 'games'], 'у партнёра остался порядок по умолчанию');
  await page.evaluate(() => localStorage.setItem('quiet_mailbox_user', '1'));
  await page.evaluate(() => refresh());
  await page.setViewportSize({ width: 1280, height: 900 });

  // --- Резервная копия: экспорт ---
  await api('/api/wishes?kind=general', 'POST', { kind: 'general', text: 'Хочу увидеть море вдвоём' });
  await api('/api/agreements', 'POST', { text: 'Если оба устали, сначала заказываем еду' });
  await page.locator('#topMenuButton').click();
  await page.locator('#settingsButton').click();
  await page.locator('#settingsModal').waitFor({ state: 'visible' });

  // --- Настройки вкладками: четыре вкладки, «Данные» открывается с клавиатуры ---
  assert.equal(await page.locator('[data-settings-tab]').count(), 4, 'настройки разбиты на вкладки');
  assert.deepEqual(await page.locator('[data-settings-tab]').evaluateAll((nodes) => nodes.map((node) => node.dataset.settingsTab)),
    ['appearance', 'layout', 'alerts', 'account'], 'вкладки как в «Поляне»');
  assert.equal(await page.locator('#settingsPanelAccount').isVisible(), true, 'из меню открывается «Аккаунт и данные»');
  assert.equal(await page.locator('#exportBackupButton').isVisible(), true, 'кнопки копии на вкладке аккаунта');
  assert.equal(await page.locator('#settingsPanelAppearance').isVisible(), false, 'одна вкладка за раз');
  await page.locator('#settingsTabAccount').focus();
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#settingsPanelAppearance').isVisible(), true, 'Home ведёт на первую вкладку');
  assert.equal(await page.locator('#settingsTabAppearance').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('End');
  assert.equal(await page.locator('#settingsPanelAccount').isVisible(), true, 'End ведёт на последнюю вкладку');
  await page.locator('[data-settings-tab=layout]').click();
  assert.equal(await page.locator('#tabOrderControls').isVisible(), true, 'порядок вкладок на вкладке «Расположение»');
  await page.locator('[data-settings-tab=account]').click();

  // --- Новые пиксельные картинки на месте ---
  const heroSrc = await page.locator('.welcome-kitten img').getAttribute('src');
  assert.equal(heroSrc, '/assets/ui/together.svg');
  const heroBox = await page.locator('.welcome-kitten img').boundingBox();
  assert.ok(heroBox.width > 150, 'иллюстрация шапки отрисована');
  assert.equal(await page.locator('.account-box img').getAttribute('src'), '/assets/ui/profile.svg');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBackupButton').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^tihiy-yashchik-backup-\d{4}-\d{2}-\d{2}\.json$/, 'имя файла понятное');
  const savedPath = path.join(os.tmpdir(), 'backup-e2e.json');
  await download.saveAs(savedPath);
  const exported = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
  assert.equal(exported.format, 'quiet-mailbox-backup');
  assert.equal(exported.sections.wishes_general.length, 1);
  assert.equal(exported.sections.agreements.length, 1);
  assert.ok(Array.isArray(exported.sections.homework), 'домашние задания попадают в копию');
  assert.ok(exported.sections.games, 'игры попадают в копию');
  await page.waitForFunction(() => document.querySelector('#backupStatus').textContent.includes('Копия скачана'));

  // --- Битый файл не меняет данные ---
  const junkPath = path.join(os.tmpdir(), 'backup-junk.json');
  fs.writeFileSync(junkPath, '{"hello": "world"}');
  await page.locator('#importBackupInput').setInputFiles(junkPath);
  await page.locator('#importBackupPreview .backup-warning').waitFor({ state: 'visible' });
  assert.match(await page.locator('#importBackupPreview').innerText(), /Файл не подошёл/);
  assert.equal(await page.locator('#confirmImportBackup').count(), 0, 'у битого файла нет кнопки восстановления');
  assert.equal((await api('/api/wishes?kind=general')).mine.length, 1, 'данные не изменились');

  // --- Импорт копии: предпросмотр, подтверждение, добавление без удаления ---
  const incoming = structuredClone(exported);
  incoming.sections.wishes_general = [{ text: 'Совсем новое желание из копии' }];
  incoming.sections.agreements = [{ text: 'Новая договорённость из копии' }];
  incoming.sections.anniversary_ideas = [{ text: 'Поехать в горы' }];
  incoming.sections.games = { truths_rounds: [{ options: ['Я умею жонглировать', 'У меня есть кот', 'Хочу на море'], dream_index: 2 }], runner_best: 77 };
  const importPath = path.join(os.tmpdir(), 'backup-import.json');
  fs.writeFileSync(importPath, JSON.stringify(incoming));
  await page.locator('#importBackupInput').setInputFiles(importPath);
  await page.locator('#confirmImportBackup').waitFor({ state: 'visible' });
  const previewText = await page.locator('#importBackupPreview').innerText();
  assert.match(previewText, /Проверка файла прошла/);
  assert.match(previewText, /только добавляет недостающее/);
  await page.locator('#confirmImportBackup').click();
  await page.waitForFunction(() => {
    const text = document.querySelector('#backupStatus').textContent;
    return text.includes('Добавлено') || text.includes('Восстановление');
  });
  const wishes = await api('/api/wishes?kind=general');
  assert.equal(wishes.mine.length, 2, 'новое желание добавлено');
  const wishText = (wish) => wish.text || wish.body || '';
  assert.ok(wishes.mine.some((wish) => wishText(wish) === 'Хочу увидеть море вдвоём'), 'прежнее желание осталось');
  assert.ok(wishes.mine.some((wish) => wishText(wish) === 'Совсем новое желание из копии'), 'текст из копии сохранился целиком');
  const agreements = await api('/api/agreements');
  assert.equal(agreements.agreements.length, 2, 'договорённости: добавлено, но не заменено');
  const gamesAfterImport = await api('/api/games');
  assert.ok(gamesAfterImport.truths.rounds.some((round) => round.options.includes('Хочу на море')), 'раунд игры восстановлен');
  assert.equal(gamesAfterImport.runner.mine.best_score, 77, 'рекорд забега восстановлен');

  // Повторный импорт того же файла ничего не дублирует.
  await page.locator('#importBackupInput').setInputFiles([]);
  await page.locator('#importBackupInput').setInputFiles(importPath);
  await page.locator('#confirmImportBackup').waitFor({ state: 'visible' });
  await page.locator('#confirmImportBackup').click();
  await page.waitForTimeout(400);
  assert.equal((await api('/api/wishes?kind=general')).mine.length, 2, 'повтор не создал дубликатов');

  assert.equal(errors.length, 0, `ошибки JavaScript: ${errors.join(', ')}`);
  console.log('PASS: настройки вкладками (мышь и клавиатура), новая иллюстрация шапки, перетаскивание вкладок мышью и пальцем, стрелки, сохранение порядка после перезагрузки, отдельный порядок у партнёра, экспорт копии, отказ на битом файле, импорт только с добавлением, восстановление раунда и рекорда игры, повтор без дубликатов, нет ошибок JS.');
} finally {
  await browser.close();
}
