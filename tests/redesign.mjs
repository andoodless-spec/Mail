import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.TEST_URL||'http://127.0.0.1:8002';
fs.mkdirSync('test-artifacts',{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(7000);page.setDefaultNavigationTimeout(10000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const api=async(path,method='GET',data={})=>page.evaluate(async({path,method,data})=>localApi(path,{method,body:JSON.stringify(data)}),{path,method,data});
const refresh=()=>page.evaluate(()=>refresh());
// Оформление живёт на первой вкладке настроек; после сохранения панель закрываем.
const appearance=async(theme,mode)=>{await page.locator('#quickAppearance').click();await page.locator('#settingsPanelAppearance').waitFor({state:'visible'});await page.locator(`[data-theme-choice=${theme}]`).click();await page.locator(`[data-mode-choice=${mode}]`).click();await page.locator('#savePersonalizationButton').click();await page.waitForFunction(()=>document.querySelector('html').dataset.theme!==undefined);await page.locator('#settingsModal .modal-close').click();await page.locator('#settingsModal').waitFor({state:'hidden'});};
try{
 await page.goto(base);console.log('stage auth');await page.locator('#createForm input[name=name]').fill('Маша');await page.locator('#createForm input[name=pin]').fill('1234');await page.locator('#createForm button[type=submit]').click();await page.locator('#appView:not(.hidden)').waitFor();
 const state=await api('/api/state');await api('/api/join','POST',{name:'Саша',pin:'5678',code:state.pair_code});await page.evaluate(()=>localStorage.setItem('quiet_mailbox_user','1'));await refresh();await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('.main-tab').allTextContents().then(a=>a.map(s=>s.trim()).join('|')),'Наш уголок|Ящик|Свидания|Игры');
 assert.equal(await page.locator('.our-grid').evaluate(e=>getComputedStyle(e).display),'grid');
 assert.equal(await page.locator('#ourView .card').count(),4);
 await page.screenshot({path:'test-artifacts/home-desktop.png',fullPage:true,animations:'disabled'});
 console.log('// The home editor');
 // The home editor changes only this person's presentation, not stored content.
 await page.locator('#homeLayoutEditor summary').click();await page.locator('[data-home-title=wishes]').fill('Наши мечты');await page.locator('#saveHomeLayout').click();
 await page.waitForFunction(()=>normalizeClientPreferences(appState.preferences).homeTitles.wishes==='Наши мечты');
 await page.locator('#homeLayoutEditor summary').click();
 console.log('// Three independent');
 // Three independent palettes, each with genuinely different day/night surfaces.
 const colors={};
 for(const theme of ['pink','purple','blue']){
  colors[theme]=[];
  for(const mode of ['light','dark']){await appearance(theme,mode);colors[theme].push(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor));}
  assert.notEqual(...colors[theme]);
 }
 assert.equal(new Set(Object.values(colors).flat()).size,6);
 await appearance('purple','dark');await page.reload();await page.locator('#appView:not(.hidden)').waitFor();assert.equal(await page.locator('html').getAttribute('data-mode'),'dark');
 await page.screenshot({path:'test-artifacts/home-dark.png',fullPage:true,animations:'disabled'});
 await page.evaluate(()=>openPersonalization());await page.locator('#settingsPanelAppearance').waitFor({state:'visible'});assert.notEqual(await page.evaluate(()=>document.activeElement?.tagName),'INPUT');await page.locator('#settingsModal .modal-close').click();
 await appearance('blue','system');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.mode==='dark');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.mode==='light');
 await appearance('pink','light');
 console.log('// Agreements');
 // Agreements have one shared form, moved rather than duplicated.
 await page.locator('.main-tab[data-view=mailbox]').click();await page.locator('[data-mailbox-view=agreements]').click();assert.equal(await page.locator('#agreementForm').count(),1);assert(await page.locator('#agreementsView #agreementForm').isVisible());
 await page.locator('#agreementForm textarea[name=text]').fill('Разговариваем без телефонов');await page.locator('#agreementForm button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#agreementsList').textContent.includes('без телефонов'));
 await page.locator('.main-tab[data-view=our]').click();assert(await page.locator('#ourView #agreementForm').isVisible());assert.equal(await page.locator('#agreementForm').count(),1);
 assert.equal(await page.locator('#intimateGate').getAttribute('open'),null);
 await page.locator('#intimateGate > summary').click();await page.locator('.main-tab[data-view=mailbox]').click();assert.equal(await page.locator('#intimateGate').getAttribute('open'),null);
 console.log('// A real note');
 // A real note saved using the new in-letter category buttons.
 await page.locator('[data-mailbox-view=mailbox]').click();await page.locator('[data-category=hard]').click();await page.locator('#noteBody').fill('Мне хотелось бы больше спокойных разговоров');await page.locator('#saveNote').click();await page.waitForFunction(()=>appState.counts.hard===1);
 assert.equal(await page.locator('#notesList .note-body').count(),0);
 console.log('// Long letters');
 // Long letters: exact reassembly, continuation pages, actions only on the last page.
 const longText=('Строка про нас и про заботу. 💌\n').repeat(105).slice(0,3450);
 await api('/api/notes','POST',{category:'sweet',body:longText});await api('/api/open','POST',{now:true});await refresh();await page.locator('[data-mailbox-view=conversation]').click();
 assert.equal(await page.locator('#notesList input[type=search]').count(),0);
 let count=Number((await page.locator('#bookPageLabel').textContent()).split('/')[1]);assert(count>3);
 const collected=new Map();
 for(let i=0;i<count;i++){
  const current=await page.evaluate(()=>{const e=document.querySelector('#notesList .note-item:not(.hidden)');return e?{id:[...document.querySelectorAll('#notesList .note-item')].indexOf(e),text:e.querySelector('.note-body')?.textContent,hasActions:!e.querySelector('.note-actions')?.classList.contains('hidden')}:null;});
  if(current?.text)collected.set(current.id,(collected.get(current.id)||'')+current.text);
  if(i<count-1)await page.locator('#bookNext').click();
 }
 assert([...collected.values()].includes(longText.trim()));assert(await page.locator('#talkOutcomeCard').isVisible());
 await page.locator('#bookPrev').click();await page.screenshot({path:'test-artifacts/book-desktop.png',fullPage:true,animations:'disabled'});
 console.log('// Narrow phones');
 // Narrow phones keep the same readable font and a fixed-height book; no page overflow.
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`horizontal overflow at ${width}`);
  const h=await page.locator('#bookWorkspace').evaluate(e=>e.clientHeight);assert(h<=445&&h>=330);
  assert(await page.locator('#bookNext').isVisible());
  for(const view of ['homework','agreements','capsule','mailbox','conversation']){await page.locator(`[data-mailbox-view=${view}]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  if(width===390)await page.screenshot({path:'test-artifacts/book-mobile.png',fullPage:true,animations:'disabled'});
 }
 await api('/api/finish','POST',{});await refresh();assert.equal((await api('/api/state')).notes.length,0);assert.equal(await page.locator('#notesList .note-body').count(),0);
 console.log('// Independent settings');
 // Independent settings and all main destinations remain usable.
 await page.evaluate(()=>localStorage.setItem('quiet_mailbox_user','2'));await refresh();assert.equal(await page.locator('html').getAttribute('data-theme'),'pink');assert.equal(await page.locator('html').getAttribute('data-mode'),'light');
 for(const view of ['our','dates','games','mailbox']){await page.locator(`.main-tab[data-view=${view}]`).click();assert(await page.locator(`#${view}View`).isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 const ids=await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id));assert.equal(new Set(ids).size,ids.length);assert.deepEqual(errors,[]);
 console.log('PASS: create/join UI,home editing,6 palettes,system preference/reload,agreement identity,private gate,letter categories,exact long-letter pagination,320/390/430px,cycle clearing,all destinations,no JS errors.');
}finally{await browser.close();}
