import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const pageErrors = [];

for (const width of [1280, 390, 320]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await localApi('/api/create', { method: 'POST', body: JSON.stringify({ name: 'Маша', pin: '1234' }) });
    await refresh();
  });

  const tabViews = await page.locator('.main-tab').evaluateAll((tabs) => tabs.map((tab) => tab.dataset.view).sort());
  assert.deepEqual(tabViews, ['dates', 'games', 'mailbox', 'our'], 'all main views stay available regardless of saved ordering');
  const subnav = page.locator('#mailboxSubnav');
  assert.equal(await subnav.isVisible(), true);

  for (const view of ['dates', 'our', 'games']) {
    await page.locator(`.main-tab[data-view="${view}"]`).click();
    assert.equal(await subnav.isVisible(), false, `mailbox subtabs hide outside ${view}`);
  }
  await page.locator('.main-tab[data-view="mailbox"]').click();
  assert.equal(await subnav.isVisible(), true, 'mailbox subtabs return only after opening the mailbox');

  await page.locator('.main-tab[data-view="games"]').click();
  await page.locator('[data-game-subtab="runner"]').click();
  assert.equal(await page.locator('#gameRunnerPanel').isVisible(), true);
  const hud = await page.locator('#gameRunnerPanel .runner-scoreline').innerText();
  assert.match(hud, /^\s*\d+\s+\d+\s*:\s*\d+\s*$/, 'runner HUD visibly contains only current number and paired numbers');
  assert.equal(await page.locator('#runnerClock, #runnerScore, #runnerRecord').count(), 0, 'runner has no timer-era HUD nodes');

  await page.locator('[data-game-subtab="tictactoe"]').click();
  assert.equal(await page.locator('#gameTictactoePanel').isVisible(), true);
  assert.equal(await page.locator('#tttBoard [data-ttt-cell]').count(), 9, 'Tic-Tac-Toe remains a conventional 3×3 board');
  assert.equal(await page.locator('#tttResetBtn').count(), 1);
  assert.equal(await page.locator('#gameTictactoePanel [data-fullscreen-target="gameTictactoePanel"]').count(), 1);

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no horizontal overflow at ${width}px`);
  console.log(`PASS ${width}px: current navigation, hidden mailbox subtabs, numerical Runner HUD, ordinary 3×3 TTT, no overflow`);
  await context.close();
}

assert.deepEqual(pageErrors, []);
await browser.close();
console.log('PASS: current browser smoke audit.');
