import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({args:['--no-sandbox']});
for(const width of [1280,390,320]){
 const p=await b.newPage({viewport:{width,height:950}});await p.goto('http://127.0.0.1:8000');
 await p.evaluate(async()=>{await localApi('/api/create',{method:'POST',body:JSON.stringify({name:'Маша',pin:'1234'})});await refresh();});
 const metrics=await p.evaluate(()=>{
  const r=s=>document.querySelector(s).getBoundingClientRect();
  const css=getComputedStyle(document.querySelector('.mailbox-subnav'));
  return {gap:r('#mailboxView .grid-layout').top-r('.mailbox-subnav').bottom, navBackground:css.backgroundColor,navBorder:css.borderTopWidth, radius:getComputedStyle(document.querySelector('.mailbox-subtab')).borderRadius,catRight:r('.welcome-kitten').left>=r('.welcome-copy-text').right, overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert(metrics.gap<=16);assert.equal(metrics.navBackground,'rgba(0, 0, 0, 0)');assert.equal(metrics.navBorder,'0px');assert.equal(metrics.radius,'999px');assert(metrics.catRight);assert(!metrics.overflow);
 await p.screenshot({path:`/home/user/browser-check/v16-${width}.png`});console.log(width,metrics);await p.close();
}
await b.close();
