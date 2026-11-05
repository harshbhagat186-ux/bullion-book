/* Bullion Book cloud sync: Firebase Auth (login) + Firestore (live data on every device).
   Turned on only when config.js sets window.BULLION_FIREBASE. */
(function () {
'use strict';
var CFG = window.BULLION_FIREBASE;
var SHOP = (window.BULLION_SHOP_ID || 'main');
var KINDS = { bills: 'bill', entries: 'entry', parties: 'party', sauda: 'sauda' };
var Cloud = window.Cloud = { enabled: !!(CFG && CFG.apiKey && window.firebase), user: null, status: 'off' };
if (!Cloud.enabled) return;

firebase.initializeApp(CFG);
var auth = firebase.auth(), db = firebase.firestore();
if (window.BULLION_EMULATOR) { auth.useEmulator('http://127.0.0.1:9099'); db.useEmulator('127.0.0.1', 8080); }
try { db.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}
var shopRef = db.collection('shops').doc(SHOP);
var recRef = shopRef.collection('records'), stateRef = shopRef.collection('meta').doc('state'), accessRef = shopRef.collection('meta').doc('access');
var last = {};          // id -> JSON last seen in cloud
var lastState = '';
var unsub = [];
var gotRecs = false, gotState = false, remoteEmpty = true;
var cache = { bills: {}, entries: {}, parties: {}, sauda: {} };
var pendingMsg = '';

function $(id) { return document.getElementById(id); }
function setStatus(s) {
  Cloud.status = s;
  var el = $('cloudDot');
  if (el) { el.className = 'cdot ' + s; el.title = s === 'online' ? 'Synced online' : s === 'pending' ? 'Saving…' : s === 'offline' ? 'Offline: will sync later' : ''; }
}

/* ---------- login screen ---------- */
function loginHtml(msg) {
  return '<div class="login"><div class="lbox"><img src="icon.png" alt=""><h2>Bullion Book</h2><p class="muted">Sign in to your shop</p>' +
    (msg ? '<p class="lerr">' + msg + '</p>' : '') +
    '<label class="f"><span>Email</span><input id="lg_e" type="email" autocomplete="username" inputmode="email"></label>' +
    '<label class="f"><span>Password</span><input id="lg_p" type="password" autocomplete="current-password"></label>' +
    '<button class="btn gold" style="width:100%" id="lg_go">Sign in</button>' +
    '<p style="text-align:center;margin-top:14px"><a href="#" id="lg_fg">Forgot password?</a></p></div></div>';
}
function showLogin(msg) {
  var o = $('loginLayer');
  if (!o) { o = document.createElement('div'); o.id = 'loginLayer'; document.body.appendChild(o); }
  o.innerHTML = loginHtml(msg);
  o.classList.remove('hidden');
  $('lg_go').onclick = doLogin;
  $('lg_p').onkeydown = function (e) { if (e.key === 'Enter') doLogin(); };
  $('lg_fg').onclick = function (e) {
    e.preventDefault();
    var em = $('lg_e').value.trim();
    if (!em) { showLogin('Type your email first, then tap Forgot password.'); return; }
    auth.sendPasswordResetEmail(em).then(function () { showLogin('Password reset email sent to ' + em); }, function (er) { showLogin(niceErr(er)); });
  };
}
function hideLogin() { var o = $('loginLayer'); if (o) o.classList.add('hidden'); }
function niceErr(er) {
  var c = (er && er.code) || '';
  if (/wrong-password|invalid-credential|user-not-found|invalid-login/.test(c)) return 'Wrong email or password.';
  if (/too-many-requests/.test(c)) return 'Too many wrong tries. Locked for a while for safety. Try later.';
  if (/network/.test(c)) return 'No internet. Connect and try again.';
  if (/permission-denied/.test(c)) return 'This account is not allowed to open this shop. Ask the owner to add your email.';
  return (er && er.message) || 'Something went wrong.';
}
function doLogin() {
  var em = $('lg_e').value.trim(), pw = $('lg_p').value;
  if (!em || !pw) { showLogin('Enter email and password.'); return; }
  $('lg_go').textContent = 'Signing in…';
  auth.signInWithEmailAndPassword(em, pw).catch(function (er) { showLogin(niceErr(er)); });
}

/* ---------- cloud -> app ---------- */
function deliver() {
  if (!gotRecs || !gotState) return;
  var data = { bills: [], entries: [], parties: [], sauda: [] };
  Object.keys(cache).forEach(function (k) { Object.keys(cache[k]).forEach(function (id) { data[k].push(cache[k][id]); }); });
  App._applyRemote(data, Cloud.remoteState, remoteEmpty);
}
function listen() {
  unsub.push(recRef.onSnapshot({ includeMetadataChanges: true }, function (snap) {
    snap.docChanges().forEach(function (ch) {
      var d = ch.doc.data(), arr = Object.keys(KINDS).filter(function (k) { return KINDS[k] === d.k; })[0];
      if (!arr) return;
      if (ch.type === 'removed') { delete cache[arr][ch.doc.id]; delete last[ch.doc.id]; }
      else { cache[arr][ch.doc.id] = d.v; last[ch.doc.id] = JSON.stringify(d.v); }
    });
    if (snap.size) remoteEmpty = false;
    setStatus(snap.metadata.hasPendingWrites ? 'pending' : snap.metadata.fromCache ? 'offline' : 'online');
    gotRecs = true; deliver();
  }, onListenErr));
  unsub.push(accessRef.onSnapshot({ includeMetadataChanges: true }, function (d) {
    if (d.metadata.fromCache || d.metadata.hasPendingWrites) return; // act only on what the server confirms
    var em = (Cloud.user && Cloud.user.email || '').toLowerCase(), list = (d.exists && d.data().emails) || [];
    if (Cloud.user && list.indexOf(em) < 0 && !Cloud.isOwner) onListenErr({ code: 'permission-denied' });
  }, function (er) { if (er && er.code === 'permission-denied') onListenErr(er); }));
  unsub.push(stateRef.onSnapshot(function (doc) {
    if (doc.exists) { remoteEmpty = false; Cloud.remoteState = doc.data(); lastState = JSON.stringify(Cloud.remoteState.v || {}); }
    gotState = true; deliver();
  }, onListenErr));
}
function onListenErr(er) {
  stopListen();
  if (er && er.code === 'permission-denied') { pendingMsg = niceErr(er); auth.signOut().then(function () { App._lock(true); }); }
  else showLogin(niceErr(er));
}
function stopListen() { unsub.forEach(function (f) { try { f(); } catch (e) {} }); unsub = []; }

/* ---------- app -> cloud (only changed records are written) ---------- */
Cloud.push = function (D) {
  if (!Cloud.user || !gotRecs || !gotState) return;
  var ops = [], seen = {};
  Object.keys(KINDS).forEach(function (arr) {
    (D[arr] || []).forEach(function (o) {
      seen[o.id] = 1;
      var j = JSON.stringify(o);
      if (last[o.id] !== j) { ops.push(['set', o.id, { k: KINDS[arr], v: JSON.parse(j), u: firebase.firestore.FieldValue.serverTimestamp(), by: Cloud.user.email }]); last[o.id] = j; }
    });
  });
  Object.keys(last).forEach(function (id) { if (!seen[id]) { ops.push(['del', id]); delete last[id]; } });
  var st = { settings: D.settings, opening: D.opening, seq: D.seq }, sj = JSON.stringify(st);
  var writeState = sj !== lastState;
  if (writeState) lastState = sj;
  if (!ops.length && !writeState) return;
  setStatus('pending');
  var chunks = [];
  for (var i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
  if (!chunks.length) chunks.push([]);
  chunks.forEach(function (ch, n) {
    var b = db.batch();
    ch.forEach(function (op) { if (op[0] === 'set') b.set(recRef.doc(op[1]), op[2]); else b.delete(recRef.doc(op[1])); });
    if (n === 0 && writeState) b.set(stateRef, { v: JSON.parse(sj), u: firebase.firestore.FieldValue.serverTimestamp(), by: Cloud.user.email });
    b.commit().catch(function (er) { App._toast('Online save failed: ' + niceErr(er)); });
  });
};
Cloud.signOut = function () {
  if (!confirm('Sign out from this device?')) return;
  stopListen(); auth.signOut().then(function () { App._lock(true); });
};
Cloud.addUserHelp = function () {
  return 'To add staff: open Firebase console → Authentication → Add user (email + password), then add that email in Firestore → shops/' + SHOP + '/meta/access → emails.';
};

/* ---------- staff logins (owner only) ---------- */
Cloud.loadUsers = function (cb) {
  accessRef.get().then(function (d) { cb(null, (d.exists && d.data().emails) || []); }, function (er) { cb(niceErr(er)); });
};
Cloud.addUser = function (email, password, cb) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { cb('Enter a valid email'); return; }
  if (String(password || '').length < 6) { cb('Password must be at least 6 characters'); return; }
  var sec = firebase.apps.filter(function (a) { return a.name === 'staff'; })[0] || firebase.initializeApp(CFG, 'staff');
  var sauth = sec.auth();
  if (window.BULLION_EMULATOR && !sec._emu) { sauth.useEmulator('http://127.0.0.1:9099'); sec._emu = 1; }
  sauth.createUserWithEmailAndPassword(email, password).then(function () { return sauth.signOut(); }, function (er) {
    if (er && er.code === 'auth/email-already-in-use') return null; // already has a login, just allow it
    throw er;
  }).then(function () {
    return accessRef.set({ emails: firebase.firestore.FieldValue.arrayUnion(email) }, { merge: true });
  }).then(function () { cb(null); }, function (er) { cb(niceErr(er)); });
};
Cloud.removeUser = function (email, cb) {
  accessRef.set({ emails: firebase.firestore.FieldValue.arrayRemove(email) }, { merge: true }).then(function () { cb(null); }, function (er) { cb(niceErr(er)); });
};
Cloud.resetPassword = function (email, cb) { auth.sendPasswordResetEmail(email).then(function () { cb(null); }, function (er) { cb(niceErr(er)); }); };

auth.onAuthStateChanged(function (u) {
  Cloud.user = u;
  Cloud.isOwner = !!(u && u.email && String(window.BULLION_OWNER || '').toLowerCase() === u.email.toLowerCase());
  stopListen(); gotRecs = gotState = false; remoteEmpty = true; last = {}; lastState = '';
  cache = { bills: {}, entries: {}, parties: {}, sauda: {} };
  if (!u) { setStatus('off'); showLogin(pendingMsg); pendingMsg = ''; return; }
  hideLogin(); setStatus('offline');
  listen();
});
})();
