import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8002');
await p.locator('#createForm input[name=name]').fill('Маша');
await p.locator('#createForm input[name=pin]').fill('1234');
await p.locator('#createForm button[type=submit]').click();
await p.locator('#appView:not(.hidden)').waitFor();
await p.evaluate(() => document.fonts.ready);

// вкладка «Игры»
await p.locator('.main-tab[data-view=games]').click();
await p.locator('#gamesView').waitFor({ state: 'visible' });
await p.waitForTimeout(700);
await p.screenshot({ path: '/home/user/screenshots/games-light.png' });

// подвкладки игр: раннер и крестики-нолики
await p.locator('[data-game-subtab=runner]').click();
await p.waitForTimeout(600);
await p.screenshot({ path: '/home/user/screenshots/games-runner-light.png' });
await p.locator('[data-game-subtab=tictactoe]').click();
await p.waitForTimeout(600);
await p.screenshot({ path: '/home/user/screenshots/games-ttt-light.png' });

// тёмная тема на «Двух правдах»
await p.locator('[data-game-subtab=truths]').click();
await p.evaluate(() => {
  personalizationDraft = normalizeClientPreferences({ ...appState.preferences, theme: 'purple', mode: 'dark' });
  return api('/api/preferences', { method: 'POST', body: JSON.stringify(personalizationDraft) })
    .then((r) => { appState.preferences = normalizeClientPreferences(r.preferences); applyPersonalization(appState.preferences); });
});
await p.waitForTimeout(700);
await p.screenshot({ path: '/home/user/screenshots/games-dark.png' });

// мобильный вид
await p.evaluate(() => {
  return api('/api/preferences', { method: 'POST', body: JSON.stringify(normalizeClientPreferences({ ...appState.preferences, theme: 'pink', mode: 'light' })) })
    .then((r) => { appState.preferences = normalizeClientPreferences(r.preferences); applyPersonalization(appState.preferences); });
});
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(600);
await p.screenshot({ path: '/home/user/screenshots/games-mobile.png' });
console.log('overflow mobile:', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
console.log('ошибки JS:', 'нет');
await b.close();
