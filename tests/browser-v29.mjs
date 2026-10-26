import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const errors = [];

for (const width of [1280, 390, 320]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:8002', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const created = await localApi('/api/create', { method: 'POST', body: JSON.stringify({ name: 'Маша', pin: '1234' }) });
    await localApi('/api/join', { method: 'POST', body: JSON.stringify({ name: 'Саша', pin: '5678', code: created.invite_code }) });
    localStorage.setItem('quiet_mailbox_user', '1');
    await refresh();
  });

  // Theme choices still exist per account, while v29 restores the original soft page/card gradients.
  await page.locator('.main-tab[data-view="our"]').click();
  const palette = await page.evaluate(async () => {
    const themes = ['white', 'pink', 'purple', 'blue', 'yellow', 'cyan'];
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const sample = (selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return { color: style.backgroundColor, image: style.backgroundImage, shadow: style.boxShadow, border: style.borderColor };
    };
    const before = document.documentElement.dataset.theme;
    const results = {};
    for (const theme of themes) {
      document.documentElement.dataset.theme = theme;
      await nextFrame();
      results[theme] = {
        body: sample('body'),
        card: sample('.decisions-card'),
        input: sample('.decisions-card textarea'),
        details: sample('#agreementsDetails'),
        summary: sample('#agreementsDetails > summary'),
        inactiveTab: sample('.main-tab[data-view="mailbox"]'),
      };
    }
    document.documentElement.dataset.theme = before;
    await nextFrame();
    return results;
  });
  for (const [theme, paint] of Object.entries(palette)) {
    assert.match(paint.body.image, /gradient/, `${theme} keeps its original gentle page background`);
    assert.match(paint.card.image, /gradient/, `${theme} keeps its original soft card gradient`);
    for (const name of ['input', 'details', 'summary', 'inactiveTab']) {
      assert.equal(paint[name].color, 'rgba(0, 0, 0, 0)', `${theme}: ${name} has no contrasting filled inset tile`);
      assert.equal(paint[name].image, 'none', `${theme}: ${name} borrows its host surface instead of painting a pale window`);
    }
  }
  assert(new Set(Object.values(palette).map(({ card }) => card.image)).size >= 4, 'each saved theme retains its own pastel card palette');

  // Mailbox subtabs remain contextual.
  const subnav = page.locator('#mailboxSubnav');
  await page.locator('.main-tab[data-view="games"]').click();
  assert.equal(await subnav.isVisible(), false);
  await page.locator('.main-tab[data-view="mailbox"]').click();
  assert.equal(await subnav.isVisible(), true);

  // Runner: exactly two visual numerical pills; no clock or wording in the visible HUD.
  await page.locator('.main-tab[data-view="games"]').click();
  await page.locator('[data-game-subtab="runner"]').click();
  const runner = page.locator('#gameRunnerPanel');
  assert.equal(await runner.isVisible(), true);
  assert.equal(await runner.locator('.runner-live-record-pill').count(), 1);
  assert.equal(await runner.locator('.runner-pair-record-pill').count(), 1);
  assert.equal(await runner.locator('#runnerClock, #runnerScore, #runnerRecord').count(), 0);
  const initialHud = (await runner.locator('.runner-scoreline').innerText()).replace(/\s+/g, ' ').trim();
  assert.equal(initialHud, '0 0 : 0');
  const live = await page.evaluate(() => {
    runnerGame = createRunnerState();
    runnerMyBestScore = 42;
    runnerPartnerBestScore = 81;
    runnerGame.elapsedMs = 1100;
    runnerGame.bonusScore = 8;
    updateRunnerHud();
    const line = document.querySelector('.runner-scoreline');
    const first = document.querySelector('.runner-live-record-pill').getBoundingClientRect();
    const second = document.querySelector('.runner-pair-record-pill').getBoundingClientRect();
    return {
      text: line.innerText.replace(/\s+/g, ' ').trim(),
      sameLine: Math.abs(first.top - second.top) < 2,
      fits: line.scrollWidth <= line.clientWidth + 1,
    };
  });
  assert.equal(live.text, '20 42 : 81');
  assert.equal(live.sameLine, true, `runner pills stay on one row at ${width}px`);
  assert.equal(live.fits, true, `runner pills fit at ${width}px`);

  // Classic 3×3 Tic-Tac-Toe remains conventional.
  await page.locator('[data-game-subtab="tictactoe"]').click();
  assert.equal(await page.locator('#tttBoard [data-ttt-cell]').count(), 9);
  await page.locator('[data-ttt-mode="local"]').click();
  await page.locator('#tttResetBtn').click();
  for (const cell of [0, 4, 1, 3, 2]) await page.locator(`#tttBoard [data-ttt-cell="${cell}"]`).click();
  assert.match(await page.locator('#tttStatusBanner').innerText(), /Победа/);

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no horizontal overflow at ${width}px`);
  await context.close();
  console.log(`PASS ${width}px: restored soft themes/no inset tiles and numerical Runner HUD.`);
}

assert.deepEqual(errors, []);
await browser.close();
console.log('PASS: v29 restored-palette visual audit.');
