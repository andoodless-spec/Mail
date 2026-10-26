import collections
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
app = (root / 'app.js').read_text()
css = (root / 'extra.css').read_text()
router = (root / 'api/[...path].js').read_text()

# Basic document/API wiring.
ids = re.findall(r'\bid="([^"]+)"', html)
assert not [value for value, count in collections.Counter(ids).items() if count > 1]
refs = set(re.findall(r"\$\('#([\w-]+)'\)", app))
dynamic_ids = set(re.findall(r'\bid="([\w-]+)"', app))
assert not refs - set(ids) - dynamic_ids, refs - set(ids) - dynamic_ids
routes = set(re.findall(r"/api/([\w-]+)", app))
declared = set(re.findall(r"import \w+ from '../endpoints/([\w-]+).js'", router))
assert routes <= declared, routes - declared

# Original per-account personalization is still the source of visual identity.
for theme in ('white', 'pink', 'purple', 'blue', 'yellow', 'cyan'):
    assert f"html[data-theme='{theme}']" in css, theme
assert 'PERSONAL_THEME_KEYS' in app
assert 'function applyPersonalization' in app and 'function savePersonalization' in app
assert "'/api/preferences'" in app
assert 'preferences JSONB' in (root / 'lib/db.js').read_text()
assert 'preferences: normalizePreferences(user.preferences)' in (root / 'lib/state.js').read_text()
assert 'v29: original gentle personal palettes, without inset squares' in css
assert 'html[data-theme] :is(input, textarea, select)' in css
assert 'background: transparent !important;' in css
assert 'html[data-theme] details > summary' in css
assert 'html[data-theme] button:not(.button.primary):not(.info-heart-button)' in css
assert 'theme-unified-surface' not in css
assert '=== v27 palette' not in css and '=== v28 continuous' not in css
assert 'html[data-theme=\'purple\'] body' in css

# Only the desired runner HUD correction is added to the v26 baseline.
runner_hud = re.search(r'<div class="runner-scoreline".*?</div>\s*\n\s*\n\s*<div id="runnerStage"', html, re.S).group(0)
for element_id in ('runnerLiveRecord', 'runnerMyRecord', 'runnerPartnerRecord', 'runnerRecordBadge'):
    assert f'id="{element_id}"' in runner_hud, element_id
for obsolete in ('id="runnerClock"', 'id="runnerScore"', 'runner-time-score', 'runner-record-caption', 'runner-record-slot', 'очков'):
    assert obsolete not in runner_hud, obsolete
assert 'runner-live-record-pill' in runner_hud and 'runner-pair-record-pill' in runner_hud
assert 'runner-record-colon' in runner_hud and '>:</span>' in runner_hud
assert 'formatRunnerTime' not in app
assert 'runnerMyBestScore' in app and 'runnerPartnerBestScore' in app
assert "$('#runnerLiveRecord')" in app and "$('#runnerMyRecord')" in app and "$('#runnerPartnerRecord')" in app
assert 'runnerData?.partner?.best_score' in app
assert '#gameRunnerPanel .runner-live-record-pill,' in css
assert '#gameRunnerPanel .runner-pair-record-pill' in css
assert 'font-variant-numeric: tabular-nums' in css

# The rest of the established endless Runner remains intact.
assert 'Любимое село' in html and "runner: 'Любимое село'" in app
for obsolete in ('runner-route-btn', 'runnerJumpBtn', 'runnerKmLeft', 'runnerTime', 'runnerProgressBar'):
    assert obsolete not in html, obsolete
for key in ('rock', 'tree', 'bull', 'grass', 'milk', 'boots'):
    assert f"key: '{key}'" in app, key
assert 'RUNNER_START_SPEED = 2.25' in app and 'RUNNER_MAX_SPEED = 12.25' in app
assert 'runnerGame.speed = Math.min(RUNNER_MAX_SPEED + 0' not in app
for asset_name in ('runner-cow.svg', 'runner-cow-run.svg', 'runner-rock.svg', 'runner-tree.svg', 'runner-bull.svg', 'runner-grass.svg', 'runner-milk.svg', 'runner-boots.svg'):
    asset = (root / 'assets' / asset_name).read_text()
    assert 'shape-rendering="crispEdges"' in asset, asset_name

# Existing conventional game/privacy/fullscreen behavior is retained.
for source in (app, (root / 'lib/games.js').read_text(), (root / 'endpoints/games.js').read_text()):
    assert 'applyInfiniteMove' not in source
assert 'applyClassicMove' in app and 'Ничья' in app
assert 'runnerLives' not in html and 'runnerLives' not in app
assert 'function toggleGameFullscreen' in app and 'setFallbackFullscreen' in app
assert 'data-fullscreen-target="gameRunnerPanel"' in html
assert 'data-fullscreen-target="gameTictactoePanel"' in html
assert 'PARTNER_PROFILE_ACCENTS' in app and 'normalizePartnerProfileAccent' in app
assert 'partner_profiles' in (root / 'lib/db.js').read_text()
assert 'DROP TABLE' not in (root / 'lib/db.js').read_text().upper()

# Release/update files point at the v29 archive and preserve the existing Vercel data model.
assert (root / 'RELEASE-v29.md').is_file()
release = (root / 'RELEASE-v29.md').read_text()
assert 'quiet-mailbox-vercel-v29.zip' in release and 'DATABASE_URL' in release
phone = (root / 'GITHUB-PHONE-SETUP.md').read_text()
workflow = (root / 'Cunpack-update-v29.yml').read_text()
manual_workflow = (root / 'github-phone-unpack-update.yml').read_text()
assert 'quiet-mailbox-vercel-v29.zip' in phone and 'Run workflow' in phone
assert "'.github/workflows/Cunpack-update.yml'" in workflow
assert 'workflow_dispatch:' in workflow and 'contents: write' in workflow
assert 'quiet-mailbox-vercel-v29.zip' in workflow and 'Обновить Тихий ящик до v29' in workflow
assert 'workflow_dispatch:' in manual_workflow and 'unzip -o -q' in manual_workflow
assert 'quiet-mailbox-vercel-v29.zip' in manual_workflow
assert 'Не меняйте и не удаляйте `DATABASE_URL`' in (root / 'UPDATE-EXISTING-VERCEL.md').read_text()

# No unrelated AI integration is introduced.
for path in root.rglob('*'):
    if path.is_file() and 'node_modules' not in path.parts and path.suffix in ('.js', '.json', '.html'):
        assert not re.search(r'openai|anthropic|gemini|/api/ai\b|ai-provider|ai-prompts', path.read_text(), re.I), path

print('PASS: v29 restores the original gentle personalized design, removes inset tiles, and retains the numerical Runner HUD.')
