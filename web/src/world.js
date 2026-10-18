// The storeroom's window on the wider world: publish your museum, visit other people's, and
// the auction house (bid on other players' pieces, or put your own up). Everything here is
// the game's own money; the server only settles who won what.
//
// Your item while it's for sale: where 'auction', auctionId. When a sale closes, settle()
// claims it: a won piece arrives in your storeroom, proceeds arrive in your funds, an unsold
// piece comes back.

import * as save from './save.js';
import * as net from './net.js';
import { LEVELS, SPECIAL } from './data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const levelOf = (id) => LEVELS.find((l) => l.id === id) ?? SPECIAL[id];
const left = (s) => (s <= 0 ? 'closed' : s < 120 ? `${s}s left` : s < 7200 ? `${Math.round(s / 60)} min left` : `${Math.round(s / 3600)} h left`);

/** A local item -> the public record the server keeps (plus its mesh, uploaded). */
async function publicPiece(it) {
  const mesh = await save.loadDisplay(it.id);
  if (!mesh) return null;
  const lv = levelOf(it.level);
  return {
    name: it.name || lv?.title || 'Specimen', level: it.level, place: lv?.place ?? '', value: it.value ?? 0,
    exposure: it.exposure ?? 0, integrity: it.integrity ?? 0, mounted: !!it.mounted, repaired: !!it.repaired,
    mesh: await net.uploadMesh(mesh),
  };
}

/** Claim whatever's due from closed sales. Returns lines for the storeroom to show. */
export async function settle() {
  const { auctions } = await net.myAuctions();
  const lines = [];
  const p = await save.profile();
  let changed = false;
  for (const a of auctions) {
    if (a.status === 'open') continue;
    const mineSold = a.mine && !a.sellerClaimed;
    const iWon = a.bidOn && a.leading && a.status === 'sold' && !a.buyerClaimed;
    if (!mineSold && !iWon) continue;
    let r;
    try { r = await net.claim(a.id); } catch { continue; }
    const local = (await save.listItems()).find((it) => it.auctionId === a.id);
    if (r.won) {
      const lv = levelOf(r.won.level);
      const it = save.newItem(lv ?? { id: r.won.level }, 0, {
        status: 'prepared', where: 'keep', name: r.won.name, value: r.won.value, exposure: r.won.exposure, integrity: r.won.integrity,
        mounted: r.won.mounted, repaired: r.won.repaired, from: `${r.from}, at auction`, boughtFor: r.price, day: p.day,
      });
      try { await save.saveDisplay(it.id, await net.fetchMesh(r.won.mesh)); } catch {}
      await save.putItem(it);
      p.funds -= r.price;
      lines.push(`You won <i>${esc(r.won.name)}</i> for <b>$${r.price}</b>. It's in your storeroom.`);
    } else if (r.proceeds) {
      p.funds += r.proceeds;
      if (local) { local.where = 'sell'; local.soldTo = r.to; await save.putItem(local); }
      lines.push(`<i>${esc(a.piece.name)}</i> sold to ${esc(r.to)} for <b>$${r.proceeds}</b>.`);
    } else if (r.unsold) {
      if (local) { local.where = 'keep'; delete local.auctionId; await save.putItem(local); }
      lines.push(`<i>${esc(a.piece.name)}</i> didn't reach its reserve and has come home.`);
    }
    changed = true;
  }
  if (changed) await save.saveProfile(p);
  return lines;
}

/** The section's HTML (filled in after the server answers; see bind()). */
export function html(p) {
  return `<h3 class="sub">The wider world</h3>` +
    `<p class="fine">Publish your museum for other players to walk round, visit theirs, and buy and sell at auction. Prices are in the game's own funds. Collectors bid too, so there's always someone in the room.</p>` +
    `<div id="worldNews"></div>` +
    `<div class="worldpub"><input type="text" id="wName" maxlength="60" placeholder="Your museum's name" value="${esc(p.museumName ?? '')}">` +
    `<input type="text" id="wCurator" maxlength="40" placeholder="Curator (your name)" value="${esc(p.curator ?? '')}">` +
    `<button id="wPublish" class="on">Publish my museum</button><span class="fine" id="wPubState"></span></div>` +
    `<h4 class="sub2">Museums to visit</h4><div class="shelf" id="worldMuseums"><p class="fine">Looking…</p></div>` +
    `<h4 class="sub2">The auction house</h4><div class="shelf" id="worldAuctions"><p class="fine">Looking…</p></div>`;
}

/** Wire the section up: fetch museums and auctions, settle closed sales. */
export async function bind(ui, p, items) {
  const $ = (id) => document.getElementById(id);
  if (!$('worldMuseums')) return;
  const fail = (el, e) => { el.innerHTML = `<p class="fine">The wider world is out of reach just now (${esc(e.message)}).</p>`; };
  // Closed sales first, so funds are right before anyone bids.
  try {
    const news = await settle();
    if (news.length) {
      $('worldNews').innerHTML = `<div class="daycard"><div class="cat">From the auction house</div>${news.map((l) => `<p>${l}</p>`).join('')}</div>`;
      p = await save.profile();
    }
  } catch {}
  $('wPublish').onclick = async () => {
    const b = $('wPublish');
    const name = $('wName').value.trim(), curator = $('wCurator').value.trim();
    if (!name || !curator) return ui.toast('Give your museum and yourself a name');
    b.disabled = true;
    $('wPubState').textContent = 'Packing the cases…';
    try {
      const shown = items.filter((it) => it.status === 'prepared' && it.where === 'museum' && !it.loanedTo).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 11);
      const pieces = [], slotOf = new Map();
      for (const it of shown) {
        const pc = await publicPiece(it);
        if (!pc) continue;
        slotOf.set(it.id, pieces.length);
        pieces.push(pc);
        $('wPubState').textContent = `Packing the cases… ${pieces.length} of ${shown.length}`;
      }
      if (!pieces.length) throw new Error('nothing on display has a model yet');
      const pr = await save.profile();
      const stops = (pr.tour?.stops ?? []).filter((s) => slotOf.has(s.id)).map((s) => ({ slot: slotOf.get(s.id), card: s.card ?? '' }));
      const r = await net.publish({ name, curator, pieces, tour: stops.length >= 3 ? { name: pr.tour.name, stops } : null });
      pr.museumName = name;
      pr.curator = curator;
      pr.published = { id: r.id, at: Date.now(), n: pieces.length };
      await save.saveProfile(pr);
      $('wPubState').textContent = `Published: ${pieces.length} piece${pieces.length === 1 ? '' : 's'}${stops.length >= 3 ? ' and your tour' : ''}. Publish again whenever you change the displays.`;
      import('./telemetry.js').then((t) => t.track('publish', '', { n: pieces.length }));
    } catch (e) {
      $('wPubState').textContent = `Couldn't publish: ${e.message}`;
    }
    b.disabled = false;
  };
  if (p.published) $('wPubState').textContent = `Published with ${p.published.n} piece${p.published.n === 1 ? '' : 's'}.`;
  // Museums.
  net.listMuseums().then(({ museums, mine }) => {
    const others = museums.filter((m) => m.id !== mine);
    $('worldMuseums').innerHTML = others.length
      ? others.slice(0, 18).map((m) => `<div class="blk"><div class="cat">Curated by ${esc(m.curator)}</div><div class="sp">${esc(m.name)}</div>` +
        `<div class="fine">${m.pieces} piece${m.pieces === 1 ? '' : 's'}${m.tour ? ' · a tour' : ''} · ${m.visits} visit${m.visits === 1 ? '' : 's'}</div>` +
        `<div class="row"><button class="on" data-visit="${esc(m.id)}">Visit</button><button data-report="museum:${esc(m.id)}" title="Report something offensive">Report</button></div></div>`).join('')
      : `<p class="fine">No other museums yet. Publish yours and be the first.</p>`;
    for (const b of document.querySelectorAll('[data-visit]')) b.onclick = async () => {
      try {
        const m = await net.getMuseum(b.dataset.visit);
        ui.visitMuseum({ ...m, title: m.name, info: `Curated by ${m.curator} · ${m.pieces.length} piece${m.pieces.length === 1 ? '' : 's'}` });
      } catch (e) { ui.toast(e.message); }
    };
    bindReports(ui);
  }).catch((e) => fail($('worldMuseums'), e));
  // Auctions.
  const drawAuctions = async () => {
    const { auctions } = await net.listAuctions();
    const pr = await save.profile();
    const held = auctions.filter((a) => a.status === 'open' && a.leading).reduce((s, a) => s + a.price, 0);
    const open = auctions.filter((a) => a.status === 'open');
    const done = auctions.filter((a) => a.status !== 'open').slice(-6).reverse();
    let h = open.length ? '' : `<p class="fine">Nothing under the hammer right now. Put a piece up from "Prepared specimens".</p>`;
    for (const a of open) {
      const lv = levelOf(a.piece.level);
      h += `<div class="blk${a.leading ? ' contract on' : ''}"><div class="cat">${esc(a.piece.place || lv?.place || '')} · ${left(a.left)}</div><div class="sp"><i>${esc(a.piece.name)}</i></div>` +
        `<div class="fine">From ${esc(a.seller)}${a.mine ? ' (you)' : ''} · ${Math.floor(a.piece.exposure * 100)}% exposed · ${Math.round(a.piece.integrity * 100)}% integrity${a.piece.mounted ? ' · mounted' : ''}${a.piece.repaired ? ' · repaired' : ''}</div>` +
        `<div class="fine">${a.bids ? `<b>$${a.price}</b>, ${a.leading ? 'your bid' : `bid by ${esc(a.leader)}`}` : `Opens at <b>$${a.reserve}</b>`} · ${a.bids} bid${a.bids === 1 ? '' : 's'}</div>` +
        `<div class="row"><button data-lot-view="${a.id}">See it</button>` +
        (a.mine || a.leading ? '' : `<button class="on" data-bid="${a.id}:${a.next}" ${pr.funds - held < a.next ? 'disabled title="Not enough funds"' : ''}>Bid $${a.next}</button>`) + `</div></div>`;
    }
    if (done.length) h += done.map((a) => `<div class="blk gone"><div class="cat">${a.status === 'sold' ? `Sold to ${esc(a.leader)}` : 'Unsold'}</div><div class="sp"><i>${esc(a.piece.name)}</i></div><div class="fine">${a.status === 'sold' ? `$${a.price}` : `Reserve $${a.reserve} not met`}</div></div>`).join('');
    $('worldAuctions').innerHTML = h + (held ? `<p class="fine" style="grid-column: 1 / -1">$${held} is held in your winning bids.</p>` : '');
    for (const b of document.querySelectorAll('[data-bid]')) b.onclick = async () => {
      const [id, amount] = b.dataset.bid.split(':').map(Number);
      b.disabled = true;
      try {
        const pr2 = await save.profile();
        await net.bid(id, amount, pr2.curator || pr2.museumName || 'A preparator');
        ui.toast(`You bid $${amount}`, 'good');
        import('./telemetry.js').then((t) => t.track('bid', '', { amount }));
      } catch (e) { ui.toast(e.message, 'bad'); }
      drawAuctions().catch(() => {});
    };
    for (const b of document.querySelectorAll('[data-lot-view]')) b.onclick = () => {
      const a = open.find((x) => x.id === +b.dataset.lotView);
      ui.visitMuseum({ title: 'The sale room', info: `Lot: ${a.piece.name} · ${a.bids ? `$${a.price}` : `opens at $${a.reserve}`} · ${left(a.left)}`, pieces: [a.piece], saleRoom: true });
    };
  };
  drawAuctions().catch((e) => fail($('worldAuctions'), e));
}

function bindReports(ui) {
  for (const b of document.querySelectorAll('[data-report]')) b.onclick = async () => {
    const [kind, id] = b.dataset.report.split(':');
    if (!confirm('Report this as offensive? Anything reported by three people is hidden.')) return;
    try { await net.report(kind, id); ui.toast('Thanks. Reported.'); } catch (e) { ui.toast(e.message); }
    b.disabled = true;
  };
}

/** Put one of your pieces up for auction. Returns an error or null. */
export async function sell(itemId, reserve, hours) {
  const it = await save.getItem(itemId);
  if (!it || it.status !== 'prepared' || it.where === 'sell' || it.where === 'auction') return 'That piece isn\'t yours to sell.';
  const piece = await publicPiece(it);
  if (!piece) return 'That piece has no model yet: open it on the display bench once.';
  const p = await save.profile();
  const r = await net.listForSale({ piece, reserve, hours, name: p.curator || p.museumName || 'A preparator' });
  it.where = 'auction';
  it.auctionId = r.id;
  await save.putItem(it);
  return null;
}
