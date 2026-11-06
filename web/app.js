/* Bullion Book - offline billing, stock and Baki/Jama for a bullion shop */
(function () {
'use strict';

/* ---------- constants ---------- */
var ITEMS = {
  bs:     { name: 'Buy Sell',    short: 'Buy Sell', metal: 'silver', touch: false, time: true },
  silver: { name: 'Silver',      short: 'Silver',   metal: 'silver', touch: false },
  sili:   { name: 'Silver Sili 999', short: 'Sili 999', metal: 'silver', touch: false },
  rupa:   { name: 'Silver Rupa', short: 'Rupa',     metal: 'silver', touch: true },
  gold:   { name: 'Gold',        short: 'Gold',     metal: 'gold',   touch: false },
  kaccha: { name: 'Gold Kaccha', short: 'Kaccha',   metal: 'gold',   touch: true }
};
var ALL_KEYS = ['bs', 'silver', 'sili', 'rupa', 'gold', 'kaccha'];
var ITEM_KEYS = ['silver', 'sili', 'rupa', 'gold', 'kaccha'];
function shownKeys() { return D.bills.some(function (b) { return b.lines.some(function (l) { return l.item === 'bs'; }); }) || num(D.opening.bs) ? ['bs'].concat(ITEM_KEYS) : ITEM_KEYS; }
var ACCTS = ['cash', 'silver', 'gold'];
var KIND = {
  baki:    { name: 'Baki (they owe)',          short: 'Baki',     party: true },
  jama:    { name: 'Jama (deposit / we owe)',  short: 'Jama',     party: true },
  recv:    { name: 'Received from party',      short: 'Received', party: true },
  pay:     { name: 'Paid / given to party',    short: 'Paid',     party: true },
  cashin:  { name: 'Cash In (shop)',           short: 'Cash In' },
  cashout: { name: 'Cash Out / Expense',       short: 'Cash Out' },
  stockin: { name: 'Stock In (adjust)',        short: 'Stock In' },
  stockout:{ name: 'Stock Out (adjust)',       short: 'Stock Out' }
};
var STORE_KEY = 'bullionbook.v1';
var HAS_APP = !!(window.Android && window.Android.isApp);

/* ---------- data ---------- */
function blank() {
  return {
    version: 1, savedAt: 0,
    settings: {
      shopName: 'My Bullion Shop', address: '', phone: '', gstin: '', email: '',
      tagline: 'Gold & Silver Bullion', footer: 'Thank you! Visit again.',
      terms: 'Goods once sold will not be taken back.',
      gstOn: false, gstRate: 3, gstInter: false,
      sellPrefix: 'S-', buyPrefix: 'P-',
      units: { silver: { unit: 'kg', ratePer: 1 }, gold: { unit: 'g', ratePer: 10 } },
      hsn: { silver: '7106', gold: '7108' },
      stockItems: { bs: true, silver: true, sili: true, rupa: true, gold: true, kaccha: true },
      paper: '80', btPrinter: '', btName: '', btWidth: 32
    },
    opening: { bs: 0, silver: 0, sili: 0, rupa: 0, rupaFine: 0, gold: 0, kaccha: 0, kacchaFine: 0, cash: 0, bank: 0 },
    seq: { sell: 1, buy: 1 },
    parties: [], bills: [], entries: [], sauda: []
  };
}
var D = blank();

function merge(base, obj) {
  for (var k in obj) {
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k]) && base[k] && typeof base[k] === 'object') merge(base[k], obj[k]);
    else base[k] = obj[k];
  }
  return base;
}
function load() {
  var a = null, b = null;
  try { var s = localStorage.getItem(STORE_KEY); if (s) a = JSON.parse(s); } catch (e) {}
  try { if (HAS_APP) { var t = Android.loadData(); if (t) b = JSON.parse(t); } } catch (e) {}
  var best = a && b ? (b.savedAt > a.savedAt ? b : a) : (a || b);
  if (best) D = merge(blank(), best);
}
function save() {
  D.savedAt = Date.now();
  var s = JSON.stringify(D);
  try { localStorage.setItem(STORE_KEY, s); } catch (e) {}
  try { if (HAS_APP) Android.saveData(s); } catch (e) {}
  try { if (window.Cloud && Cloud.enabled) Cloud.push(D); } catch (e) {}
}
function saveLocal() {
  var s = JSON.stringify(D);
  try { localStorage.setItem(STORE_KEY, s); } catch (e) {}
  try { if (HAS_APP) Android.saveData(s); } catch (e) {}
}

/* ---------- utils ---------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function nowTime() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fd(s) { if (!s) return ''; var p = s.split('-'); return p[2] + '-' + MON[+p[1] - 1] + '-' + p[0].slice(2); }
function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
function r3(n) { return Math.round(n * 1000) / 1000; }
function r2(n) { return Math.round(n * 100) / 100; }
function inr(n, dec) {
  dec = dec || 0;
  var neg = n < 0; n = Math.abs(n);
  var s = n.toFixed(dec), parts = s.split('.'), x = parts[0];
  var last3 = x.slice(-3), rest = x.slice(0, -3);
  if (rest) last3 = ',' + last3;
  rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (neg ? '-' : '') + rest + last3 + (parts[1] ? '.' + parts[1] : '');
}
function money(n) { return '₹' + inr(Math.round(n)); }
function moneyP(n) { return '₹' + inr(n, 2); }
function unitOf(metal) { return D.settings.units[metal].unit; }
function ratePer(metal) { return num(D.settings.units[metal].ratePer) || 1; }
function rateLbl(metal) { var r = ratePer(metal), u = unitOf(metal); return 'per ' + (r === 1 ? '' : r + ' ') + u; }
function w(n, metal) { return (+n || 0).toFixed(3) + (metal ? ' ' + unitOf(metal) : ''); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function $(id) { return document.getElementById(id); }
function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.add('hidden'); }, 2600); }
function acctOfItem(item) { return item === 'cash' ? 'cash' : ITEMS[item].metal; }
function acctLabel(a) { return a === 'cash' ? 'Cash' : a === 'silver' ? 'Silver' : 'Gold'; }
function fmtAcct(a, v) { return a === 'cash' ? money(v) : w(v, a); }

function amountWords(n) {
  n = Math.round(n);
  if (n === 0) return 'Zero';
  var a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function two(x) { return x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''); }
  function three(x) { var h = Math.floor(x / 100), r = x % 100; return (h ? a[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : ''); }
  var out = [], cr = Math.floor(n / 10000000); n %= 10000000;
  var la = Math.floor(n / 100000); n %= 100000;
  var th = Math.floor(n / 1000); n %= 1000;
  if (cr) out.push((cr > 999 ? amountWords(cr) : three(cr)) + ' Crore');
  if (la) out.push(two(la) + ' Lakh');
  if (th) out.push(two(th) + ' Thousand');
  if (n) out.push(three(n));
  return out.join(' ');
}

/* ---------- parties ---------- */
function partyById(id) { for (var i = 0; i < D.parties.length; i++) if (D.parties[i].id === id) return D.parties[i]; return null; }
function partyByName(name) {
  var n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  for (var i = 0; i < D.parties.length; i++) if (D.parties[i].name.toLowerCase() === n) return D.parties[i];
  return null;
}
function ensureParty(name, phone) {
  name = String(name || '').trim();
  if (!name) return null;
  var p = partyByName(name);
  if (!p) { p = { id: uid(), name: name, phone: phone || '', address: '', gstin: '' }; D.parties.push(p); }
  else if (phone && !p.phone) p.phone = phone;
  return p;
}
function partyDatalist() {
  return '<datalist id="plist">' + D.parties.map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join('') + '</datalist>';
}

/* ---------- calculations ---------- */
function lineCalc(l) {
  var it = ITEMS[l.item], metal = it.metal;
  l.weight = num(l.weight);
  l.touch = it.touch ? num(l.touch) : 100;
  l.fine = it.touch ? r3(l.weight * l.touch / 100) : l.weight;
  l.rate = num(l.rate);
  l.amount = Math.round((it.touch ? l.fine : l.weight) * l.rate / ratePer(metal));
  return l;
}
function billCalc(b) {
  b.lines.forEach(lineCalc);
  b.subtotal = b.lines.reduce(function (s, l) { return s + l.amount; }, 0);
  b.cgst = b.sgst = b.igst = 0;
  var tax = 0;
  b.gstOn = false;
  if (b.gstOn) {
    tax = r2(b.subtotal * num(b.gstRate) / 100);
    if (b.gstInter) b.igst = tax; else { b.cgst = r2(tax / 2); b.sgst = r2(tax - b.cgst); }
  }
  var raw = b.subtotal + tax;
  b.total = Math.round(raw);
  b.roundOff = r2(b.total - raw);
  b.paid = num(b.paid);
  b.due = b.total - b.paid;
  return b;
}
function inRange(d, from, to) { return (!from || d >= from) && (!to || d <= to); }

/* Full position: stock, cash, party balances. Positive party balance = Baki (party owes shop). */
function compute(upto) {
  var st = {}, cash = { open: num(D.opening.cash), in: 0, out: 0 }, bank = { open: num(D.opening.bank), in: 0, out: 0 };
  ALL_KEYS.forEach(function (k) {
    st[k] = { open: num(D.opening[k]), openFine: ITEMS[k].touch ? num(D.opening[k + 'Fine']) : num(D.opening[k]), buy: 0, sell: 0, buyFine: 0, sellFine: 0, adjIn: 0, adjOut: 0, adjInFine: 0, adjOutFine: 0 };
  });
  var pb = {};
  function P(id) { return pb[id] || (pb[id] = { cash: 0, silver: 0, gold: 0 }); }
  function money2(mode, dir, amt) { cash[dir] += amt; }
  D.bills.forEach(function (b) {
    if (upto && b.date > upto) return;
    b.lines.forEach(function (l) {
      var s = st[l.item];
      if (b.type === 'buy') { s.buy += l.weight; s.buyFine += l.fine; } else { s.sell += l.weight; s.sellFine += l.fine; }
    });
    if (b.type === 'sell') money2(b.mode, 'in', b.paid); else money2(b.mode, 'out', b.paid);
    if (b.partyId) P(b.partyId).cash += (b.type === 'sell' ? 1 : -1) * (b.total - b.paid);
  });
  D.entries.forEach(function (e) {
    if (upto && e.date > upto) return;
    var acct = acctOfItem(e.item), q = num(e.qty);
    switch (e.kind) {
      case 'baki': P(e.partyId)[acct] += q; break;
      case 'jama': P(e.partyId)[acct] -= q; break;
      case 'recv': P(e.partyId)[acct] -= q; break;
      case 'pay': P(e.partyId)[acct] += q; break;
    }
    if (e.kind === 'recv' || e.kind === 'pay' || e.kind === 'cashin' || e.kind === 'cashout' || e.kind === 'stockin' || e.kind === 'stockout') {
      var dirIn = e.kind === 'recv' || e.kind === 'cashin' || e.kind === 'stockin';
      if (e.item === 'cash') money2(e.mode, dirIn ? 'in' : 'out', q);
      else {
        var s = st[e.item];
        if (dirIn) { s.adjIn += num(e.weight); s.adjInFine += q; } else { s.adjOut += num(e.weight); s.adjOutFine += q; }
      }
    }
  });
  ALL_KEYS.forEach(function (k) {
    var s = st[k];
    s.close = r3(s.open + s.buy - s.sell + s.adjIn - s.adjOut);
    s.closeFine = r3(s.openFine + s.buyFine - s.sellFine + s.adjInFine - s.adjOutFine);
  });
  cash.close = cash.open + cash.in - cash.out;
  bank.close = bank.open + bank.in - bank.out;
  var metal = { silver: 0, gold: 0 };
  ALL_KEYS.forEach(function (k) { if (D.settings.stockItems[k] !== false) metal[ITEMS[k].metal] += st[k].closeFine; });
  return { stock: st, cash: cash, bank: bank, party: pb, metal: metal };
}

function registerRows(item, type, from, to) {
  var rows = [];
  D.bills.forEach(function (b) {
    if (b.type !== type || !inRange(b.date, from, to)) return;
    b.lines.forEach(function (l, i) { if (l.item === item) rows.push({ b: b, l: l, i: i }); });
  });
  rows.sort(function (x, y) { return (x.b.date + x.b.time).localeCompare(y.b.date + y.b.time); });
  return rows;
}
function ratioOf(rows, item) {
  var t = ITEMS[item], q = 0, a = 0;
  rows.forEach(function (r) { q += t.touch ? r.l.fine : r.l.weight; a += r.l.amount; });
  return { qty: r3(q), amt: a, avg: q ? a / q * ratePer(t.metal) : 0 };
}

/* ---------- navigation ---------- */
var stack = [];
var cur = null;
var TITLES = { users: 'Staff logins', sauda: 'Sauda · Silver / Gold', entry: 'Received / Given', home: 'Bullion Book', registers: 'Registers', newbill: 'New Bill', baki: 'Baki / Jama', more: 'More', bill: 'Bill', party: 'Party Ledger', stock: 'Stock', settings: 'Settings', parties: 'Parties', daybook: 'Day Book', backup: 'Backup & Excel', printer: 'Printer' };
var TOP = ['home', 'registers', 'newbill', 'baki', 'more'];

function nav(route, arg) { stack = [{ r: route, a: arg }]; show(); }
function go(route, arg) { stack.push({ r: route, a: arg }); show(); }
function back() {
  if (!$('modal').classList.contains('hidden')) { closeModal(); return true; }
  if (stack.length > 1) { stack.pop(); show(); return true; }
  if (stack.length && stack[0].r !== 'home') { nav('home'); return true; }
  return false;
}
window.handleBack = back;
function show() {
  cur = stack[stack.length - 1];
  $('title').textContent = (cur.r === 'newbill' && cur.a) ? 'Edit Bill' : (TITLES[cur.r] || 'Bullion Book');
  $('backBtn').classList.toggle('hidden', stack.length < 2 && cur.r === 'home');
  $('topActions').innerHTML = '';
  var root = stack[0].r;
  Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) { b.classList.toggle('on', b.getAttribute('data-r') === root); });
  var fn = V[cur.r] || V.home;
  $('main').innerHTML = fn(cur.a) || '';
  if (V[cur.r + '_after']) V[cur.r + '_after'](cur.a);
  window.scrollTo(0, 0);
}
function openModal(html) { $('sheet').innerHTML = html; $('modal').classList.remove('hidden'); }
function closeModal() { $('modal').classList.add('hidden'); $('sheet').innerHTML = ''; }
$('modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
function topAction(label, fn) {
  var b = document.createElement('button'); b.textContent = label; b.onclick = fn; $('topActions').appendChild(b);
}

/* ---------- views ---------- */
var V = {};

V.home = function () {
  var c = compute(), t = today();
  var todays = D.bills.filter(function (b) { return b.date === t; });
  var sold = 0, bought = 0;
  todays.forEach(function (b) { if (b.type === 'sell') sold += b.total; else bought += b.total; });
  var baki = { cash: 0, silver: 0, gold: 0 }, jama = { cash: 0, silver: 0, gold: 0 };
  Object.keys(c.party).forEach(function (id) { ACCTS.forEach(function (a) { var v = c.party[id][a]; if (v > 0.0005) baki[a] += v; else if (v < -0.0005) jama[a] -= v; }); });
  function metalLine(o) { var p = []; if (o.silver > 0.0005) p.push('Silver ' + w(o.silver, 'silver')); if (o.gold > 0.0005) p.push('Gold ' + w(o.gold, 'gold')); return p.join(' · '); }
  var h = '<div class="big4">';
  h += '<button class="sellb" onclick="App.newBill(\'sell\')"><span>&#8593;</span>Sell</button>';
  h += '<button class="buyb" onclick="App.newBill(\'buy\')"><span>&#8595;</span>Buy</button>';
  h += '<button onclick="App.go(\'entry\',{kind:\'recv\'})"><span>&#8601;</span>Received</button>';
  h += '<button onclick="App.go(\'entry\',{kind:\'pay\'})"><span>&#8599;</span>Given</button>';
  h += '</div>';
  h += '<div class="grid" style="margin-bottom:12px">';
  h += tile('Cash in hand', money(c.cash.close), '');
  h += tile('Silver stock', w(c.metal.silver, 'silver'), '', 'silver');
  h += tile('Gold stock', w(c.metal.gold, 'gold'), '', 'gold');
  h += tile('Today', 'Sold ' + money(sold), 'Bought ' + money(bought));
  h += '<div class="tile click" onclick="App.nav(\'baki\')"><div class="k baki">To receive (Baki)</div><div class="v baki">' + money(baki.cash) + '</div><div class="s">' + metalLine(baki) + '</div></div>';
  h += '<div class="tile click" onclick="App.setBJ({tab:\'jama\'});App.nav(\'baki\')"><div class="k jama">To pay (Jama)</div><div class="v jama">' + money(jama.cash) + '</div><div class="s">' + metalLine(jama) + '</div></div>';
  h += '</div>';
  h += '<div class="btns" style="margin-bottom:12px"><button class="btn gold" style="flex:1" onclick="App.setDB(\'\');App.go(\'daybook\')">Today\'s hisab (Day Book)</button><button class="btn" onclick="App.setDB(\'\');App.waDay()">WhatsApp</button></div>';
  h += '<div class="card"><h2>Stock by item</h2><div class="tw"><table class="t"><thead><tr><th>Item</th><th class="n">Closing</th><th class="n">Fine</th><th class="n">Buy ratio</th><th class="n">Sell ratio</th></tr></thead><tbody>';
  shownKeys().forEach(function (k) {
    var it = ITEMS[k], s = c.stock[k], rb = ratioOf(registerRows(k, 'buy'), k), rs = ratioOf(registerRows(k, 'sell'), k);
    h += '<tr class="click" onclick="App.go(\'registers\',\'' + k + '\')"><td>' + it.name + '</td><td class="n">' + w(s.close, it.metal) + '</td><td class="n">' + (it.touch ? w(s.closeFine) : '') + '</td><td class="n">' + (rb.avg ? inr(rb.avg) : '-') + '</td><td class="n">' + (rs.avg ? inr(rs.avg) : '-') + '</td></tr>';
  });
  h += '<tr class="click" onclick="App.go(\'stock\')"><td><b>Cash in hand</b></td><td class="n"><b>' + money(c.cash.close) + '</b></td><td></td><td class="n" colspan="2"><small class="muted">In ' + money(c.cash.in) + ' · Out ' + money(c.cash.out) + '</small></td></tr>';
  h += '</tbody></table></div></div>';
  h += '<div class="card"><h2>Recent bills</h2>' + billList(D.bills.slice().sort(byNewest).slice(0, 10)) + '</div>';
  return h;
};
function tile(k, v, s, cls) { return '<div class="tile ' + (cls || '') + '"><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>'; }
function byNewest(a, b) { return (b.date + b.time + (b.createdAt || '')).localeCompare(a.date + a.time + (a.createdAt || '')); }
function billList(bills) {
  if (!bills.length) return '<div class="empty">No bills yet. Tap <b>+ New Bill</b> to make one.</div>';
  return '<div class="list">' + bills.map(function (b) {
    var items = b.lines.map(function (l) { return ITEMS[l.item].short + ' ' + w(l.weight); }).join(', ');
    return '<div class="it click" onclick="App.go(\'bill\',\'' + b.id + '\')"><div class="l"><b>' + esc(b.partyName || 'Cash') + '</b><small><span class="pill ' + b.type + '">' + (b.type === 'sell' ? 'SALE' : 'BUY') + '</span> ' + esc(b.no) + ' · ' + fd(b.date) + ' ' + esc(b.time || '') + ' · ' + esc(items) + '</small></div><div class="r"><b>' + money(b.total) + '</b>' + (Math.abs(b.due) >= 1 ? '<br><small class="' + (b.type === 'sell' ? 'baki' : 'jama') + '">due ' + money(b.due) + '</small>' : '') + '</div></div>';
  }).join('') + '</div>';
}

/* ----- registers (mirrors Buy Sell / Silver / Rupa / Gold / Kaccha sheets) ----- */
var regState = { item: 'silver', range: 'month', from: '', to: '' };
function rangeDates(st) {
  var t = today(), d = new Date();
  if (st.range === 'today') return [t, t];
  if (st.range === 'month') return [d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-01', t];
  if (st.range === 'custom') return [st.from, st.to];
  return ['', ''];
}
function rangeBar(st, fnName) {
  var h = '<div class="tabs">';
  [['today', 'Today'], ['month', 'This month'], ['all', 'All'], ['custom', 'Dates…']].forEach(function (r) {
    h += '<button class="' + (st.range === r[0] ? 'on' : '') + '" onclick="App.' + fnName + '({range:\'' + r[0] + '\'})">' + r[1] + '</button>';
  });
  h += '</div>';
  if (st.range === 'custom') h += '<div class="row" style="margin-bottom:10px"><input type="date" value="' + st.from + '" onchange="App.' + fnName + '({from:this.value})"><input type="date" value="' + st.to + '" onchange="App.' + fnName + '({to:this.value})"></div>';
  return h;
}
V.registers = function (item) {
  if (item) regState.item = item;
  var k = regState.item, it = ITEMS[k], rg = rangeDates(regState);
  var h = '<div class="tabs">' + shownKeys().map(function (x) { return '<button class="' + (x === k ? 'on' : '') + '" onclick="App.setReg({item:\'' + x + '\'})">' + ITEMS[x].name + '</button>'; }).join('') + '</div>';
  h += rangeBar(regState, 'setReg');
  var buys = registerRows(k, 'buy', rg[0], rg[1]), sells = registerRows(k, 'sell', rg[0], rg[1]);
  var rb = ratioOf(buys, k), rs = ratioOf(sells, k);
  h += '<div class="ratio"><div class="b">Buy Ratio (avg rate ' + rateLbl(it.metal) + ')<b>' + (rb.avg ? inr(rb.avg) : '—') + '</b>Qty ' + w(rb.qty, it.metal) + ' · ' + money(rb.amt) + '</div>';
  h += '<div class="s">Sell Ratio (avg rate ' + rateLbl(it.metal) + ')<b>' + (rs.avg ? inr(rs.avg) : '—') + '</b>Qty ' + w(rs.qty, it.metal) + ' · ' + money(rs.amt) + '</div></div>';
  h += '<div class="two">' + regTable('Buy', 'buyh', buys, k) + regTable('Sell', 'sellh', sells, k) + '</div>';
  h += '<div class="btns"><button class="btn gold" onclick="App.newBill(\'buy\',\'' + k + '\')">+ Buy</button><button class="btn dark" onclick="App.newBill(\'sell\',\'' + k + '\')">+ Sell</button></div>';
  return h;
};
function regTable(title, cls, rows, k) {
  var it = ITEMS[k];
  var h = '<div><h3 class="' + (cls === 'buyh' ? 'jama' : 'baki') + '" style="margin:0 0 6px">' + title + ' (' + rows.length + ')</h3><div class="tw"><table class="t"><thead><tr class="' + cls + '">';
  h += (it.time ? '<th>Time</th>' : '') + '<th>Date</th><th>Name</th><th class="n">' + (it.touch ? 'Weight' : 'Qty') + '</th>' + (it.touch ? '<th class="n">Touch</th><th class="n">Fine</th>' : '') + '<th class="n">Rate</th><th class="n">Total</th></tr></thead><tbody>';
  var tw = 0, tf = 0, ta = 0;
  rows.forEach(function (r) {
    tw += r.l.weight; tf += r.l.fine; ta += r.l.amount;
    h += '<tr class="click" onclick="App.go(\'bill\',\'' + r.b.id + '\')">' + (it.time ? '<td>' + esc(r.b.time) + '</td>' : '') + '<td>' + fd(r.b.date) + '</td><td>' + esc(r.b.partyName || 'Cash') + '</td><td class="n">' + w(r.l.weight) + '</td>' + (it.touch ? '<td class="n">' + r.l.touch + '</td><td class="n">' + w(r.l.fine) + '</td>' : '') + '<td class="n">' + inr(r.l.rate) + '</td><td class="n">' + inr(r.l.amount) + '</td></tr>';
  });
  if (!rows.length) h += '<tr><td colspan="9" class="empty">No entries</td></tr>';
  h += '</tbody><tfoot><tr>' + (it.time ? '<td></td>' : '') + '<td></td><td>Total</td><td class="n">' + w(tw) + '</td>' + (it.touch ? '<td></td><td class="n">' + w(tf) + '</td>' : '') + '<td></td><td class="n">' + inr(ta) + '</td></tr></tfoot></table></div></div>';
  return h;
}

/* ----- new / edit bill ----- */
var F = null;
V.newbill = function (id) {
  if (id && (!F || F.id !== id)) {
    var b = billById(id); if (!b) return '<div class="empty">Bill not found</div>';
    F = JSON.parse(JSON.stringify(b)); F.paidTouched = true;
    F.phone = (partyById(b.partyId) || {}).phone || '';
  }
  if (!F) newBillState();
  var h = '<div class="seg bs big"><button class="sell ' + (F.type === 'sell' ? 'on' : '') + '" onclick="App.fset(\'type\',\'sell\')">SELL</button><button class="buy ' + (F.type === 'buy' ? 'on' : '') + '" onclick="App.fset(\'type\',\'buy\')">BUY</button></div>';
  h += '<div class="card"><label class="f"><span>Party name <small>(leave blank for cash customer)</small></span><input id="f_party" list="plist" autocomplete="off" value="' + esc(F.partyName) + '" placeholder="Type name" oninput="App.partyHint()"></label>' + partyDatalist();
  h += '<div id="f_phint" class="muted" style="font-size:12px;margin:-6px 0 0"></div></div>';
  h += '<div id="f_lines">' + F.lines.map(lineForm).join('') + '</div>';
  h += '<button class="btn small" style="width:100%;margin-bottom:12px" onclick="App.addLine()">+ Add one more item to this bill</button>';
  h += '<div class="card"><div id="f_sum"></div>';
  h += '<label class="f"><span id="f_paidlbl">' + (F.type === 'sell' ? 'Money received now (₹)' : 'Money paid now (₹)') + '</span><input id="f_paid" class="bigin" type="number" step="any" inputmode="decimal" value="' + esc(F.paid) + '" oninput="App.paidEdit()"></label>';
  h += '<input type="hidden" id="f_mode" value="cash">';
  h += '<div id="f_due" class="sum"></div></div>';
  h += '<div class="btns"><button class="btn gold" onclick="App.saveBill(true)">Save &amp; Print</button><button class="btn dark" onclick="App.saveBill(false)">Save</button></div>';
  h += '<details class="card more"' + (F.note ? ' open' : '') + '><summary>More options (date, mobile, note)</summary><div style="margin-top:10px">';
  h += '<div class="row"><label class="f"><span>Date</span><input type="date" id="f_date" value="' + F.date + '"></label><label class="f"><span>Time</span><input type="time" id="f_time" value="' + esc(F.time) + '"></label></div>';
  h += '<label class="f"><span>Mobile</span><input id="f_phone" inputmode="tel" value="' + esc(F.phone || '') + '"></label>';
  h += '<input type="hidden" id="f_gstrate" value="0"><input type="hidden" id="f_gstinter" value="0"><input type="checkbox" id="f_gst" class="hidden"><div id="f_gstbox" class="hidden"></div>';
  h += '<label class="f"><span>Note</span><input id="f_note" value="' + esc(F.note || '') + '"></label></div></details>';
  return h;
};
V.newbill_after = function () { recalc(); partyHint(); };
function newBillState() { F = { id: null, type: 'sell', date: today(), time: nowTime(), partyName: '', phone: '', lines: [{ item: 'silver', weight: '', touch: '', rate: '' }], gstOn: D.settings.gstOn, gstRate: D.settings.gstRate, gstInter: D.settings.gstInter, paid: '', mode: 'cash', note: '' }; }
function lineForm(l, i) {
  var it = ITEMS[l.item], m = it.metal;
  var h = '<div class="line" id="ln' + i + '"><div class="hd"><b>' + (F.lines.length > 1 ? 'Item ' + (i + 1) : 'Item') + '</b>' + (F.lines.length > 1 ? '<button class="btn small red" onclick="App.delLine(' + i + ')">Remove</button>' : '') + '</div>';
  h += '<div class="chips">' + ITEM_KEYS.map(function (k) { return '<button class="' + (k === l.item ? 'on' : '') + '" onclick="App.lineItem(' + i + ',\'' + k + '\')">' + ITEMS[k].name + '</button>'; }).join('') + '</div>';
  h += '<div class="row"><label class="f"><span>Weight (' + unitOf(m) + ')</span><input class="bigin" type="number" step="any" inputmode="decimal" data-i="' + i + '" data-k="weight" value="' + esc(l.weight) + '" oninput="App.lineIn(this)"></label>';
  if (it.touch) h += '<label class="f"><span>Touch %</span><input class="bigin" type="number" step="any" inputmode="decimal" data-i="' + i + '" data-k="touch" value="' + esc(l.touch) + '" oninput="App.lineIn(this)"></label>';
  h += '</div><label class="f"><span>Rate ' + rateLbl(m) + '</span><input class="bigin" type="number" step="any" inputmode="decimal" data-i="' + i + '" data-k="rate" value="' + esc(l.rate) + '" oninput="App.lineIn(this)"></label>';
  if (it.touch) h += '<div class="sum"><span class="muted">Fine</span><b id="lf' + i + '"></b></div>';
  h += '<div class="sum"><span class="muted">Amount</span><span class="amt" id="la' + i + '"></span></div></div>';
  return h;
}
function readForm() {
  if (!$('f_date')) return;
  F.date = $('f_date').value || today(); F.time = $('f_time').value; F.partyName = $('f_party').value.trim(); F.phone = $('f_phone').value.trim();
  F.gstOn = $('f_gst').checked; F.gstRate = num($('f_gstrate').value); F.gstInter = $('f_gstinter').value === '1';
  F.paid = $('f_paid').value; F.mode = $('f_mode').value; F.note = $('f_note').value;
}
function recalc() {
  readForm();
  var b = billCalc(JSON.parse(JSON.stringify(F)));
  b.lines.forEach(function (l, i) { if ($('la' + i)) $('la' + i).textContent = money(l.amount); if ($('lf' + i)) $('lf' + i).textContent = w(l.fine, ITEMS[l.item].metal); });
  $('f_gstbox').classList.toggle('hidden', !b.gstOn);
  if (!F.paidTouched) { $('f_paid').value = b.total || ''; b.paid = b.total; }
  var s = '';
  if (b.gstOn) s += b.gstInter ? '<div class="sum"><span>IGST ' + b.gstRate + '%</span><span>' + moneyP(b.igst) + '</span></div>' : '<div class="sum"><span>CGST ' + b.gstRate / 2 + '%</span><span>' + moneyP(b.cgst) + '</span></div><div class="sum"><span>SGST ' + b.gstRate / 2 + '%</span><span>' + moneyP(b.sgst) + '</span></div>';
  if (b.roundOff) s += '<div class="sum muted"><span>Round off</span><span>' + b.roundOff.toFixed(2) + '</span></div>';
  s += '<div class="sum big"><span>Total</span><span>' + money(b.total) + '</span></div>';
  $('f_sum').innerHTML = s;
  var due = b.total - num($('f_paid').value);
  $('f_due').innerHTML = Math.abs(due) >= 1 ? '<span>' + (F.type === 'sell' ? 'Pending: goes to party Baki' : 'Pending: goes to party Jama') + '</span><b class="' + (F.type === 'sell' ? 'baki' : 'jama') + '">' + money(due) + '</b>' : '';
}
function partyHint() {
  var p = partyByName($('f_party').value), hEl = $('f_phint');
  if (!p) { hEl.textContent = $('f_party').value.trim() ? 'New party will be added' : ''; return; }
  if (!$('f_phone').value && p.phone) $('f_phone').value = p.phone;
  var c = compute().party[p.id];
  hEl.innerHTML = c ? balanceText(c) : 'No balance';
}
function balanceText(c) {
  var parts = [];
  ACCTS.forEach(function (a) { var v = c[a]; if (Math.abs(v) > 0.0005) parts.push('<span class="' + (v > 0 ? 'baki' : 'jama') + '">' + acctLabel(a) + ' ' + (v > 0 ? 'Baki ' : 'Jama ') + fmtAcct(a, Math.abs(v)) + '</span>'); });
  return parts.length ? parts.join(' · ') : 'Settled';
}
function saveBill(print) {
  readForm();
  var lines = F.lines.filter(function (l) { return num(l.weight) > 0; });
  if (!lines.length) { toast('Enter weight / quantity'); return; }
  for (var i = 0; i < lines.length; i++) { if (ITEMS[lines[i].item].touch && !num(lines[i].touch)) { toast('Enter touch for ' + ITEMS[lines[i].item].name); return; } }
  var p = F.partyName ? ensureParty(F.partyName, F.phone) : null;
  var b = { id: F.id || uid(), type: F.type, no: F.no, date: F.date, time: F.time, partyId: p ? p.id : '', partyName: p ? p.name : '', lines: lines.map(function (l) { return { item: l.item, weight: l.weight, touch: l.touch, rate: l.rate }; }), gstOn: F.gstOn, gstRate: F.gstRate, gstInter: F.gstInter, paid: F.paid === '' ? 0 : F.paid, mode: F.mode, note: F.note, createdAt: F.createdAt || new Date().toISOString() };
  billCalc(b);
  if (!p && Math.abs(b.due) >= 1) { toast('Enter a party name: this bill has a balance of ' + money(b.due)); return; }
  if (F.id) {
    var old = billById(F.id);
    if (old && old.type !== b.type) b.no = nextNo(b.type);
    D.bills = D.bills.map(function (x) { return x.id === b.id ? b : x; });
  } else {
    b.no = nextNo(b.type);
    D.bills.push(b);
  }
  save();
  F = null;
  toast('Bill ' + b.no + ' saved');
  stack[stack.length - 1] = { r: 'bill', a: b.id };
  show();
  if (print) printBill(b.id);
}
function nextNo(type) { var n = D.seq[type]++; return (type === 'sell' ? D.settings.sellPrefix : D.settings.buyPrefix) + n; }
function billById(id) { for (var i = 0; i < D.bills.length; i++) if (D.bills[i].id === id) return D.bills[i]; return null; }

/* ----- bill view ----- */
V.bill = function (id) {
  var b = billById(id);
  if (!b) return '<div class="empty">Bill not found</div>';
  var h = '<div class="card"><div class="sum"><span><span class="pill ' + b.type + '">' + (b.type === 'sell' ? 'SALE' : 'PURCHASE') + '</span> <b>' + esc(b.no) + '</b></span><span>' + fd(b.date) + ' ' + esc(b.time) + '</span></div>';
  h += '<div class="sum"><span>Party</span><b>' + (b.partyId ? '<a href="#" onclick="App.go(\'party\',\'' + b.partyId + '\');return false">' + esc(b.partyName) + '</a>' : 'Cash') + '</b></div>';
  h += '<div class="tw" style="margin:8px 0"><table class="t"><thead><tr><th>Item</th><th class="n">Wt</th><th class="n">Touch</th><th class="n">Fine</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead><tbody>';
  b.lines.forEach(function (l) { var it = ITEMS[l.item]; h += '<tr><td>' + it.name + '</td><td class="n">' + w(l.weight) + '</td><td class="n">' + (it.touch ? l.touch : '') + '</td><td class="n">' + (it.touch ? w(l.fine) : '') + '</td><td class="n">' + inr(l.rate) + '</td><td class="n">' + inr(l.amount) + '</td></tr>'; });
  h += '</tbody></table></div>';
  if (b.gstOn) h += '<div class="sum"><span>GST ' + b.gstRate + '%</span><span>' + moneyP(b.cgst + b.sgst + b.igst) + '</span></div>';
  h += '<div class="sum big"><span>Total</span><span>' + money(b.total) + '</span></div>';
  h += '<div class="sum"><span>' + (b.type === 'sell' ? 'Received' : 'Paid') + ' (' + 'CASH' + ')</span><span>' + money(b.paid) + '</span></div>';
  if (Math.abs(b.due) >= 1) h += '<div class="sum"><span>Balance</span><b class="' + (b.type === 'sell' ? 'baki' : 'jama') + '">' + money(b.due) + '</b></div>';
  if (b.note) h += '<div class="muted" style="margin-top:6px">Note: ' + esc(b.note) + '</div>';
  h += '</div>';
  h += '<div class="btns"><button class="btn gold" onclick="App.printBill(\'' + b.id + '\')">Print / PDF</button>' + (HAS_APP ? '<button class="btn dark" onclick="App.btPrintBill(\'' + b.id + '\')">Bluetooth print</button>' : '') + '<button class="btn" onclick="App.shareBill(\'' + b.id + '\')">Share</button></div>';
  h += '<div class="btns"><button class="btn" onclick="App.editBill(\'' + b.id + '\')">Edit</button><button class="btn red" onclick="App.delBill(\'' + b.id + '\')">Delete</button></div>';
  h += '<h3>Preview</h3><div class="preview"><iframe id="pv"></iframe></div>';
  return h;
};
V.bill_after = function (id) {
  var b = billById(id); if (!b) return;
  var f = $('pv'), paper = D.settings.paper, wide = !(paper === '58' || paper === '80');
  f.srcdoc = billHtml(b, paper === 'ask' ? '80' : paper);
  f.onload = function () {
    try {
      var hgt = f.contentDocument.body.scrollHeight + 30;
      if (wide && paper !== 'ask') {
        var box = f.parentNode.clientWidth - 16, scale = Math.min(1, box / 760);
        f.style.width = '760px'; f.style.height = hgt + 'px'; f.style.transform = 'scale(' + scale + ')'; f.style.transformOrigin = '0 0';
        f.parentNode.style.height = (hgt * scale + 16) + 'px'; f.parentNode.style.overflow = 'hidden';
      } else f.style.height = hgt + 'px';
    } catch (e) {}
  };
};
function editBill(id) { F = null; stack[stack.length - 1] = { r: 'newbill', a: id }; show(); }
function delBill(id) {
  var b = billById(id);
  if (!confirm('Delete bill ' + b.no + '? This cannot be undone.')) return;
  D.bills = D.bills.filter(function (x) { return x.id !== id; }); save(); toast('Deleted'); back();
}

/* ---------- printing ---------- */
function billHtml(b, paper) {
  var S = D.settings, thermal = paper === '58' || paper === '80';
  var width = paper === '58' ? '54mm' : paper === '80' ? '74mm' : '190mm';
  var party = partyById(b.partyId) || {};
  var title = b.type === 'sell' ? (b.gstOn ? 'TAX INVOICE' : 'SALE BILL') : 'PURCHASE BILL';
  var css = '@page{size:' + (thermal ? (paper === '58' ? '58mm' : '80mm') + ' auto' : (paper === 'a5' ? 'A5' : 'A4')) + ';margin:' + (thermal ? '2mm' : '10mm') + '}' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0 auto;width:' + width + ';font-size:' + (thermal ? (paper === '58' ? '10px' : '11.5px') : '12.5px') + '}' +
    'h1{font-size:' + (thermal ? '15px' : '22px') + ';margin:0}.c{text-align:center}.r{text-align:right}table{width:100%;border-collapse:collapse}' +
    'th,td{padding:' + (thermal ? '2px 1px' : '5px 6px') + ';vertical-align:top}' +
    (thermal ? 'th{border-bottom:1px dashed #000;text-align:left}.hr{border-top:1px dashed #000;margin:4px 0}' : 'th,td.b{border:1px solid #555}th{background:#f1e7cf;text-align:left}.hr{border-top:1px solid #000;margin:8px 0}.box{border:1px solid #555;padding:8px}') +
    '.tot td{font-weight:bold}.big{font-size:' + (thermal ? '13px' : '16px') + ';font-weight:bold}.muted{color:#444}.ttl{font-weight:bold;letter-spacing:1px}';
  var h = '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head><body>';
  h += '<div class="c"><h1>' + esc(S.shopName) + '</h1>' + (S.tagline ? '<div>' + esc(S.tagline) + '</div>' : '') + (S.address ? '<div>' + esc(S.address).replace(/\n/g, '<br>') + '</div>' : '') + (S.phone ? '<div>Ph: ' + esc(S.phone) + '</div>' : '') + '</div>';
  h += '<div class="hr"></div><div class="c ttl">' + title + '</div>';
  if (thermal) {
    h += '<table><tr><td>No: <b>' + esc(b.no) + '</b></td><td class="r">' + fd(b.date) + ' ' + esc(b.time) + '</td></tr></table>';
    h += '<div>' + (b.type === 'sell' ? 'To' : 'From') + ': <b>' + esc(b.partyName || 'Cash') + '</b>' + (party.phone ? ' (' + esc(party.phone) + ')' : '') + '</div><div class="hr"></div>';
    h += '<table><tr><th>Item</th><th class="r">Wt</th><th class="r">Rate</th><th class="r">Amt</th></tr>';
    b.lines.forEach(function (l) {
      var it = ITEMS[l.item];
      h += '<tr><td>' + it.name + (it.touch ? '<br><span class="muted">T ' + l.touch + '% F ' + w(l.fine) + '</span>' : '') + '</td><td class="r">' + w(l.weight) + '<br><span class="muted">' + unitOf(it.metal) + '</span></td><td class="r">' + inr(l.rate) + '</td><td class="r">' + inr(l.amount) + '</td></tr>';
    });
    h += '</table><div class="hr"></div><table>';
  } else {
    h += '<table style="margin:8px 0"><tr><td class="box" style="width:55%"><div class="muted">' + (b.type === 'sell' ? 'Billed to' : 'Purchased from') + '</div><b>' + esc(b.partyName || 'Cash') + '</b>' + (party.address ? '<br>' + esc(party.address) : '') + (party.phone ? '<br>Ph: ' + esc(party.phone) : '') + '</td>';
    h += '<td class="box"><div>Bill No: <b>' + esc(b.no) + '</b></div><div>Date: ' + fd(b.date) + ' ' + esc(b.time) + '</div>' + (b.gstOn ? '<div>Place of supply: ' + (b.gstInter ? 'Inter-state' : 'Intra-state') + '</div>' : '') + '</td></tr></table>';
    h += '<table><tr><th>#</th><th>Description</th><th class="r">Weight</th><th class="r">Touch</th><th class="r">Fine</th><th class="r">Rate</th><th class="r">Amount (₹)</th></tr>';
    b.lines.forEach(function (l, i) {
      var it = ITEMS[l.item];
      h += '<tr><td class="b">' + (i + 1) + '</td><td class="b">' + it.name + '</td><td class="b r">' + w(l.weight, it.metal) + '</td><td class="b r">' + (it.touch ? l.touch + '%' : '') + '</td><td class="b r">' + (it.touch ? w(l.fine) : '') + '</td><td class="b r">' + inr(l.rate) + '<br><small>' + rateLbl(it.metal) + '</small></td><td class="b r">' + inr(l.amount, 2) + '</td></tr>';
    });
    h += '</table><table style="margin-top:8px"><tr><td style="width:55%" class="muted">Amount in words:<br><b>Rupees ' + amountWords(b.total) + ' Only</b></td><td><table>';
  }
  if (b.gstOn) {
    if (b.gstInter) h += '<tr><td>IGST ' + b.gstRate + '%</td><td class="r">' + inr(b.igst, 2) + '</td></tr>';
    else h += '<tr><td>CGST ' + b.gstRate / 2 + '%</td><td class="r">' + inr(b.cgst, 2) + '</td></tr><tr><td>SGST ' + b.gstRate / 2 + '%</td><td class="r">' + inr(b.sgst, 2) + '</td></tr>';
  }
  if (b.roundOff) h += '<tr><td>Round off</td><td class="r">' + b.roundOff.toFixed(2) + '</td></tr>';
  h += '<tr class="big"><td>TOTAL</td><td class="r">₹' + inr(b.total) + '</td></tr>';
  h += '<tr><td>' + (b.type === 'sell' ? 'Received' : 'Paid') + ' (' + 'CASH' + ')</td><td class="r">' + inr(b.paid) + '</td></tr>';
  if (Math.abs(b.due) >= 1) h += '<tr class="tot"><td>Balance</td><td class="r">' + inr(b.due) + '</td></tr>';
  if (thermal) {
    h += '</table>';
    if (b.partyId) { var c = compute().party[b.partyId]; if (c) h += '<div class="hr"></div><div class="muted">Party balance: ' + balancePlain(c) + '</div>'; }
    if (b.note) h += '<div class="muted">Note: ' + esc(b.note) + '</div>';
    h += '<div class="hr"></div><div class="c">' + esc(S.footer) + '</div><br>';
  } else {
    h += '</table></td></tr></table>';
    if (b.partyId) { var c2 = compute().party[b.partyId]; if (c2) h += '<div class="muted" style="margin-top:6px">Party balance after this bill: ' + balancePlain(c2) + '</div>'; }
    if (b.note) h += '<div style="margin-top:6px">Note: ' + esc(b.note) + '</div>';
    h += '<table style="margin-top:40px"><tr><td class="muted" style="width:60%">' + esc(S.terms) + '<br>' + esc(S.footer) + '</td><td class="r">For <b>' + esc(S.shopName) + '</b><br><br><br>Authorised Signatory</td></tr></table>';
  }
  return h + '</body></html>';
}
function balancePlain(c) {
  var p = [];
  ACCTS.forEach(function (a) { var v = c[a]; if (Math.abs(v) > 0.0005) p.push(acctLabel(a) + ' ' + (v > 0 ? 'Baki ' : 'Jama ') + (a === 'cash' ? 'Rs.' + inr(Math.abs(v)) : w(Math.abs(v), a))); });
  return p.length ? p.join(', ') : 'Settled';
}
function printHtml(html, job, paper) {
  if (HAS_APP) { Android.printHtml(html, job, paper); return; }
  var f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.srcdoc = html;
  f.onload = function () { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(function () { f.remove(); }, 2000); };
}
function printBill(id, paper) {
  var b = billById(id);
  paper = paper || D.settings.paper;
  if (!paper || paper === 'ask') {
    openModal('<h3>Print size</h3><div class="btns"><button class="btn" onclick="App.closeModal();App.printBill(\'' + id + '\',\'58\')">2 inch (58mm)</button><button class="btn" onclick="App.closeModal();App.printBill(\'' + id + '\',\'80\')">3 inch (80mm)</button><button class="btn" onclick="App.closeModal();App.printBill(\'' + id + '\',\'a4\')">A4 / PDF</button></div>');
    return;
  }
  printHtml(billHtml(b, paper), 'Bill ' + b.no, paper);
}

/* ESC/POS for Bluetooth thermal printers */
function escpos(lines) {
  var out = [0x1b, 0x40];
  lines.forEach(function (ln) {
    var t = typeof ln === 'string' ? { t: ln } : ln;
    out.push(0x1b, 0x61, t.c ? 1 : 0);
    out.push(0x1b, 0x45, t.b ? 1 : 0);
    out.push(0x1d, 0x21, t.big ? 0x11 : 0);
    var s = String(t.t).replace(/₹/g, 'Rs.');
    for (var i = 0; i < s.length; i++) { var code = s.charCodeAt(i); out.push(code < 128 ? code : 63); }
    out.push(0x0a);
  });
  out.push(0x1d, 0x21, 0, 0x1b, 0x45, 0, 0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00);
  var bin = ''; out.forEach(function (c) { bin += String.fromCharCode(c); });
  return btoa(bin);
}
function lr(l, r, W) { l = String(l); r = String(r); var sp = W - l.length - r.length; if (sp < 1) { l = l.slice(0, W - r.length - 1); sp = 1; } return l + new Array(sp + 1).join(' ') + r; }
function billText(b, W) {
  var S = D.settings, L = [], dash = new Array(W + 1).join('-');
  L.push({ t: S.shopName, c: 1, b: 1, big: W >= 32 && S.shopName.length <= W / 2 });
  if (S.address) S.address.split('\n').forEach(function (a) { L.push({ t: a, c: 1 }); });
  if (S.phone) L.push({ t: 'Ph: ' + S.phone, c: 1 });
  L.push(dash);
  L.push({ t: b.type === 'sell' ? (b.gstOn ? 'TAX INVOICE' : 'SALE BILL') : 'PURCHASE BILL', c: 1, b: 1 });
  L.push(lr('No: ' + b.no, fd(b.date) + ' ' + (b.time || ''), W));
  L.push((b.type === 'sell' ? 'To: ' : 'From: ') + (b.partyName || 'Cash'));
  L.push(dash);
  b.lines.forEach(function (l) {
    var it = ITEMS[l.item];
    L.push({ t: it.name, b: 1 });
    if (it.touch) L.push(lr(' Wt ' + w(l.weight) + ' T ' + l.touch + '%', 'Fine ' + w(l.fine), W));
    L.push(lr(' ' + (it.touch ? w(l.fine) : w(l.weight)) + ' ' + unitOf(it.metal) + ' x ' + inr(l.rate), inr(l.amount), W));
  });
  L.push(dash);
  if (b.gstOn) {
    if (b.gstInter) L.push(lr('IGST ' + b.gstRate + '%', inr(b.igst, 2), W));
    else { L.push(lr('CGST ' + b.gstRate / 2 + '%', inr(b.cgst, 2), W)); L.push(lr('SGST ' + b.gstRate / 2 + '%', inr(b.sgst, 2), W)); }
  }
  if (b.roundOff) L.push(lr('Round off', b.roundOff.toFixed(2), W));
  L.push({ t: lr('TOTAL', 'Rs.' + inr(b.total), W), b: 1 });
  L.push(lr(b.type === 'sell' ? 'Received' : 'Paid', inr(b.paid), W));
  if (Math.abs(b.due) >= 1) L.push({ t: lr('Balance', inr(b.due), W), b: 1 });
  if (b.partyId) { var c = compute().party[b.partyId]; if (c) { L.push(dash); L.push('Party bal: ' + balancePlain(c)); } }
  L.push(dash);
  if (S.footer) L.push({ t: S.footer, c: 1 });
  return L;
}
var btPending = null;
function btPrintBill(id) {
  var S = D.settings, b = billById(id);
  if (!S.btPrinter) { toast('Choose your Bluetooth printer first'); btPending = id; go('printer'); return; }
  toast('Printing on ' + (S.btName || 'printer') + '…');
  Android.btPrint(S.btPrinter, escpos(billText(b, num(S.btWidth) || 32)));
}
function shareBill(id) {
  var b = billById(id), S = D.settings;
  var t = S.shopName + '\n' + (b.type === 'sell' ? 'Sale' : 'Purchase') + ' bill ' + b.no + ' · ' + fd(b.date) + '\n' + (b.partyName || 'Cash') + '\n';
  b.lines.forEach(function (l) { var it = ITEMS[l.item]; t += it.name + ': ' + w(l.weight, it.metal) + (it.touch ? ' @' + l.touch + '% = ' + w(l.fine, it.metal) + ' fine' : '') + ' x ' + inr(l.rate) + ' = Rs.' + inr(l.amount) + '\n'; });
  if (b.gstOn) t += 'GST ' + b.gstRate + '%: Rs.' + inr(b.cgst + b.sgst + b.igst, 2) + '\n';
  t += 'Total: Rs.' + inr(b.total) + '\n' + (b.type === 'sell' ? 'Received' : 'Paid') + ': Rs.' + inr(b.paid);
  if (Math.abs(b.due) >= 1) t += '\nBalance: Rs.' + inr(b.due);
  shareText(t);
}
function shareText(t) {
  if (HAS_APP) Android.shareText(t);
  else if (navigator.share) navigator.share({ text: t }).catch(function () {});
  else { try { navigator.clipboard.writeText(t); toast('Copied to clipboard'); } catch (e) { alert(t); } }
}

/* ----- Baki / Jama ----- */
var bjState = { tab: 'baki', acct: 'all', q: '' };
V.baki = function () {
  var c = compute(), h = '';
  var baki = { cash: 0, silver: 0, gold: 0 }, jama = { cash: 0, silver: 0, gold: 0 };
  Object.keys(c.party).forEach(function (id) { ACCTS.forEach(function (a) { var v = c.party[id][a]; if (v > 0.0005) baki[a] += v; else if (v < -0.0005) jama[a] -= v; }); });
  h += '<div class="grid" style="margin-bottom:12px">';
  h += tile('<span class="baki">Baki (to receive)</span>', '<span class="baki">' + money(baki.cash) + '</span>', 'Silver ' + w(baki.silver, 'silver') + ' · Gold ' + w(baki.gold, 'gold'));
  h += tile('<span class="jama">Jama (to pay)</span>', '<span class="jama">' + money(jama.cash) + '</span>', 'Silver ' + w(jama.silver, 'silver') + ' · Gold ' + w(jama.gold, 'gold'));
  h += '</div>';
  h += '<div class="seg"><button class="' + (bjState.tab === 'baki' ? 'on' : '') + '" onclick="App.setBJ({tab:\'baki\'})">Baki (to receive)</button><button class="' + (bjState.tab === 'jama' ? 'on' : '') + '" onclick="App.setBJ({tab:\'jama\'})">Jama (to pay)</button><button class="' + (bjState.tab === 'all' ? 'on' : '') + '" onclick="App.setBJ({tab:\'all\'})">All</button></div>';
  h += '<input placeholder="Search party" value="' + esc(bjState.q) + '" oninput="App.bjSearch(this.value)" style="margin-bottom:10px">';
  h += '<div class="card" id="bjlist">' + bjList(c) + '</div>';
  h += '<button class="fab" onclick="App.go(\'entry\',{kind:\'' + (bjState.tab === 'jama' ? 'jama' : 'baki') + '\'})">+ Entry</button>';
  return h;
};
function bjList(c) {
  c = c || compute();
  var q = bjState.q.toLowerCase();
  var rows = D.parties.filter(function (p) {
    if (q && p.name.toLowerCase().indexOf(q) < 0) return false;
    var b = c.party[p.id]; if (!b) return bjState.tab === 'all' && !!q;
    var accts = bjState.acct === 'all' ? ACCTS : [bjState.acct];
    return accts.some(function (a) { var v = b[a]; return bjState.tab === 'baki' ? v > 0.0005 : bjState.tab === 'jama' ? v < -0.0005 : Math.abs(v) > 0.0005 || !!q; });
  }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  if (!rows.length) return '<div class="empty">Nothing pending here.</div>';
  return '<div class="list">' + rows.map(function (p) {
    var b = c.party[p.id] || { cash: 0, silver: 0, gold: 0 };
    var r = ACCTS.filter(function (a) { return Math.abs(b[a]) > 0.0005; }).map(function (a) { return '<div class="' + (b[a] > 0 ? 'baki' : 'jama') + '">' + acctLabel(a) + ' ' + fmtAcct(a, Math.abs(b[a])) + ' ' + (b[a] > 0 ? 'Baki' : 'Jama') + '</div>'; }).join('') || '<div class="muted">Settled</div>';
    return '<div class="it click" onclick="App.go(\'party\',\'' + p.id + '\')"><div class="l"><b>' + esc(p.name) + '</b><small>' + esc(p.phone || '') + '</small></div><div class="r">' + r + '</div></div>';
  }).join('') + '</div>';
}

/* ----- party ledger ----- */
function partyLedger(pid) {
  var rows = [];
  D.bills.forEach(function (b) {
    if (b.partyId !== pid) return;
    var sgn = b.type === 'sell' ? 1 : -1;
    rows.push({ date: b.date, time: b.time, sortKey: b.date + (b.time || '') + 'b', text: (b.type === 'sell' ? 'Sale ' : 'Purchase ') + b.no + ' (' + money(b.total) + ', ' + (b.type === 'sell' ? 'recd ' : 'paid ') + money(b.paid) + ')', d: { cash: sgn * (b.total - b.paid), silver: 0, gold: 0 }, bill: b.id });
  });
  D.entries.forEach(function (e) {
    if (e.partyId !== pid) return;
    var a = acctOfItem(e.item), q = num(e.qty), d = { cash: 0, silver: 0, gold: 0 }, txt = KIND[e.kind].short;
    if (e.kind === 'baki' || e.kind === 'pay') d[a] = q;
    else if (e.kind === 'jama' || e.kind === 'recv') d[a] = -q;
    if (e.item !== 'cash') txt += ' ' + ITEMS[e.item].name + (num(e.weight) && ITEMS[e.item].touch ? ' ' + w(e.weight) + '@' + e.touch : '');
    if (e.note) txt += ' · ' + e.note;
    rows.push({ date: e.date, sortKey: e.date + (e.time || '') + 'e', text: txt, d: d, entry: e.id });
  });
  rows.sort(function (a, b) { return a.sortKey.localeCompare(b.sortKey); });
  var bal = { cash: 0, silver: 0, gold: 0 };
  rows.forEach(function (r) { ACCTS.forEach(function (a) { bal[a] += r.d[a]; }); r.bal = { cash: bal.cash, silver: bal.silver, gold: bal.gold }; });
  return { rows: rows, bal: bal };
}
V.party = function (pid) {
  var p = partyById(pid); if (!p) return '<div class="empty">Party not found</div>';
  var L = partyLedger(pid), h = '';
  h += '<div class="card"><div class="sum"><b style="font-size:17px">' + esc(p.name) + '</b><button class="btn small" onclick="App.editParty(\'' + pid + '\')">Edit</button></div><div class="muted">' + esc(p.phone || '') + (p.address ? ' · ' + esc(p.address) : '') + '</div>';
  h += '<div class="grid" style="margin-top:10px">' + ACCTS.map(function (a) { var v = L.bal[a]; return tile(acctLabel(a), '<span class="' + (v > 0.0005 ? 'baki' : v < -0.0005 ? 'jama' : '') + '">' + fmtAcct(a, Math.abs(v)) + '</span>', v > 0.0005 ? 'Baki (they owe)' : v < -0.0005 ? 'Jama (we owe)' : 'Settled', a === 'cash' ? '' : a); }).join('') + '</div></div>';
  h += '<div class="btns"><button class="btn gold" onclick="App.go(\'entry\',{kind:\'recv\',partyId:\'' + pid + '\'})">Received</button><button class="btn dark" onclick="App.go(\'entry\',{kind:\'pay\',partyId:\'' + pid + '\'})">Paid / Given</button></div>';
  h += '<div class="btns"><button class="btn" onclick="App.go(\'entry\',{kind:\'baki\',partyId:\'' + pid + '\'})">+ Baki</button><button class="btn" onclick="App.go(\'entry\',{kind:\'jama\',partyId:\'' + pid + '\'})">+ Jama</button><button class="btn" onclick="App.newBillFor(\'' + pid + '\')">+ Bill</button></div>';
  h += '<div class="btns" style="margin-bottom:12px"><button class="btn" onclick="App.printLedger(\'' + pid + '\')">Print statement</button><button class="btn" onclick="App.shareBal(\'' + pid + '\')">Share balance</button></div>';
  h += '<div class="tw"><table class="t"><thead><tr><th>Date</th><th>Details</th><th class="n">Cash</th><th class="n">Silver</th><th class="n">Gold</th></tr></thead><tbody>';
  if (!L.rows.length) h += '<tr><td colspan="5" class="empty">No transactions</td></tr>';
  L.rows.slice().reverse().forEach(function (r) {
    var click = r.bill ? 'App.go(\'bill\',\'' + r.bill + '\')' : 'App.go(\'entry\',{id:\'' + r.entry + '\'})';
    h += '<tr class="click" onclick="' + click + '"><td>' + fd(r.date) + '</td><td style="white-space:normal;min-width:140px">' + esc(r.text) + '</td>' + ACCTS.map(function (a) { var v = r.d[a]; return '<td class="n">' + (Math.abs(v) > 0.0005 ? '<span class="' + (v > 0 ? 'baki' : 'jama') + '">' + (a === 'cash' ? inr(v) : (+v).toFixed(3)) + '</span><br>' : '') + '<small class="muted">' + (a === 'cash' ? inr(r.bal[a]) : r.bal[a].toFixed(3)) + '</small></td>'; }).join('') + '</tr>';
  });
  h += '</tbody></table></div><p class="muted" style="font-size:12px">Red = Baki (party owes shop), green = Jama (shop owes party). Small grey figure is the running balance.</p>';
  return h;
};
function newBillFor(pid) { var p = partyById(pid); newBillState(); F.partyName = p.name; F.phone = p.phone; go('newbill'); }
function editParty(pid) {
  var p = partyById(pid);
  openModal('<h3>Edit party</h3><label class="f"><span>Name</span><input id="pe_n" value="' + esc(p.name) + '"></label><label class="f"><span>Mobile</span><input id="pe_p" inputmode="tel" value="' + esc(p.phone) + '"></label><label class="f"><span>Address</span><input id="pe_a" value="' + esc(p.address) + '"></label><div class="btns"><button class="btn gold" onclick="App.saveParty(\'' + pid + '\')">Save</button><button class="btn red" onclick="App.delParty(\'' + pid + '\')">Delete</button></div>');
}
function saveParty(pid) {
  var p = partyById(pid), n = $('pe_n').value.trim();
  if (!n) { toast('Name required'); return; }
  var other = partyByName(n); if (other && other.id !== pid) { toast('Another party has this name'); return; }
  p.name = n; p.phone = $('pe_p').value.trim(); p.address = $('pe_a').value.trim();
  D.bills.forEach(function (b) { if (b.partyId === pid) b.partyName = n; });
  D.entries.forEach(function (e) { if (e.partyId === pid) e.partyName = n; });
  save(); closeModal(); show();
}
function delParty(pid) {
  var used = D.bills.some(function (b) { return b.partyId === pid; }) || D.entries.some(function (e) { return e.partyId === pid ; });
  if (used) { toast('This party has bills or entries, so it cannot be deleted'); return; }
  if (!confirm('Delete this party?')) return;
  D.parties = D.parties.filter(function (p) { return p.id !== pid; }); save(); closeModal(); back();
}
function shareBal(pid) {
  var p = partyById(pid), L = partyLedger(pid);
  shareText(D.settings.shopName + '\nBalance for ' + p.name + ' as on ' + fd(today()) + ':\n' + balancePlain(L.bal).split(', ').join('\n'));
}
function printLedger(pid) {
  var p = partyById(pid), L = partyLedger(pid), S = D.settings;
  var h = '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:10mm}body{font-family:Arial;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:4px 6px}th{background:#f1e7cf}.r{text-align:right}h1{margin:0;font-size:20px}</style></head><body>';
  h += '<div style="text-align:center"><h1>' + esc(S.shopName) + '</h1>' + esc(S.address) + (S.phone ? ' · Ph ' + esc(S.phone) : '') + '</div><h3>Statement: ' + esc(p.name) + ' (as on ' + fd(today()) + ')</h3>';
  h += '<table><tr><th>Date</th><th>Details</th><th class="r">Cash</th><th class="r">Bal</th><th class="r">Silver</th><th class="r">Bal</th><th class="r">Gold</th><th class="r">Bal</th></tr>';
  L.rows.forEach(function (r) { h += '<tr><td>' + fd(r.date) + '</td><td>' + esc(r.text) + '</td>' + ACCTS.map(function (a) { return '<td class="r">' + (Math.abs(r.d[a]) > 0.0005 ? (a === 'cash' ? inr(r.d[a]) : r.d[a].toFixed(3)) : '') + '</td><td class="r">' + (a === 'cash' ? inr(r.bal[a]) : r.bal[a].toFixed(3)) + '</td>'; }).join('') + '</tr>'; });
  h += '</table><p><b>Closing: ' + balancePlain(L.bal) + '</b></p><p style="color:#555">Positive = Baki (payable by party), negative = Jama (payable by shop).</p></body></html>';
  printHtml(h, 'Statement ' + p.name, 'a4');
}

/* ----- entries: Received / Given / Baki / Jama / Expense / Stock adjust ----- */
var E = null;
var EASY = {
  recv:    ['Received',   'Party gave me cash / silver / gold'],
  pay:     ['Given',      'I gave party cash / silver / gold'],
  baki:    ['Old Baki',   'Party owes me (old balance)'],
  jama:    ['Old Jama',   'I owe party (deposit / old balance)'],
  cashout: ['Expense',    'Shop expense, rent, salary'],
  cashin:  ['Cash added', 'Cash put into the shop'],
  stockin: ['Stock in',   'Add stock without bill'],
  stockout:['Stock out',  'Remove stock without bill']
};
V.entry = function (arg) {
  arg = arg || {};
  if (arg.id) { var ex = D.entries.filter(function (x) { return x.id === arg.id; })[0]; if (!ex) return '<div class="empty">Entry not found</div>'; if (!E || E.id !== arg.id) E = JSON.parse(JSON.stringify(ex)); }
  else if (!E || E._for !== arg) { E = { _for: arg, kind: arg.kind || 'recv', date: today(), partyId: arg.partyId || '', item: 'cash', weight: '', touch: '', qty: '', mode: 'cash', note: '' }; }
  var k = KIND[E.kind];
  var isStock = E.kind === 'stockin' || E.kind === 'stockout';
  var kinds = isStock ? ['stockin', 'stockout'] : ['recv', 'pay', 'baki', 'jama', 'cashout', 'cashin'];
  var h = '<div class="pick">' + kinds.map(function (x) { return '<button class="' + (x === E.kind ? 'on' : '') + '" onclick="App.eset(\'kind\',\'' + x + '\')"><b>' + EASY[x][0] + '</b><small>' + EASY[x][1] + '</small></button>'; }).join('') + '</div>';
  h += '<div class="card">';
  if (k.party) h += '<label class="f"><span>Party name</span><input id="e_party" list="plist" autocomplete="off" value="' + esc(E._party != null ? E._party : ((partyById(E.partyId) || {}).name || '')) + '"></label>' + partyDatalist();
  var cashOnly = E.kind === 'cashin' || E.kind === 'cashout';
  if (isStock && E.item === 'cash') E.item = 'silver';
  if (cashOnly) E.item = 'cash';
  if (!isStock && !cashOnly && ['cash', 'silver', 'gold'].indexOf(E.item) < 0) E.item = 'cash';
  if (!cashOnly) {
    var opts = isStock ? ITEM_KEYS : ['cash', 'silver', 'gold'];
    h += '<div class="chips">' + opts.map(function (x) { return '<button class="' + (x === E.item ? 'on' : '') + '" onclick="App.eset(\'item\',\'' + x + '\')">' + (x === 'cash' ? '₹ Cash' : !isStock ? ITEMS[x].short + ' (' + unitOf(ITEMS[x].metal) + ')' : ITEMS[x].short) + '</button>'; }).join('') + '</div>';
  }
  if (E.item === 'cash') {
    h += '<label class="f"><span>Amount (₹)</span><input id="e_qty" class="bigin" type="number" step="any" inputmode="decimal" value="' + esc(E.qty) + '"></label>';
  } else {
    var it = ITEMS[E.item];
    h += '<div class="row"><label class="f"><span>' + (isStock ? 'Weight' : 'Fine weight') + ' (' + unitOf(it.metal) + ')</span><input id="e_w" class="bigin" type="number" step="any" inputmode="decimal" value="' + esc(E.weight) + '" oninput="App.eFine()"></label>' + (it.touch ? '<label class="f"><span>Touch %</span><input id="e_t" class="bigin" type="number" step="any" inputmode="decimal" value="' + esc(E.touch) + '" oninput="App.eFine()"></label>' : '') + '</div>';
    if (it.touch) h += '<div class="sum"><span class="muted">Fine</span><b id="e_fine"></b></div>';
  }
  h += '<div class="row"><label class="f"><span>Date</span><input type="date" id="e_date" value="' + E.date + '"></label><label class="f"><span>Note</span><input id="e_note" value="' + esc(E.note) + '"></label></div></div>';
  h += '<div class="btns"><button class="btn gold" onclick="App.saveEntry()">Save</button>' + (E.id ? '<button class="btn red" onclick="App.delEntry()">Delete</button>' : '') + '</div>';
  return h;
};
V.entry_after = function () { eFine(); };
function eRead() {
  E.date = $('e_date').value || today();
  if ($('e_party')) E._party = $('e_party').value.trim();
  if ($('e_qty')) E.qty = $('e_qty').value;
  if ($('e_w')) E.weight = $('e_w').value;
  if ($('e_t')) E.touch = $('e_t').value;
  E.note = $('e_note').value;
}
function eFine() {
  if (!$('e_w') || E.item === 'cash') return;
  var it = ITEMS[E.item], wt = num($('e_w').value), t = it.touch ? num($('e_t').value) : 100;
  if ($('e_fine')) $('e_fine').textContent = w(r3(wt * t / 100), it.metal);
}
function eset(k, v) {
  eRead();
  if (E._party) { var p = partyByName(E._party); if (p) E.partyId = p.id; }
  E[k] = v;
  show();
}
function saveEntry() {
  eRead();
  var k = KIND[E.kind];
  var e = { id: E.id || uid(), kind: E.kind, date: E.date, item: E.item, note: E.note, mode: E.item === 'cash' ? (E.mode || 'cash') : '', createdAt: E.createdAt || new Date().toISOString() };
  if (k.party) {
    if (!E._party) { toast('Enter party name'); return; }
    var p = ensureParty(E._party); e.partyId = p.id; e.partyName = p.name;
  }
  if (E.item === 'cash') { e.qty = num(E.qty); }
  else {
    var it = ITEMS[E.item];
    e.weight = num(E.weight); e.touch = it.touch ? num(E.touch) : 100;
    if (it.touch && !e.touch) { toast('Enter touch'); return; }
    e.qty = r3(e.weight * e.touch / 100);
  }
  if (!(e.qty > 0)) { toast('Enter amount / weight'); return; }
  if (E.id) D.entries = D.entries.map(function (x) { return x.id === e.id ? e : x; }); else D.entries.push(e);
  save(); E = null; toast('Saved');
  back();
}
function delEntry() {
  if (!confirm('Delete this entry?')) return;
  var id = E.id; D.entries = D.entries.filter(function (x) { return x.id !== id; }); save(); E = null; toast('Deleted'); back();
}

/* ----- Stock (mirrors Stock sheet) ----- */
V.stock = function () {
  var c = compute(), h = '';
  h += '<div class="grid" style="margin-bottom:12px">' + tile('Cash in hand', money(c.cash.close), 'In ' + money(c.cash.in) + ' · Out ' + money(c.cash.out)) + tile('Silver (fine)', w(c.metal.silver, 'silver'), '', 'silver') + tile('Gold (fine)', w(c.metal.gold, 'gold'), '', 'gold') + '</div>';
  h += '<div class="card"><h2>Stock statement</h2><div class="tw"><table class="t"><thead><tr><th>Item</th><th class="n">Opening</th><th class="n">Buy</th><th class="n">Sell</th><th class="n">Adj in</th><th class="n">Adj out</th><th class="n">Closing</th><th class="n">Fine</th></tr></thead><tbody>';
  shownKeys().forEach(function (k) {
    var s = c.stock[k], it = ITEMS[k];
    h += '<tr class="click" onclick="App.go(\'registers\',\'' + k + '\')"><td>' + it.name + '<br><small class="muted">' + unitOf(it.metal) + (D.settings.stockItems[k] ? '' : ' · not counted') + '</small></td><td class="n">' + w(s.open) + '</td><td class="n jama">' + w(s.buy) + '</td><td class="n baki">' + w(s.sell) + '</td><td class="n">' + w(s.adjIn) + '</td><td class="n">' + w(s.adjOut) + '</td><td class="n"><b>' + w(s.close) + '</b></td><td class="n">' + (it.touch ? w(s.closeFine) : '') + '</td></tr>';
  });
  h += '</tbody></table></div></div>';
  h += '<div class="btns"><button class="btn gold" onclick="App.go(\'entry\',{kind:\'cashin\'})">Cash In</button><button class="btn dark" onclick="App.go(\'entry\',{kind:\'cashout\'})">Cash Out / Expense</button></div>';
  h += '<div class="btns"><button class="btn" onclick="App.go(\'entry\',{kind:\'stockin\'})">Stock In</button><button class="btn" onclick="App.go(\'entry\',{kind:\'stockout\'})">Stock Out</button><button class="btn" onclick="App.go(\'settings\')">Opening stock</button></div>';
  var adj = D.entries.filter(function (e) { return /^(cash|stock)(in|out)$/.test(e.kind); }).sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 30);
  h += '<div class="card" style="margin-top:12px"><h2>Cash &amp; stock entries</h2>' + (adj.length ? '<div class="list">' + adj.map(function (e) { var a = acctOfItem(e.item); return '<div class="it click" onclick="App.go(\'entry\',{id:\'' + e.id + '\'})"><div class="l"><b>' + KIND[e.kind].short + (e.item !== 'cash' ? ' · ' + ITEMS[e.item].name : '') + '</b><small>' + fd(e.date) + (e.note ? ' · ' + esc(e.note) : '') + '</small></div><div class="r ' + (/in$/.test(e.kind) ? 'jama' : 'baki') + '">' + (e.item === 'cash' ? money(e.qty) : w(e.weight, a)) + '</div></div>'; }).join('') + '</div>' : '<div class="empty">None yet</div>') + '</div>';
  return h;
};

/* ----- Day book: each day separate, opening = previous day's closing ----- */
var dbState = { date: today() };
function addDays(d, n) { var x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
function dayData(d) {
  var prev = compute(addDays(d, -1)), cur = compute(d);
  var bills = D.bills.filter(function (b) { return b.date === d; }).sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
  var ents = D.entries.filter(function (e) { return e.date === d; });
  var sold = 0, bought = 0, recd = 0, paid = 0;
  bills.forEach(function (b) { if (b.type === 'sell') { sold += b.total; recd += b.paid; } else { bought += b.total; paid += b.paid; } });
  var rows = shownKeys().map(function (k) {
    var p = prev.stock[k], c = cur.stock[k];
    return { k: k, open: p.close, buy: r3(c.buy - p.buy), sell: r3(c.sell - p.sell), inn: r3(c.adjIn - p.adjIn), out: r3(c.adjOut - p.adjOut), close: c.close, fine: c.closeFine };
  });
  var cash = { open: prev.cash.close, in: cur.cash.in - prev.cash.in, out: cur.cash.out - prev.cash.out, close: cur.cash.close };
  return { d: d, bills: bills, ents: ents, sold: sold, bought: bought, recd: recd, paid: paid, rows: rows, cash: cash, metal: cur.metal };
}
V.daybook = function () {
  var X = dayData(dbState.date), d = X.d, isToday = d === today();
  var h = '<div class="row" style="align-items:center;margin-bottom:12px;gap:8px"><button class="btn small" onclick="App.setDB(\'' + addDays(d, -1) + '\')">&#8592; Prev day</button><input type="date" value="' + d + '" onchange="App.setDB(this.value)" style="flex:1"><button class="btn small" onclick="App.setDB(\'' + addDays(d, 1) + '\')"' + (isToday ? ' disabled' : '') + '>Next day &#8594;</button></div>';
  h += '<p class="muted" style="margin:0 0 10px">' + (isToday ? 'Today' : fd(d)) + ': opening is the closing of ' + fd(addDays(d, -1)) + '</p>';
  h += '<div class="grid" style="margin-bottom:12px">' + tile('Sales', money(X.sold), 'Received ' + money(X.recd)) + tile('Purchases', money(X.bought), 'Paid ' + money(X.paid)) + tile('Cash opening', money(X.cash.open), 'In ' + money(X.cash.in) + ' · Out ' + money(X.cash.out)) + tile('Cash closing', money(X.cash.close), '') + '</div>';
  h += '<div class="card"><h2>Day stock</h2><div class="tw"><table class="t"><thead><tr><th>Item</th><th class="n">Opening</th><th class="n">Buy</th><th class="n">Sell</th><th class="n">In</th><th class="n">Out</th><th class="n">Closing</th><th class="n">Fine</th></tr></thead><tbody>';
  X.rows.forEach(function (r) { var it = ITEMS[r.k]; h += '<tr><td>' + it.name + '<br><small class="muted">' + unitOf(it.metal) + '</small></td><td class="n">' + w(r.open) + '</td><td class="n">' + w(r.buy) + '</td><td class="n">' + w(r.sell) + '</td><td class="n">' + w(r.inn) + '</td><td class="n">' + w(r.out) + '</td><td class="n"><b>' + w(r.close) + '</b></td><td class="n">' + (it.touch ? w(r.fine) : '') + '</td></tr>'; });
  h += '<tr><td><b>Cash</b></td><td class="n">' + inr(X.cash.open) + '</td><td></td><td></td><td class="n">' + inr(X.cash.in) + '</td><td class="n">' + inr(X.cash.out) + '</td><td class="n"><b>' + inr(X.cash.close) + '</b></td><td></td></tr>';
  h += '</tbody></table></div></div>';
  h += '<div class="card"><h2>Bills</h2>' + billList(X.bills.slice().sort(byNewest)) + '</div>';
  h += '<div class="card"><h2>Other entries</h2>' + (X.ents.length ? '<div class="list">' + X.ents.map(function (e) { var a = acctOfItem(e.item); return '<div class="it click" onclick="App.go(\'entry\',{id:\'' + e.id + '\'})"><div class="l"><b>' + KIND[e.kind].short + (e.partyId ? ' · ' + esc((partyById(e.partyId) || {}).name) : '') + '</b><small>' + (e.item === 'cash' ? 'Cash' : ITEMS[e.item].name) + (e.note ? ' · ' + esc(e.note) : '') + '</small></div><div class="r">' + fmtAcct(a, e.qty) + '</div></div>'; }).join('') + '</div>' : '<div class="empty">None</div>') + '</div>';
  h += '<div class="btns"><button class="btn gold" onclick="App.waDay()">Send on WhatsApp</button><button class="btn" onclick="App.printDay()">Print day report</button></div>';
  return h;
};
function dayText(d) {
  var X = dayData(d), S = D.settings, t = '*' + S.shopName + '*\n*Day report ' + fd(d) + '*\n\n';
  t += 'Sales: Rs.' + inr(X.sold) + ' (recd Rs.' + inr(X.recd) + ')\nPurchases: Rs.' + inr(X.bought) + ' (paid Rs.' + inr(X.paid) + ')\n';
  if (X.bills.length) { t += '\n*Bills*\n'; X.bills.forEach(function (b) { t += (b.type === 'sell' ? 'Sale ' : 'Buy ') + b.no + ' ' + (b.partyName || 'Cash') + ': ' + b.lines.map(function (l) { return ITEMS[l.item].short + ' ' + w(l.weight) + ' @' + inr(l.rate); }).join(', ') + ' = Rs.' + inr(b.total) + '\n'; }); }
  if (X.ents.length) { t += '\n*Other entries*\n'; X.ents.forEach(function (e) { t += KIND[e.kind].short + (e.partyId ? ' ' + ((partyById(e.partyId) || {}).name || '') : '') + ': ' + fmtAcct(acctOfItem(e.item), e.qty).replace(/<[^>]*>/g, '').replace('₹', 'Rs.') + (e.note ? ' (' + e.note + ')' : '') + '\n'; }); }
  t += '\n*Stock (opening > closing)*\n';
  X.rows.forEach(function (r) { var it = ITEMS[r.k]; if (Math.abs(r.open) < 0.0005 && Math.abs(r.close) < 0.0005 && !r.buy && !r.sell) return; t += it.name + ': ' + w(r.open) + ' > ' + w(r.close, it.metal) + (r.buy ? ' | buy ' + w(r.buy) : '') + (r.sell ? ' | sell ' + w(r.sell) : '') + (it.touch ? ' | fine ' + w(r.fine) : '') + '\n'; });
  t += 'Cash: Rs.' + inr(X.cash.open) + ' > Rs.' + inr(X.cash.close) + ' (in ' + inr(X.cash.in) + ', out ' + inr(X.cash.out) + ')\n';
  return t;
}
function waDay() {
  var t = dayText(dbState.date), ph = String(D.settings.waNumber || '').replace(/\D/g, '');
  if (ph.length === 10) ph = '91' + ph;
  var url = 'https://wa.me/' + ph + '?text=' + encodeURIComponent(t);
  if (HAS_APP) location.href = url; else window.open(url, '_blank');
}
function printDay() {
  var X = dayData(dbState.date), d = X.d, S = D.settings;
  var h = '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:10mm}body{font-family:Arial;font-size:12px}table{width:100%;border-collapse:collapse;margin-bottom:10px}th,td{border:1px solid #777;padding:4px 6px}th{background:#f1e7cf}.r{text-align:right}</style></head><body><h2 style="margin:0">' + esc(S.shopName) + '</h2><h3>Day report ' + fd(d) + '</h3>';
  h += '<table><tr><th>Time</th><th>No</th><th>Type</th><th>Party</th><th>Items</th><th class="r">Total</th><th class="r">Recd/Paid</th></tr>';
  X.bills.forEach(function (b) { h += '<tr><td>' + esc(b.time) + '</td><td>' + esc(b.no) + '</td><td>' + (b.type === 'sell' ? 'Sale' : 'Purchase') + '</td><td>' + esc(b.partyName || 'Cash') + '</td><td>' + b.lines.map(function (l) { return ITEMS[l.item].short + ' ' + w(l.weight) + ' @' + inr(l.rate); }).join('<br>') + '</td><td class="r">' + inr(b.total) + '</td><td class="r">' + inr(b.paid) + '</td></tr>'; });
  h += '</table><table><tr><th>Item</th><th class="r">Opening</th><th class="r">Buy</th><th class="r">Sell</th><th class="r">In</th><th class="r">Out</th><th class="r">Closing</th><th class="r">Fine</th></tr>';
  X.rows.forEach(function (r) { var it = ITEMS[r.k]; h += '<tr><td>' + it.name + '</td><td class="r">' + w(r.open) + '</td><td class="r">' + w(r.buy) + '</td><td class="r">' + w(r.sell) + '</td><td class="r">' + w(r.inn) + '</td><td class="r">' + w(r.out) + '</td><td class="r">' + w(r.close, it.metal) + '</td><td class="r">' + (it.touch ? w(r.fine) : '') + '</td></tr>'; });
  h += '<tr><td>Cash</td><td class="r">' + inr(X.cash.open) + '</td><td></td><td></td><td class="r">' + inr(X.cash.in) + '</td><td class="r">' + inr(X.cash.out) + '</td><td class="r">' + inr(X.cash.close) + '</td><td></td></tr></table></body></html>';
  printHtml(h, 'Day ' + d, 'a4');
}

/* ----- Sauda: silver / gold kg + rate only, with ratio and received tick ----- */
var sdState = { metal: 'silver', range: 'all', from: '', to: '', show: 'all' };
var sdType = 'buy';
function sdRows(metal, rg) {
  return (D.sauda || []).filter(function (x) { return x.metal === metal && inRange(x.date, rg[0], rg[1]); })
    .sort(function (a, b) { return (b.date + b.time + b.id).localeCompare(a.date + a.time + a.id); });
}
function sdSum(rows, type) {
  var q = 0, a = 0, pq = 0, pa = 0;
  rows.forEach(function (x) { if (x.type !== type) return; q += x.qty; a += x.amount; if (!x.received) { pq += x.qty; pa += x.amount; } });
  return { qty: r3(q), amt: a, avg: q ? a / q : 0, pqty: r3(pq), pamt: pa };
}
V.sauda = function () {
  var m = sdState.metal, rg = rangeDates(sdState);
  var h = '<div class="seg"><button class="' + (m === 'silver' ? 'on' : '') + '" onclick="App.setSD({metal:\'silver\'})">Silver</button><button class="' + (m === 'gold' ? 'on' : '') + '" onclick="App.setSD({metal:\'gold\'})">Gold</button></div>';
  // quick add
  h += '<div class="card"><div class="seg bs"><button class="buy ' + (sdType === 'buy' ? 'on' : '') + '" onclick="App.sdType(\'buy\')">BUY</button><button class="sell ' + (sdType === 'sell' ? 'on' : '') + '" onclick="App.sdType(\'sell\')">SELL</button></div>';
  h += '<label class="f"><span>Name</span><input id="sd_name" list="plist" autocomplete="off" placeholder="Party name">' + partyDatalist() + '</label>';
  h += '<div class="row"><label class="f"><span>Kg</span><input id="sd_qty" class="bigin" type="number" step="any" inputmode="decimal" oninput="App.sdCalc()"></label><label class="f"><span>Rate per kg</span><input id="sd_rate" class="bigin" type="number" step="any" inputmode="decimal" oninput="App.sdCalc()"></label></div>';
  h += '<div class="sum"><span class="muted">Amount</span><b id="sd_amt">₹0</b></div>';
  h += '<label class="chk"><input type="checkbox" id="sd_recd"> Already received</label>';
  h += '<button class="btn gold" style="width:100%" onclick="App.sdAdd()">Add</button></div>';
  h += rangeBar(sdState, 'setSD');
  var rows = sdRows(m, rg), b = sdSum(rows, 'buy'), sl = sdSum(rows, 'sell');
  h += '<div class="ratio"><div class="b">Buy Ratio (per kg)<b>' + (b.avg ? inr(b.avg) : '—') + '</b>' + w(b.qty) + ' kg · ' + money(b.amt) + '</div>';
  h += '<div class="s">Sell Ratio (per kg)<b>' + (sl.avg ? inr(sl.avg) : '—') + '</b>' + w(sl.qty) + ' kg · ' + money(sl.amt) + '</div></div>';
  h += '<div class="grid" style="margin-bottom:12px">' + tile('Net (buy − sell)', w(b.qty - sl.qty) + ' kg', b.avg && sl.avg ? 'Rate diff ' + inr(sl.avg - b.avg) + ' per kg' : '');
  h += tile('<span class="baki">Not received</span>', '<span class="baki">' + money(b.pamt + sl.pamt) + '</span>', 'Buy ' + w(b.pqty) + ' kg · Sell ' + w(sl.pqty) + ' kg') + '</div>';
  h += '<div class="tabs">' + [['all', 'All'], ['pending', 'Not received'], ['done', 'Received']].map(function (x) { return '<button class="' + (sdState.show === x[0] ? 'on' : '') + '" onclick="App.setSD({show:\'' + x[0] + '\'})">' + x[1] + '</button>'; }).join('') + '</div>';
  var list = rows.filter(function (x) { return sdState.show === 'all' || (sdState.show === 'pending' ? !x.received : x.received); });
  h += '<div class="tw"><table class="t"><thead><tr><th>✓</th><th>Date</th><th></th><th>Name</th><th class="n">Kg</th><th class="n">Rate</th><th class="n">Amount</th><th></th></tr></thead><tbody>';
  if (!list.length) h += '<tr><td colspan="8" class="empty">No entries</td></tr>';
  list.forEach(function (x) {
    h += '<tr' + (x.received ? ' style="opacity:.6"' : '') + '><td><input type="checkbox" style="width:24px;height:24px;min-height:24px" ' + (x.received ? 'checked' : '') + ' onchange="App.sdTick(\'' + x.id + '\',this.checked)"></td><td>' + fd(x.date) + '<br><small class="muted">' + esc(x.time) + '</small></td><td><span class="pill ' + x.type + '">' + (x.type === 'buy' ? 'BUY' : 'SELL') + '</span></td><td>' + esc(x.name || '') + '</td><td class="n">' + w(x.qty) + '</td><td class="n">' + inr(x.rate) + '</td><td class="n">' + inr(x.amount) + '</td><td><button class="btn small red" onclick="App.sdDel(\'' + x.id + '\')">✕</button></td></tr>';
  });
  return h + '</tbody></table></div>';
};
function sdCalc() { $('sd_amt').textContent = money(num($('sd_qty').value) * num($('sd_rate').value)); }
function sdAdd() {
  var q = num($('sd_qty').value), r = num($('sd_rate').value);
  if (!(q > 0) || !(r > 0)) { toast('Enter kg and rate'); return; }
  var name = $('sd_name').value.trim();
  if (name) ensureParty(name);
  D.sauda = D.sauda || [];
  D.sauda.push({ id: uid(), date: today(), time: nowTime(), metal: sdState.metal, type: sdType, name: name, qty: r3(q), rate: r, amount: Math.round(q * r), received: $('sd_recd').checked });
  save(); toast('Added'); show();
}
function sdTick(id, v) { D.sauda.forEach(function (x) { if (x.id === id) x.received = v; }); save(); show(); }
function sdDel(id) { if (!confirm('Delete this entry?')) return; D.sauda = D.sauda.filter(function (x) { return x.id !== id; }); save(); show(); }

/* ----- Staff logins (online mode) ----- */
V.users = function () {
  var h = '<div class="card"><h2>Add a staff login</h2><p class="muted" style="font-size:13px">They can then sign in on any phone, iPhone or laptop and see the same data. Only emails on this list (and the owner) can open the shop.</p>';
  h += '<label class="f"><span>Email</span><input id="u_e" type="email" inputmode="email"></label><label class="f"><span>Password (min 6 letters)</span><input id="u_p" type="text"></label>';
  h += '<button class="btn gold" style="width:100%" onclick="App.addUser()">Add login</button></div>';
  h += '<div class="card"><h2>Allowed staff</h2><div id="u_list" class="muted">Loading…</div></div>';
  return h;
};
V.users_after = function () {
  Cloud.loadUsers(function (err, list) {
    var el = $('u_list'); if (!el) return;
    if (err) { el.innerHTML = '<span class="baki">Only the owner can manage staff logins.</span>'; return; }
    el.innerHTML = list.length ? '<div class="list">' + list.map(function (e) { return '<div class="it"><div class="l"><b>' + esc(e) + '</b></div><div class="r"><button class="btn small" onclick="App.resetUser(\'' + esc(e) + '\')">Reset password</button> <button class="btn small red" onclick="App.removeUser(\'' + esc(e) + '\')">Remove</button></div></div>'; }).join('') + '</div>' : 'No staff yet. Only the owner can sign in.';
  });
};

/* ----- More menu ----- */
V.more = function () {
  var items = [['registers', 'Bill Registers', 'Silver, Sili 999, Rupa, Gold, Kaccha with ratios'], ['stock', 'Stock & Cash', 'Stock statement, cash in/out, expenses'], ['daybook', 'Day Book', 'Everything on one day, day report'], ['parties', 'Parties', 'Customers & suppliers'], ['printer', 'Printer', 'Bill size, Bluetooth thermal printer'], ['backup', 'Backup & Excel', 'Export to Excel, backup, restore'], ['settings', 'Settings', 'Shop details, GST, units, opening stock']];
  if (window.Cloud && Cloud.enabled && Cloud.isOwner) items.push(['users', 'Staff logins', 'Who can open this shop on other phones / laptops']);
  if (window.Cloud && Cloud.enabled && Cloud.user) items.push(['__signout', 'Sign out', 'Signed in as ' + esc(Cloud.user.email)]);
  return '<div class="card menu"><div class="list">' + items.map(function (x) { return '<div class="it" onclick="' + (x[0] === '__signout' ? 'Cloud.signOut()' : 'App.go(\'' + x[0] + '\')') + '"><div class="l"><b>' + x[1] + '</b><small>' + x[2] + '</small></div><div class="r">&#8250;</div></div>'; }).join('') + '</div></div><p class="muted c" style="font-size:12px">Bullion Book 1.6 · ' + (window.Cloud && Cloud.enabled ? 'data saved online and on this device' : 'all data stays on this phone') + '</p>';
};
V.parties = function () {
  var c = compute();
  var h = '<div class="btns" style="margin-top:0;margin-bottom:12px"><button class="btn gold" onclick="App.addParty()">+ Add party</button></div><div class="card">';
  if (!D.parties.length) return h + '<div class="empty">No parties yet. They are added automatically when you make a bill.</div></div>';
  h += '<div class="list">' + D.parties.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (p) { return '<div class="it click" onclick="App.go(\'party\',\'' + p.id + '\')"><div class="l"><b>' + esc(p.name) + '</b><small>' + esc(p.phone || '') + '</small></div><div class="r" style="font-size:12px">' + (c.party[p.id] ? balanceText(c.party[p.id]) : '') + '</div></div>'; }).join('') + '</div></div>';
  return h;
};
function addParty() {
  openModal('<h3>Add party</h3><label class="f"><span>Name</span><input id="pa_n"></label><label class="f"><span>Mobile</span><input id="pa_p" inputmode="tel"></label><label class="f"><span>Address</span><input id="pa_a"></label><div class="btns"><button class="btn gold" onclick="App.addPartySave()">Save</button></div>');
}
function addPartySave() {
  var n = $('pa_n').value.trim(); if (!n) { toast('Name required'); return; }
  if (partyByName(n)) { toast('Party already exists'); return; }
  D.parties.push({ id: uid(), name: n, phone: $('pa_p').value.trim(), address: $('pa_a').value.trim() });
  save(); closeModal(); show();
}

/* ----- Settings ----- */
V.settings = function () {
  var S = D.settings, O = D.opening;
  function inp(id, label, val, type) { return '<label class="f"><span>' + label + '</span><input id="' + id + '" ' + (type === 'n' ? 'type="number" step="any" inputmode="decimal"' : '') + ' value="' + esc(val) + '"></label>'; }
  var h = '<div class="card"><h2>Shop details (bill header)</h2>' + inp('s_name', 'Shop name', S.shopName) + inp('s_tag', 'Tagline', S.tagline) + '<label class="f"><span>Address</span><textarea id="s_addr" rows="2">' + esc(S.address) + '</textarea></label>' + inp('s_phone', 'Phone', S.phone) + inp('s_wa', 'WhatsApp number for day report', S.waNumber || '') + inp('s_footer', 'Bill footer', S.footer) + inp('s_terms', 'Terms (A4 bill)', S.terms) + '</div>';
  h += '<div class="card"><h2>Units &amp; rates</h2><div class="row"><label class="f"><span>Silver unit</span><select id="s_su"><option ' + (S.units.silver.unit === 'kg' ? 'selected' : '') + '>kg</option><option ' + (S.units.silver.unit === 'g' ? 'selected' : '') + '>g</option></select></label>' + inp('s_sr', 'Silver rate is per (units)', S.units.silver.ratePer, 'n') + '</div>';
  h += '<div class="row"><label class="f"><span>Gold unit</span><select id="s_gu"><option ' + (S.units.gold.unit === 'g' ? 'selected' : '') + '>g</option><option ' + (S.units.gold.unit === 'kg' ? 'selected' : '') + '>kg</option></select></label>' + inp('s_gr', 'Gold rate is per (units)', S.units.gold.ratePer, 'n') + '</div>';
  h += '<p class="muted" style="font-size:12px">Example: silver in kg with rate per 1 kg → 20.000 × 2,47,000 = 49,40,000. Gold in g with rate per 10 g → 10 g × 75,000 = 75,000.</p>';
  h += '<h3>Count in stock</h3>' + ITEM_KEYS.map(function (k) { return '<label class="chk"><input type="checkbox" id="s_st_' + k + '" ' + (S.stockItems[k] ? 'checked' : '') + '> ' + ITEMS[k].name + '</label>'; }).join('') + '</div>';
  h += '<div class="card"><h2>Bill numbers</h2><div class="row">' + inp('s_sp', 'Sale prefix', S.sellPrefix) + inp('s_sn', 'Next sale no.', D.seq.sell, 'n') + '</div><div class="row">' + inp('s_bp', 'Purchase prefix', S.buyPrefix) + inp('s_bn', 'Next purchase no.', D.seq.buy, 'n') + '</div></div>';
  h += '<div class="card"><h2>Opening stock &amp; cash</h2><div class="row">' + inp('o_sili', 'Sili 999 (' + unitOf('silver') + ')', O.sili, 'n') + inp('o_silver', 'Silver (' + unitOf('silver') + ')', O.silver, 'n') + '</div><div class="row">' + inp('o_rupa', 'Rupa weight', O.rupa, 'n') + inp('o_rupaFine', 'Rupa fine', O.rupaFine, 'n') + '</div><div class="row">' + inp('o_gold', 'Gold (' + unitOf('gold') + ')', O.gold, 'n') + '<span></span></div><div class="row">' + inp('o_kaccha', 'Kaccha weight', O.kaccha, 'n') + inp('o_kacchaFine', 'Kaccha fine', O.kacchaFine, 'n') + '</div><div class="row">' + inp('o_cash', 'Cash in hand (₹)', O.cash, 'n') + '<span></span>' + '</div><p class="muted" style="font-size:12px">For old party balances use Baki/Jama → + Entry.</p></div>';
  h += '<div class="btns"><button class="btn gold" onclick="App.saveSettings()">Save settings</button></div>';
  return h;
};
function saveSettings() {
  var S = D.settings, O = D.opening;
  S.shopName = $('s_name').value.trim() || 'My Bullion Shop'; S.tagline = $('s_tag').value; S.address = $('s_addr').value; S.phone = $('s_phone').value; S.waNumber = $('s_wa').value.trim(); S.footer = $('s_footer').value; S.terms = $('s_terms').value;
  S.gstOn = false;
  S.units.silver.unit = $('s_su').value; S.units.silver.ratePer = num($('s_sr').value) || 1; S.units.gold.unit = $('s_gu').value; S.units.gold.ratePer = num($('s_gr').value) || 1;
  ITEM_KEYS.forEach(function (k) { S.stockItems[k] = $('s_st_' + k).checked; });
  S.sellPrefix = $('s_sp').value; S.buyPrefix = $('s_bp').value; D.seq.sell = Math.max(1, Math.floor(num($('s_sn').value))); D.seq.buy = Math.max(1, Math.floor(num($('s_bn').value)));
  ['sili', 'silver', 'rupa', 'rupaFine', 'gold', 'kaccha', 'kacchaFine', 'cash'].forEach(function (k) { O[k] = num($('o_' + k).value); });
  save(); toast('Settings saved'); back();
}

/* ----- Printer ----- */
V.printer = function () {
  var S = D.settings;
  var h = '<div class="card"><h2>Default bill size</h2><div class="seg">' + [['58', '2 inch'], ['80', '3 inch'], ['a4', 'A4'], ['ask', 'Ask']].map(function (x) { return '<button class="' + (S.paper === x[0] ? 'on' : '') + '" onclick="App.setPaper(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div><p class="muted" style="font-size:12px">"Print / PDF" opens the Android print screen: choose a Wi-Fi/USB printer or <b>Save as PDF</b> to send on WhatsApp.</p></div>';
  if (HAS_APP) {
    h += '<div class="card"><h2>Bluetooth thermal printer</h2><p class="muted" style="font-size:12px">Pair the printer in phone Bluetooth settings first (PIN is usually 0000 or 1234), then pick it here.</p>';
    h += '<div>Selected: <b>' + esc(S.btName || 'None') + '</b></div><div class="seg" style="margin-top:10px"><button class="' + (num(S.btWidth) === 32 ? 'on' : '') + '" onclick="App.setBtW(32)">58mm (32 chars)</button><button class="' + (num(S.btWidth) === 48 ? 'on' : '') + '" onclick="App.setBtW(48)">80mm (48 chars)</button></div>';
    h += '<div id="btlist"></div><div class="btns"><button class="btn dark" onclick="App.btScan()">Show paired printers</button><button class="btn" onclick="App.btTest()">Test print</button></div></div>';
  } else {
    h += '<div class="card muted">Bluetooth printing works in the Android app.</div>';
  }
  return h;
};
function setPaper(p) { D.settings.paper = p; save(); show(); }
function setBtW(n) { D.settings.btWidth = n; save(); show(); }
function btScan() {
  var r = JSON.parse(Android.btDevices());
  if (r.error === 'perm') { $('btlist').innerHTML = '<p class="muted">Allow "Nearby devices" permission, then tap again.</p>'; return; }
  if (r.error) { $('btlist').innerHTML = '<p class="baki">' + esc(r.error) + '</p>'; return; }
  if (!r.devices.length) { $('btlist').innerHTML = '<p class="muted">No paired devices. Pair your printer in Bluetooth settings.</p>'; return; }
  $('btlist').innerHTML = '<div class="list">' + r.devices.map(function (d) { return '<div class="it click" onclick="App.btPick(\'' + esc(d.address) + '\',\'' + esc(String(d.name).replace(/'/g, '')) + '\')"><div class="l"><b>' + esc(d.name) + '</b><small>' + esc(d.address) + '</small></div><div class="r">' + (D.settings.btPrinter === d.address ? '✓' : 'Use') + '</div></div>'; }).join('') + '</div>';
}
function btPick(addr, name) {
  D.settings.btPrinter = addr; D.settings.btName = name; save(); toast('Printer set: ' + name);
  if (btPending) { var id = btPending; btPending = null; back(); btPrintBill(id); } else show();
}
function btTest() {
  if (!D.settings.btPrinter) { toast('Pick a printer first'); return; }
  Android.btPrint(D.settings.btPrinter, escpos([{ t: D.settings.shopName, c: 1, b: 1 }, { t: 'Printer test OK', c: 1 }, new Array((num(D.settings.btWidth) || 32) + 1).join('-')]));
}

/* ----- Backup / Excel ----- */
V.backup = function () {
  return '<div class="card"><h2>Excel</h2><p class="muted" style="font-size:13px">Exports all sheets like your old workbook: Buy Sell, Silver, Silver Rupa, Stock, Gold, G.Kachha, Baki Jama, plus Bills and Parties.</p><div class="btns"><button class="btn gold" onclick="App.exportXlsx()">Export to Excel</button></div></div>' +
    '<div class="card"><h2>Backup</h2><p class="muted" style="font-size:13px">Save a full backup file to Google Drive, WhatsApp or the phone. Keep one every week. The app also keeps 15 daily copies inside the phone.</p><div class="btns"><button class="btn dark" onclick="App.exportJson()">Save backup</button><button class="btn" onclick="App.importJson()">Restore backup</button></div></div>' +
    '<div class="card"><h2>Data</h2><p class="muted" style="font-size:13px">' + D.bills.length + ' bills · ' + D.entries.length + ' entries · ' + D.parties.length + ' parties</p><div class="btns"><button class="btn red" onclick="App.wipe()">Erase all data</button></div></div>';
};
function saveBlob(name, mime, b64) {
  if (HAS_APP) { Android.saveFile(name, mime, b64); return; }
  var a = document.createElement('a'); a.href = 'data:' + mime + ';base64,' + b64; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function stamp() { var d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()); }
function exportJson() {
  var s = JSON.stringify(D);
  saveBlob('BullionBook-backup-' + stamp() + '.json', 'application/json', btoa(unescape(encodeURIComponent(s))));
}
var importCb = null;
function importJson() {
  importCb = function (text) {
    try {
      var o = JSON.parse(text);
      if (!o || !o.settings || !o.bills) throw new Error('Not a Bullion Book backup');
      if (!confirm('Replace current data with this backup? (' + o.bills.length + ' bills)')) return;
      D = merge(blank(), o); save(); toast('Backup restored'); nav('home');
    } catch (e) { alert('Restore failed: ' + e.message); }
  };
  if (HAS_APP) { Android.openFile(); return; }
  var i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.onchange = function () { var r = new FileReader(); r.onload = function () { importCb(r.result); }; r.readAsText(i.files[0]); };
  i.click();
}
function wipe() {
  if (!confirm('Erase ALL bills, entries and parties? Make a backup first!')) return;
  if (prompt('Type ERASE to confirm') !== 'ERASE') return;
  var s = D.settings; D = blank(); D.settings = s; save(); toast('All data erased'); nav('home');
}
function exportXlsx() {
  if (!window.XLSX) { toast('Excel library not loaded'); return; }
  var wb = XLSX.utils.book_new(), c = compute();
  function sheetFor(k, title) {
    var it = ITEMS[k], cols = (it.time ? ['Time'] : []).concat(['Date', 'Name', it.touch ? 'Weight' : 'Qty']).concat(it.touch ? ['Touch', 'Fine'] : []).concat(['Rate', 'Total']);
    var buys = registerRows(k, 'buy'), sells = registerRows(k, 'sell');
    function row(r) { return (it.time ? [r.b.time] : []).concat([fd(r.b.date), r.b.partyName || 'Cash', r3(r.l.weight)]).concat(it.touch ? [r.l.touch, r3(r.l.fine)] : []).concat([r.l.rate, r.l.amount]); }
    var blankRow = cols.map(function () { return ''; });
    var aoa = [[title], ['BUY'].concat(cols.slice(1).map(function () { return ''; })).concat(['']).concat(['SELL']).concat(cols.slice(1).map(function () { return ''; })), cols.concat(['']).concat(cols)];
    var n = Math.max(buys.length, sells.length);
    for (var i = 0; i < n; i++) aoa.push((buys[i] ? row(buys[i]) : blankRow).concat(['']).concat(sells[i] ? row(sells[i]) : blankRow));
    var rb = ratioOf(buys, k), rs = ratioOf(sells, k);
    aoa.push([]);
    aoa.push(['Buy total qty', rb.qty, 'Amount', rb.amt, 'Buy Ratio', Math.round(rb.avg)]);
    aoa.push(['Sell total qty', rs.qty, 'Amount', rs.amt, 'Sell Ratio', Math.round(rs.avg)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), title);
  }
  if (shownKeys()[0] === 'bs') sheetFor('bs', 'Buy Sell'); sheetFor('silver', 'Silver'); sheetFor('sili', 'Silver Sili 999'); sheetFor('rupa', 'Silver Rupa');
  var st = [['Item', 'Unit', 'Opening', 'Buy', 'Sell', 'Adj In', 'Adj Out', 'Closing', 'Closing Fine']];
  shownKeys().forEach(function (k) { var s = c.stock[k]; st.push([ITEMS[k].name, unitOf(ITEMS[k].metal), s.open, r3(s.buy), r3(s.sell), r3(s.adjIn), r3(s.adjOut), s.close, s.closeFine]); });
  st.push([]); st.push(['Cash', '', 'Opening', 'In', 'Out', '', '', 'Closing']); st.push(['Cash in hand', '₹', c.cash.open, c.cash.in, c.cash.out, '', '', c.cash.close]); 
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(st), 'Stock');
  sheetFor('gold', 'Gold'); sheetFor('kaccha', 'G.Kachha');
  var bj = [['Party', 'Phone', 'Cash Baki', 'Cash Jama', 'Silver Baki', 'Silver Jama', 'Gold Baki', 'Gold Jama']];
  D.parties.forEach(function (p) { var b = c.party[p.id]; if (!b) return; bj.push([p.name, p.phone, b.cash > 0 ? Math.round(b.cash) : '', b.cash < 0 ? Math.round(-b.cash) : '', b.silver > 0 ? r3(b.silver) : '', b.silver < 0 ? r3(-b.silver) : '', b.gold > 0 ? r3(b.gold) : '', b.gold < 0 ? r3(-b.gold) : '']); });
  bj.push([]); bj.push(['Entries']); bj.push(['Date', 'Type', 'Party', 'What', 'Weight', 'Touch', 'Fine / Amount', 'Mode', 'Note']);
  D.entries.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (e) { bj.push([fd(e.date), KIND[e.kind].short, (partyById(e.partyId) || {}).name || '', e.item === 'cash' ? 'Cash' : ITEMS[e.item].name, e.weight || '', e.touch || '', e.qty, e.mode || '', e.note]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bj), 'Baki Jama');
  var bl = [['Bill No', 'Type', 'Date', 'Time', 'Party', 'Item', 'Weight', 'Touch', 'Fine', 'Rate', 'Amount', 'Total', 'Paid/Recd', 'Mode', 'Balance', 'Note']];
  D.bills.slice().sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }).forEach(function (b) { b.lines.forEach(function (l, i) { bl.push([b.no, b.type === 'sell' ? 'Sale' : 'Purchase', fd(b.date), b.time, b.partyName || 'Cash', ITEMS[l.item].name, r3(l.weight), ITEMS[l.item].touch ? l.touch : '', ITEMS[l.item].touch ? r3(l.fine) : '', l.rate, l.amount].concat(i === 0 ? [b.total, b.paid, b.mode, b.due, b.note] : [])); }); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bl), 'Bills');
  var sd = [['Date', 'Time', 'Metal', 'Type', 'Name', 'Kg', 'Rate', 'Amount', 'Received']];
  (D.sauda || []).slice().sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }).forEach(function (x) { sd.push([fd(x.date), x.time, x.metal === 'gold' ? 'Gold' : 'Silver', x.type === 'buy' ? 'Buy' : 'Sell', x.name, x.qty, x.rate, x.amount, x.received ? 'Yes' : 'No']); });
  ['silver', 'gold'].forEach(function (m) { var rr = sdRows(m, ['', '']), bb = sdSum(rr, 'buy'), ss = sdSum(rr, 'sell'); sd.push([]); sd.push([m === 'gold' ? 'Gold' : 'Silver', 'Buy Ratio', Math.round(bb.avg), bb.qty + ' kg', 'Sell Ratio', Math.round(ss.avg), ss.qty + ' kg']); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sd), 'Sauda');
  var pt = [['Name', 'Phone', 'Address']]; D.parties.forEach(function (p) { pt.push([p.name, p.phone, p.address]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pt), 'Parties');
  var b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  saveBlob('Bullion shop ' + stamp() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', b64);
}

/* ---------- native callbacks ---------- */
window.onNative = function (ev, payload) {
  if (ev === 'saved') { if (payload === 'ok') toast('File saved'); else if (payload !== 'cancel') alert(payload); }
  else if (ev === 'opened') { if (payload && importCb) { var text = decodeURIComponent(escape(atob(payload))); importCb(text); } }
  else if (ev === 'btprint') { toast(payload === 'ok' ? 'Printed' : payload); }
  else if (ev === 'btperm') { if (payload === 'ok' && $('btlist')) btScan(); else if (payload !== 'ok') toast('Bluetooth permission denied'); }
};

/* ---------- public API for inline handlers ---------- */
window.App = {
  nav: function (r) { if (r === 'newbill') { newBillState(); } nav(r); },
  go: go, back: back, closeModal: closeModal,
  newBill: function (t, item) { newBillState(); F.type = t; if (item) F.lines[0].item = item; go('newbill'); },
  newBillFor: newBillFor,
  setReg: function (o) { for (var k in o) regState[k] = o[k]; if (o.range === 'custom' && !regState.from) { regState.from = today().slice(0, 8) + '01'; regState.to = today(); } stack[stack.length - 1].a = null; show(); },
  fset: function (k, v) { readForm(); F[k] = v; show(); },
  lineItem: function (i, v) { readForm(); F.lines[i].item = v; show(); },
  addLine: function () { readForm(); var last = F.lines[F.lines.length - 1]; F.lines.push({ item: last ? last.item : 'silver', weight: '', touch: '', rate: last ? last.rate : '' }); show(); },
  delLine: function (i) { readForm(); F.lines.splice(i, 1); show(); },
  lineIn: function (el) { F.lines[+el.getAttribute('data-i')][el.getAttribute('data-k')] = el.value; recalc(); },
  recalc: recalc, partyHint: partyHint,
  fmode: function (v, el) { $('f_mode').value = v; Array.prototype.forEach.call($('f_modes').children, function (b) { b.classList.toggle('on', b === el); }); },
  paidEdit: function () { F.paidTouched = true; recalc(); },
  saveBill: saveBill, editBill: editBill, delBill: delBill, printBill: printBill, btPrintBill: btPrintBill, shareBill: shareBill,
  setBJ: function (o) { for (var k in o) bjState[k] = o[k]; show(); },
  bjSearch: function (v) { bjState.q = v; $('bjlist').innerHTML = bjList(); },
  editParty: editParty, saveParty: saveParty, delParty: delParty, shareBal: shareBal, printLedger: printLedger, addParty: addParty, addPartySave: addPartySave,
  eset: eset, eFine: eFine, saveEntry: saveEntry, delEntry: delEntry,
  setSD: function (o) { for (var k in o) sdState[k] = o[k]; if (o.range === 'custom' && !sdState.from) { sdState.from = today().slice(0, 8) + '01'; sdState.to = today(); } show(); },
  sdType: function (t) { sdType = t; show(); }, sdCalc: sdCalc, sdAdd: sdAdd, sdTick: sdTick, sdDel: sdDel,
  setDB: function (v) { dbState.date = (v && v <= today()) ? v : today(); show(); }, printDay: printDay, waDay: waDay,
  saveSettings: saveSettings, setPaper: setPaper, setBtW: setBtW, btScan: btScan, btPick: btPick, btTest: btTest,
  addUser: function () { var e = $('u_e').value, p = $('u_p').value; toast('Adding…'); Cloud.addUser(e, p, function (err) { if (err) toast(err); else { toast('Login added: ' + e); show(); } }); },
  removeUser: function (e) { if (!confirm('Remove ' + e + '? They will not be able to open the shop any more.')) return; Cloud.removeUser(e, function (err) { toast(err || 'Removed'); show(); }); },
  resetUser: function (e) { Cloud.resetPassword(e, function (err) { toast(err || 'Password reset email sent to ' + e); }); },
  exportXlsx: exportXlsx, exportJson: exportJson, importJson: importJson, wipe: wipe,
  _D: function () { return D; }, _compute: compute, _toast: toast,
  _applyRemote: function (data, state, remoteEmpty) {
    if (remoteEmpty) {
      if (D.bills.length || D.entries.length || D.parties.length || (D.sauda || []).length) { toast('Uploading your data online…'); }
      D.savedAt = Date.now(); window.Cloud.push(D); saveLocal(); show(); return;
    }
    D.bills = data.bills; D.entries = data.entries; D.parties = data.parties; D.sauda = data.sauda;
    if (state && state.v) { D.settings = merge(blank().settings, state.v.settings || {}); D.opening = merge(blank().opening, state.v.opening || {}); D.seq = merge(blank().seq, state.v.seq || {}); }
    saveLocal();
    var r = cur && cur.r;
    if (r !== 'newbill' && r !== 'entry' && r !== 'settings' && $('modal').classList.contains('hidden')) {
      var y = window.scrollY; show(); window.scrollTo(0, y);
    }
  },
  _lock: function (wipe) {
    if (wipe) { try { localStorage.removeItem(STORE_KEY); } catch (e) {} var st = D.settings; D = blank(); D.settings = st; saveLocal(); nav('home'); }
  },
};

load();
nav('home');
})();
