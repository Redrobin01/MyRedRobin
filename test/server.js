// Test server: serves site/ and runs the bridge (api/Code.gs) against a copy of the sheet data (ref/realfx.json).
const http=require('http'), fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
const FX=JSON.parse(fs.readFileSync(process.argv[2]||'/home/claude/rk/ref/realfx.json','utf8'));
const tabs={'1U6ra-LmwQIFJKGtI0f1nuP6sAnjama4Zq36TQalptYk':{}, '1rasCtoX6Ox8ZBqulykS8HJN6GjzygfbSYYgqSmfvKzA':{'Form Responses 1':FX.FORM}, '13Wk9b8XW0j5F9cLkwK7_6pi06fcCl2TOfMuYc9AVBec':{'Form responses 1':FX.AFORM}};
['Settings','Classes','TermDates','Sessions','Enrolments','Swaps'].forEach(k=>tabs['1U6ra-LmwQIFJKGtI0f1nuP6sAnjama4Zq36TQalptYk'][k]=FX[k]);
const W=n=>{ const w=Math.max(...n.map(r=>r.length)); return n.map(r=>{ r=r.slice(); while(r.length<w) r.push(''); return r.map(x=>x==null?'':String(x)); }); };
function sheet(rows){ return { getDataRange:()=>({getDisplayValues:()=>W(rows)}), appendRow:r=>rows.push(r.map(String)), setFrozenRows(){}, getLastRow:()=>rows.length,
  getRange:(r,c,nr,nc)=>({setValues:v=>{ v.forEach((row,i)=>{ const t=rows[r-1+i]||(rows[r-1+i]=[]); while(t.length<c-1) t.push(''); row.forEach((x,j)=>t[c-1+j]=String(x)); }); }}) }; }
const cache={};
const ctx={ SpreadsheetApp:{ flush(){}, openById:id=>({ getSheetByName:n=>tabs[id]&&tabs[id][n]?sheet(tabs[id][n]):null, insertSheet:n=>{ tabs[id][n]=[]; return sheet(tabs[id][n]); } }) },
  ContentService:{ MimeType:{JSON:'json'}, createTextOutput:t=>({setMimeType(){ return this; }, t}) },
  CacheService:{ getScriptCache:()=>({get:k=>cache[k]||null, put:(k,v)=>{cache[k]=v;}}) },
  LockService:{ getScriptLock:()=>({waitLock(){}, releaseLock(){}}) },
  Utilities:{ getUuid:()=>crypto.randomUUID(), sleep(){}, formatDate:(d,tz,f)=>{ const L=new Date(d.toLocaleString('en-US',{timeZone:'Europe/London'})), z=n=>String(n).padStart(2,'0'), M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return f.replace('yyyy',L.getFullYear()).replace('MMM',M[L.getMonth()]).replace('MM',z(L.getMonth()+1)).replace('dd',z(L.getDate())).replace('HH',z(L.getHours())).replace('mm',z(L.getMinutes())); } }, Logger:{log:console.log}, console };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname,'../api/Code.gs'),'utf8'), ctx);
const site=path.join(__dirname,'../site'), types={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json','.css':'text/css'};
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  if(u.pathname==='/api'){ const p={}; u.searchParams.forEach((v,k)=>p[k]=v); const out=ctx.doGet({parameter:p});
    res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); res.end(out.t); return; }
  if(u.pathname==='/swaps'){ res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(tabs['1U6ra-LmwQIFJKGtI0f1nuP6sAnjama4Zq36TQalptYk'].Swaps)); return; }
  if(u.pathname==='/links'){ res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(tabs['1U6ra-LmwQIFJKGtI0f1nuP6sAnjama4Zq36TQalptYk'].PortalLinks||[])); return; }
  let f=path.join(site, u.pathname==='/'?'index.html':u.pathname); if(!fs.existsSync(f)){ res.writeHead(404); res.end(); return; }
  res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);
}).listen(8765, ()=>console.log('test server on 8765'));
if(process.argv[3]==='setup'){ ctx.setup(); const L=tabs['1U6ra-LmwQIFJKGtI0f1nuP6sAnjama4Zq36TQalptYk'].PortalLinks; console.log('links', L.length-1, L.slice(0,3)); process.exit(0); }
