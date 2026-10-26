import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const errors = [];

for (const width of [1280, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle' });

  await page.evaluate(async () => {
    const created = await localApi('/api/create', { method: 'POST', body: JSON.stringify({ name: 'Маша', pin: '1234' }) });
    await localApi('/api/join', { method: 'POST', body: JSON.stringify({ name: 'Саша', pin: '5678', code: created.invite_code }) });
    localStorage.setItem('quiet_mailbox_user', '1');
    await refresh();
  });

  const subnav = page.locator('#mailboxSubnav');
  assert.equal(await subnav.isVisible(), true);

  // The partner badge has no adjacent hint; the personal card opens in a social-profile-like read view first.
  assert.match(await page.locator('#partnerBadge').textContent(), /Вместе с Саша/);
  assert.equal(await page.locator('.partner-shortcut .partner-info-button').count(), 0);
  await page.locator('#partnerBadge').click();
  await page.locator('#partnerProfileModal').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#partnerProfileView').isVisible(), true);
  assert.equal(await page.locator('#partnerProfileForm').isVisible(), false);
  assert.equal(await page.locator('#editPartnerProfileButton').isVisible(), true);
  await page.locator('#partnerProfileModal [data-info-key="partnerProfile"]').click();
  assert.equal(await page.locator('#infoTitle').textContent(), 'Карточка партнёра');
  assert.match(await page.locator('#infoModalBody').textContent(), /личные заметки/);
  await page.locator('[data-close-modal="infoModal"]').click();
  await page.locator('#editPartnerProfileButton').click();
  assert.equal(await page.locator('#partnerProfileFields .partner-profile-field').count(), 6);
  await page.locator('#partnerProfileFields .partner-profile-field').first().locator('[name="value"]').fill('Бирюзовый');
  await page.locator('#partnerProfileFields .partner-profile-field').first().locator('[name="accent"]').selectOption('sky');
  await page.locator('#partnerProfileFields .profile-field-remove').nth(2).click();
  assert.equal(await page.locator('#partnerProfileFields .partner-profile-field').count(), 5);
  await page.locator('#addPartnerFieldButton').click();
  assert.equal(await page.locator('#partnerProfileFields .partner-profile-field').count(), 6);
  const profileRows = page.locator('#partnerProfileFields .partner-profile-field');
  await profileRows.last().locator('[name="label"]').fill('Место мечты');
  await profileRows.last().locator('[name="value"]').fill('У моря');
  await page.locator('#partnerProfileForm [type="submit"]').click();
  await page.locator('#partnerProfileView').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#partnerProfileForm').isVisible(), false, 'save returns to view mode instead of leaving edit controls open');
  assert.equal(await page.locator('#editPartnerProfileButton').isVisible(), true);
  assert.match(await page.locator('#partnerProfileView').textContent(), /Бирюзовый/);
  assert.match(await page.locator('#partnerProfileView').textContent(), /Место мечты/);
  assert.equal(await page.locator('#partnerProfileView .partner-profile-memory-card').count(), 2, 'only filled memories appear in the pretty profile view');
  assert.equal(await page.locator('#partnerProfileView .partner-profile-memory-card.accent-sky').count(), 1, 'one deliberately accented memory is visibly marked');
  assert.equal(await page.locator('#partnerProfileView .partner-profile-count').count(), 0, 'the cover no longer shows a stroke counter');
  assert.match(await page.locator('#partnerProfileView .partner-profile-cover').textContent(), /то, что хочется бережно помнить/);
  assert.doesNotMatch(await page.locator('#partnerProfileView .partner-profile-cover').textContent(), /штрих/);
  assert.equal(await page.locator('#partnerProfileView .partner-profile-info-row').count(), 0, 'the old grocery-list rows are gone');
  const savedPrivateCard = await page.evaluate(async () => (await localApi('/api/partner-profile')).fields);
  assert.equal(savedPrivateCard[0].value, 'Бирюзовый');
  assert.equal(savedPrivateCard[0].accent, 'sky', 'the selected memory accent persists in the private profile');
  assert.equal(savedPrivateCard.at(-1).label, 'Место мечты');
  await page.locator('#partnerProfileModal [data-close-modal="partnerProfileModal"]').click();

  // Theme and ordering only take effect after an explicit save in Settings.
  const pinkThemePaint = await page.evaluate(() => ['.write-card', '.mailbox-subtab', '#topMenuButton'].map((selector) => {
    const style = getComputedStyle(document.querySelector(selector));
    return `${style.backgroundImage}|${style.backgroundColor}|${style.borderColor}|${style.color}`;
  }));
  await page.locator('#topMenuButton').click();
  await page.locator('#settingsButton').click();
  await page.locator('#personalizeButton').click();
  assert.equal(await page.locator('#themeChoices .theme-choice').count(), 6);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'pink');
  await page.locator('#themeChoices [data-theme-choice="blue"]').click();
  await page.locator('#tabOrderControls [data-order-move="main"][data-order-index="3"][data-order-direction="-1"]').click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'pink', 'a draft cannot restyle the app accidentally');
  await page.locator('#savePersonalizationButton').click();
  await page.locator('#personalizationModal').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'blue');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.main-tab')].map((button) => button.dataset.view)), ['mailbox', 'dates', 'games', 'our']);
  const blueThemePaint = await page.evaluate(() => ['.write-card', '.mailbox-subtab', '#topMenuButton'].map((selector) => {
    const style = getComputedStyle(document.querySelector(selector));
    return `${style.backgroundImage}|${style.backgroundColor}|${style.borderColor}|${style.color}`;
  }));
  assert.deepEqual(blueThemePaint.map((value, index) => value !== pinkThemePaint[index]), [true, true, true], 'cards and every sampled secondary control follow the saved account theme');
  const paletteCoverage = await page.evaluate(async () => {
    const themes = ['white', 'pink', 'purple', 'blue', 'yellow', 'cyan'];
    const selectors = [
      '.write-card', '.write-card textarea', '.mailbox-subtab', '#topMenuButton',
      '#agreementsDetails > summary', '#infoModal .info-modal-body p',
      '#tttBoard .ttt-cell', '#gameRunnerPanel .runner-pair-record-pill',
    ];
    const before = document.documentElement.dataset.theme;
    const paint = (selector) => {
      const el = document.querySelector(selector);
      const style = getComputedStyle(el);
      return { color: style.backgroundColor, image: style.backgroundImage, border: style.borderColor, display: style.display };
    };
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const snapshots = {};
    for (const theme of themes) {
      document.documentElement.dataset.theme = theme;
      await nextFrame();
      snapshots[theme] = Object.fromEntries(selectors.map((selector) => [selector, paint(selector)]));
    }
    document.documentElement.dataset.theme = before;
    await nextFrame();
    return { themes, selectors, snapshots };
  });
  for (const selector of paletteCoverage.selectors) {
    const paints = paletteCoverage.themes.map((theme) => paletteCoverage.snapshots[theme][selector]);
    assert(paints.every((paint) => paint.color !== 'rgba(0, 0, 0, 0)' || paint.image !== 'none'), `${selector} always has a filled themed surface`);
    assert(paints.every((paint) => !/rgb\(255,\s*255,\s*255\)/.test(`${paint.color}|${paint.image}`)), `${selector} has no generic white window in any account theme`);
    assert(new Set(paints.map((paint) => `${paint.color}|${paint.image}|${paint.border}`)).size >= 4, `${selector} visibly follows the individual account palettes`);
  }
  assert.equal(paletteCoverage.snapshots.purple['#agreementsDetails > summary'].display, 'block', 'closed accordions receive a real palette-filled summary strip');
  const flatSurfaceAudit = await page.evaluate(async () => {
    const themes = ['white', 'pink', 'purple', 'blue', 'yellow', 'cyan'];
    const before = document.documentElement.dataset.theme;
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const settleTheme = async () => { await nextFrame(); await new Promise((resolve) => setTimeout(resolve, 220)); };
    const color = (selector) => getComputedStyle(document.querySelector(selector)).backgroundColor;
    const results = {};
    for (const theme of themes) {
      document.documentElement.dataset.theme = theme;
      await settleTheme();
      results[theme] = {
        card: color('.write-card'),
        input: color('.write-card textarea'),
        details: color('#agreementsDetails'),
        summary: color('#agreementsDetails > summary'),
        modal: color('#infoModal .info-modal-card'),
        modalParagraph: color('#infoModal .info-modal-body p'),
      };
    }
    document.documentElement.dataset.theme = before;
    await settleTheme();
    return results;
  });
  for (const [theme, colors] of Object.entries(flatSurfaceAudit)) {
    assert.equal(colors.input, colors.card, `${theme}: fields blend with their card instead of becoming a pale tile`);
    assert.equal(colors.summary, colors.details, `${theme}: collapsed summary blends with its parent instead of becoming a pale tile`);
    assert.equal(colors.modalParagraph, colors.modal, `${theme}: modal inset shares its surface`);
  }
  const settingsGeometry = await page.locator('#settingsModal .settings-modal-card').evaluate((card) => {
    const box = card.getBoundingClientRect();
    return { left: box.left, right: box.right, width: box.width, scrollWidth: document.querySelector('#settingsModal').scrollWidth, viewport: innerWidth };
  });
  assert(settingsGeometry.left >= -1 && settingsGeometry.right <= settingsGeometry.viewport + 1, 'settings card stays centered without right-side crop');
  assert(settingsGeometry.scrollWidth <= settingsGeometry.viewport + 1, 'settings overlay has no horizontal scroll');
  await page.locator('#settingsModal [data-close-modal="settingsModal"]').click();

  // The reusable pixel heart lives inside the card it explains, not in a spacer row under the tabs.
  const mailboxInfo = await page.evaluate(() => {
    const button = document.querySelector('#activeViewInfoBtn');
    const card = button.closest('.write-card');
    const nav = document.querySelector('#mailboxSubnav').getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const heart = button.querySelector('.info-pixel-heart');
    const buttonStyle = getComputedStyle(button);
    return {
      host: card?.className || '',
      gap: cardBox.top - nav.bottom,
      hasPixelHeart: Boolean(heart),
      width: Number.parseFloat(buttonStyle.width),
      height: Number.parseFloat(buttonStyle.height),
      opacity: Number(buttonStyle.opacity),
      heartWidth: Number.parseFloat(getComputedStyle(heart).width),
      heartHeight: Number.parseFloat(getComputedStyle(heart).height),
      legacyPieces: button.querySelectorAll('.info-letter, .info-heart-dot').length,
      contextRows: document.querySelectorAll('.context-info-row').length,
    };
  });
  assert.match(mailboxInfo.host, /write-card/);
  assert(mailboxInfo.gap < 42, 'no oversized gap remains below mailbox tabs');
  assert.equal(mailboxInfo.hasPixelHeart, true, 'the info control is a pixel heart, not an i');
  assert(mailboxInfo.width <= 22 && mailboxInfo.height <= 22, 'heart hint is intentionally smaller than the former i');
  assert(mailboxInfo.opacity <= .5, 'resting heart hint is intentionally half-transparent');
  assert.deepEqual([mailboxInfo.heartWidth, mailboxInfo.heartHeight], [12, 10], 'the completed pixel heart keeps a symmetric compact footprint');
  assert.equal(mailboxInfo.legacyPieces, 0);
  assert.equal(mailboxInfo.contextRows, 0);
  await page.locator('#activeViewInfoBtn').click();
  assert.equal(await page.locator('#infoModal').isVisible(), true);
  assert.equal(await page.locator('#infoTitle').textContent(), 'Ящик');
  const quietModal = await page.locator('#infoModal .info-modal-card').evaluate((card) => {
    const style = getComputedStyle(card);
    return { image: style.backgroundImage, color: style.backgroundColor, border: style.borderColor, body: getComputedStyle(card.querySelector('.info-modal-body')).color };
  });
  assert.equal(quietModal.image, 'none', 'info modal uses the same solid themed surface rather than a pale gradient tile');
  assert.notEqual(quietModal.color, 'rgba(0, 0, 0, 0)', 'info modal has a filled account-themed surface');
  assert.notEqual(quietModal.border, 'rgb(238, 204, 223)', 'info modal no longer keeps the fixed pink border');
  await page.locator('[data-close-modal="infoModal"]').click();

  for (const [tabSelector, hostSelector] of [
    ['[data-mailbox-view="conversation"]', '.date-controls-card'],
    ['[data-mailbox-view="homework"]', '#homeworkEmpty'],
    ['[data-mailbox-view="capsule"]', '.capsule-card'],
  ]) {
    await page.locator(tabSelector).click();
    assert.equal(await page.locator('#activeViewInfoBtn').evaluate((button, selector) => button.closest(selector) !== null, hostSelector), true, `${tabSelector} keeps its heart hint in its own card`);
  }
  const capsuleGeometry = await page.locator('#openCapsuleButton').evaluate((button) => {
    const box = button.getBoundingClientRect();
    const heading = button.closest('.capsule-card').querySelector('h3').getBoundingClientRect();
    return { top: box.top, right: box.right, headingBottom: heading.bottom, position: getComputedStyle(button).position, viewport: innerWidth };
  });
  assert.equal(capsuleGeometry.position, 'static');
  assert(capsuleGeometry.top > capsuleGeometry.headingBottom && capsuleGeometry.right <= capsuleGeometry.viewport + 1, 'capsule action remains below text and inside the phone viewport');
  await page.locator('[data-mailbox-view="mailbox"]').click();

  for (const view of ['dates', 'our', 'games']) {
    await page.locator(`.main-tab[data-view="${view}"]`).click();
    assert.equal(await subnav.isVisible(), false, `mailbox subnav should be hidden in ${view}`);
  }
  await page.locator('.main-tab[data-view="our"]').click();
  assert.equal(await page.locator('#activeViewInfoBtn').evaluate((button) => button.closest('.decisions-card') !== null), true);
  await page.locator('.main-tab[data-view="dates"]').click();
  assert.equal(await page.locator('#activeViewInfoBtn').evaluate((button) => button.closest('.ideas-hero') !== null), true);
  await page.locator('[data-date-subtab="successful"]').click();
  assert.equal(await page.locator('#activeViewInfoBtn').evaluate((button) => button.closest('.successful-intro') !== null), true);
  await page.locator('[data-date-subtab="random"]').click();
  assert.equal(await page.locator('#activeViewInfoBtn').evaluate((button) => button.closest('.ideas-hero') !== null), true);
  await page.locator('#activeViewInfoBtn').click();
  assert.equal(await page.locator('#infoTitle').textContent(), 'Свидания');
  await page.locator('[data-close-modal="infoModal"]').click();
  assert.equal(await page.locator('.info-heart-button').count() >= 4, true);

  // Runner: no route/timer/kilometre controls, exactly 3 obstacle and 3 boost assets.
  await page.locator('.main-tab[data-view="games"]').click();
  assert.equal(await page.locator('#activeViewInfoBtn').isVisible(), false, 'games use the heart inside each game card');
  await page.locator('[data-game-subtab="runner"]').click();
  assert.equal(await page.locator('#gameRunnerPanel').isVisible(), true);
  const runnerPanelText = await page.locator('#gameRunnerPanel').textContent();
  assert.match(runnerPanelText, /Любимое село/);
  assert.doesNotMatch(runnerPanelText, /Питер|Тюмень|км|6:00|Прыжок/);
  assert.equal(await page.locator('.runner-route-btn, #runnerJumpBtn, #runnerTime, #runnerKmLeft, #runnerLives').count(), 0);
  assert.equal(await page.locator('#runnerLiveRecord').textContent(), '0');
  assert.equal(await page.locator('#runnerMyRecord').textContent(), '0');
  assert.equal(await page.locator('#runnerPartnerRecord').textContent(), '0');
  const runnerHudText = await page.locator('#gameRunnerPanel .runner-scoreline').textContent();
  assert.doesNotMatch(runnerHudText, /очков|00:00|мой|партнёра|рекорд/i, 'the HUD visibly contains only numerical values');
  assert.equal(await page.locator('#runnerScore, #runnerClock, #runnerRecord, .runner-time-record-pill, .runner-score-pill').count(), 0);
  const runnerPills = await page.evaluate(() => {
    const scoreline = document.querySelector('#gameRunnerPanel .runner-scoreline');
    const live = document.querySelector('#gameRunnerPanel .runner-live-record-pill');
    const pair = document.querySelector('#gameRunnerPanel .runner-pair-record-pill');
    const liveBox = live.getBoundingClientRect(); const pairBox = pair.getBoundingClientRect();
    return {
      display: getComputedStyle(scoreline).display,
      wrap: getComputedStyle(scoreline).flexWrap,
      liveRadius: getComputedStyle(live).borderRadius,
      pairRadius: getComputedStyle(pair).borderRadius,
      sameLine: Math.abs(liveBox.top - pairBox.top) < 2,
      fits: scoreline.scrollWidth <= scoreline.clientWidth + 1,
      separate: getComputedStyle(live).borderStyle !== 'none' && getComputedStyle(pair).borderStyle !== 'none',
      values: [live.textContent.trim(), pair.textContent.replace(/\s+/g, ' ').trim()],
    };
  });
  assert.equal(runnerPills.display, 'flex');
  assert.equal(runnerPills.wrap, 'nowrap');
  assert.equal(runnerPills.sameLine, true, 'live score and paired records stay in one visual line');
  assert.equal(runnerPills.fits, true, `runner pills fit at ${width}px`);
  assert.equal(runnerPills.separate, true, 'live score and paired records have independent outlines');
  assert.match(runnerPills.liveRadius, /999/);
  assert.match(runnerPills.pairRadius, /999/);
  assert.deepEqual(runnerPills.values, ['0', '0 : 0']);
  const liveHud = await page.evaluate(() => {
    runnerGame = createRunnerState();
    runnerMyBestScore = 42;
    runnerPartnerBestScore = 81;
    runnerGame.elapsedMs = 1100;
    runnerGame.bonusScore = 8;
    updateRunnerHud();
    return {
      live: document.querySelector('#runnerLiveRecord').textContent,
      mine: document.querySelector('#runnerMyRecord').textContent,
      partner: document.querySelector('#runnerPartnerRecord').textContent,
      aria: document.querySelector('#runnerRecordBadge').getAttribute('aria-label'),
    };
  });
  assert.equal(liveHud.live, '20', 'the first pill rises continuously during a run');
  assert.equal(liveHud.mine, '42');
  assert.equal(liveHud.partner, '81');
  assert.match(liveHud.aria, /Мой рекорд 42; рекорд партнёра 81/);
  await page.evaluate(() => { runnerGame = createRunnerState(); runnerMyBestScore = 0; runnerPartnerBestScore = 0; updateRunnerHud(); });
  assert.equal(await page.locator('#runnerRestartBtn').count(), 1);
  assert.equal(await page.locator('#runnerRestartBtn').textContent(), '↻');
  const runnerFullscreen = await page.locator('#gameRunnerPanel .game-fullscreen-button').evaluate((button) => {
    const box = button.getBoundingClientRect();
    const panel = button.closest('.games-page-card').getBoundingClientRect();
    const stage = button.closest('.games-page-card').querySelector('#runnerStage').getBoundingClientRect();
    const utility = button.closest('.runner-utility-buttons').getBoundingClientRect();
    return { label: button.getAttribute('aria-label'), width: box.width, height: box.height, left: box.left - panel.left, top: box.top - panel.top, stageBottom: stage.bottom - panel.top, utilityLeft: utility.left - panel.left };
  });
  assert.match(runnerFullscreen.label, /экран/);
  assert(runnerFullscreen.width >= 30 && runnerFullscreen.width <= 38 && runnerFullscreen.height >= 30 && runnerFullscreen.height <= 38, 'fullscreen control stays unobtrusive next to restart');
  assert(runnerFullscreen.utilityLeft < 65 && runnerFullscreen.top >= runnerFullscreen.stageBottom, 'runner replay/fullscreen utilities live at the lower left below the stage');
  await page.locator('#gameRunnerPanel .game-fullscreen-button').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'gameRunnerPanel');
  assert.equal(await page.locator('#gameRunnerPanel .game-fullscreen-button').getAttribute('aria-label'), 'Выйти из полноэкранного режима');
  await page.evaluate(() => document.exitFullscreen?.());
  await page.waitForFunction(() => !document.fullscreenElement);
  // Exercise the same in-page fallback used when a browser refuses the native request.
  await page.evaluate(() => setFallbackFullscreen(document.querySelector('#gameRunnerPanel'), true));
  await page.waitForFunction(() => document.querySelector('#gameRunnerPanel').classList.contains('game-fallback-fullscreen'));
  assert.equal(await page.locator('#gameRunnerPanel .game-fullscreen-button').getAttribute('aria-label'), 'Выйти из полноэкранного режима');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#gameRunnerPanel').classList.contains('game-fallback-fullscreen'));
  const calmGround = await page.evaluate(() => {
    const canvas = document.querySelector('#runnerCanvas');
    const ctx = canvas.getContext('2d');
    const y = canvas.height - 38;
    runnerGame = createRunnerState();
    runnerGame.worldOffset = 0;
    drawRunnerStatic();
    const first = Array.from(ctx.getImageData(180, y + 3, 300, 26).data);
    runnerGame.worldOffset = 500;
    drawRunnerStatic();
    const second = Array.from(ctx.getImageData(180, y + 3, 300, 26).data);
    return first.every((pixel, index) => pixel === second[index]);
  });
  assert.equal(calmGround, true, 'the green platform does not scroll or stripe at high speed');

  await page.locator('#gameRunnerPanel [data-info-key="runner"]').click();
  assert.equal(await page.locator('#infoTitle').textContent(), 'Любимое село');
  assert.match(await page.locator('#infoModalBody').textContent(), /двойной прыжок/);
  await page.locator('[data-close-modal="infoModal"]').click();

  const runnerVisual = await page.evaluate(async () => {
    const canvas = document.querySelector('#runnerCanvas');
    const ctx = canvas.getContext('2d');
    const groundY = canvas.height - 38;
    await Promise.all(['tree', 'bull', 'cow', 'cowRun'].map(async (key) => {
      const image = runnerImages[key];
      if (image?.decode) { try { await image.decode(); } catch {} }
    }));
    runnerGame = createRunnerState();
    runnerGame.entities = [
      { type: 'obstacle', ...RUNNER_OBSTACLES.find((item) => item.key === 'tree'), x: 375, baseY: groundY + 5 },
      { type: 'obstacle', ...RUNNER_OBSTACLES.find((item) => item.key === 'bull'), x: 560, baseY: groundY + 2 },
    ];
    drawRunnerStatic();
    runnerGame.entities.forEach((entity) => drawRunnerEntity(ctx, entity));
    document.querySelector('#runnerOverlay').classList.add('hidden');
    const tree = runnerGame.entities[0];
    const bull = runnerGame.entities[1];
    const treeVisual = entityRect(tree);
    const bullVisual = entityRect(bull);
    return {
      obstacles: RUNNER_OBSTACLES.map((item) => item.key),
      bonuses: RUNNER_BONUSES.map((item) => item.key),
      initialSpeed: runnerGame.speed,
      treeVisual,
      treeHitbox: entityHitbox(tree, treeVisual),
      bullVisual,
      bullHitbox: entityHitbox(bull, bullVisual),
      treeLoaded: runnerImages.tree.complete && runnerImages.tree.naturalWidth > 0,
      bullLoaded: runnerImages.bull.complete && runnerImages.bull.naturalWidth > 0,
      cowLoaded: runnerImages.cow.complete && runnerImages.cow.naturalWidth > 0,
      cowRunLoaded: runnerImages.cowRun.complete && runnerImages.cowRun.naturalWidth > 0,
      fontLoaded: document.fonts.check(`12px ${RUNNER_FONT}`),
    };
  });
  assert.deepEqual(runnerVisual.obstacles, ['rock', 'tree', 'bull']);
  assert.deepEqual(runnerVisual.bonuses, ['grass', 'milk', 'boots']);
  assert.equal(runnerVisual.initialSpeed, 2.25);
  assert.equal(runnerVisual.treeLoaded, true);
  assert.equal(runnerVisual.bullLoaded, true);
  assert.equal(runnerVisual.cowLoaded, true);
  assert.equal(runnerVisual.cowRunLoaded, true);
  assert.equal(runnerVisual.fontLoaded, true);
  assert(runnerVisual.treeVisual.y >= 0 && runnerVisual.treeVisual.y + runnerVisual.treeVisual.height <= 250, 'complete tree stays in canvas');
  assert(runnerVisual.treeHitbox.width < runnerVisual.treeVisual.width && runnerVisual.treeHitbox.height < runnerVisual.treeVisual.height, 'tree death zone excludes transparent artwork');
  assert(runnerVisual.bullHitbox.width < runnerVisual.bullVisual.width && runnerVisual.bullHitbox.height < runnerVisual.bullVisual.height, 'bull death zone excludes horns and margins');
  await page.locator('#runnerStage').screenshot({ path: `/home/user/browser-check/runner-v24-entities-${width}.png` });
  await page.evaluate(() => setRunnerOverlay('Любимое село', 'Начать'));

  // It starts slowly, accelerates endlessly, and the small restart resets its own run.
  await page.locator('#runnerStartBtn').click();
  await page.waitForTimeout(80);
  const speedRun = await page.evaluate(() => {
    const slow = runnerGame.speed;
    runnerGame.entities = [];
    runnerGame.nextSpawnAt = Infinity;
    runnerGame.elapsedMs = 6 * 60 * 1000;
    runnerGame.lastFrameAt = performance.now() - 20;
    runnerLoop(performance.now());
    return { slow, fast: runnerGame.speed, stillRunning: runnerGame.running, elapsedMs: runnerGame.elapsedMs };
  });
  assert(speedRun.fast > speedRun.slow, 'speed increases over time');
  assert.equal(speedRun.stillRunning, true, 'the runner has no six-minute finish line');
  await page.locator('#runnerRestartBtn').click();
  assert.equal(await page.evaluate(() => runnerGame.elapsedMs < 200 && runnerGame.speed === RUNNER_START_SPEED), true, 'restart creates a slow fresh run');
  await page.evaluate(() => pauseRunnerGame());

  // Truths labels no longer define/explain truth and dream in the card itself.
  await page.locator('[data-game-subtab="truths"]').click();
  const truthsText = await page.locator('#gameTruthsPanel').textContent();
  assert.doesNotMatch(truthsText, /реальный факт|желание на встречу/);
  assert.equal(await page.locator('#gameTruthsPanel .games-modal-heading [data-fullscreen-target]').count(), 0);
  const truthsFullscreen = await page.locator('#gameTruthsPanel .truths-bottom-utilities [data-fullscreen-target="gameTruthsPanel"]').evaluate((button) => {
    const box = button.getBoundingClientRect(); const card = button.closest('.games-page-card').getBoundingClientRect();
    const history = button.closest('.games-page-card').querySelector('#truthsHistoryDetails').getBoundingClientRect(); const utility = button.parentElement.getBoundingClientRect();
    return { utilityLeft: utility.left - card.left, top: box.top - card.top, historyBottom: history.bottom - card.top };
  });
  assert(truthsFullscreen.utilityLeft < 65 && truthsFullscreen.top >= truthsFullscreen.historyBottom, 'truths fullscreen is in the lower-left utility area');
  const truthsRestart = await page.locator('#truthsResetBtn').evaluate((button) => {
    const restart = button.getBoundingClientRect(); const fullscreen = button.parentElement.querySelector('[data-fullscreen-target]').getBoundingClientRect();
    return { text: button.textContent.trim(), right: restart.right, fullscreenLeft: fullscreen.left, sameRow: Math.abs(restart.top - fullscreen.top) < 2 };
  });
  assert.equal(truthsRestart.text, '↻');
  assert(truthsRestart.sameRow && truthsRestart.right <= truthsRestart.fullscreenLeft + 1, 'truths restart icon sits beside fullscreen');
  await page.locator('#gameTruthsPanel [data-info-key="truths"]').click();
  assert.equal(await page.locator('#infoTitle').textContent(), 'Две правды и одна мечта');
  await page.locator('[data-close-modal="infoModal"]').click();

  // Compact phone-safe mode line and relative left/right score display.
  await page.locator('[data-game-subtab="tictactoe"]').click();
  assert.equal(await page.locator('#gameTictactoePanel .games-modal-heading [data-fullscreen-target]').count(), 0);
  const tttFullscreen = await page.locator('#gameTictactoePanel .ttt-bottom-utilities [data-fullscreen-target="gameTictactoePanel"]').evaluate((button) => {
    const box = button.getBoundingClientRect(); const card = button.closest('.games-page-card').getBoundingClientRect();
    const board = button.closest('.games-page-card').querySelector('#tttBoard').getBoundingClientRect(); const utility = button.parentElement.getBoundingClientRect();
    return { utilityLeft: utility.left - card.left, top: box.top - card.top, boardBottom: board.bottom - card.top };
  });
  assert(tttFullscreen.utilityLeft < 65 && tttFullscreen.top >= tttFullscreen.boardBottom, 'TTT fullscreen shares the lower-left utility area');
  const tttRestart = await page.locator('#tttResetBtn').evaluate((button) => {
    const restart = button.getBoundingClientRect(); const fullscreen = button.parentElement.querySelector('[data-fullscreen-target]').getBoundingClientRect();
    return { text: button.textContent.trim(), right: restart.right, fullscreenLeft: fullscreen.left, sameRow: Math.abs(restart.top - fullscreen.top) < 2 };
  });
  assert.equal(tttRestart.text, '↻');
  assert(tttRestart.sameRow && tttRestart.right <= tttRestart.fullscreenLeft + 1, 'TTT restart icon sits beside fullscreen');
  const compactTtt = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.ttt-mode-btn')].map((button) => button.getBoundingClientRect());
    const switcher = document.querySelector('.ttt-mode-switch');
    return {
      wrap: getComputedStyle(switcher).flexWrap,
      sameLine: Math.max(...buttons.map((box) => box.top)) - Math.min(...buttons.map((box) => box.top)) < 2,
      fits: switcher.scrollWidth <= switcher.clientWidth + 1,
      pills: [...document.querySelectorAll('.ttt-score-pill')].map((pill) => pill.textContent.trim()),
    };
  });
  assert.equal(compactTtt.wrap, 'nowrap');
  assert.equal(compactTtt.sameLine, true, 'all modes use one line');
  assert.equal(compactTtt.fits, true, `TTT controls fit at ${width}px`);
  assert.equal(compactTtt.pills.length, 2);
  assert(compactTtt.pills.every((value) => /^\d+$/.test(value)), 'scoreboard visually contains only two numeric values');
  const relativeScores = await page.evaluate(() => {
    tttMode = 'online';
    latestGamesData = { tictactoe: { catMoves: [], heartMoves: [], turn: 'heart', winner: null, winLine: null, scores: { cat: 3, heart: 7 }, my_side: 'heart' } };
    renderTicTacToe();
    return [document.querySelector('#tttCatScore').textContent, document.querySelector('#tttHeartScore').textContent];
  });
  assert.deepEqual(relativeScores, ['7', '3'], 'left score is always the signed-in player');
  await page.locator('[data-ttt-mode="local"]').click();
  await page.locator('#tttResetBtn').click();
  for (const cell of [0, 4, 1, 3, 2]) await page.locator(`#tttBoard [data-ttt-cell="${cell}"]`).click();
  const winningBoard = await page.evaluate(() => ({ state: localTttState, status: document.querySelector('#tttStatusBanner').textContent }));
  assert.equal(JSON.stringify(winningBoard.state.catMoves), JSON.stringify([0, 1, 2]));
  assert.equal(JSON.stringify(winningBoard.state.heartMoves), JSON.stringify([4, 3]));
  assert.equal(winningBoard.state.winner, 'cat');
  assert.match(winningBoard.status, /Победа/);
  await page.locator('#tttResetBtn').click();
  for (const cell of [0, 1, 2, 4, 3, 5, 7, 6, 8]) await page.locator(`#tttBoard [data-ttt-cell="${cell}"]`).click();
  const drawBoard = await page.evaluate(() => ({ state: localTttState, status: document.querySelector('#tttStatusBanner').textContent }));
  assert.equal(drawBoard.state.draw, true);
  assert.equal(drawBoard.state.catMoves.length + drawBoard.state.heartMoves.length, 9);
  assert.equal(drawBoard.status, 'Ничья');
  await page.locator('#gameTictactoePanel [data-info-key="tictactoe"]').click();
  assert.equal(await page.locator('#infoTitle').textContent(), 'Крестики-нолики');
  await page.locator('[data-close-modal="infoModal"]').click();

  const anniversary = await page.evaluate(() => {
    const button = document.querySelector('#anniversaryButton');
    const date = button.querySelector('.anniversary-date-label');
    const spans = [...button.children];
    const dateIndex = spans.indexOf(date);
    return {
      left: spans.slice(0, dateIndex).filter((item) => item.getAttribute('aria-hidden') === 'true').map((item) => item.textContent),
      right: spans.slice(dateIndex + 1).filter((item) => item.getAttribute('aria-hidden') === 'true').map((item) => item.textContent),
    };
  });
  assert.deepEqual(anniversary.left, ['✨', '💞']);
  assert.deepEqual(anniversary.right, ['✨', '🎀']);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, `no horizontal overflow at ${width}px`);
  await page.screenshot({ path: `/home/user/browser-check/v25-${width}.png`, fullPage: true });
  await context.close();
}

assert.deepEqual(errors, []);
await browser.close();
console.log('PASS: v28 continuous non-tiled theme surfaces, numerical live/paired runner records, shared restart/fullscreen utilities, and conventional TTT.');
