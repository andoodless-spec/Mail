import re, collections, pathlib

p = pathlib.Path(__file__).resolve().parent.parent
h = (p / 'index.html').read_text()
a = (p / 'app.js').read_text()
c = (p / 'extra.css').read_text()
r = (p / 'api/[...path].js').read_text()

# Basic wiring remains intact.
ids = re.findall(r'\bid="([^"]+)"', h)
assert not [k for k, n in collections.Counter(ids).items() if n > 1]
refs = set(re.findall(r"\$\('#([\w-]+)'\)", a))
dynamic = set(re.findall(r'\bid="([\w-]+)"', a))
assert not refs - set(ids) - dynamic, refs - set(ids) - dynamic
routes = set(re.findall(r"/api/([\w-]+)", a))
declared = set(re.findall(r"import \w+ from '../endpoints/([\w-]+).js'", r))
assert routes <= declared, routes - declared
assert len(list((p / 'api').glob('*.js'))) == 1

# v21 game and information architecture.
assert 'Любимое село' in h and "runner: 'Любимое село'" in a
assert 'Сократи километры' not in h
for obsolete in ('runner-route-btn', 'runnerJumpBtn', 'runnerKmLeft', 'runnerTime', 'runnerProgressBar'):
    assert obsolete not in h, obsolete
for obsolete in ('RUNNER_DURATION_SECONDS', 'RUNNER_TOTAL_KM', 'runnerRoute'):
    assert obsolete not in a, obsolete
assert "key: 'rock'" in a and "key: 'tree'" in a and "key: 'bull'" in a
assert a.count("key: 'bull'") == 1
assert a.count("key: 'grass'") == 1 and a.count("key: 'milk'") == 1 and a.count("key: 'boots'") == 1
assert 'RUNNER_START_SPEED = 2.25' in a and 'RUNNER_MAX_SPEED = 12.25' in a
assert 'runnerGame.speed = Math.min(RUNNER_MAX_SPEED, RUNNER_START_SPEED + runnerSeconds() * 0.052)' in a
assert "action: 'runner_score',\n        score: runnerGame.score" in a
assert 'my_side: myTttSide' in a and 'Сейчас ход соперника.' in a
assert 'runner-bull.svg' in h or 'runner-bull.svg' in a
assert (p / 'assets/runner-bull.svg').is_file()
assert (p / 'assets/runner-tree.svg').is_file()
tree = (p / 'assets/runner-tree.svg').read_text()
bull = (p / 'assets/runner-bull.svg').read_text()
assert 'viewBox="0 0 140 180"' in tree and 'Пиксельное дерево' in tree
assert 'Пиксельный бычок' in bull
for asset_name in ('runner-cow.svg', 'runner-rock.svg', 'runner-tree.svg', 'runner-bull.svg', 'runner-grass.svg', 'runner-milk.svg', 'runner-boots.svg'):
    asset = (p / 'assets' / asset_name).read_text()
    assert 'shape-rendering="crispEdges"' in asset, asset_name
cow = (p / 'assets/runner-cow.svg').read_text()
assert 'Пиксельная коровка' in cow and 'коровьей мордочкой' in cow
run_cow = (p / 'assets/runner-cow-run.svg').read_text()
assert 'Пиксельная коровка в беге' in run_cow and 'shape-rendering="crispEdges"' in run_cow
assert 'const offset = (runnerGame.worldOffset' not in a
assert 'for (let x = -offset;' not in a
assert "ctx.fillStyle = '#347e40';" in a and 'steppedHill' in a and 'ctx.imageSmoothingEnabled = false;' in a
assert "RUNNER_COW_RUN" in a and "runner-cow-run.svg" in a

# All principal sections and games expose rules through heart-dotted i controls.
assert 'id="infoModal"' in h and 'id="activeViewInfoBtn"' in h
assert 'context-info-row' not in h
assert 'active-view-info-button' in h
assert h.count('data-info-key=') >= 4
for key in ('mailbox', 'conversation', 'homework', 'capsule', 'dates', 'datesHistory', 'our', 'games', 'truths', 'runner', 'tictactoe', 'partnerProfile'):
    assert f'{key}:' in a, key
assert 'const INFO_HOSTS' in a and 'function mountActiveViewInfo' in a
assert '.info-card-host' in c and '.active-view-info-button' in c
assert 'info-pixel-heart' in h and 'info-letter' not in h and 'info-heart-dot' not in h
assert '.info-pixel-heart::before' in c and 'opacity: .42' in c
assert '#infoModal .info-modal-card' in c and 'background: rgba(255, 250, 253, .86)' in c
assert '.info-pixel-heart' in c and '#appView .view .muted' in c
assert '#appView .runner-overlay-text' in c

# v23: intentional per-account personalization, private partner notes and game fullscreen controls.
for element_id in ('personalizeButton', 'personalizationModal', 'themeChoices', 'tabOrderControls', 'savePersonalizationButton', 'partnerProfileModal', 'partnerProfileView', 'editPartnerProfileButton', 'partnerProfileForm', 'partnerProfileFields', 'addPartnerFieldButton', 'runnerClock', 'runnerRecordBadge', 'runnerScore', 'runnerRecord'):
    assert f'id="{element_id}"' in h, element_id
assert 'id="partnerBadge" class="partner-badge" type="button"' in h
assert 'data-info-key="partnerProfile"' in h
assert 'PERSONAL_THEME_KEYS' in a
for theme in ('white', 'pink', 'purple', 'blue', 'yellow', 'cyan'):
    assert f"'{theme}'" in a and f"html[data-theme='{theme}']" in c, theme
assert 'function applyPersonalization' in a and 'function savePersonalization' in a
assert 'function openPartnerProfile' in a and "'/api/partner-profile'" in a
assert "'/api/preferences'" in a and 'partnerProfiles' in a
assert 'partner_profiles' in (p / 'lib/db.js').read_text()
assert 'preferences JSONB' in (p / 'lib/db.js').read_text()
assert 'u.preferences' in (p / 'lib/http.js').read_text()
assert 'preferences: normalizePreferences(user.preferences)' in (p / 'lib/state.js').read_text()
assert "import preferences from '../endpoints/preferences.js'" in r
assert "import partnerProfile from '../endpoints/partner-profile.js'" in r
assert "'partner-profile': partnerProfile" in r
for game_id in ('gameTruthsPanel', 'gameRunnerPanel', 'gameTictactoePanel'):
    assert f'data-fullscreen-target="{game_id}"' in h
assert 'function toggleGameFullscreen' in a and 'requestFullscreen' in a
assert 'setFallbackFullscreen' in a and 'game-fallback-fullscreen' in a
assert '.game-fullscreen-button' in c and '.game-subpanel:fullscreen' in c and '.game-fallback-fullscreen' in c
assert '.partner-profile-field' in c and '.theme-choices' in c

# v24: profile is view-first, runner status is one line, capsule/settings stay safe on phones.
assert 'function beginPartnerProfileEdit' in a and 'partnerProfileEditing' in a
assert 'partner-profile-info-grid' in c and 'partner-profile-edit' in c
profile_modal = re.search(r'<div id="partnerProfileModal".*?</div>\s*</div>', h, re.S).group(0)
assert 'id="partnerProfileView"' in profile_modal and 'id="editPartnerProfileButton"' in profile_modal
assert 'id="partnerProfileForm" class="partner-profile-form hidden"' in profile_modal
partner_shortcut = re.search(r'<div class="partner-shortcut">.*?</div>', h, re.S).group(0)
assert 'data-info-key' not in partner_shortcut
assert 'runnerLives' not in h and 'runnerLives' not in a
assert 'formatRunnerTime' in a and 'runnerClock' in a and 'runnerRecordBadge' in h
runner_controls = re.search(r'<div class="runner-utility-buttons">.*?</div>', h, re.S).group(0)
assert runner_controls.index('runnerRestartBtn') < runner_controls.index('runner-fullscreen-button')
assert '#openCapsuleButton' in c and 'position: static' in c
assert '#settingsModal.overlay-modal' in c and 'overflow-x: hidden' in c

# v24: conventional Tic-Tac-Toe never removes an old mark and explicitly supports draws.
for source in (a, (p / 'lib/games.js').read_text(), (p / 'endpoints/games.js').read_text()):
    assert 'applyInfiniteMove' not in source
assert 'applyClassicMove' in a and 'applyClassicMove' in (p / 'lib/games.js').read_text()
assert 'normalizeClassicTttState' in a and 'draw: Boolean' in a
assert 'is-fading' not in a and 'is-fading' not in c
assert 'Бесконечные крестики' not in h and 'Бесконечные крестики' not in a
assert 'Ничья' in a and 'draw: false' in (p / 'endpoints/games.js').read_text()

# Compact TTT mode controls and digit-only score pills are intentional.
assert 'title="Против Кибер-партнёра">Бот</button>' in h
assert 'title="Вдвоём на одном экране">Вдвоём</button>' in h
assert 'title="Через общий ящик">Онлайн</button>' in h
scoreboard = re.search(r'<div class="ttt-scoreboard".*?</div>\s*\n\s*\n\s*<div id="tttStatusBanner"', h, re.S)
assert scoreboard
assert 'tttScoreCatIcon' not in scoreboard.group(0) and 'tttScoreHeartIcon' not in scoreboard.group(0)
assert 'Твои очки' in scoreboard.group(0) and 'Очки соперника' in scoreboard.group(0)
assert '#gameTictactoePanel .ttt-mode-switch' in c and 'flex-wrap: nowrap' in c
assert '#gameTictactoePanel .ttt-scoreboard' in c

# v27: theme-aware memory profile, fully continuous palette, compact label-free runner pills and shared restart icons.
assert 'partner-profile-memory-grid' in a and 'filledFields' in a
assert 'partner-profile-info-grid' not in a and 'partner-profile-info-row' not in a
assert 'PARTNER_PROFILE_ACCENTS' in a and 'normalizePartnerProfileAccent' in a
partner_endpoint = (p / 'endpoints/partner-profile.js').read_text()
assert 'PARTNER_PROFILE_ACCENTS' in partner_endpoint and 'accent:' in partner_endpoint
assert 'name="accent"' in a and 'accent-theme' in c
assert 'partner-profile-cover' in c and 'partner-profile-memory-card' in c
assert '.partner-profile-count { display: none !important;' in c
assert 'то, что хочется бережно помнить' in a and 'noteWord' not in a
runner_hud = re.search(r'<div class="runner-scoreline".*?</div>\s*\n\s*\n\s*<div id="runnerStage"', h, re.S).group(0)
assert 'id="runnerScore"' in runner_hud and 'id="runnerClock"' in runner_hud and 'id="runnerRecord"' in runner_hud
assert 'runnerMyRecord' not in runner_hud and 'runnerPartnerRecord' not in runner_hud
assert 'мой' not in runner_hud and 'партнёра' not in runner_hud
assert 'runner-score-pill' in runner_hud and 'runner-time-record-pill' in runner_hud
assert "$('#runnerScore')" in a and "$('#runnerRecord')" in a and 'runnerMyBestScore' in a
assert 'runnerData?.partner' not in a
assert '#gameRunnerPanel .runner-score-pill,' in c and 'border-radius: 999px' in c
assert 'flex-wrap: nowrap;' in c and 'two-pill runner HUD' in c
assert '--theme-card:' in c and '--theme-inset-filled:' in c and '--theme-summary-filled:' in c
assert 'Theme surfaces deliberately mix only the chosen theme colours' in c
assert 'html[data-theme] details > summary' in c and 'html[data-theme] :is(input, textarea, select)' in c
assert 'v27 supplemental legacy inset coverage' in c and '#infoModal .info-modal-body p' in c
assert 'game-bottom-utilities' in h and 'game-bottom-fullscreen' in h
assert h.count('class="game-restart-button') >= 3
assert '↻ Сбросить историю' not in h and 'Новая партия ↻' not in h
truths_panel = re.search(r'<div id="gameTruthsPanel".*?</article>', h, re.S).group(0)
ttt_panel = re.search(r'<div id="gameTictactoePanel".*?</article>', h, re.S).group(0)
assert 'data-fullscreen-target="gameTruthsPanel"' not in truths_panel[:truths_panel.index('truthsHistoryDetails')]
assert 'truths-bottom-utilities' in truths_panel and 'data-fullscreen-target="gameTruthsPanel"' in truths_panel
assert truths_panel.index('truthsResetBtn') < truths_panel.index('data-fullscreen-target="gameTruthsPanel"')
assert 'data-fullscreen-target="gameTictactoePanel"' not in ttt_panel[:ttt_panel.index('ttt-footer-row')]
assert 'ttt-bottom-utilities' in ttt_panel and 'data-fullscreen-target="gameTictactoePanel"' in ttt_panel
assert ttt_panel.index('tttResetBtn') < ttt_panel.index('data-fullscreen-target="gameTictactoePanel"')
assert '#gameRunnerPanel .runner-controls-row { justify-content: flex-start;' in c
assert '#gameTictactoePanel .ttt-footer-row { justify-content: flex-start;' in c
assert 'Theme normalization: windows, fields, secondary controls' in c
assert 'Theme coverage for nested surfaces' in c and 'html[data-theme] #infoModal .info-modal-card' in c
assert 'html[data-theme] button:not(.button.primary):not(.info-heart-button)' in c

# Existing Vercel data remains the source of truth: no destructive database operation is introduced.
db_source = (p / 'lib/db.js').read_text()
assert 'DROP TABLE' not in db_source.upper()
assert 'CREATE TABLE IF NOT EXISTS partner_profiles' in db_source and 'CREATE TABLE IF NOT EXISTS pair_games_state' in db_source
readme = (p / 'README-VERCEL.md').read_text()
publish = (p / 'PUBLISH-ON-VERCEL.md').read_text()
assert 'Не удаляйте, не заменяйте' in readme and 'С прежней `DATABASE_URL`' in publish
assert 'Не создавайте новый проект' in readme and 'Не создавайте новый Vercel-проект' in publish
assert (p / 'RELEASE-v27.md').is_file()
update_guide = (p / 'UPDATE-EXISTING-VERCEL.md').read_text()
assert 'Не создавайте новый Vercel-проект' in update_guide and 'Не удаляйте' in update_guide
assert 'npx vercel@latest link' in update_guide and 'Link to existing project? → Yes' in update_guide
assert 'Вариант B — обновление с iPad' in update_guide and 'Не открывайте `vercel.com/drop`' in update_guide
assert (p / 'GITHUB-PHONE-SETUP.md').is_file() and (p / 'github-phone-unpack-update.yml').is_file()
phone_guide = (p / 'GITHUB-PHONE-SETUP.md').read_text()
phone_workflow = (p / 'github-phone-unpack-update.yml').read_text()
assert 'quiet-mailbox-vercel-v27.zip' in phone_guide and '.github/workflows/unpack-update.yml' in phone_guide
assert 'workflow_dispatch:' in phone_workflow and 'inputs:' in phone_workflow and 'unzip -o -q' in phone_workflow
assert 'contents: write' in phone_workflow and 'test -f "$ARCHIVE"' in phone_workflow

# Four symmetric header emojis: two before and two after the anniversary date.
anniversary = re.search(r'<button id="anniversaryButton".*?</button>', h, re.S).group(0)
date_at = anniversary.index('anniversary-date-label')
assert anniversary[:date_at].count('aria-hidden="true"') == 2
assert anniversary[date_at:].count('aria-hidden="true"') == 2

for path in p.rglob('*'):
    if path.is_file() and 'node_modules' not in path.parts and path.suffix in ['.js', '.json', '.html']:
        assert not re.search(r'openai|anthropic|gemini|/api/ai\b|ai-provider|ai-prompts', path.read_text(), re.I), path

print('PASS: v27 wiring — continuous theme surfaces, compact runner score/time-record pills, retained Vercel data model, and conventional Tic-Tac-Toe.')
