'use strict';
const VERSION = '1.0.0';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gbp = n => (n < 0 ? '-£' : '£') + Math.abs(Number(n) || 0).toFixed(2);
const pct = n => n == null ? '—' : (Number(n) * 100).toFixed(1) + '%';
const sign = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
async function getJSON(p) { const r = await fetch(p, {cache: 'no-cache'}); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }

document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === b.dataset.tab));
  location.hash = b.dataset.tab;
});
if (location.hash) { const b = document.querySelector(`nav button[data-tab="${location.hash.slice(1)}"]`); if (b) b.click(); }

function src(x) { return `<div class="muted">Source: ${esc(x.source || '—')} · fetched ${esc(x.fetched_london || '—')} London</div>`; }

function renderPlan(p) {
  const st = p.status === 'settled' ? 'ok' : p.status === 'pending' ? 'warn' : '';
  let h = `<h2>${esc(p.day)} ${esc(p.date)} <span class="pill ${st}">${esc(p.status)}</span></h2>
  <div class="card"><b>${esc(p.headline)}</b><div>${esc(p.summary)}</div><div class="muted">Updated ${esc(p.updated_london)} London</div></div>
  <div class="note">Re-check the live price before staking. If it's below the min odds, skip the bet.</div>`;
  h += '<h3>1 · Matched betting</h3>';
  h += p.matched_betting?.length ? p.matched_betting.map(m => `<div class="card"><b>${esc(m.offer)}</b> · ${esc(m.book)}
    <ol>${(m.steps||[]).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${m.est_profit != null ? `<div>Est. profit: <b>${gbp(m.est_profit)}</b></div>` : ''}${src(m)}</div>`).join('') : '<div class="card muted">None listed.</div>';
  h += '<h3>2 · Extra-place offers</h3>';
  h += p.extra_place?.length ? p.extra_place.map(e => `<div class="card"><b>${esc(e.time)} ${esc(e.race)}</b> · ${esc(e.book)} · ${esc(e.places)} places
    <div>${esc(e.note)}</div>${src(e)}</div>`).join('') : '<div class="card muted">None listed.</div>';
  h += '<h3>3 · Value picks</h3>';
  h += p.value_picks?.length ? p.value_picks.map(v => `<div class="card">
    <b>${esc(v.event)}</b> · ${esc(v.selection)} @ <b>${esc(v.odds)}</b> (${esc(v.book)})
    <div class="kv"><div><b>${esc(v.fair)}</b><span>fair</span></div><div><b>${pct(v.p_est)}</b><span>p est (model)</span></div><div><b class="${sign(v.ev)}">${pct(v.ev)}</b><span>EV</span></div>
    <div><b>${esc(v.stake)}</b><span>stake</span></div><div><b>${esc(v.min_odds)}</b><span>min odds</span></div><div><b>${esc(v.recheck_by)}</b><span>re-check by</span></div></div>
    ${src(v)}</div>`).join('') : '<div class="card muted">No value picks.</div>';
  if (p.checks?.length) {
    h += '<h3>Checks run</h3>' + p.checks.map(c => `<div class="card"><b>${esc(c.area)}</b>
      <div class="muted">${(c.events||[]).map(esc).join(' · ')}</div><div>${esc(c.result)}</div>${src(c)}</div>`).join('');
  }
  if (p.notes?.length) h += p.notes.map(n => `<div class="muted">• ${esc(n)}</div>`).join('');
  return h;
}

function chart(days, start) {
  const pts = [start, ...days.map(d => d.balance)];
  if (pts.length < 2) return '<div class="muted">Chart starts after the first settled day.</div>';
  const W = 320, H = 140, pad = 10, mn = Math.min(...pts) - 1, mx = Math.max(...pts) + 1;
  const xy = pts.map((v, i) => [pad + i * (W - 2 * pad) / (pts.length - 1), H - pad - (v - mn) * (H - 2 * pad) / (mx - mn)]);
  const y0 = H - pad - (start - mn) * (H - 2 * pad) / (mx - mn);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${y0}" y2="${y0}" stroke="#1f2b45" stroke-dasharray="4"/>
    <polyline fill="none" stroke="#22c55e" stroke-width="2" points="${xy.map(p => p.join(',')).join(' ')}"/></svg>`;
}

function renderWallet(w) {
  const pnl = w.balance - w.start_balance;
  const open = w.bets.filter(b => b.status === 'open');
  const settled = w.bets.filter(b => b.status !== 'open');
  let h = `<h2>Practice wallet</h2><div class="note">${esc(w.note)}</div>
  <div class="card"><div class="muted">Balance</div><div class="big">${gbp(w.balance)}</div>
  <div class="${sign(pnl)}">${pnl >= 0 ? '+' : ''}${gbp(pnl)} since ${esc(w.start_date)} (started ${gbp(w.start_balance)})</div>
  <div class="muted">Updated ${esc(w.updated_london)} London</div></div>
  <div class="card">${chart(w.days, w.start_balance)}</div>`;
  const row = b => `<tr><td>${esc(b.date)}</td><td>${esc(b.event)}<div class="muted">${esc(b.selection)} @ ${esc(b.odds)} (${esc(b.book)})</div></td><td>${gbp(b.stake)}</td>
    <td>${b.status === 'open' ? '<span class="pill warn">open</span>' : `<span class="pill ${b.status === 'won' ? 'ok' : b.status === 'lost' ? 'bad' : ''}">${esc(b.status)}</span><div class="${sign(b.pnl)}">${gbp(b.pnl)}</div>`}</td></tr>`;
  h += '<h3>Open paper bets</h3>' + (open.length ? `<div class="card"><table>${open.map(row).join('')}</table></div>` : '<div class="card muted">None.</div>');
  h += '<h3>Settled</h3>' + (settled.length ? `<div class="card"><table>${settled.map(row).join('')}</table></div>` : '<div class="card muted">No settled paper bets yet.</div>');
  h += '<h3>Daily P&amp;L</h3>' + (w.days.length ? `<div class="card"><table><tr><th>Date</th><th>Bets</th><th>P&amp;L</th><th>Balance</th></tr>${w.days.map(d => `<tr><td>${esc(d.date)}</td><td>${d.bets}</td><td class="${sign(d.pnl)}">${gbp(d.pnl)}</td><td>${gbp(d.balance)}</td></tr>`).join('')}</table></div>` : '<div class="card muted">No settled days yet.</div>');
  return h;
}

async function showDay(date) {
  try { $('#today').innerHTML = renderPlan(await getJSON(`data/plan-${date}.json`)); }
  catch (e) { $('#today').innerHTML = `<div class="card">Couldn't load plan for ${esc(date)}. ${navigator.onLine ? '' : 'You are offline.'}</div>`; }
  document.querySelector('nav button[data-tab="today"]').click();
}

async function init() {
  $('#ver').textContent = 'v' + VERSION;
  try {
    const idx = await getJSON('data/index.json');
    await showDay(idx.latest);
    if (location.hash && location.hash !== '#today') { const b = document.querySelector(`nav button[data-tab="${location.hash.slice(1)}"]`); if (b) b.click(); }
    $('#history').innerHTML = '<h2>History</h2>' + idx.days.map(d => `<div class="card" style="cursor:pointer" data-date="${esc(d.date)}">
      <b>${esc(d.date)}</b> <span class="pill ${d.status === 'settled' ? 'ok' : 'warn'}">${esc(d.status)}</span>
      <div>${esc(d.headline)}</div><div class="muted">${d.bets} paper bets · P&amp;L <span class="${sign(d.pnl)}">${gbp(d.pnl)}</span></div></div>`).join('');
    document.querySelectorAll('#history [data-date]').forEach(c => c.onclick = () => showDay(c.dataset.date));
  } catch (e) { $('#today').innerHTML = '<div class="card">Couldn\'t load data.</div>'; }
  try { $('#wallet').innerHTML = renderWallet(await getJSON('data/wallet.json')); }
  catch (e) { $('#wallet').innerHTML = '<div class="card">Couldn\'t load wallet.</div>'; }
}
init();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
let deferred;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
$('#installBtn').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#installBtn').hidden = true; };
