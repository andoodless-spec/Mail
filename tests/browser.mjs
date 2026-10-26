import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
for(const width of [1280,390,320]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000');
 await page.evaluate(async()=>{await localApi('/api/create',{method:'POST',body:JSON.stringify({name:'Маша',pin:'1234'})});await refresh();});
 assert.deepEqual(await page.locator('.main-tab').allTextContents(),['✍️ Ящик','🐱 Игры','💗 Свидания','🌷 Наше']);
 for(const tab of ['conversation','homework','mailbox']){
  await page.locator(`[data-mailbox-view="${tab}"]`).click();assert(await page.locator(`#${tab}View`).isVisible());assert(await page.locator('.main-tab[data-view="mailbox"]').evaluate(e=>e.classList.contains('active')));
 }
 await page.locator('.main-tab[data-view="games"]').click();assert(await page.locator('#gamesView').isVisible());assert(!(await page.locator('#mailboxSubnav').isVisible()));
 await page.locator('[data-game-start]').click();await page.locator('.game-question').waitFor();
 const original=await page.locator('.game-question').getAttribute('data-round-id');
 await page.locator('input[name="gameGuess"][value="1"]').check();await page.locator('input[name="gameAnswer"][value="2"]').check();await page.locator('[data-game-submit]').click();await page.getByText('Твой ответ сохранён',{exact:true}).waitFor();
 for(const [mode,label] of [['support','Понять меня'],['choose','Мы выбираем'],['reactions','Наши реакции']]){
  await page.locator('#gameMode').selectOption(mode);await page.locator('.game-category').filter({hasText:label}).waitFor();assert.equal(await page.locator('#gamesTitle').textContent(),label);
 }
 await page.locator('#gameMode').selectOption('know');await page.getByText('Твой ответ сохранён',{exact:true}).waitFor();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('quiet_mailbox_demo')).gameRounds.filter(r=>r.mode_key==='know')[0].id);assert.equal(String(stored),original);
 await page.locator('.main-tab[data-view="our"]').click();
 const cards=await page.locator('.our-grid > .card').evaluateAll(es=>es.map(e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,b:r.bottom}}));
 assert.equal(cards.length,5);for(let i=1;i<cards.length;i++){assert.equal(cards[i].x,cards[0].x);assert.equal(cards[i].w,cards[0].w);assert(cards[i].y>=cards[i-1].b);}
 for(const id of ['wishListDetails','intimateWishListDetails','agreementsDetails']){const d=page.locator('#'+id);await d.locator(':scope > summary').click();assert.equal(await d.getAttribute('open'),'');await d.locator(':scope > summary').click();}
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS',width,'px: tabs/subtabs, four game modes, preserved submitted answer on return, strictly vertical cards, details, no overflow/errors');await page.close();
}
await browser.close();
