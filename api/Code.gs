//
// Red Robin Swaps - the bridge between the parents' app and Carla's Google Sheets
// ------------------------------------------------------------------------------
// The "Red Robin Swaps" app (on Netlify) asks this script for ONE family's details. It answers with
// only what the app needs: the children's names, their classes and dates this term, how many places
// are free in each class on each date, and the family's own swaps. Never addresses, phone numbers,
// medical notes or payments.
//
// It runs as Carla, so parents don't need a Google account and never get access to the sheets.
// Families are found by their PERSONAL LINK (a random code in the PortalLinks tab) or by typing the
// email on their registration form. Too many wrong emails from anywhere = a short pause.
//
// v2 (25-Nov-2026): make-ups can be in any term within a year of the missed class (owed swaps last a year),
//   but only in terms the student is in a class (not Left/Absent) - "still an active Red Robin student".
// v1 (24-Nov-2026): READ ONLY. Swaps made in the app are a demo for now - nothing is written to the
// Swaps tab. The only thing it ever writes is a new row in PortalLinks when someone logs in by email
// for the first time (their personal code), so the app can remember them.
//
// Set up (Carla, once):
//   1. Go to script.google.com > New project. Name it "Red Robin Swaps bridge".
//   2. Paste this over everything in Code.gs. Save.
//   3. Run > choose "setup" > Run. Allow it (it's Carla's own script: Advanced > Go to … > Allow).
//      This also makes the PortalLinks tab: one personal link code per family email.
//   4. Deploy > New deployment > type: Web app.
//        Description: Red Robin Swaps bridge
//        Execute as: Me (the Red Robin Google account)
//        Who has access: Anyone
//      Deploy, then copy the "Web app URL" (ends in /exec) and send it to Chris.
//   After a code change: Deploy > Manage deployments > pencil > Version: New version > Deploy (same URL).
//

const DB_ID         = '1U6ra-LmwQIFJKGtI0f1nuP6sAnjama4Zq36TQalptYk'; // Red Robin Database
const FORM_ID       = '1rasCtoX6Ox8ZBqulykS8HJN6GjzygfbSYYgqSmfvKzA'; // Children's registration form responses
const ADULT_FORM_ID = '13Wk9b8XW0j5F9cLkwK7_6pi06fcCl2TOfMuYc9AVBec'; // Adults' registration form responses
const LINKS_TAB     = 'PortalLinks';                                   // Email | Code | Created | Note
const VERSION       = 'bridge v2 (25-Nov-2026)';
const TEST_DOMAIN   = '@redrobin.test';                                // test1@ … test4@ - made-up families for trying things out

// ---------------- web entry points ----------------

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.action === 'ping') out = { ok: true, version: VERSION };
    else if (p.action === 'family') out = family_(p);
    else out = { ok: false, error: 'unknown' };
  } catch (err) {
    out = { ok: false, error: 'server', message: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// Run once from the editor so Google asks for permission, and to check everything can be read.
function setup() {
  links_();
  const d = data_();
  Logger.log('OK: ' + d.term + ', ' + d.classes.length + ' classes, ' + d.students.length + ' students. ' + VERSION);
  makeLinks();   // a personal link code for every email of a student in this term's classes (PortalLinks tab)
}

// ---------------- the family answer ----------------

function family_(p) {
  const code = String(p.code || '').trim(), email = normEmail_(p.email);
  if (!code && !email) return { ok: false, error: 'missing' };
  if (email && !slowDown_()) return { ok: false, error: 'busy' };
  let who = email;
  if (code) {
    const row = links_().filter(function (r) { return r.code === code; })[0];
    if (!row) return { ok: false, error: 'badcode' };
    who = row.email;
  }
  const d = data_();
  const fam = who.slice(-TEST_DOMAIN.length) === TEST_DOMAIN ? testFamily_(d, who) : realFamily_(d, who);
  if (!fam) { if (email) failed_(); return { ok: false, error: code ? 'badcode' : 'notfound' }; }
  const myCode = code || codeFor_(who);
  const used = {}; fam.kids.forEach(function (k) { k.enr.forEach(function (x) { used[x.cid] = 1; }); });
  const groups = {}; Object.keys(used).forEach(function (cid) { groups[groupOf_(d.byId[cid])] = 1; });
  const refs = {}; fam.kids.forEach(function (k) { refs[k.ref] = 1; });
  const swaps = d.swaps.filter(function (w) { return refs[w.sid]; });
  swaps.forEach(function (w) { used[w.from] = 1; if (w.to) used[w.to] = 1; });
  // classes they could swap into: any term, same group, with a date between today and a year (plus a bit) ahead
  const until = yearOn_(yearOn_(d.today));   // a missed date later this term + a year is still inside this
  const classes = d.all.filter(function (c) {
    if (used[c.ClassID]) return true;
    if (!groups[groupOf_(c)]) return false;
    return (d.sessions[c.ClassID] || []).some(function (x) { return x >= d.today && x <= until; });
  });
  const sessions = {}, counts = {};
  classes.forEach(function (c) {
    sessions[c.ClassID] = d.sessions[c.ClassID] || [];
    const n = d.base[c.ClassID] || 0, row = {};
    sessions[c.ClassID].forEach(function (iso) { row[iso] = n + (d.swapDelta[c.ClassID + '|' + iso] || 0); });
    counts[c.ClassID] = row;
  });
  return {
    ok: true, version: VERSION, code: myCode, term: d.term, termEnd: d.termEnd,
    family: { label: fam.label, adult: fam.adult, test: !!fam.test, kids: fam.kids },
    classes: classes.map(function (c) { return { ClassID: c.ClassID, Term: c.Term, Type: c.Type, Day: c.Day, Time: c.Time, Group: c.Group, Fee: c.Fee, Weeks: c.Weeks, Capacity: c.Capacity, Sort: c.Sort }; }),
    sessions: sessions, counts: counts, swaps: swaps
  };
}

function realFamily_(d, email) {
  const kids = d.students.filter(function (s) { return s.emails.indexOf(email) >= 0 && d.enrolByRef[s.ref]; })
    .map(function (s) { return { ref: s.ref, name: s.name, adult: s.adult, enr: d.enrolByRef[s.ref], terms: Object.keys(d.termsByRef[s.ref] || {}) }; })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });
  if (!kids.length) return null;
  const adult = kids.every(function (k) { return k.adult; });
  return { label: kids.length === 1 && adult ? kids[0].name : surname_(kids[0].name) + ' family', adult: adult, kids: kids };
}

// The same made-up families as the Portal tab in the Rocker, placed in real classes (they don't change class sizes)
function testFamily_(d, email) {
  const cs = d.classes.slice().sort(function (a, b) { return num_(a.Sort) - num_(b.Sort); });
  const kidsC = cs.filter(function (c) { return !isAdultClass_(c); }), adC = cs.filter(isAdultClass_);
  const short = kidsC.filter(function (c) { return mins_(c) === 90; }), long = kidsC.filter(function (c) { return mins_(c) > 90; })[0] || kidsC[kidsC.length - 1];
  const at = function (arr, i) { return arr.length ? arr[i % arr.length] : null; };
  const fams = {
    test1: ['Test family 1', false, [['Alfie Test', at(short, 0)], ['Bella Test', long]], 1],
    test2: ['Test family 2', false, [['Cara Test', at(short, 2)]], 2],
    test3: ['Test family 3', false, [['Eddie Test', at(short, 1)], ['Flora Test', at(short, 3)], ['George Test', at(short, 4)]], 4],
    test4: ['Dan Test', true, [['Dan Test', at(adC, 0)]], 3]
  };
  const f = fams[email.split('@')[0]]; if (!f) return null;
  const kids = f[2].filter(function (k) { return k[1]; }).map(function (k, i) {
    return { ref: 'T' + f[3] + i, name: k[0], adult: f[1], enr: [{ eid: 'TE' + f[3] + i, cid: k[1].ClassID }], terms: [d.term] };
  });
  return kids.length ? { label: f[0], adult: f[1], test: true, kids: kids } : null;
}

// ---------------- reading the sheets ----------------

function data_() {
  const db = SpreadsheetApp.openById(DB_ID);
  const tab = function (name) { const sh = db.getSheetByName(name); return sh ? objects_(sh.getDataRange().getDisplayValues()) : []; };
  const settings = {}; tab('Settings').forEach(function (r) { settings[r.Setting] = r.Value; });
  const term = String(settings.CurrentTerm || '').trim(), today = today_();
  const all = tab('Classes').filter(function (c) { return c.ClassID && !/^workshop/i.test(c.Type); });   // every term: make-ups can be in a later term
  const byId = {}; all.forEach(function (c) { byId[c.ClassID] = c; });
  const classes = all.filter(function (c) { return c.Term === term; });
  const td = tab('TermDates').filter(function (r) { return r.Term === term; })[0];
  const termEnd = td ? iso_(td.End) : '';
  const sessions = {};
  tab('Sessions').forEach(function (s) {
    if (!byId[s.ClassID] || /^cancel/i.test(s.Status)) return; const day = iso_(s.Date); if (!day) return;
    (sessions[s.ClassID] = sessions[s.ClassID] || []).push(day);
  });
  Object.keys(sessions).forEach(function (k) { sessions[k] = sessions[k].filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(); });
  const base = {}, enrolByRef = {}, enrolById = {}, termsByRef = {};
  tab('Enrolments').forEach(function (e) {
    if (!byId[e.ClassID]) return;
    enrolById[e.EnrolmentID] = e;
    if (/^(left|absent)/i.test(e.Status)) return;
    base[e.ClassID] = (base[e.ClassID] || 0) + 1;                                         // places taken, any term
    const ref = String(e.Ref || '').trim(); if (!ref) return;
    (termsByRef[ref] = termsByRef[ref] || {})[e.Term] = 1;                                   // terms they're active in: swaps can only go there
    if (e.Term !== term) return;
    (enrolByRef[ref] = enrolByRef[ref] || []).push({ eid: e.EnrolmentID, cid: e.ClassID }); // who's in this term's classes
  });
  // swaps already in the Swaps tab (made by Carla from WhatsApp): they change the numbers, and the family's own are shown.
  // A family sees this term's swaps plus older ones still open: owed for a year, booked until the make-up has happened.
  const swaps = [], swapDelta = {};
  tab('Swaps').forEach(function (r) {
    const e = enrolById[r.EnrolmentID];
    if (!r.SwapID || /^cancel/i.test(r.Status) || !e || !byId[r.FromClass]) return;
    const booked = /^booked/i.test(r.Status), owed = /^owed/i.test(r.Status);
    if (!booked && !owed) return; if (booked && !byId[r.ToClass]) return;
    const w = { id: 'R' + r.SwapID, eid: r.EnrolmentID, sid: String(e.Ref).trim(), from: r.FromClass, fd: iso_(r.FromDate) || '',
      to: booked ? r.ToClass : '', td: booked ? (iso_(r.ToDate) || '') : '', status: booked ? 'booked' : 'owed', real: true, cur: e.Term === term };
    if (booked) swapDelta[w.to + '|' + w.td] = (swapDelta[w.to + '|' + w.td] || 0) + 1;
    swapDelta[w.from + '|' + w.fd] = (swapDelta[w.from + '|' + w.fd] || 0) - 1;
    if (w.cur || (owed && w.fd && yearOn_(w.fd) >= today) || (booked && w.td >= today)) swaps.push(w);
  });
  return { term: term, termEnd: termEnd, today: today, classes: classes, all: all, byId: byId, sessions: sessions, base: base, enrolByRef: enrolByRef, termsByRef: termsByRef, swaps: swaps, swapDelta: swapDelta, students: students_() };
}

// Every student on the two registration forms, with the emails on their row. Columns are found by their heading.
function students_() {
  const out = [];
  const read = function (id, tabName) { const sh = SpreadsheetApp.openById(id).getSheetByName(tabName); return sh ? sh.getDataRange().getDisplayValues() : []; };
  const col = function (head, re, not) { for (let i = 0; i < head.length; i++) { const h = norm_(head[i]); if (re.test(h) && !(not && not.test(h))) return i; } return -1; };
  const kids = read(FORM_ID, 'Form Responses 1');
  if (kids.length) {
    const h = kids[0], cN = col(h, /child.?s name/), c1 = col(h, /^parent 1 e ?mail/), c2 = col(h, /^parent 2 e ?mail/);
    kids.forEach(function (r, i) {
      if (i < 2 || cN < 0 || !String(r[cN] || '').trim()) return;           // row 1 headings, row 2 Carla's test entry
      out.push({ ref: String(i - 2), name: String(r[cN]).trim(), adult: false, emails: [r[c1], r[c2]].map(normEmail_).filter(String) });
    });
  }
  const ads = read(ADULT_FORM_ID, 'Form responses 1');
  if (ads.length) {
    const h = ads[0], cN = col(h, /^name/), cE = col(h, /^e ?mail$/), cOld = col(h, /e ?mail address/);
    ads.forEach(function (r, i) {
      if (i < 1 || cN < 0 || !String(r[cN] || '').trim()) return;
      out.push({ ref: 'A' + i, name: String(r[cN]).trim(), adult: true, emails: [r[cE], r[cOld]].map(normEmail_).filter(String) });
    });
  }
  return out;
}

// ---------------- personal links ----------------

function links_() {
  const db = SpreadsheetApp.openById(DB_ID);
  let sh = db.getSheetByName(LINKS_TAB);
  if (!sh) { sh = db.insertSheet(LINKS_TAB); sh.appendRow(['Email', 'Code', 'Created', 'Note']); sh.setFrozenRows(1); }
  return objects_(sh.getDataRange().getDisplayValues()).map(function (r) { return { email: normEmail_(r.Email), code: String(r.Code || '').trim() }; })
    .filter(function (r) { return r.email && r.code; });
}

function codeFor_(email) {
  const have = links_().filter(function (r) { return r.email === email; })[0];
  if (have) return have.code;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const again = links_().filter(function (r) { return r.email === email; })[0]; if (again) return again.code;
    const code = newCode_();
    SpreadsheetApp.openById(DB_ID).getSheetByName(LINKS_TAB).appendRow([email, code, Utilities.formatDate(new Date(), 'Europe/London', 'dd-MMM-yyyy HH:mm'), 'Logged in by email']);
    return code;
  } finally { lock.releaseLock(); }
}

// 16 random letters and digits (no look-alikes) - far too many to guess
function today_() { return Utilities.formatDate(new Date(), 'Europe/London', 'yyyy-MM-dd').slice(0, 10); }
function yearOn_(iso) { const m = String(iso || '').match(/^(\d{4})(-\d{2}-\d{2})/); return m ? (Number(m[1]) + 1) + m[2] : ''; }   // the same date a year later

function newCode_() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = '';
  const bytes = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  for (let i = 0; i < 16; i++) s += abc[parseInt(bytes.substr(i * 2, 2), 16) % abc.length];
  return s;
}

// Make one personal link per email for everyone in this term's classes (run from the editor, or by Chris).
function makeLinks() {
  const d = data_(), have = {}; links_().forEach(function (r) { have[r.email] = 1; });
  const sh = SpreadsheetApp.openById(DB_ID).getSheetByName(LINKS_TAB), now = Utilities.formatDate(new Date(), 'Europe/London', 'dd-MMM-yyyy HH:mm');
  const add = [];
  d.students.forEach(function (s) { if (!d.enrolByRef[s.ref]) return; s.emails.forEach(function (e) { if (!have[e]) { have[e] = 1; add.push([e, newCode_(), now, 'Made for the link email']); } }); });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 4).setValues(add);
  Logger.log(add.length + ' new links');
}

// ---------------- too many wrong emails ----------------

function slowDown_() { const n = Number(CacheService.getScriptCache().get('fails') || 0); return n < 30; }   // more than 30 misses in 10 minutes = pause
function failed_() { const c = CacheService.getScriptCache(), n = Number(c.get('fails') || 0) + 1; c.put('fails', String(n), 600); }

// ---------------- small helpers ----------------

function objects_(rows) {
  if (!rows || !rows.length) return [];
  const h = rows[0].map(function (x) { return String(x).trim(); });
  return rows.slice(1).map(function (r) { const o = {}; h.forEach(function (k, i) { if (k) o[k] = r[i] == null ? '' : String(r[i]); }); return o; });
}
function normEmail_(e) { return String(e || '').trim().toLowerCase(); }
function norm_(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function num_(v) { const n = parseFloat(String(v == null ? '' : v).replace(/[£,\s]/g, '')); return isFinite(n) ? n : 0; }
function isAdultClass_(c) { return /^adult/i.test(String((c || {}).Group || '')); }
function groupOf_(c) { return isAdultClass_(c) ? 'Adults' : 'Children'; }
function mins_(c) { if (isAdultClass_(c)) return 135; const f = num_(c.Fee), w = num_(c.Weeks), rate = w > 0 && f > 60 ? f / w : f; return rate >= 30 ? 120 : 90; }
function surname_(name) { const p = String(name || '').replace(/\([^)]*\)/g, ' ').trim().split(/\s+/); return p[p.length - 1] || String(name || ''); }
const MON_ = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function iso_(v) {   // 07-Sep-2026, 2026-09-07 or 07/09/2026 -> 2026-09-07
  const s = String(v || '').trim(); let m;
  const z = function (n) { return ('0' + n).slice(-2); };
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + '-' + z(m[2]) + '-' + z(m[1]);
  if ((m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*[-\s](\d{4})/)) && MON_.indexOf(m[2].toLowerCase()) >= 0) return m[3] + '-' + z(MON_.indexOf(m[2].toLowerCase()) + 1) + '-' + z(m[1]);
  return '';
}
