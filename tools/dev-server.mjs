import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();const port=Number(process.env.PORT||8002);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.json':'application/json'};
http.createServer(async(req,res)=>{try{
 const p=decodeURIComponent(new URL(req.url,'http://local').pathname);const name=p==='/'?'index.html':p.slice(1);
 if(!/^(?:index\.html|app\.js|redesign\.js|backup\.js|settings\.js|style\.css|reference\.css|extra\.css|redesign\.css|manifest\.json|icon\.svg|icon-192\.png|icon-512\.png|favicon\.png|apple-touch-icon\.png|assets\/[^.][\w/.-]+|fonts\/[\w.-]+)$/.test(name)||name.split('/').includes('..'))throw Error();
 const file=path.join(root,name);const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'Local preview: server API is not connected.'}));}
}).listen(port,'0.0.0.0',()=>console.log(`Тихий ящик: http://0.0.0.0:${port} (local preview; API fallback)`));
