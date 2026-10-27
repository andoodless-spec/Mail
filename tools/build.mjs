import {cp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
export const files=['index.html','app.js','redesign.js','backup.js','settings.js','style.css','reference.css','extra.css','redesign.css','manifest.json','icon.svg','icon-192.png','icon-512.png','favicon.png','apple-touch-icon.png'];
for(const file of ['app.js','redesign.js','lib/preferences.js'])execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
for(const file of files)await cp(file,'dist/'+file);
for(const folder of ['fonts','assets'])await cp(folder,'dist/'+folder,{recursive:true});
console.log('Static production bundle ready. Vercel retains api/[...path].js as the server entry.');
