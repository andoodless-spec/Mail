import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizePreferences, mergePreferences, TAB_ORDER_DEFAULTS } from '../lib/preferences.js';
const memory=new Map();
const sandbox={console,URL,Date,Math,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},document:{addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('app.js','utf8'),sandbox);
for(const raw of [{},{theme:'white'},{theme:'cyan',mode:'dark'},{theme:'purple',mode:'system',homeOrder:['wishes','wishes','bad'],homeHidden:['intimate','bad','intimate'],homeTitles:{wishes:'  Мечты  ',bad:'Bad'}},JSON.stringify({theme:'blue',mode:'dark'})]){
 const server=normalizePreferences(raw),client=sandbox.normalizeClientPreferences(raw);
 assert.equal(JSON.stringify(server),JSON.stringify(client));
 assert.deepEqual(server.orders.mailbox,TAB_ORDER_DEFAULTS.mailbox);
 assert.deepEqual(server.orders.main,TAB_ORDER_DEFAULTS.main);
}
// Своя раскладка вкладок: валидный порядок сохраняется и у сервера, и у клиента,
// повторы убираются, неизвестные ключи отбрасываются, забытые возвращаются на место.
for(const raw of [{orders:{main:['games','our'],mailbox:['capsule','mailbox','capsule']}},{orders:{main:['nope','dates'],mailbox:'broken',games:['tictactoe','truths']}},{orders:{main:[],mailbox:['']}}]){
 const server=normalizePreferences(raw),client=sandbox.normalizeClientPreferences(raw);
 assert.equal(JSON.stringify(server),JSON.stringify(client));
 assert.deepEqual([...server.orders.main].sort(),[...TAB_ORDER_DEFAULTS.main].sort());
 assert.deepEqual([...server.orders.mailbox].sort(),[...TAB_ORDER_DEFAULTS.mailbox].sort());
 assert.equal(new Set(server.orders.main).size,server.orders.main.length);
 assert.equal(new Set(server.orders.games).size,server.orders.games.length);
}
const customOrder=normalizePreferences({orders:{main:['games','our'],mailbox:['capsule','mailbox']}});
assert.deepEqual(customOrder.orders.main,['games','our','mailbox','dates']);
assert.deepEqual(customOrder.orders.mailbox,['capsule','mailbox','conversation','homework','agreements']);
assert.deepEqual(normalizePreferences({orders:{main:['nope']}}).orders.main,TAB_ORDER_DEFAULTS.main,'битый порядок откатывается к умолчанию');
let prefs=mergePreferences({theme:'purple',mode:'dark',homeOrder:['intimate','agreements','wishes','decisions'],homeTitles:{wishes:'Мечты'}},{homeHidden:['decisions']});
assert.equal(prefs.theme,'purple');assert.equal(prefs.mode,'dark');assert.equal(prefs.homeTitles.wishes,'Мечты');assert.equal(prefs.homeOrder[0],'intimate');
assert.deepEqual(prefs.homeHidden,['decisions']);assert.equal(mergePreferences(prefs,{theme:'unknown'}).theme,'purple');
console.log('PASS: client/server preference parity, legacy migration, personal tab order, 3 themes, dark/system modes, safe personal home layout merging.');
