/* ---------- My Red Robin – the parents' app (started as Red Robin Swaps) (24-Nov-2026) ----------
   The screens come from the Rocker's Portal tab (portal.js, unchanged). This file supplies what the Rocker would:
   the family's data (from the bridge script that runs as Carla), the login by personal link or email,
   "remember me" on this phone, and the add-to-home-screen help. Swaps are a DEMO for now: nothing is saved. */

/* ----- small helpers the portal screens use (same as in the Rocker) ----- */
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { const n = parseFloat(String(v ?? "").replace(/[£,\s]/g,"")); return isFinite(n) ? n : 0; };
function isoDate(v){ const s = String(v||"").trim(); let m;
  if((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2]-1, +m[3]);
  if((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return new Date(+m[3], +m[2]-1, +m[1]);
  return null; }
function toIso(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
const isAdultClass = c => /^adult/i.test(String((c||{}).Group||""));
const isWorkshop = c => /^workshop/i.test(String((c||{}).Type||""));
function shortDay(d){ const s = String(d||"").trim(); return /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*day$/i.test(s) ? s.slice(0,3) : s; }
function classLabel(c){ if(!c) return ""; return [shortDay(c.Day), c.Time].filter(x=>String(x||"").trim()).join(" "); }
function classById(id){ return S.classes.find(c=>c.ClassID===id); }
function capOf(cid){ const c = classById(cid), n = num(c && c.Capacity); return n>0 ? n : 0; }
function termDates(){ return APP.data && APP.data.termEnd ? {End: APP.data.termEnd} : null; }
function isPhone(){ return window.matchMedia("(max-width:600px)").matches; }
function openDialog(html){ const m = $("#modal"), layer = document.createElement("div"); layer.className = "overlay";
  layer.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${html}</div>`;
  layer.addEventListener("click", e=>{ if(e.target===layer) closeDialog(); }); m.appendChild(layer);
  const f = layer.querySelector("button.primary, button"); f && f.focus({preventScroll:true}); }
function closeDialog(){ const l = $("#modal").lastElementChild; if(l) l.remove(); }
function closeAllDialogs(){ $("#modal").innerHTML = ""; }
function toast(t){ document.querySelectorAll(".toast").forEach(x=>x.remove());
  const d = document.createElement("div"); d.className = "banner info toast"; d.setAttribute("role","status");
  d.style.cssText = "position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:60;box-shadow:0 8px 24px rgba(0,0,0,.2)";
  d.textContent = t; document.body.appendChild(d); setTimeout(()=>d.remove(), 3200); }
function render(){ $("#main").innerHTML = viewPortal(); }

let S = { classes:[], settings:{}, term:"", parent:true, byRef:new Map(), enrol:[] };
const APP = { data:null, state:"start", msg:"", installEvt:null };
const STORE = "rrswaps-code";
const store = { get(){ try{ return localStorage.getItem(STORE)||""; }catch(e){ return ""; } },
  set(v){ try{ v ? localStorage.setItem(STORE, v) : localStorage.removeItem(STORE); }catch(e){} } };

/* ----- talking to the bridge ----- */
async function api(params){
  const u = new URL(CONFIG.api); Object.entries(params).forEach(([k,v])=>u.searchParams.set(k, v));
  const ctl = new AbortController(), t = setTimeout(()=>ctl.abort(), 25000);
  try{ const r = await fetch(u, {signal:ctl.signal, redirect:"follow"}); if(!r.ok) throw new Error("HTTP "+r.status); return await r.json(); }
  finally{ clearTimeout(t); }
}
function useData(d){
  d.family.kids.forEach(k=>{ if(!k.terms) k.terms = [d.term]; }); /* bridge v1 doesn't send the student's terms: this term only */
  APP.data = d; S.classes = d.classes; S.settings = {CurrentTerm:d.term}; S.term = d.term;
  PT = null; ptInit(); APP.state = "in"; if(!APP.asked){ APP.ask = wantInstall(); APP.asked = true; } /* once per visit */
  store.set(d.code);
  const u = new URL(location.href); if(u.searchParams.get("c")!==d.code){ u.searchParams.set("c", d.code); history.replaceState(null, "", u); } /* so "Add to Home Screen" keeps them logged in */
}
async function loadByCode(code){
  APP.state = "loading"; render();
  try{ const d = await api({action:"family", code});
    if(d.ok){ useData(d); render(); return; }
    forget(); APP.state = "out"; APP.msg = d.error==="badcode" ? "That link isn't working any more. Please type your email instead." : "Something went wrong. Please type your email to log in.";
  }catch(e){ APP.state = "out"; APP.msg = "Couldn't connect. Please check your internet and try again."; APP.retry = code; }
  render();
}
async function loginByEmail(email){
  const b = $("#pt-go"); if(b){ b.disabled = true; b.textContent = "Logging in…"; }
  try{ const d = await api({action:"family", email:ptEmailNorm(email)});
    if(d.ok){ PT && (PT._err = ""); useData(d); render(); window.scrollTo(0,0); return; }
    APP.msg = d.error==="busy" ? "Too many tries just now. Please wait a few minutes and try again."
      : `We can't find <b>${esc(ptEmailNorm(email))}</b>. Please use the email address you gave on the registration form, or contact Carla.`;
  }catch(e){ APP.msg = "Couldn't connect. Please check your internet and try again."; }
  APP.state = "out"; render(); const i = $("#pt-q"); if(i) i.focus();
}
function forget(){ store.set(""); APP.data = null; PT = null; const u = new URL(location.href); u.searchParams.delete("c"); history.replaceState(null, "", u); }

/* ----- the portal screens, fed from the bridge instead of the Rocker ----- */
function ptInit(){
  const d = APP.data || {family:{kids:[]}, swaps:[]};
  PT = { fam:"me", sid:null, all:{}, seq:1, _more:false, _q:"", _err:"", swaps: d.swaps.map(w=>({...w})),
    fams: [{key:"me", label:d.family.label, adult:d.family.adult, test:d.family.test, kids:d.family.kids}] };
  APP.orig = d.swaps.map(w=>({...w}));
}
function ptSessions(cid){ return ((APP.data && APP.data.sessions[cid]) || []).slice(); }
function ptTermEnd(){ return (APP.data && APP.data.termEnd) || ""; }
function ptCount(cid, iso){ /* places on that date: the sheet's count (all families' swaps included), with this family's changes made here */
  const base = ((APP.data && APP.data.counts[cid]) || {})[iso] || 0, test = APP.data && APP.data.family.test;
  const part = list => list.reduce((n, w)=> n + (w.status==="booked" && w.to===cid && w.td===iso ? 1 : 0) - (!test && w.from===cid && w.fd===iso ? 1 : 0), 0);
  return base - part(APP.orig || []) + part(PT.swaps);
}
function standalone(){ return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; }
function phoneKind(){ const ua = navigator.userAgent || "";
  if(/iPhone|iPad|iPod/i.test(ua) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1)) return "ios";
  if(/Android/i.test(ua)) return "android"; return "computer"; }
function browserKind(){ /* which browser on the phone, so the home-screen steps match what they see (Chris, 25-Nov 09:46) */
  const ua = navigator.userAgent || "";
  if(/FBAN|FBAV|Instagram|Line\/|GSA\/|; wv\)|LinkedInApp|Snapchat/i.test(ua)) return "inapp";   /* a link opened inside another app */
  if(/CriOS/i.test(ua)) return "chrome";
  if(/FxiOS|Firefox/i.test(ua)) return "firefox";
  if(/EdgiOS|EdgA|Edg\//i.test(ua)) return "edge";
  if(/SamsungBrowser/i.test(ua)) return "samsung";
  return phoneKind()==="ios" ? "safari" : "chrome";
}
/* Straight after login, a screen of its own asking them to put the app on their home screen (Chris, 25-Nov 10:34).
   It keeps asking on every visit in the browser until they tap "Done – go to my classes" after the steps (10:43);
   "Not now" just goes through to their children this time. Never shown when opened from the home-screen icon. */
const DONE = "rrswaps-homescreen-done-2"; /* renamed 25-Nov 19:31 so every phone starts fresh (Chris testing) */
function wantInstall(){ if(standalone()) return false;
  try{ return !localStorage.getItem(DONE); }catch(e){ return true; } }
function installScreen(){
  return ptTop("Class swaps") + `<div class="ptbody rrask">
    <img src="icons/icon-192.png" alt="" width="96" height="96">
    <h2>Put My Red Robin on your home screen</h2>
    <p>Next time, just tap the robin – no need to find this link or log in again.</p>
    <button type="button" class="btn primary ptbig" data-rr="install">Show me how</button>
    <button type="button" class="ptlink rrnot" data-rr="noinstall">Not now</button></div>`;
}
function installHelp(){
  const k = phoneKind();
  const SHARE = `<svg class="rrico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`;
  const LINES = `<svg class="rrico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>`;
  const DOTS = `<svg class="rrico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>`;
  const PLUS = `<svg class="rrico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>`;
  const step = (n, html) => `<li><span class="rrn">${n}</span><span>${html}</span></li>`;
  let body;
  const br = browserKind(), here = k==="ios" ? "Safari" : "Chrome";
  const ol = (...xs) => `<ol class="rrsteps">${xs.map((x,i)=>step(i+1, x)).join("")}</ol>`;
  if(br==="inapp" && k!=="computer") body = `<p>This page has opened inside another app. To add it to your home screen, first open it in <b>${here}</b>:</p>`
    + ol(`Tap the menu (${LINES}, ${DOTS} or ⋯) in a top or bottom corner.`, `Choose <b>Open in ${here}</b> (or Open in browser).`, `Then tap <b>Show me how</b> again.`);
  else if(k==="ios" && br==="chrome") body = ol(`Tap the <b>Share</b> button ${SHARE} at the top, next to the web address. (Or tap ⋯ at the bottom, then <b>Share</b>.)`,
      `Scroll down and tap <b>Add to Home Screen</b> ${PLUS}. (Can't see it? Tap <b>View More</b> first.)`, `Tap <b>Add</b>. Done!`);
  else if(k==="ios" && br!=="safari") body = ol(`Tap the <b>menu button</b> (${LINES} or ⋯) at the bottom of the screen, next to the web address.`, `Tap <b>Share</b> ${SHARE}.`,
      `Tap <b>Add to Home Screen</b> ${PLUS}, then <b>Add</b>.`) + `<p class="small muted">If you can't find it, open this page in <b>Safari</b> instead – it's easiest there.</p>`;
  else if(k==="ios") body = ol(`Tap the <b>menu button</b> ${LINES} at the bottom of the screen, next to the web address.`, `Tap <b>Share</b> ${SHARE}.`,
      `Scroll down and tap <b>Add to Home Screen</b> ${PLUS}. (Can't see it? Tap <b>View More</b> first.)`, `Tap <b>Add</b>. Done!`)
    + `<p class="small muted">If you can already see the Share button ${SHARE} at the bottom of the screen, just tap that and skip step 1.</p>`
    + `<p class="small muted">Opened this from an email or WhatsApp? First tap the compass or “Open in Safari” button, then follow the steps.</p>`;
  else if(k==="android" && APP.installEvt) body = `<p>Tap the button and then <b>Install</b>.</p><button type="button" class="btn primary ptbig" data-rr="doinstall">Add to home screen</button>`;
  else if(k==="android" && br==="samsung") body = ol(`Tap the <b>menu button</b> ${LINES} at the bottom of the screen.`, `Tap <b>Add page to</b>, then <b>Home screen</b>.`, `Tap <b>Add</b>. Done!`);
  else if(k==="android" && br==="firefox") body = ol(`Tap the <b>menu button</b> ${DOTS} in the corner of the screen, next to the web address.`, `Tap <b>Add to Home screen</b> (or <b>Install</b>).`, `Tap <b>Add</b>. Done!`);
  else if(k==="android" && br==="edge") body = ol(`Tap the <b>menu button</b> ⋯ at the bottom of the screen.`, `Tap <b>Add to phone</b> (or <b>Add to Home screen</b>).`, `Tap <b>Add</b> or <b>Install</b>. Done!`);
  else if(k==="android") body = ol(`Tap the <b>menu button</b> ${DOTS} at the top of the screen, next to the web address.`, `Tap <b>Add to Home screen</b> (or <b>Install app</b>).`, `Tap <b>Add</b> or <b>Install</b>. Done!`)
    + `<p class="small muted">Opened this from an email or WhatsApp? First tap ${DOTS} and “Open in Chrome”.</p>`;
  else body = APP.installEvt
    ? `<p>Click the button and then <b>Install</b>. You'll get a My Red Robin icon on your computer.</p><button type="button" class="btn primary ptbig" data-rr="doinstall">Install on this computer</button>`
    : `<p>In Chrome or Edge, click the install icon at the right of the address bar. In Safari: <b>File › Add to Dock</b>. Or simply bookmark this page.</p><p class="small muted">The easiest way is on your phone: open the link from the email there.</p>`;
  ptDialog(`<div class="rrhelp"><img src="icons/icon-192.png" alt="" width="64" height="64"><h2>Add to your home screen</h2>${body}
    <button type="button" class="btn ptbig" data-rr="helpdone">${APP.ask ? "Done – go to my classes" : "Close"}</button>
    ${APP.ask ? `<button type="button" class="ptlink rrnot" data-rr="noinstall">Not now</button>` : ""}</div>`);
}

/* login screen: the Rocker's, plus the app's own messages, a loading state and the version */
const _ptLogin = ptLogin;
ptLogin = function(){
  if(PT) PT._err = APP.msg; else PT = {_q:"", _err:APP.msg};
  let html = _ptLogin();
  if(APP.retry) html = html.replace('<button type="button" id="pt-go"', `<button type="button" class="btn ptbig" data-rr="retry" style="margin-bottom:8px">Try again</button><button type="button" id="pt-go"`);
  return html.replace(/<\/div>\s*$/, `<p class="rrver">Version ${esc(CONFIG.version)}</p></div>`);
};
function viewPortal(){
  if(APP.state==="loading" || APP.state==="start") return `<div class="ptwrap"><div class="ptphone"><div class="ptlogin rrload">${ptLogo()}<h3>Red Robin Art Academy</h3><p class="small muted">Loading your classes…</p><div class="rrspin" aria-hidden="true"></div></div></div></div>`;
  let screen = !APP.data ? ptLogin() : APP.ask ? installScreen() : !PT.sid ? ptChildren() : ptStudent();
  if(APP.data){
    const top = (CONFIG.demo ? `<div class="rrdemo">Preview – swaps made here are not saved yet</div>`
      : APP.data.family.test ? `<div class="rrdemo">Test family – swaps made here are not saved</div>` : "");
    screen = screen.replace('<div class="ptbody">', '<div class="ptbody">' + top);
  }
  return `<div class="ptwrap"><div class="ptphone">${screen}</div></div>`;
}
function ptLogo(){ return `<img src="icons/icon-192.png" alt="" width="64" height="64" class="ptlogo">`; }

const _ptClick = ptClick;
ptClick = function(el){
  const k = el.dataset.pt.split("|")[0];
  if(k==="login"){ const i = $("#pt-q"); const v = i ? i.value : ""; if(PT) PT._q = v; APP.msg = ""; if(ptEmailOk(v)) loginByEmail(v); return; }
  if(k==="logout"){ closeAllDialogs(); forget(); APP.state = "out"; APP.msg = ""; APP.retry = null; render(); return; }
  if(k==="reset"||k==="parent"||k==="exit") return;
  if(SAVES[k] && saving()) return saveChange(el, k, el.dataset.pt.split("|"));
  return _ptClick(el);
};
/* ----- saving swaps for real (25-Nov-2026, Chris: "make the link live") -----
   Every confirmed change goes to the bridge first; it checks everything again (space, dates, the family's own child)
   and writes the Swaps tab. Only when it says OK does the family see "Swap confirmed!". Test families stay a demo. */
const SAVES = {do:1, dolater:1, doundo:1, dotoowed:1};
function saving(){ return !CONFIG.demo && APP.data && !APP.data.family.test; }
async function saveChange(el, k, p){
  let req, done;
  if(k==="do"){ const [ , mode, sid, own, ref, cid, iso] = p, kid = ptKid(sid);
    if(mode==="swap"){ req = {op:"swap", eid:(kid.enr.find(x=>x.cid===own)||{}).eid, from:own, fd:ref, to:cid, td:iso}; }
    else req = {op:"book", id:ref, to:cid, td:iso};
    const w = mode==="swap" ? null : PT.swaps.find(x=>x.id===ref), fromH = mode==="swap" ? ptWhenH(own, ref) : (w && w.fd ? ptWhenH(w.from, w.fd) : "The missed class"), toH = ptWhenH(cid, iso);
    done = ()=>ptCelebrate(fromH, toH); }
  if(k==="dolater"){ const kid = ptKid(p[1]); req = {op:"later", eid:(kid.enr.find(x=>x.cid===p[2])||{}).eid, from:p[2], fd:p[3]}; done = ()=>toast(`Saved as an owed swap for ${ptFirst(kid.name)}.`); }
  if(k==="doundo"){ const w = Object.assign({}, PT.swaps.find(x=>x.id===p[1])); req = {op:"cancel", id:p[1]}; done = ()=>ptCancelPop(w); }
  if(k==="dotoowed"){ const w = Object.assign({}, PT.swaps.find(x=>x.id===p[1])); req = {op:"toowed", id:p[1]}; done = ()=>ptToOwedPop(w); }
  const btns = [...document.querySelectorAll("#modal button")], label = el.textContent;
  btns.forEach(b=>b.disabled = true); el.textContent = "Saving…";
  const undoBusy = ()=>{ btns.forEach(b=>b.disabled = false); el.textContent = label; };
  try{
    const r = await api(Object.assign({action:"change", code:APP.data.code}, req));
    if(r.ok){ closeAllDialogs(); refreshFrom(r.data); done(); return; }
    if(r.error==="badcode"){ closeAllDialogs(); forget(); APP.state = "out"; APP.msg = "Please log in again."; render(); return; }
    closeAllDialogs(); toast(r.error==="unknown" ? "Saving isn't switched on yet – nothing was saved. Please try again later." : (r.message || "Sorry – that couldn't be saved. Please try again."));
    refreshQuietly();
  }catch(e){ undoBusy(); toast("Couldn't connect – nothing was saved. Please check your internet and try again."); }
}
function refreshFrom(d){ if(!d || !d.ok) return; const sid = PT && PT.sid, all = PT && PT.all; useData(d); if(PT){ PT.sid = sid; PT.all = all || {}; } $("#main").innerHTML = viewPortal(); }
async function refreshQuietly(){ try{ const d = await api({action:"family", code:APP.data.code}); refreshFrom(d); }catch(e){} }
function rrClick(el){
  const k = el.dataset.rr;
  if(k==="install") installHelp();
  if(k==="noinstall"){ closeAllDialogs(); APP.ask = false; render(); window.scrollTo(0,0); }   /* this visit only – asks again next time */
  if(k==="helpdone"){ try{ localStorage.setItem(DONE, new Date().toISOString()); }catch(e){} closeAllDialogs(); if(APP.ask){ APP.ask = false; render(); window.scrollTo(0,0); } }
  if(k==="doinstall" && APP.installEvt){ APP.installEvt.prompt(); APP.installEvt.userChoice.finally(()=>{ APP.installEvt = null; APP.ask = false; closeAllDialogs(); render(); }); }
  if(k==="retry"){ const c = APP.retry; APP.retry = null; APP.msg = ""; loadByCode(c); }
}

document.addEventListener("click", ev=>{
  const r = ev.target.closest("[data-rr]"); if(r){ ev.preventDefault(); rrClick(r); return; }
  const p = ev.target.closest("[data-pt]"); if(p){ ev.preventDefault(); ptClick(p); return; }
  if(ev.target.closest("[data-close]")){ ev.preventDefault(); closeDialog(); }
});
document.addEventListener("keydown", ev=>{ if(ev.key==="Escape") closeDialog(); });
window.addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); APP.installEvt = e; });
window.addEventListener("appinstalled", ()=>{ APP.installEvt = null; APP.ask = false; try{ localStorage.setItem(DONE, new Date().toISOString()); }catch(e){} closeAllDialogs(); render(); });
/* coming back to the app after a while: fetch fresh numbers (only when nothing is open) */
let hiddenAt = 0;
document.addEventListener("visibilitychange", ()=>{ if(document.hidden){ hiddenAt = Date.now(); return; }
  if(APP.data && hiddenAt && Date.now()-hiddenAt > 20*60e3 && !$("#modal").children.length) loadByCode(APP.data.code); });
if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});

(function start(){
  const u = new URL(location.href), code = (u.searchParams.get("c") || store.get() || "").trim();
  if(code) loadByCode(code); else { APP.state = "out"; render(); }
})();
