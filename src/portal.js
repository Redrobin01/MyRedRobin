
/* ---------- Portal tab – PROTOTYPE (Chris, 24-Nov-2026) ----------
   What a family would see in a self-service swaps portal: log in -> select child -> that child's classes.
   Log in by typing the email address on the registration form (Chris, 24-Nov 22:05); you then see every student
   registered with that email (Parent 1 / Parent 2 email for children, Email for adults) – usually one child,
   several for families. Test families have made-up emails (test1@redrobin.test …).
   classes, class dates (Sessions tab), places and existing swaps (Swaps tab), but every swap made here is
   kept in memory only: nothing is written to the sheet. "Reset demo" starts again from the sheet.
   Rules (Chris, 24-Nov): max 16 in a children's class, 14 in an
   adult class (unless the class's Capacity is set); a child can swap into any other children's class (the
   "no longer than their own" rule was dropped 24-Nov 11:34; adults: adult classes); swap right up to the start (25-Nov); make-up in any
   term within a year of the missed class; 2 swaps per term per student; "owed" = unbook a class now, book the make-up later (for a year); cancel up
   to the deadline. Absent-this-term students don't count towards the max. */
const PT_DAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const PT_MAX = {Children:16, Adults:15}, PT_LIMIT = Infinity, PT_NOTICE_H = 0; /* Chris 25-Nov: swap right up to the start; adults 15; NO limit on swaps per term (09:59) – only the class maximums matter */
let PT = null;
window.__portal = ()=>PT; /* for testing */
function ptTerm(){ return (S.settings && S.settings.CurrentTerm) || S.term; }
function ptGrp(c){ return isAdultClass(c) ? "Adults" : "Children"; }
function ptMins(c){ /* class length: adults 2h15, the £32-a-week children's class (Sun 3pm) 2h, the rest 1h30. Fee is per term, so divide by Weeks */
  if(isAdultClass(c)) return 135; const f = num(c.Fee), w = num(c.Weeks), rate = w>0 && f>60 ? f/w : f; return rate >= 30 ? 120 : 90; }
function ptMax(c){ return capOf(c.ClassID) || PT_MAX[ptGrp(c)]; }
function ptHm(c){ const m = String(c.Time||"").match(/(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)/i); if(!m) return [0,0]; let h = +m[1]%12; if(/pm/i.test(m[3])) h += 12; return [h, +(m[2]||0)]; }
function ptTime(c){ return String(c.Time||"").trim(); }
function ptDt(cid, iso){ const c = classById(cid), d = isoDate(iso), hm = ptHm(c); d.setHours(hm[0], hm[1], 0, 0); return d.getTime(); }
function ptD(iso, yr){ const d = isoDate(iso); return d ? `${PT_DAY[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}-${MON[d.getMonth()]}${yr?"-"+d.getFullYear():""}` : iso; }
function ptWhen(cid, iso){ return `${ptD(iso)} · ${ptTime(classById(cid))}`; }
function ptLen(c){ const m = ptMins(c), h = Math.floor(m/60), q = {0:"",15:"¼",30:"½",45:"¾"}[m%60]; return q===undefined ? `${m} mins` : `${h}${q} hr${m>60?"s":""}`; } /* "1½ hrs", "2 hrs", "2¼ hrs" */
function ptLenH(cid){ const c = classById(cid); return c ? ` <span class="ptlen">(${esc(ptLen(c))})</span>` : ""; }
function ptWhenH(cid, iso){ return esc(ptWhen(cid, iso)) + ptLenH(cid); } /* day, date and time, with the class length in brackets in smaller type */
function ptLblH(cid){ return esc(classLabel(classById(cid))) + ptLenH(cid); }
function ptOpen(cid, iso){ return ptDt(cid, iso) - Date.now() > PT_NOTICE_H*3600e3; } /* class not started yet? */
function ptHash(s){ let h = 7; for(const ch of s) h = (h*31 + ch.charCodeAt(0))>>>0; return h; }
function ptFirst(name){ return String(name||"").replace(/\([^)]*\)/g, " ").trim().split(/\s+/)[0] || String(name||""); }
function ptSurname(name){ const p = String(name||"").replace(/\([^)]*\)/g, " ").trim().split(/\s+/); return p[p.length-1] || String(name||""); }

/* every term class, its dates and the people in it (left and absent-this-term places don't count) */
function ptClasses(){ return S.classes.filter(c=>c.Term===ptTerm() && !isWorkshop(c)); }
function ptNoSwapTo(c){ /* the children's Sunday 3pm class is the GCSE class: never offered as a swap (Chris, 25-Nov 19:57) */
  return !/^adult/i.test(String(c.Group||"")) && /^sun/i.test(String(c.Day||"")) && /^(3([.:]00)?\s*pm|15[.:]00)$/i.test(String(c.Time||"").trim()); }
function ptAnyClasses(){ return S.classes.filter(c=>!isWorkshop(c) && !ptNoSwapTo(c)); } /* make-ups can be in any term (Chris, 25-Nov 09:15) */
function ptYear(iso){ const d = isoDate(iso); if(!d) return ""; d.setFullYear(d.getFullYear()+1); return toIso(d); } /* a make-up lasts a year from the missed class */
function ptToday(){ return toIso(new Date()); }
function ptActiveTerms(kid){ /* terms this student is in a class (not Left/Absent): a swap can only go into one of those (Chris, 25-Nov 09:33) */
  if(kid.terms) return new Set(kid.terms);
  if(/^T/.test(kid.ref)) return new Set([ptTerm()]);
  return new Set(S.enrol.filter(e=>String(e.Ref)===String(kid.ref) && !/^(left|absent)/i.test(e.Status||"") && classById(e.ClassID) && !isWorkshop(classById(e.ClassID))).map(e=>e.Term));
}
function ptSessions(cid){ return sessAll().filter(s=>s.ClassID===cid && s.day && !/^cancel/i.test(s.Status)).map(s=>s.day).sort(); }
function ptBase(cid){ return classRoster(cid).filter(v=>!v.left && !v.absent).length; }
function ptCount(cid, iso){ let n = ptBase(cid);
  PT.swaps.forEach(w=>{ if(w.status==="booked" && w.to===cid && w.td===iso) n++; if(w.from===cid && w.fd===iso && !/^T/.test(w.sid)) n--; }); return n; } /* test students aren't in the class numbers, so their swaps out don't free a place */
function ptFamilies(){ /* families in the current term: brothers and sisters share a phone number / parent; adults are on their own */
  const fams = new Map();
  ptClasses().forEach(c=>classRoster(c.ClassID).filter(v=>!v.left && !v.absent && v.st).forEach(v=>{
    const key = familyKey(v.st, v.e); let f = fams.get(key);
    if(!f){ f = {key, adult:isAdult(v.st), parent:v.st.p1||"", kids:new Map()}; fams.set(key, f); }
    let k = f.kids.get(v.st.ref); if(!k){ k = {ref:String(v.st.ref), name:v.name, adult:isAdult(v.st), enr:[]}; f.kids.set(v.st.ref, k); }
    k.enr.push({eid:v.e.EnrolmentID, cid:c.ClassID});
  }));
  const all = [...fams.values()].map(f=>Object.assign(f, {kids:[...f.kids.values()].sort((a,b)=>a.name.localeCompare(b.name))}));
  all.forEach(f=>{ f.label = f.adult ? f.kids[0].name : `${ptSurname(f.kids[0].name)} family`; });
  return all;
}
function ptTestFams(){ /* 3 made-up families placed in real classes, for trying things out (they don't change class sizes) */
  const cs = ptClasses().slice().sort((a,b)=>num(a.Sort)-num(b.Sort)), kidsC = cs.filter(c=>!isAdultClass(c)), adC = cs.filter(isAdultClass);
  const short = kidsC.filter(c=>ptMins(c)===90), long = kidsC.find(c=>ptMins(c)>90) || kidsC[kidsC.length-1];
  const at = (arr, i) => arr.length ? arr[i % arr.length] : null;
  const fam = (n, code, label, adult, kids) => ({key:"test|"+n, code, label, adult, test:true, email:`test${n===4?3:n===3?4:n}@redrobin.test`,
    kids: kids.filter(k=>k[1]).map((k,i)=>({ref:`T${n}${i}`, name:k[0], adult, enr:[{eid:`TE${n}${i}`, cid:k[1].ClassID}]}))});
  return [ fam(1, "TST222", "Test family 1", false, [["Alfie Test", at(short,0)], ["Bella Test", long]]),
           fam(2, "TST333", "Test family 2", false, [["Cara Test", at(short,2)]]),
           fam(4, "TST444", "Test family 3", false, [["Eddie Test", at(short,1)], ["Flora Test", at(short,3)], ["George Test", at(short,4)]]),
           fam(3, "TST555", "Dan Test", true, [["Dan Test", at(adC,0)]]) ].filter(f=>f.kids.length);
}
function ptInit(){
  const term = ptTerm(), eids = new Map(), today = ptToday();
  S.enrol.forEach(e=>eids.set(e.EnrolmentID, e));
  /* this term's swaps, plus older ones still open: an owed swap lasts a year, a booked make-up until it happens (Chris, 25-Nov 09:15) */
  const keep = r=>{ const e = eids.get(r.EnrolmentID), booked = /^booked/i.test(r.Status), owed = /^owed/i.test(r.Status);
    if(!e || !classById(r.FromClass) || !(booked||owed) || (booked && !classById(r.ToClass))) return false;
    return e.Term===term || (booked && r.td && r.td>=today); }; /* banked swaps last one term (26-Nov) */
  PT = { fam:null, sid:null, all:{}, seq:1, _more:false, _q:"", _pick:null, _err:"",
    swaps: swapsAll().filter(keep)
      .map(r=>({id:"R"+r.SwapID, eid:r.EnrolmentID, sid:String(eids.get(r.EnrolmentID).Ref), from:r.FromClass, fd:r.fd||"", to:/^booked/i.test(r.Status)?r.ToClass:"", td:/^booked/i.test(r.Status)?r.td:"", status:/^booked/i.test(r.Status)?"booked":"owed", real:true, cur:eids.get(r.EnrolmentID).Term===term})) };
  PT.fams = ptFamilies().concat(ptTestFams()); /* every family this term, plus the test families */
}
function ptFam(){ return PT.fams.find(f=>f.key===PT.fam); }
function ptKid(sid){ const f = ptFam(); return f && f.kids.find(k=>k.ref===sid); }
function ptUsed(sid){ return PT.swaps.filter(w=>w.sid===sid && w.cur!==false).length; } /* 2 per term: older terms' swaps don't count */
function ptUsedHtml(sid){ return isFinite(PT_LIMIT) ? (u=>`<span class="ptused${u>=PT_LIMIT?" full":""}">${u>PT_LIMIT?`${u} swaps (limit ${PT_LIMIT})`:`${u} of ${PT_LIMIT} swaps used`}</span>`)(ptUsed(sid)) : ""; } /* nothing shown when there's no limit */
function ptOptions(kid, cid, skip){ /* classes this student could go to instead of a date in class cid */
  const own = classById(cid), mine = new Set(PT.swaps.filter(w=>w.sid===kid.ref && w.status==="booked").map(w=>w.to+"|"+w.td)), myCls = new Set(kid.enr.map(x=>x.cid));
  const until = ptTermEnd() || ptYear(ptMissedOf(cid, skip)) || ptYear(ptToday()); /* swaps last one term (Chris, 26-Nov 09:42) */
  const terms = ptActiveTerms(kid);
  return ptAnyClasses().filter(c=>ptGrp(c)===ptGrp(own) && !myCls.has(c.ClassID) && terms.has(c.Term) && String(c.Term)===String(own.Term)) /* any children's class in a term they're enrolled in; adults: adult classes */
    .flatMap(c=>ptSessions(c.ClassID).map(iso=>({cid:c.ClassID, iso, dt:ptDt(c.ClassID, iso)})))
    .filter(x=>x.iso<=until && ptOpen(x.cid, x.iso) && !mine.has(x.cid+"|"+x.iso) && skip!==x.cid+"|"+x.iso)
    .map(x=>({...x, spaces: ptMax(classById(x.cid)) - ptCount(x.cid, x.iso)})).sort((a,b)=>a.dt-b.dt);
}
function ptMissedOf(cid, skip){ return PT._missed || ""; } /* the missed date the picker is for (set when the picker opens) */
function ptTermEnd(){ const td = termDates(ptTerm()); return td && isoDate(td.End) ? toIso(isoDate(td.End)) : ""; }
function ptByWhen(){ const e = ptTermEnd(); return e ? ptD(e, true) : "the end of term"; }

/* ----- screens ----- */
function ptLogo(){ const img = document.querySelector("header .logo"); return img ? `<img src="${img.src}" alt="" width="56" height="56" class="ptlogo">` : ""; }
function ptTop(sub){ const f = PT.fam && ptFam();
  return `<div class="pttop">${PT.fam?`<div class="ptbrand"><b>Red Robin</b><span>${esc(sub||"Class swaps")}</span></div><div class="ptwho"><span>${esc(f?f.label:"")}</span><span class="ptacts"><button type="button" class="ptlink" data-pt="rules">How it works</button><button type="button" class="ptout" data-pt="logout">Log out</button></span></div>`:""}</div>`; }
function ptEmailNorm(e){ return String(e||"").trim().toLowerCase(); }
function ptEmailOk(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ptEmailNorm(e)); }
function ptStEmails(ref){ /* the emails on a student's registration form row */
  const st = S.byRef.get(String(ref)); if(!st) return [];
  return [st.emailAddr, st.emailAddr2, st.emailOld].map(ptEmailNorm).filter(Boolean);
}
function ptByEmail(email){ /* everyone this term registered with this email -> one "family" to log in as */
  const e = ptEmailNorm(email); if(!ptEmailOk(e)) return null;
  const kids = PT.fams.flatMap(f=>f.kids.filter(k=> f.test ? f.email===e : ptStEmails(k.ref).includes(e)));
  if(!kids.length) return null;
  const uniq = [...new Map(kids.map(k=>[k.ref, k])).values()].sort((a,b)=>a.name.localeCompare(b.name));
  const adult = uniq.every(k=>k.adult), test = /@redrobin\.test$/.test(e);
  const st0 = S.byRef.get(String(uniq[0].ref));
  const label = uniq.length===1 && adult ? uniq[0].name : test ? (PT.fams.find(f=>f.test && f.email===e)||{}).label : `${ptSurname(uniq[0].name)} family`;
  return {key:"email|"+e, email:e, adult, test, label: label || (st0 && st0.p1) || e, kids:uniq};
}
function ptLogin(){
  return `<div class="ptlogin">${ptLogo()}<h3>Red Robin Art Academy</h3><p class="small muted">Class swaps</p>
    <label class="ptlbl" for="pt-q">Your email address</label>
    <p class="small muted ptlhint" style="text-align:left;margin:-4px 0 8px;align-self:stretch">The one you gave on the registration form</p>
    <div class="ptsearch"><input id="pt-q" class="ptsel" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@example.com" value="${esc(PT._q||"")}"></div>
    ${PT._err?`<p class="ptnone">${PT._err}</p>`:""}
    <button type="button" id="pt-go" class="btn primary ptbig" data-pt="login"${ptEmailOk(PT._q)?"":" disabled"}>Log in</button><button type="button" class="ptlink ptrlink" data-pt="rules">How it works</button></div>`;
}
function ptSearch(){ /* typing in the email box: just enable the button, so the box keeps focus */
  const inp = $("#pt-q"); if(!inp) return; PT._q = inp.value;
  const b = $("#pt-go"); if(b) b.disabled = !ptEmailOk(PT._q);
  if(PT._err){ PT._err = ""; const m = document.querySelector(".ptlogin .ptnone"); if(m) m.remove(); }
}
document.addEventListener("input", ev=>{ if(ev.target && ev.target.id==="pt-q") ptSearch(); });
document.addEventListener("keydown", ev=>{ if(ev.key!=="Enter" || !ev.target || ev.target.id!=="pt-q") return; ev.preventDefault();
  if(PT && ptEmailOk(PT._q)) ptClick({dataset:{pt:"login"}}); });
function ptChildren(){
  const f = ptFam();
  /* a big "n banked swaps – book a class" button for each student with banked swaps, first thing on opening the app (Chris, 26-Nov 09:50) */
  const banks = f.kids.map(k=>({k, n:PT.swaps.filter(w=>w.sid===k.ref && w.status==="owed").length})).filter(x=>x.n);
  const by = ptTermEnd() ? ptD(ptTermEnd()) : "the end of term";
  const bankH = banks.length ? `<div class="ptbanks">${banks.map(({k,n})=>`<button type="button" class="ptbank" data-pt="bankgo|${esc(k.ref)}"><span class="ptbt"><b>${n} banked swap${n>1?"s":""} – book a class</b><span>${f.kids.length>1?esc(ptFirst(k.name))+" · ":""}Book by ${esc(by)}</span></span><span class="ptbgo">›</span></button>`).join("")}</div>`
    : `<div class="ptbanks"><div class="ptbank zero"><span class="ptbt"><b>0 banked swaps</b><span>Nothing to book right now</span></span></div></div>`; /* banner stays with 0 (Chris, 09:52) */
  return ptTop("Class swaps") + `<div class="ptbody">${bankH}<h3 class="pth">${f.adult?"Select student":"Select child"}</h3>
    <div class="ptkids">${f.kids.map(k=>{ const owed = PT.swaps.filter(w=>w.sid===k.ref && w.status==="owed").length;
      return `<button type="button" class="ptkid" data-pt="kid|${esc(k.ref)}"><span class="ptav">${esc(ptFirst(k.name).slice(0,1))}</span>
        <span class="ptkn"><b>${esc(k.adult?k.name:ptFirst(k.name))}</b><span class="small muted">${k.enr.map(x=>ptLblH(x.cid)).join(" · ")}</span>
        ${owed?`<span class="ptbadge">${owed} banked swap${owed>1?"s":""} to book</span>`:""}</span>${ptUsedHtml(k.ref)}<span class="ptchev">›</span></button>`; }).join("")}</div></div>`;
}
function ptStudent(){
  const f = ptFam(), k = ptKid(PT.sid); if(!k){ PT.sid = null; return ptChildren(); }
  const rows = [], now = Date.now();
  k.enr.forEach(({cid})=>{ const c = classById(cid);
    ptSessions(cid).filter(iso=>ptDt(cid, iso) + ptMins(c)*60e3 > now).forEach(iso=>{
      const w = PT.swaps.find(w=>w.sid===k.ref && w.from===cid && w.fd===iso), when = ptWhenH(cid, iso);
      rows.push({dt:ptDt(cid, iso), own:true, html: w ? (w.status==="booked"
        ? `<button type="button" class="ptrow out" data-pt="manage|${w.id}"><span class="ptd"><s>${when}</s></span><span class="ptst">Swapped to ${esc(ptD(w.td))}</span></button>`
        : `<button type="button" class="ptrow out" data-pt="manage|${w.id}"><span class="ptd"><s>${when}</s></span><span class="ptst warn">Not coming · swap to book</span></button>`)
        : ptOpen(cid, iso) ? `<button type="button" class="ptrow" data-pt="swap|${esc(k.ref)}|${esc(cid)}|${iso}"><span class="ptd">${when}</span><span class="ptgo">Swap ›</span></button>`
        : `<div class="ptrow dim"><span class="ptd">${when}</span><span class="ptst">Too late to swap</span></div>`});
    });
  });
  PT.swaps.filter(w=>w.sid===k.ref && w.status==="booked" && w.to && classById(w.to) && ptDt(w.to, w.td) + ptMins(classById(w.to))*60e3 > now).forEach(w=>{
    rows.push({dt:ptDt(w.to, w.td), html:`<button type="button" class="ptrow in" data-pt="manage|${w.id}"><span class="ptd">${ptWhenH(w.to, w.td)}</span><span class="ptst good">${w.fd?`Swapped from ${esc(ptD(w.fd))}`:"Swapped"}</span></button>`});
  });
  rows.sort((a,b)=>a.dt-b.dt);
  const ownRows = rows.filter(r=>r.own), cut = ownRows.length>4 ? ownRows[3].dt : Infinity, first = rows.filter(r=>r.dt<=cut),
    more = rows.length - first.length, showAll = PT.all[k.ref] || more<=1, shown = showAll ? rows : first;
  const owed = PT.swaps.filter(w=>w.sid===k.ref && w.status==="owed");
  return ptTop("Class swaps") + `<div class="ptbody">
    <button type="button" class="ptlink ptback" data-pt="kids">‹ ${f.kids.length>1?"All children":"Back"}</button>
    <div class="ptsh"><div><h3 class="pth">${esc(k.adult?k.name:ptFirst(k.name))}</h3><span class="small muted">${k.enr.map(x=>ptLblH(x.cid)).join(" · ")}</span></div>${ptUsedHtml(k.ref)}</div>
    ${owed.length?`<div class="ptowed"><div class="ptoh">Banked swap${owed.length>1?"s":""} to book</div>${owed.map(w=>`<button type="button" class="ptrow owed" data-pt="manage|${w.id}"><span class="ptd">Missed ${w.fd?esc(ptD(w.fd)):"a class"}${w.fd?`<br><span class="small muted">Book by ${esc(ptByWhen())}</span>`:""}</span><span class="ptgo">Book swap ›</span></button>`).join("")}</div>`:""}
    <p class="small muted ptintro">Tap a class to swap it.</p>
    <div class="ptlist">${shown.map(r=>r.html).join("")||'<p class="small muted">No more classes this term.</p>'}</div>
    ${more>1?`<button type="button" class="ptlink ptmore" data-pt="all|${esc(k.ref)}">${showAll?"Show fewer":`Show all dates this term (${more} more)`}</button>`:""}</div>`;
}
function viewPortal(){
  if(!PT) ptInit();
  const head = `<div class="pagehead"><div class="rowgap" style="align-items:center"><h2>Portal</h2><span class="pill warn">Prototype</span><span class="small muted">Test logins: test1@redrobin.test (Alfie, Bella) · test2@ (Cara) · test3@ (Eddie, Flora, George) · test4@ (Dan, adult)</span>
      <a class="btn small primary" href="#parent" data-pt="parent" style="margin-left:auto">Open parent view ↗</a><button type="button" class="btn small" data-pt="reset">Reset demo</button></div></div>`;
  if(!PT.fams.length) return head + `<p class="muted">No children in classes in ${esc(ptTerm())} yet.</p>`;
  const screen = !PT.fam ? ptLogin() : !PT.sid ? ptChildren() : ptStudent();
  const bar = S.parent ? `<div class="ptexit"><span>Parent view · preview</span><button type="button" data-pt="reset">Reset</button><a href="#portal" data-pt="exit">Exit</a></div>` : "";
  return (S.parent ? "" : head) + `<div class="ptwrap"><div class="ptphone">${screen}</div></div>` + bar;
}
function ptRules(){
  ptDialog(`<h2>How it works</h2><ul class="ptrl">
    <li>Can't make a class? Swap to any other class <b>this term</b>, as long as there's space.</li>
    <li>Children can go to <b>any other children's class</b>. Adults can go to <b>any other adult class</b>.</li>
    <!-- class maximums (16 children / 15 adults) are not shown to families, only the spaces left (Chris, 25-Nov 09:25) -->
    <li>Not sure when you can come? Tap <b>Bank swap</b>. Banked swaps last until the end of term and are cleared when the new term starts.</li></ul>
    <div class="ptfoot"><button type="button" class="btn" data-close>Close</button></div>`);
}
function ptPicker(kid, mode, cid, ref){ /* mode "swap" (ref = own date), "book" / "change" (ref = swap id) */
  const w = mode==="swap" ? null : PT.swaps.find(x=>x.id===ref);
  const own = mode==="swap" ? cid : w.from;
  PT._missed = mode==="swap" ? ref : (w.fd || "");
  const opts = ptOptions(kid, own, mode==="change" ? w.to+"|"+w.td : "");
  const limit = PT._more ? opts.length : Math.min(opts.length, 12);
  let prev = ""; const list = opts.slice(0, limit).map(o=>{ const day = ptD(o.iso), c = classById(o.cid), hd = day!==prev ? `<div class="ptday">${esc(day)}</div>` : ""; prev = day;
    const lbl = `<span class="ptot">${esc(ptD(o.iso))} · ${esc(ptTime(c))}${ptLenH(o.cid)}</span>`;
    return hd + (o.spaces>0
      ? `<button type="button" class="ptopt" data-pt="pick|${mode}|${esc(kid.ref)}|${esc(own)}|${esc(ref)}|${esc(o.cid)}|${o.iso}">${lbl}<span class="ptsp">${o.spaces} space${o.spaces>1?"s":""}</span></button>`
      : `<div class="ptopt full">${lbl}<span class="ptsp">Full</span></div>`); }).join("");
  const nm = ptFirst(kid.name);
  const title = mode==="swap" ? `Swap ${nm}'s class on ${ptD(ref)}` : mode==="book" ? `Book ${nm}'s swap` : `Change ${nm}'s swap`;
  const sub = mode==="swap" ? (isFinite(PT_LIMIT) ? `${ptUsed(kid.ref)} of ${PT_LIMIT} swaps used this term` : "") : `Instead of ${w.fd?ptWhen(w.from, w.fd):"a missed class"}`;
  ptDialog(`<h2>${esc(title)}</h2>${sub?`<p class="small muted" style="margin:2px 0 10px">${esc(sub)}</p>`:""}
    ${mode==="swap"?`<button type="button" class="btn ptlater" data-pt="later|${esc(kid.ref)}|${esc(cid)}|${ref}">Bank swap</button><div class="ptor small muted">or choose a class to come to instead</div>`:""}
    <div class="ptopts">${list||'<p class="muted">No classes with space left this term.</p>'}</div>
    ${opts.length>limit?`<button type="button" class="ptlink" data-pt="more|${mode}|${esc(kid.ref)}|${esc(cid||"")}|${esc(ref)}" style="margin-top:8px">Show later dates (${opts.length-limit} more)</button>`:""}
    <div class="ptfoot"><button type="button" class="btn" data-close>Close</button></div>`);
}
function ptDing(){ /* a soft two-note chime, made in the browser (no sound file); silently skipped if sound isn't allowed */
  try{ const A = window.AudioContext || window.webkitAudioContext; if(!A) return; const ac = ptDing.ac || (ptDing.ac = new A()); if(ac.state==="suspended") ac.resume();
    [[880,0],[1318.5,0.13]].forEach(([f,t])=>{ const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + t;
      o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0+0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0+0.9);
      o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0+0.95); });
  }catch(e){}
}
function ptCelebrate(fromH, toH, o){ /* from + to (Chris, 22:14); o = {title, fromLbl, toLbl, strike} for the cancel pop-ups (Chris, 25-Nov 12:29) */
  o = o || {};
  const dots = Array.from({length:14}, (_,i)=>`<i style="--a:${i*360/14}deg;--d:${i%3}"></i>`).join("");
  ptDialog(`<div class="ptyay"><div class="ptburst">${dots}<div class="pttickc"><svg viewBox="0 0 52 52" aria-hidden="true"><path d="M14 27 l8 8 l16 -18"/></svg></div></div>
    <h2>${o.title||"Swap confirmed!"}</h2>
    <div class="ptyayft"><div class="ptyrow"><span class="ptylbl">${o.fromLbl||"From"}</span><span class="ptyfrom">${o.strike?`<s>${fromH}</s>`:fromH}</span></div>
      <div class="ptyarr" aria-hidden="true">↓</div>
      <div class="ptyrow"><span class="ptylbl">${o.toLbl||"To"}</span><span class="ptyto">${toH}</span></div></div>
    <button type="button" class="btn primary ptbig" data-close>Done</button></div>`);
  ptDing();
}
function ptCancelPop(w){ /* cancel a swap: what was cancelled, and the class they're back to */
  const kid = ptKid(w.sid), nm = kid ? ptFirst(kid.name) : "";
  ptCelebrate(w.status==="booked" && w.td ? ptWhenH(w.to, w.td) : "Banked swap", ptWhenH(w.from, w.fd), {title:nm?`${esc(nm)}'s swap cancelled`:"Swap cancelled", fromLbl:"Cancelled", toLbl:"Back to", strike:true});
}
function ptToOwedPop(w){ /* cancel the swapped-to class: it goes back to an owed swap */
  ptCelebrate(ptWhenH(w.to, w.td), "Banked swap – book another class later", {title:"Class cancelled", fromLbl:"Cancelled", toLbl:"Now", strike:true});
}
function ptDialog(html){ closeAllDialogs(); openDialog(`<div class="ptdlg">${html}</div>`); }
function ptConfirm(text, btn, action, back){ ptDialog(`<h2>Check and confirm</h2><p>${text}</p><div class="ptfoot"><button type="button" class="btn" ${back?`data-pt="${esc(back)}"`:"data-close"}>Back</button><button type="button" class="btn primary" data-pt="${esc(action)}">${esc(btn)}</button></div>`); }
function ptManage(w){
  const k = ptKid(w.sid), nm = k ? ptFirst(k.name) : "", fromOpen = w.fd && ptOpen(w.from, w.fd), toOpen = w.status==="booked" && w.td && ptOpen(w.to, w.td), btns = [];
  if(w.status==="owed"){
    btns.push(`<button type="button" class="btn primary" data-pt="book|${w.id}">Book swap</button>`);
    if(fromOpen) btns.push(`<button type="button" class="btn" data-pt="undo|${w.id}">Cancel – ${esc(nm)} will come on ${esc(ptD(w.fd))}</button>`);
  } else {
    if(toOpen) btns.push(`<button type="button" class="btn" data-pt="change|${w.id}">Change class</button>`);
    if(fromOpen && toOpen) btns.push(`<button type="button" class="btn" data-pt="undo|${w.id}">Cancel swap – back to ${esc(ptD(w.fd))}</button>`);
    else if(toOpen) btns.push(`<button type="button" class="btn" data-pt="toowed|${w.id}">Cancel this class (book another later)</button>`);
  }
  const toC = w.to && classById(w.to);
  ptDialog(`<h2>${esc(nm)}'s swap</h2>
    <div class="ptsum"><div><span class="small muted">Not coming</span><br><b>${w.fd?ptWhenH(w.from, w.fd):"A missed class"}</b></div>
      <div><span class="small muted">Coming instead</span><br><b>${w.status==="booked"&&toC?ptWhenH(w.to, w.td):'<span style="color:var(--warn)">Not booked yet</span>'}</b></div></div>
    ${w.status==="owed"?`<p class="small muted">Book the swap any time up to ${esc(ptByWhen())}.</p>`:""}
    ${btns.length?`<div class="ptbtns">${btns.join("")}</div>`:'<p class="small muted">It is too late to change this swap.</p>'}
    <div class="ptfoot"><button type="button" class="btn" data-close>Close</button></div>`);
}
function ptOuterHash(h){ /* on Carla's Apps Script link, also put #parent / #portal in the real address bar so it can be bookmarked */
  try{ if(viaAppsScript() && window.google && google.script && google.script.history) google.script.history.push(null, null, h); }catch(e){}
}
function ptClick(el){
  const p = el.dataset.pt.split("|"), k = p[0];
  if(k==="reset"){ PT = null; closeAllDialogs(); render(); toast("Demo reset – back to what's in the sheet."); return; }
  if(k==="rules"){ ptRules(); return; }
  if(k==="parent"||k==="exit"){ ptOuterHash(k==="parent" ? "parent" : "portal"); return; } /* the link's own href changes the hash */
  if(k==="login"){ const inp = $("#pt-q"); if(inp) PT._q = inp.value; const f = ptByEmail(PT._q);
    if(!f){ PT._err = `We can't find <b>${esc(ptEmailNorm(PT._q))}</b>. Please use the email address you gave on the registration form, or contact Carla.`; render(); const i = $("#pt-q"); if(i) i.focus(); return; }
    PT.fams = PT.fams.filter(x=>x.key!==f.key).concat([f]); PT.fam = f.key; PT._err = "";
    PT.sid = null; render(); window.scrollTo(0,0); return; } /* then "Select child" – one card for most, several for families */
  if(k==="logout"){ PT.fam = null; PT.sid = null; PT._q = ""; PT._err = ""; closeAllDialogs(); render(); return; }
  if(k==="kids"){ PT.sid = null; render(); return; }
  if(k==="kid"){ PT.sid = p[1]; render(); window.scrollTo(0,0); return; }
  if(k==="all"){ PT.all[p[1]] = !PT.all[p[1]]; render(); return; }
  if(k==="swap"){ const kid = ptKid(p[1]); PT._more = false;
    if(ptUsed(kid.ref)>=PT_LIMIT){ ptDialog(`<h2>No swaps left</h2><p>${esc(ptFirst(kid.name))} has used both swaps this term. Please contact Carla if you need to miss this class.</p><div class="ptfoot"><button type="button" class="btn" data-close>Close</button></div>`); return; }
    ptPicker(kid, "swap", p[2], p[3]); return; }
  if(k==="more"){ PT._more = true; ptPicker(ptKid(p[2]), p[1], p[3], p[4]); return; }
  if(k==="manage"){ ptManage(PT.swaps.find(w=>w.id===p[1])); return; }
  if(k==="bankgo"){ const ws = PT.swaps.filter(w=>w.sid===p[1] && w.status==="owed").sort((a,b)=>String(a.fd).localeCompare(String(b.fd)));
    if(!ws.length) return; PT.sid = p[1]; render(); PT._more = false; ptPicker(ptKid(p[1]), "book", ws[0].from, ws[0].id); return; } /* oldest banked swap first */
  if(k==="book"||k==="change"){ const w = PT.swaps.find(x=>x.id===p[1]); PT._more = false; ptPicker(ptKid(w.sid), k, w.from, w.id); return; }
  if(k==="later"){ const kid = ptKid(p[1]); ptConfirm(`<b>${esc(ptFirst(kid.name))}</b> won't come on <b>${ptWhenH(p[2], p[3])}</b>. The swap will be banked – book a class for it any time up to ${esc(ptByWhen())}.${isFinite(PT_LIMIT)?`<br><span class="small muted">This uses ${ptUsed(kid.ref)+1} of ${PT_LIMIT} swaps this term.</span>`:""}`, "Confirm", `dolater|${kid.ref}|${p[2]}|${p[3]}`, `swap|${kid.ref}|${p[2]}|${p[3]}`); return; }
  if(k==="pick"){ const [ , mode, sid, own, ref, cid, iso] = p, kid = ptKid(sid), w = mode==="swap" ? null : PT.swaps.find(x=>x.id===ref);
    const from = mode==="swap" ? ptWhen(own, ref) : (w.fd ? ptWhen(w.from, w.fd) : "the missed class");
    ptConfirm(`<b>${esc(ptFirst(kid.name))}</b> will come to <b>${ptWhenH(cid, iso)}</b> instead of <b>${esc(from)}</b>.${mode==="swap" && isFinite(PT_LIMIT)?`<br><span class="small muted">This uses ${ptUsed(kid.ref)+1} of ${PT_LIMIT} swaps this term.</span>`:""}`,
      "Confirm swap", `do|${mode}|${sid}|${own}|${ref}|${cid}|${iso}`, mode==="swap" ? `swap|${sid}|${own}|${ref}` : `${mode}|${ref}`); return; }
  if(k==="do"){ const [ , mode, sid, own, ref, cid, iso] = p, kid = ptKid(sid);
    if(ptCount(cid, iso) >= ptMax(classById(cid)) || !ptOpen(cid, iso)){ toast("Sorry – that class is no longer available."); ptPicker(kid, mode, own, ref); return; }
    if(mode==="swap") PT.swaps.push({id:"D"+PT.seq++, sid, eid:(kid.enr.find(x=>x.cid===own)||{}).eid, from:own, fd:ref, to:cid, td:iso, status:"booked"});
    else Object.assign(PT.swaps.find(x=>x.id===ref), {to:cid, td:iso, status:"booked"});
    const w = mode==="swap" ? null : PT.swaps.find(x=>x.id===ref), fromH = mode==="swap" ? ptWhenH(own, ref) : (w && w.fd ? ptWhenH(w.from, w.fd) : "The missed class");
    closeAllDialogs(); render(); ptCelebrate(fromH, ptWhenH(cid, iso)); return; } /* Chris, 24-Nov 22:12: a fun "Swap confirmed" pop-up + ding, then back to the child's classes */
  if(k==="dolater"){ const kid = ptKid(p[1]); PT.swaps.push({id:"D"+PT.seq++, sid:kid.ref, eid:(kid.enr.find(x=>x.cid===p[2])||{}).eid, from:p[2], fd:p[3], to:"", td:"", status:"owed"});
    closeAllDialogs(); render(); toast(`Swap banked for ${ptFirst(kid.name)}.`); return; }
  if(k==="undo"){ const w = PT.swaps.find(x=>x.id===p[1]), kid = ptKid(w.sid); ptConfirm(`Cancel this swap? <b>${esc(ptFirst(kid.name))}</b> will come to <b>${ptWhenH(w.from, w.fd)}</b> as usual.`, "Cancel swap", `doundo|${w.id}`, `manage|${w.id}`); return; }
  if(k==="doundo"){ const w = PT.swaps.find(x=>x.id===p[1]); PT.swaps = PT.swaps.filter(x=>x.id!==p[1]); closeAllDialogs(); render(); if(w) ptCancelPop(w); return; }
  if(k==="toowed"){ const w = PT.swaps.find(x=>x.id===p[1]); ptConfirm(`Cancel the class on <b>${ptWhenH(w.to, w.td)}</b>? It goes back to a banked swap you can book later this term.`, "Cancel class", `dotoowed|${w.id}`, `manage|${w.id}`); return; }
  if(k==="dotoowed"){ const w = PT.swaps.find(x=>x.id===p[1]), was = Object.assign({}, w); Object.assign(w, {to:"", td:"", status:"owed"}); closeAllDialogs(); render(); ptToOwedPop(was); return; }
}
