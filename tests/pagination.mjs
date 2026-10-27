import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch();const p=await browser.newPage();
try {
 await p.goto(process.env.TEST_URL||'http://127.0.0.1:8002');
 await p.evaluate(async()=>{await localApi('/api/create',{method:'POST',body:JSON.stringify({name:'Проверка',pin:'1234'})});await refresh();});
 for(const width of [320,390,1440]) {
  await p.setViewportSize({width,height:900});
  for(const text of ['Я'.repeat(3500),'💌'.repeat(1700),('Сохраняем каждую строку.\n').repeat(130).trim()]) {
   await p.evaluate(async text=>{await localApi('/api/notes',{method:'POST',body:JSON.stringify({category:'sweet',body:text})});await localApi('/api/open',{method:'POST',body:JSON.stringify({now:true})});await refresh();switchView('conversation');},text);
   await p.waitForTimeout(140);
   const total=Number((await p.locator('#bookPageLabel').textContent()).split('/')[1]);let combined='';
   for(let i=0;i<total-1;i++) {
    const result=await p.evaluate(()=>{const ws=document.querySelector('#bookWorkspace'),a=document.querySelector('#notesList .note-item:not(.hidden)'),b=a.querySelector('.note-body');return {text:b.textContent,fs:getComputedStyle(b).fontSize,overflowX:b.scrollWidth>b.clientWidth+1,bottom:b.getBoundingClientRect().bottom,limit:ws.getBoundingClientRect().bottom,actions:!a.querySelector('.note-actions').classList.contains('hidden')};});
    assert.equal(result.fs,'16px');assert.equal(result.overflowX,false);assert(result.bottom<=result.limit+2,`Letter body overflows vertically at ${width}`);
    assert.equal(result.actions,i===total-2);combined+=result.text;
    assert(!/[\uD800-\uDBFF]$/.test(result.text),'A page must not end on half an emoji');
    await p.locator('#bookNext').click();
   }
   assert.equal(combined,text);await p.evaluate(async()=>{await localApi('/api/finish',{method:'POST',body:'{}'});await refresh();});
  }
 }
 console.log('PASS: lossless 3500-character unbroken letters,emoji pairs,newline-heavy letters,16px fixed text,no text overflow,actions only on last continuation at320/390/1440px.');
}finally{await browser.close();}
