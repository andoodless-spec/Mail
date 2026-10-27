import collections,json,pathlib,re
r=pathlib.Path(__file__).resolve().parent.parent
html=(r/'index.html').read_text();app=(r/'app.js').read_text();css=(r/'redesign.css').read_text()
ids=re.findall(r'\bid="([^"]+)"',html)
assert len(ids)==len(set(ids)), 'Duplicate HTML IDs'
refs=set(re.findall(r"\$\('#([\w-]+)'\)",app));dynamic=set(re.findall(r'\bid="([\w-]+)"',app))
assert not refs-set(ids)-dynamic, refs-set(ids)-dynamic
router=(r/'api/[...path].js').read_text()
routes=set(re.findall(r"/api/([\w-]+)",app));declared=set(re.findall(r"import \w+ from '../endpoints/([\w-]+).js'",router))
assert routes<=declared
for theme in ('pink','purple','blue'):
 assert f'html[data-theme="{theme}"]' in css and f'html[data-theme="{theme}"][data-mode="dark"]' in css
for key in ('mailbox','conversation','homework','agreements','capsule'):
 assert f'data-mailbox-view="{key}"' in html
assert 'type="search"' not in html
assert html.count('id="agreementForm"')==1
for name in ('app.js','redesign.js','backup.js','settings.js','style.css','reference.css','extra.css','redesign.css','icon.svg','favicon.png','apple-touch-icon.png','manifest.json','fonts/pixelify.ttf','assets/ui/together.svg','api/[...path].js','lib/db.js'):
 assert (r/name).is_file(), name
for path in re.findall(r'(?:src|href)="(/[^"?]+)',html):
 assert (r/path[1:]).exists(),path
assert json.loads((r/'package.json').read_text())['version']=='2.3.0'
print('PASS: unique IDs, local asset references,API routing,five book tabs,3 complete palettes,no mailbox search.')
