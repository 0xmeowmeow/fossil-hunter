// DOM: menu, HUD, toasts, results.

import { LEVELS, MATRICES, SPECIAL } from './data.js';
import * as save from './save.js';
import { outlineTop, shapes } from './trilobite.js';

const $ = (id) => document.getElementById(id);

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem('fh-best') || '{}');
  } catch {
    return {};
  }
}

function saveBest(best) {
  try {
    localStorage.setItem('fh-best', JSON.stringify(best));
  } catch {
    /* private mode etc. */
  }
}

export class UI {
  constructor() {
    this.best = loadBest();
    this.lastToast = '';
  }

  bind(game, input, start) {
    this.game = game;
    this.input = input;
    this.start = start;
    for (const b of document.querySelectorAll('#tools button')) b.onclick = () => game.setTool(b.dataset.tool);
    for (const b of document.querySelectorAll('#media button')) b.onclick = () => game.setMedia(b.dataset.media);
    for (const b of document.querySelectorAll('#heads button')) b.onclick = () => game.setHead(b.dataset.head);
    $('btnFinish').onclick = () => game.finish();
    $('btnPack').onclick = () => game.packUp();
    $('btnMuseumBack').onclick = () => this.leaveMuseum();
    $('btnWet').onclick = () => game.wetten();
    $('btnLeft').onclick = () => {
      game.setShowLeft(!game.showLeft);
      $('btnLeft').classList.toggle('on', game.showLeft);
      $('btnLeft').textContent = game.showLeft ? 'Hide leftovers' : 'Show leftovers';
    };
    $('btnSweep').onclick = () => game.sweep();
    $('btnModel').onclick = () => game.setModelMode(!game.modelMode);
    $('btnNotes').onclick = () => {
      $('notebook').classList.toggle('hidden');
      $('guide').classList.add('hidden');
      if (!$('notebook').classList.contains('hidden')) this.renderNotebook(game);
    };
    $('btnGuide').onclick = () => {
      $('notebook').classList.add('hidden');
      $('guide').classList.toggle('hidden');
      if (!$('guide').classList.contains('hidden')) this.renderGuide(game);
    };
    for (const b of document.querySelectorAll('#modelbar button')) {
      b.onclick = () => {
        const m = game.mind;
        const act = {
          rotl: () => m.rotate(0.2), rotr: () => m.rotate(-0.2), smaller: () => m.scale(1 / 1.08), bigger: () => m.scale(1.08),
          lower: () => m.setHeight(m.height / 1.15), higher: () => m.setHeight(m.height * 1.15),
          ovoid: () => m.ovoid(), hide: () => { m.visible = !m.visible; m.version++; this.syncModel(game); },
          done: () => game.setModelMode(false),
        }[b.dataset.m];
        act?.();
      };
    }
    $('btnMenu').onclick = () => this.showMenu();
    $('btnBack').onclick = () => this.showMenu();
    $('btnRetry').onclick = () => start(game.level, game.seed);
    $('btnNew').onclick = () => start(game.level, Math.floor(Math.random() * 1e6));
    $('btnNext').onclick = () => {
      const i = LEVELS.indexOf(game.level);
      start(LEVELS[(i + 1) % LEVELS.length]);
    };
    $('btnStart').onclick = () => {
      // The first drawer you haven't finished, or the first.
      const next = LEVELS.find((l) => !this.best[l.id]) ?? LEVELS[0];
      this.start(next, $('randomSeed').checked ? Math.floor(Math.random() * 1e6) : undefined);
    };
    $('loopForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = $('loopEmail').value.trim(), name = $('loopName').value.trim();
      const msg = $('loopMsg');
      msg.textContent = 'Sending…';
      try {
        const r = await fetch('api/subscribe.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, source: new URLSearchParams(location.search).get('utm_source') || 'site' }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || r.status);
        msg.textContent = `Thanks${name ? `, ${name}` : ''}! You're on the list.`;
        $('loopForm').reset();
        import('./telemetry.js').then((t) => t.track('subscribe', null, {}));
      } catch (err) {
        msg.textContent = `That didn't go through: ${err.message || err}. Try again in a moment?`;
      }
    };
    $('btnDrawers').onclick = () => $('drawersSec').scrollIntoView({ behavior: 'smooth' });
    this.renderLevels();
    this.renderCareer();
    this.syncSettings(game);
  }

  /** The landing-page specimen's museum label. */
  setShowLabel(sc) {
    $('showCat').textContent = `On the bench today · No. ${String(sc.seed).padStart(6, '0')}`;
    $('showName').textContent = sc.name;
    $('showLine').textContent = `${article(sc.group)}. Generated for this visit; no one has seen it before.`;
    if (!$('menu').classList.contains('hidden')) $('showlabel').classList.remove('hidden');
  }

  /** Open the i-th parcel in the mail room. */
  openMail(i) {
    const mail = loadJSON('fh-mail', []);
    const m = mail[i];
    if (!m) return;
    import('./telemetry.js').then((t) => t.track('parcel_open', m.id, { waited: i }));
    mail.splice(i, 1);
    saveJSON('fh-mail', mail);
    this.start(SPECIAL[m.id], m.seed, { item: save.newItem(SPECIAL[m.id], m.seed, { from: m.from }) });
  }

  renderLevels() {
    const box = $('levels');
    box.innerHTML = '';
    const mail = loadJSON('fh-mail', []);
    if (mail.length) {
      const m = document.createElement('div');
      m.className = 'museum';
      m.style.borderColor = 'rgba(217,169,78,.5)';
      m.innerHTML = `<div style="flex:1"><b>Mail room</b>${mail.length === 1 ? 'A parcel is waiting' : `${mail.length} parcels are waiting`}: ${mail.map((x) => esc(x.from)).join(', ')}.</div>`;
      const b = document.createElement('button');
      b.className = 'on';
      b.textContent = 'Open the parcel';
      b.onclick = () => this.openMail(0);
      m.appendChild(b);
      box.appendChild(m);
    }
    const col = loadJSON('fh-collection', []), wallet = loadJSON('fh-wallet', 0);
    if (col.length) {
      const museum = col.filter((c) => c.where === 'museum').length, kept = col.filter((c) => c.where === 'keep').length;
      const m = document.createElement('div');
      m.className = 'museum';
      m.innerHTML = `<div><b>${museum}</b>on display in your museum</div><div><b>${kept}</b>in your collection</div><div><b>$${wallet}</b>from sales</div>` +
        `<div><b>${col.length}</b>prepared in all</div>`;
      box.appendChild(m);
    }
    const grid = document.createElement('div');
    grid.className = 'drawers';
    const TOOLNAMES = { chisel: 'chisel', scribe_large: 'large scribe', scribe_fine: 'fine scribe', abrader: 'abrader' };
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      b.className = 'drawer';
      const best = this.best[lv.id];
      const pips = Array.from({ length: 5 }, (_, k) => `<i class="${k < lv.difficulty ? 'f' : ''}"></i>`).join('');
      b.innerHTML = `<div class="pull"></div><div class="body">` +
        `<div class="label"><div class="cat">Drawer ${String(i + 1).padStart(2, '0')} · FH-${String(lv.specimen.seed).padStart(4, '0')}</div>` +
        `<div class="sp">${lv.title}</div><div class="ln">${lv.place}</div></div>` +
        `<div class="blurb">${lv.blurb}</div>` +
        `<div class="tools">Tools: ${lv.tools.map((t) => TOOLNAMES[t]).join(' · ')}</div>` +
        `<div class="meta"><div class="pips" title="difficulty ${lv.difficulty} of 5">${pips}</div>` +
        `<div class="best">${best ? `best <b>$${best}</b> of $${lv.value}` : `unopened · worth up to $${lv.value}`}</div></div></div>`;
      b.onclick = () => {
        const random = $('randomSeed').checked;
        this.start(lv, random ? Math.floor(Math.random() * 1e6) : undefined);
      };
      grid.appendChild(b);
    });
    box.appendChild(grid);
  }

  syncModel(game) {
    $('modelbar').classList.toggle('hidden', !game.modelMode);
    $('btnModel').classList.toggle('on', game.modelMode);
    $('btnModel').textContent = game.mind?.placed ? 'Model' : 'Model…';
    const hb = document.querySelector('#modelbar button[data-m="hide"]');
    if (hb && game.mind) hb.textContent = game.mind.visible ? 'Hide' : 'Show';
    if (!$('guide').classList.contains('hidden')) this.renderGuide(game);
  }

  /** Notebook: identification tests, observations, your identification, and the plan it implies. */
  renderNotebook(game) {
    const box = $('notebook');
    if (box.classList.contains('hidden')) return;
    const armed = game.test;
    const tb = (t, label) => `<button data-t="${t}" class="${armed === t ? 'on' : ''}">${label}</button>`;
    const obs = game.notes.length
      ? `<ul class="obs">${game.notes.map((n) => `<li><b>${{ scratch: 'Scratch', acid: 'Acid', loupe: 'Loupe' }[n.test]}</b> on ${n.where}: ${n.text}</li>`).join('')}</ul>`
      : '<p>No observations yet.</p>';
    const seen = new Set();
    const mats = Object.entries(MATRICES).filter(([, m]) => !seen.has(m.name) && seen.add(m.name));
    const opt = (v, label, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${label}</option>`;
    const plan = game.plan();
    box.innerHTML =
      `<h3>Notebook</h3><p>Identify the rock and the fossil before you commit to a tool. Pick a test, then click a spot on the specimen. Testing the shell itself can mark it: choose a spot that won't matter.</p>` +
      `<div class="tests">${tb('scratch', 'Steel needle')}${tb('acid', 'Acid drop')}${tb('loupe', 'Loupe')}</div>` +
      (armed ? `<p style="color:var(--accent);margin-top:6px">Click the specimen to ${armed === 'loupe' ? 'look closely' : armed === 'acid' ? 'place a drop' : 'scratch it'}.</p>` : '') +
      `<h4>Observations</h4>${obs}` +
      `<h4>Your identification</h4>` +
      `<select data-g="matrix">${opt('', 'Matrix: not sure yet', game.guess.matrix ?? '')}${mats.map(([id, m]) => opt(id, m.name, game.guess.matrix)).join('')}</select>` +
      `<select data-g="fossil">${opt('', 'Fossil material: not sure yet', game.guess.fossil ?? '')}${opt('calcite', 'Calcite', game.guess.fossil)}${opt('pyrite', 'Pyrite', game.guess.fossil)}</select>` +
      `<h4>Plan</h4>` +
      (plan ? plan.map(([h, t]) => `<div class="step"><b>${h}.</b> ${t}</div>`).join('') : '<p>Choose a matrix and a fossil material to get a plan. It follows your identification, so if the tools behave differently from what it says, check your guess.</p>');
    for (const b of box.querySelectorAll('.tests button')) b.onclick = () => game.armTest(b.dataset.t);
    for (const s of box.querySelectorAll('select')) s.onchange = () => game.setGuess(s.dataset.g, s.value);
  }

  /** Field guide: candidate trilobites from this deposit. One of them is in the rock. */
  renderGuide(game) {
    const box = $('guide');
    box.innerHTML = `<h3>Field guide</h3><p>Trilobites known from this deposit. One of them is in your block. Rule them out as features appear, and fit your model to the best match.</p>`;
    this.ruled ??= new Set();
    for (const c of game.guide) {
      const key = c.genus + c.species;
      const el = document.createElement('div');
      el.className = 'card' + (this.ruled.has(key) ? ' out' : '') + (game.mind?.card === c ? ' fit' : '');
      const cv = document.createElement('canvas');
      cv.width = 168;
      cv.height = 208;
      drawSilhouette(cv, c.anatomy, game.sp.spec.seed);
      const info = document.createElement('div');
      info.innerHTML = `<i>${c.genus} ${c.species}</i><div class="sz">${c.size}</div><ul>${c.features.map((f) => `<li>${f}</li>`).join('')}</ul>`;
      const acts = document.createElement('div');
      acts.className = 'acts';
      const fit = document.createElement('button');
      fit.textContent = 'Fit model';
      fit.onclick = () => game.fitModel(c);
      const out = document.createElement('button');
      out.textContent = this.ruled.has(key) ? 'Restore' : 'Rule out';
      out.onclick = () => {
        this.ruled.has(key) ? this.ruled.delete(key) : this.ruled.add(key);
        this.renderGuide(game);
      };
      acts.append(fit, out);
      info.append(acts);
      el.append(cv, info);
      box.append(el);
    }
  }

  /** Day, funds, reputation, knowledge, and the storeroom shelf. */
  /** The contracts clipboard and the lots noticeboard, as storeroom HTML. */
  async _noticeboard(p, items, lvOf) {
    const C = await import('./contracts.js');
    const name = (lv) => [].concat(lv).map((id) => {
      const l = lvOf({ level: id, special: id === 'ridge' });
      return l ? `${l.title.toLowerCase().replace(/^a parcel of /, '')} (${l.place.split(', ').slice(-1)[0]})` : id;
    }).join(' or ');
    let html = `<h3 class="sub">Contracts</h3>`;
    const mine = p.contracts ?? [];
    if (mine.length) {
      html += `<div class="shelf">`;
      for (const a of mine) {
        const c = C.findContract(a.id);
        if (!c) continue;
        const give = C.deliverable(c, items);
        const n = c.goal.count ?? 1, have = items.filter((it) => C.qualifies(c, it)).length;
        const near = items.map((it) => [it, C.shortfall(c, it)]).filter(([, f]) => f);
        const left = a.due - p.day;
        html += `<div class="blk contract on"><div class="cat">${esc(c.from)} · ${left <= 0 ? 'due today' : `${left} day${left === 1 ? '' : 's'} left`}</div>` +
          `<div class="sp">${esc(c.title)}</div><div class="fine">${esc(C.goalText(c, name))}${c.loan ? ' (a loan: it comes back)' : ''}.</div>` +
          `<div class="fine">Pays ${C.rewardText(c.reward)}.</div>` +
          (n > 1 ? `<div class="fine">You have ${have} of ${n}.</div><div class="bar"><i style="width:${Math.min(100, (100 * have) / n)}%"></i></div>` : '') +
          (!give && near.length ? `<div class="fine">Close: ${near.slice(0, 2).map(([it, f]) => `<i>${esc(it.name || 'a specimen')}</i> (${esc(f)})`).join('; ')}.</div>` : '') +
          `<div class="tip">${esc(c.tip)}</div>` +
          `<div class="row">${give ? `<button class="on" data-deliver="${c.id}">${c.loan ? 'Lend' : 'Deliver'} ${give.length > 1 ? `${give.length} specimens` : `<i>${esc(give[0].name || 'specimen')}</i>`}</button>` : `<button disabled>Not ready yet</button>`}</div></div>`;
      }
      html += `</div>`;
    }
    const offers = p.offers ?? [];
    if (offers.length) {
      html += `<p class="fine">${mine.length ? 'Also offered' : 'Offered to you'} (each offer stays up a few days):</p><div class="shelf">`;
      for (const o of offers) {
        const c = C.findContract(o.id);
        if (!c) continue;
        html += `<div class="blk contract"><div class="cat">${esc(c.from)}</div><div class="sp">${esc(c.title)}</div>` +
          `<div class="fine">“${esc(c.text)}”</div><div class="fine">${esc(C.goalText(c, name))}. ${c.days} days.${c.supply ? ` They send the ${c.supply.length > 1 ? 'blocks' : 'block'}.` : ' Source the rock yourself.'}</div>` +
          `<div class="fine">Pays <b>${C.rewardText(c.reward)}</b>.</div>` +
          `<div class="row"><button data-take="${c.id}" ${mine.length >= 3 ? 'disabled title="Three contracts at a time"' : ''}>Take it on</button></div></div>`;
      }
      html += `</div>`;
    } else if (!mine.length) html += `<p class="fine">No contracts on offer today. New ones come up as the days go by.</p>`;
    // The noticeboard.
    const lots = p.lots ?? [];
    html += `<h3 class="sub">Noticeboard: rock for sale</h3>`;
    if (!lots.length) html += `<p class="fine">Nothing on the noticeboard today.</p>`;
    else {
      html += `<div class="shelf">`;
      for (const n of lots) {
        const l = C.findLot(n.id);
        if (!l) continue;
        const lvs = l.blocks.map((id) => lvOf({ level: id, special: id === 'ridge' })).filter(Boolean);
        const hard = Math.max(...lvs.map((lv) => lv.difficulty));
        const left = n.until - p.day;
        html += `<div class="blk notice"><div class="cat">${'●'.repeat(hard)}${'○'.repeat(5 - hard)} · ${left <= 1 ? 'last day' : `${left} days left`}</div>` +
          `<div class="sp">${esc(l.title)}</div><div class="fine">${esc(l.text)}</div>` +
          `<div class="fine">${l.blocks.length} block${l.blocks.length === 1 ? '' : 's'}: ${[...new Set(lvs.map((lv) => esc(lv.place)))].join('; ')}.</div>` +
          `<div class="row"><button data-lot="${l.id}" ${p.funds < n.price ? 'disabled' : ''}>Buy for $${n.price}</button></div></div>`;
      }
      html += `</div>`;
    }
    return html;
  }

  async renderCareer() {
    const box = $('career');
    if (!box) return;
    let p, items;
    try {
      p = await save.ensureCareer(LEVELS);
      items = await save.listItems();
    } catch (e) {
      box.innerHTML = `<p class="fine">Saving isn't available in this browser (${esc(String(e.message || e))}).</p>`;
      return;
    }
    const lvOf = (it) => (it.special ? SPECIAL[it.level] : LEVELS.find((l) => l.id === it.level));
    const shelf = items.filter((it) => it.status === 'raw' || it.status === 'working').sort((a, b) => (b.saved ?? b.created) - (a.saved ?? a.created));
    const done = items.filter((it) => it.status === 'prepared');
    const shown = done.filter((it) => it.where === 'museum').length;
    const { JUNK, TICKET } = await import('./economy.js');
    let html = '';
    const y = p.lastDay;
    if (y) {
      const soldList = Object.entries(y.sold ?? {}).map(([id, n]) => `${n} ${JUNK.find((j) => j.id === id)?.name.toLowerCase() ?? id}`).join(', ');
      html += `<div class="daycard"><div class="cat">Day ${y.day} at the museum</div>` +
        `<p><b>${y.visitors} visitor${y.visitors === 1 ? '' : 's'}</b> came through the doors ($${y.tickets} in tickets at $${TICKET}).` +
        (y.shop ? ` The gift shop sold ${soldList}: <b>$${Math.round(y.shop)}</b>.`
          : !y.visitors ? ''
          : Object.values(y.stock ?? {}).some((n) => n > 0) ? ' Nobody bought anything from the gift shop.'
          : ' The gift shop had nothing to sell: stock it below.') +
        (y.star ? ` Everyone wanted to see the <i>${esc(y.star)}</i>.` : ' With nothing on display, there was little to see.') +
        (y.returned?.length ? ` Back from loan: <i>${y.returned.map(esc).join(', ')}</i>.` : '') +
        (y.expired?.length ? ` ${y.expired.length === 1 ? 'A contract' : `${y.expired.length} contracts`} ran out of time (−${2 * y.expired.length} reputation).` : '') + `</p></div>`;
    }
    html += `<div class="museum"><div><b>Day ${p.day}</b>of your career</div><div><b>$${Math.round(p.funds)}</b>funds</div>` +
      `<div><b>${p.rep}</b>reputation</div><div><b>${p.knowledge}</b>knowledge</div>` +
      `<div><b>${done.length}</b>prepared · ${shown} on display</div></div>`;
    html += `<div class="row" style="margin:-6px 0 16px"><button id="btnMuseum" class="on">Visit your museum</button></div>`;
    html += await this._noticeboard(p, items, lvOf);
    html += `<h3 class="sub">Storeroom shelf</h3><div class="shelf">`;
    for (const it of shelf) {
      const lv = lvOf(it);
      if (!lv) continue;
      const pct = Math.floor((it.exposure ?? 0) * 100);
      const pips = '●'.repeat(lv.difficulty) + '○'.repeat(5 - lv.difficulty);
      html += `<div class="blk"><div class="cat">${esc(lv.place)} · ${pips}</div><div class="sp">${esc(it.name || lv.title)}</div>` +
        (it.status === 'working'
          ? `<div class="fine">${pct}% exposed · ${(it.integrity * 100).toFixed(1)}% integrity · ${Math.round(it.minutes)} min so far</div><div class="bar"><i style="width:${pct}%"></i></div>`
          : `<div class="fine">${it.from ? `From ${esc(it.from)}. ` : ''}Unopened.</div>`) +
        (it.contract ? `<div class="fine tag">For a contract</div>` : '') +
        `<div class="row"><button class="on" data-go="${it.id}">${it.status === 'working' ? 'Continue' : 'Prepare it'}</button></div></div>`;
    }
    if (!shelf.length) html += `<p class="fine">The shelf is empty. Open a drawer below, or check the mail.</p>`;
    html += `</div>`;
    // Prepared pieces: on display or in the drawer.
    if (done.length) {
      html += `<h3 class="sub">Prepared specimens</h3><div class="shelf">`;
      for (const it of done.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))) {
        const lv = lvOf(it);
        const on = it.where === 'museum';
        const gone = it.where === 'sell' || it.where === 'delivered';
        const state = it.where === 'sell' ? ' · sold' : it.where === 'delivered' ? ` · delivered to ${esc(it.deliveredTo ?? 'a client')}`
          : it.loanedTo ? ` · on loan to ${esc(it.loanedTo.who)} until day ${it.loanedTo.back}` : '';
        html += `<div class="blk${gone ? ' gone' : ''}"><div class="cat">${esc(lv?.place ?? '')}</div><div class="sp"><i>${esc(it.name || lv?.title || 'Specimen')}</i></div>` +
          `<div class="fine">Valued at $${it.value ?? 0} · ${Math.floor((it.exposure ?? 0) * 100)}% exposed · ${((it.integrity ?? 0) * 100).toFixed(0)}% integrity${it.mounted ? ' · mounted' : ''}${state}</div>` +
          (gone || it.loanedTo ? '' : `<div class="row"><button data-show="${it.id}" class="${on ? '' : 'on'}">${on ? 'Take off display' : 'Put on display'}</button></div>`) + `</div>`;
      }
      html += `</div>`;
    }
    // The gift shop: junk in bulk, sold at a markup to whoever comes in.
    html += `<h3 class="sub">Gift shop</h3><p class="fine">Bought in bulk, sold to visitors. Visitors come to see the specimens on display; the shop just makes them pay twice.</p><div class="shelf">`;
    for (const j of JUNK) {
      const have = p.stock?.[j.id] ?? 0, cost = Math.round(j.cost * j.lot);
      html += `<div class="blk"><div class="sp">${j.icon} ${esc(j.name)}</div><div class="fine">${have} in stock · sells at $${j.price}</div>` +
        `<div class="row"><button data-buy="${j.id}" ${p.funds < cost ? 'disabled' : ''}>Buy ${j.lot} for $${cost}</button></div></div>`;
    }
    html += `</div>`;
    box.innerHTML = html;
    for (const b of box.querySelectorAll('[data-go]')) b.onclick = () => this.resume(b.dataset.go);
    const act = (sel, key, fn) => {
      for (const b of box.querySelectorAll(sel)) b.onclick = async () => {
        b.disabled = true;
        const err = await fn(b.dataset[key]);
        if (err) this.toast(err);
        import('./telemetry.js').then((t) => t.track(key, b.dataset[key], { ok: !err }));
        this.renderCareer();
      };
    };
    act('[data-take]', 'take', save.acceptContract);
    act('[data-deliver]', 'deliver', save.deliverContract);
    act('[data-lot]', 'lot', save.buyLot);
    $('btnMuseum').onclick = () => this.visitMuseum();
    for (const b of box.querySelectorAll('[data-show]')) b.onclick = async () => {
      const it = await save.getItem(b.dataset.show);
      it.where = it.where === 'museum' ? 'keep' : 'museum';
      await save.putItem(it);
      this.renderCareer();
    };
    for (const b of box.querySelectorAll('[data-buy]')) b.onclick = async () => {
      const { restock } = await import('./economy.js');
      const np = restock(await save.profile(), b.dataset.buy);
      if (!np) return this.toast("Not enough funds for that lot yet");
      await save.saveProfile(np);
      import('./telemetry.js').then((t) => t.track('restock', '', { id: b.dataset.buy }));
      this.renderCareer();
    };
    // The hero's main button picks up where you left off.
    const cur = shelf.find((it) => it.status === 'working');
    const hero = $('btnStart');
    if (cur) {
      hero.textContent = `Continue: ${cur.name || lvOf(cur)?.title || 'your block'}`;
      hero.onclick = () => this.resume(cur.id);
    }
  }

  async visitMuseum() {
    const m = this.game.museum;
    for (const id of ['menu', 'showlabel', 'intro', 'celebrate', 'hud', 'results']) $(id)?.classList.add('hidden');
    $('museumHud').classList.remove('hidden');
    const n = await m.enter();
    $('museumInfo').textContent = n ? `${n} specimen${n === 1 ? '' : 's'} on display` : 'Nothing on display yet: finish a specimen and choose "Display it in my museum".';
    import('./telemetry.js').then((t) => t.track('museum_visit', '', { n }));
  }

  leaveMuseum() {
    this.game.museum.leave();
    $('museumHud').classList.add('hidden');
    this.showMenu();
  }

  museumClick(x, y) {
    const it = this.game.museum.click(x, y);
    if (it) this.toast(it.name || 'Specimen');
  }

  /** Take a block off the shelf: resume its saved state if there is one. */
  async resume(id) {
    const it = await save.getItem(id);
    if (!it) return;
    const lv = it.special ? SPECIAL[it.level] : LEVELS.find((l) => l.id === it.level);
    const state = it.status === 'working' ? await save.loadState(id) : null;
    this.start(lv, it.seed, { item: it, state });
  }

  showMenu(msg) {
    if (msg) setTimeout(() => this.toast(msg, 'good'), 300);
    this.renderCareer();
    $('celebrate').classList.add('hidden');
    this.game?.view.celebrate(false);
    this.game?.view.showcaseMode(true);
    this.renderLevels();
    $('menu').classList.remove('hidden');
    $('menu').scrollTop = 0;
    if ($('showName').textContent !== '—') $('showlabel').classList.remove('hidden');
    $('results').classList.add('hidden');
    $('hud').classList.add('hidden');
  }

  showLoading() {
    $('showlabel').classList.add('hidden');
    this.game?.view.showcaseMode(false);
    $('loadTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    $('menu').classList.add('hidden');
    $('results').classList.add('hidden');
    $('loading').classList.remove('hidden');
  }

  onLoaded(game) {
    // Show only what this level offers.
    const lv = game.level;
    for (const b of document.querySelectorAll('#tools button')) b.classList.toggle('hidden', !lv.tools.includes(b.dataset.tool));
    for (const b of document.querySelectorAll('#media button')) b.classList.toggle('hidden', !lv.media.includes(b.dataset.media));
    $('btnNotes').classList.toggle('hidden', !lv.features.includes('notebook'));
    $('btnGuide').classList.toggle('hidden', !lv.features.includes('guide'));
    $('btnModel').classList.toggle('hidden', !lv.features.includes('model'));
    // Intro card: where we are, and what's new.
    $('introPlace').textContent = `${lv.place} · difficulty ${'●'.repeat(lv.difficulty)}${'○'.repeat(5 - lv.difficulty)}`;
    $('introTitle').textContent = lv.title;
    $('introBlurb').textContent = game.resumed
      ? `Back on the bench where you left it: ${Math.round((performance.now() - game.started) / 60000)} minutes of work so far. ${lv.blurb}`
      : lv.blurb;
    $('introFresh').innerHTML = lv.fresh.length
      ? `<p class="lead" style="margin:14px 0 6px">New on this bench</p><div class="fresh">${lv.fresh.map(([a, b]) => `<b>${a}</b><span>${b}</span>`).join('')}</div>`
      : '';
    $('intro').classList.remove('hidden');
    $('btnBegin').onclick = () => $('intro').classList.add('hidden');
    this.ruled = new Set();
    $('guide').classList.add('hidden');
    $('notebook').classList.add('hidden');
    this.syncModel(game);
    $('loading').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('lvTitle').textContent = game.level.title;
    $('lvPlace').textContent = `${game.level.place} · specimen ${game.seed}`;
    this.syncSettings(game);
    this.syncStatus(game);
  }

  syncSettings(game) {
    const s = game.settings, d = game.describeSettings();
    for (const b of document.querySelectorAll('#tools button')) b.classList.toggle('on', b.dataset.tool === s.tool);
    for (const b of document.querySelectorAll('#media button')) b.classList.toggle('on', b.dataset.media === s.media);
    $('media').classList.toggle('hidden', s.tool !== 'abrader');
    for (const b of document.querySelectorAll('#heads button')) b.classList.toggle('on', b.dataset.head === s.head);
    $('heads').classList.toggle('hidden', s.tool !== 'chisel');
    $('padX').textContent = `${d.xLabel} →`;
    $('padY').textContent = d.yLabel === '—' ? '' : `↑ ${d.yLabel}`;
    const y = d.yLabel === '—' ? '' : ` · ${d.yLabel.toLowerCase()} ${Math.round(s.flow * 100)}%`;
    $('readout').textContent = s.tool === 'chisel' ? `hammer ${['light', 'medium', 'heavy'][Math.min(2, Math.floor(s.pressure * 3))]}` : `${d.psi} psi${y}`;
    $('angleRead').textContent = `Angle ${d.tiltDeg}°`;
    this.input?.syncPad?.();
  }

  syncStatus(game, dropped) {
    const p = Math.floor(game.exposure * 100 + 1e-6);
    $('expPct').textContent = `${p}%`;
    // The last couple of percent are crumbs in crevices: offer to show them, or sweep them away.
    const near = game.exposure >= 0.96 && game.exposure < 1;
    $('wrapup').classList.toggle('hidden', !near);
    if (!near && game.showLeft) $('btnLeft').onclick();
    $('expBar').style.width = `${p}%`;
    const iv = game.integ.value * 100;
    $('intPct').textContent = `${iv >= 99.95 ? 100 : iv.toFixed(1)}%`;
    $('intBar').style.width = `${iv}%`;
    if (dropped) {
      $('integ').classList.add('drop');
      clearTimeout(this._dt);
      this._dt = setTimeout(() => $('integ').classList.remove('drop'), 500);
    }
  }

  /** Small panel by the tool tip: what it's touching and what it's doing right now. */
  readout(game, tip, probe, active) {
    const el = $('tipread');
    if (game.settings.tool === 'chisel') {
      const ch = game.ch;
      const at = ch ? ch.tip : tip;
      const pos = at && !game.xrAim ? game.view.toScreen(at) : null;
      if (!pos) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      const c = ch ? ch.charge : 0;
      el.innerHTML = ch
        ? `<div class="touch">${ch.swing === null ? 'drag to lean · release to strike · Esc, right-click or two fingers to call it off' : 'strike'}</div>` +
          `<div class="row rm"><span>blow</span><div class="b"><i style="width:${c * 100}%"></i></div></div>` +
          `<div class="row"><span></span><span style="color:var(--muted)">${c < 0.25 ? 'tap' : c < 0.6 ? 'firm' : c < 0.95 ? 'hard' : 'full force'}</span></div>`
        : `<div class="touch">press, drag to lean, hold to wind up</div>`;
      return;
    }
    const pos = tip && !game.xrAim ? game.view.toScreen(tip) : null;
    if (!pos) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    let touch = probe?.contact === 'fossil' ? 'on shell' : probe?.contact === 'rock' ? 'on matrix' : 'in air';
    if (probe?.contact === 'rock' && game.mind?.placed && tip) {
      const v = game.sp.vol, g = v.grid(tip.x, tip.y, tip.z);
      const n = v.idx(Math.round(g[0]), Math.round(g[1]), Math.round(g[2]));
      if (n >= 0 && n < v.count && game.mind.mask[n]) touch = '<span style="color:#7ec4ff">inside your model: protected</span>';
    }
    const rm = active ? game.rate.removed : 0, ig = active ? Math.max(0, game.rate.integ) : 0;
    const rmW = Math.min(100, (Math.log10(1 + rm) / 2.5) * 100);
    const igW = Math.min(100, ig * 100);
    el.innerHTML = `<div class="touch">${touch}</div>` +
      `<div class="row rm"><span>matrix</span><div class="b"><i style="width:${rmW}%"></i></div></div>` +
      `<div class="row"><span></span><span style="color:var(--muted)">${active ? `${rm.toFixed(rm < 10 ? 1 : 0)} mm³/s` : '—'}</span></div>` +
      `<div class="row ig"><span>integrity</span><div class="b"><i style="width:${igW}%"></i></div></div>` +
      `<div class="row"><span></span><span style="color:${ig > 0.005 ? 'var(--bad)' : 'var(--muted)'}">${active ? (ig > 0.005 ? `−${ig.toFixed(2)} %/s` : 'no effect') : '—'}</span></div>`;
  }

  toast(msg, kind = '') {
    const t = $('toast');
    t.textContent = msg;
    t.className = `show ${kind}`;
    this.lastToast = msg;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => {
      t.className = '';
      this.lastToast = '';
    }, 1400);
  }

  /**
   * The finish: the specimen turns on the bench, confetti, the reveal of what it is, then
   * where it goes, then the leaderboard.
   */
  showResults(game, g) {
    $('hud').classList.add('hidden');
    $('guide').classList.add('hidden');
    $('notebook').classList.add('hidden');
    $('tipread').style.display = 'none';
    game.view.celebrate(true);
    confetti();
    const card = game.guide.find((c) => c.isTrue);
    const lv = game.level;
    const score = scoreOf(g);
    this.result = { game, g, card, score };
    const id = lv.id;
    if (!this.best[id] || g.value > this.best[id]) {
      this.best[id] = g.value;
      saveBest(this.best);
    }
    const pct = (x) => `${Math.round(x * 100)}%`;
    $('cpanel').innerHTML = `<div id="cardMain">` +
      `<div class="kicker">${game.sp.count > 1 ? `${['', '', 'Two', 'Three'][game.sp.count]} specimens in one slab!` : 'Specimen prepared'}</div>` +
      `<div class="label"><div class="cat">FH-${String(lv.specimen.seed).padStart(4, '0')}-${game.seed} · prepared by ${esc(loadJSON('fh-player', {}).name || 'you')} · ${new Date().toISOString().slice(0, 10)}</div>` +
      `<div class="sp">${card.genus} ${card.species}</div>` +
      `<div class="ln">${article(GROUP[card.archetype] ?? 'trilobite')}. ${lv.title}, ${lv.place}.</div></div>` +
      `<div class="feat">${card.features.map((f) => `<span>${f}</span>`).join('')}</div>` +
      `<div class="stats">` +
      `<div>Shell exposed</div><div>${pct(g.exposure)}</div>` +
      `<div>Fossil integrity</div><div>${(g.integrity * 100).toFixed(1)}%</div>` +
      (g.spines ? `<div>Spines intact</div><div>${g.spines - g.snapped} / ${g.spines}</div>` : '') +
      `<div>Time</div><div>${g.minutes.toFixed(1)} min</div>` +
      (lv.features.includes('notebook') ? `<div>Identification</div><div>${idText(game)}</div>` : '') +
      `<div>Score</div><div><b>${score}</b></div>` +
      `</div>` +
      `<div class="big" id="cValue">$${g.value}</div>` +
      (game.sp.opal ? valuerNote(game.sp, g.value) : '') +
      `<button id="cBench" class="bench-cta">Prepare for display<small>Saw it to shape, level the base, and mount it.</small></button>` +
      `<div class="row" style="margin:8px 0 2px"><button id="exGlb">Download 3D model (.glb)</button><button id="exStl">For 3D printing (.stl)</button></div>` +
      `<p class="fine" style="margin:0 0 6px">The .glb keeps colours (Blender, other games, AR). The .stl is in millimetres for slicers.</p>` +
      `<div class="choices" id="where">` +
      `<p style="margin:6px 0 0">Where will it go?</p>` +
      `<button data-w="museum">Display it in my museum<small>Pride of place. It stays yours.</small></button>` +
      `<button data-w="sell">Sell it to a museum<small>+$${g.value}</small></button>` +
      `<button data-w="keep">Keep it in my collection<small>For the drawer of good things.</small></button>` +
      `</div></div><div id="benchPanel" class="hidden"></div>`;
    $('cBench').onclick = () => this._bench();
    for (const b of document.querySelectorAll('#where button')) b.onclick = () => this._place(b.dataset.w);
    const fname = `${card.genus}-${card.species}-${game.seed}`.replace(/\s+/g, '-');
    $('exGlb').onclick = async () => (await import('./export.js')).exportGLB(game.view, fname);
    $('exStl').onclick = async () => (await import('./export.js')).exportSTL(game.view, fname);
    $('celebrate').classList.remove('hidden');
  }

  /** The display bench panel (see display.js). */
  _bench() {
    const { game } = this.result;
    const b = game.openBench();
    if (!b) return;
    $('cardMain').classList.add('hidden');
    const el = $('benchPanel');
    el.classList.remove('hidden');
    el.innerHTML =
      `<div class="kicker">Display bench</div>` +
      `<p class="fine" style="margin:4px 0 10px">Saw the block to a shape for showing. Drag to turn it. The saw never touches the fossil.</p>` +
      `<label class="fine">Shape</label>` +
      `<div class="seg" id="bShape"><button data-s="none" class="on">As found</button><button data-s="oval">Oval</button><button data-s="round">Round</button><button data-s="custom">Custom</button></div>` +
      `<div id="bSizeRow"><label class="fine">Size</label><input type="range" id="bSize" min="0" max="1" step="0.01" value="0.35"></div>` +
      `<div id="bCustom" class="hidden"><p class="fine" style="margin:4px 0">Click round the fossil to place up to 16 corners.</p>` +
      `<div class="row"><button id="bUndo">Undo point</button><button id="bClear">Clear</button></div></div>` +
      `<label class="fine">Saw the base flat</label><input type="range" id="bBase" min="0" max="1" step="0.01" value="0">` +
      `<label class="fine">Edges: clean saw cut ↔ natural</label><input type="range" id="bRough" min="0" max="1" step="0.01" value="0.2">` +
      `<p class="fine" id="bMsg" style="min-height:1.4em;margin:6px 0"></p>` +
      `<div class="row"><button id="bMount" class="on">Mount it</button><button id="bBack">Leave it as it was</button></div>` +
      `<p class="fine">Mounting fixes the shape for good, and the download uses it.</p>`;
    let pending = null;
    const msg = (e) => ($('bMsg').textContent = e ?? '');
    this.benchStatus = msg;
    const later = (patch) => {
      Object.assign(b.p, patch);
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = null;
        msg(b.apply());
      });
    };
    const shapeUI = () => {
      const s = b.p.shape;
      for (const x of document.querySelectorAll('#bShape button')) x.classList.toggle('on', x.dataset.s === s);
      $('bSizeRow').classList.toggle('hidden', !(s === 'oval' || s === 'round'));
      $('bCustom').classList.toggle('hidden', s !== 'custom');
    };
    for (const x of document.querySelectorAll('#bShape button')) x.onclick = () => {
      later({ shape: x.dataset.s });
      shapeUI();
      if (x.dataset.s === 'custom' && b.p.pts.length < 3) msg('Click on the block to place corners.');
    };
    $('bSize').oninput = (e) => later({ size: +e.target.value });
    $('bBase').oninput = (e) => later({ base: +e.target.value });
    $('bRough').oninput = (e) => later({ rough: +e.target.value });
    $('bUndo').onclick = () => { b.p.pts.pop(); later({}); };
    $('bClear').onclick = () => { b.p.pts = []; later({}); };
    shapeUI();
    const back = () => {
      el.classList.add('hidden');
      $('cardMain').classList.remove('hidden');
      game.view.celebrate(true);
    };
    $('bBack').onclick = () => {
      b.set({ shape: 'none', base: 0, pts: [] });
      b.close();
      game.bench = null;
      back();
    };
    $('bMount').onclick = () => {
      const err = b.mount();
      if (err) return msg(err);
      const { g } = this.result;
      const r = b.result;
      // A tidy mount presents better: a modest bump, earned once.
      if (r.trimmed > 0.01 && !g.mounted) {
        g.mounted = r;
        g.value = Math.round(g.value * 1.08);
        $('cValue').textContent = `$${g.value}`;
        const sell = document.querySelector('#where button[data-w="sell"] small');
        if (sell) sell.textContent = `+$${g.value}`;
      }
      if (game.item) Object.assign(game.item, { mounted: true, value: g.value });
      game.bakeDisplay(); // the museum shows the mounted shape (and saves the item)
      import('./telemetry.js').then((t) => t.track('mounted', game.level.id, { shape: r.shape, base: r.base, rough: +r.rough.toFixed(2), trimmed: +r.trimmed.toFixed(2) }));
      $('cBench').outerHTML = `<div class="feat"><span>Mounted: ${esc(r.text)}${g.mounted ? ' · +8% presentation' : ''}</span></div>`;
      back();
    };
  }

  _place(where) {
    const { game, g, card, score } = this.result;
    import('./telemetry.js').then((t) => t.track('placed', game.level.id, { where }));
    const col = loadJSON('fh-collection', []);
    col.push({ level: game.level.id, name: `${card.genus} ${card.species}`, value: g.value, where, score, date: new Date().toISOString().slice(0, 10) });
    saveJSON('fh-collection', col);
    if (where === 'sell') saveJSON('fh-wallet', loadJSON('fh-wallet', 0) + g.value);
    // The career record: where the piece went, and the money if sold.
    (async () => {
      if (game.item) {
        game.item.where = where;
        game.item.name = `${card.genus} ${card.species}`;
        game.item.value = g.value;
        game.item.mounted = !!g.mounted;
        await save.putItem(game.item);
        // Does it answer a contract? Say so; delivering is a choice made in the storeroom.
        if (where !== 'sell') {
          const C = await import('./contracts.js');
          const pr = await save.profile();
          const hit = (pr.contracts ?? []).map((a) => C.findContract(a.id)).find((c) => c && C.qualifies(c, game.item));
          const miss = !hit && (pr.contracts ?? []).map((a) => C.findContract(a.id)).map((c) => c && [c, C.shortfall(c, game.item)]).find((x) => x?.[1]);
          const line = hit ? `It meets the contract from <b>${esc(hit.from)}</b>: deliver it from the storeroom whenever you're ready.`
            : miss ? `Not quite enough for ${esc(miss[0].from)}: ${esc(miss[1])}.` : '';
          if (line) $('where').insertAdjacentHTML('afterbegin', `<p class="fine" style="margin:6px 0 0">${line}</p>`);
        }
      }
      if (where === 'sell') {
        const p = await save.profile();
        p.funds += g.value;
        await save.saveProfile(p);
      }
    })();
    // The first finished specimen brings a parcel from Lightning Ridge.
    if (!loadJSON('fh-ridge-sent', false)) {
      saveJSON('fh-ridge-sent', true);
      const mail = loadJSON('fh-mail', []);
      mail.push({ id: 'ridge', seed: Math.floor(Math.random() * 1e6), from: 'a miner at Lightning Ridge, NSW' });
      saveJSON('fh-mail', mail);
      this.parcel = true;
    }
    const said = { museum: 'On display in your museum.', sell: `Sold for $${g.value}.`, keep: 'Tucked into your collection.' }[where];
    const who = loadJSON('fh-player', { name: '', email: '', updates: false });
    const box = $('where');
    box.innerHTML =
      `<p style="margin:6px 0 0"><b>${said}</b></p>` +
      `<p style="margin:10px 0 2px">Put your result on the leaderboard?</p>` +
      `<label class="fine">Name (shown on the board)</label><input type="text" id="lbName" maxlength="24" value="${esc(who.name)}" placeholder="Your name">` +
      `<label class="fine">Email (never shown)</label><input type="email" id="lbEmail" maxlength="120" value="${esc(who.email)}" placeholder="you@example.com">` +
      `<label class="fine" style="display:flex;gap:8px;align-items:center;margin:2px 0 8px"><input type="checkbox" id="lbUpd" ${who.updates ? 'checked' : ''}> Email me when there's a significant update</label>` +
      `<div class="row" style="margin:6px 0"><button id="lbGo" class="on">Add to leaderboard</button><button id="lbSkip">Skip</button></div>` +
      `<p class="fine">Only your name appears on the board. Your email is stored privately and only used to send updates if you tick the box.</p>`;
    $('lbGo').onclick = () => this._submit();
    $('lbSkip').onclick = () => this._board(null);
  }

  async _submit() {
    const { game, g } = this.result;
    const name = $('lbName').value.trim(), email = $('lbEmail').value.trim(), updates = $('lbUpd').checked;
    if (!name) {
      $('lbName').focus();
      return;
    }
    saveJSON('fh-player', { name, email, updates });
    $('lbGo').disabled = true;
    try {
      const r = await fetch('api/score.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: game.level.id, seed: game.seed, name, email, updates, exposure: g.exposure, integrity: g.integrity, minutes: g.minutes }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.status);
      this._board(data);
    } catch (e) {
      this._board({ error: String(e.message || e) });
    }
  }

  async _board(data) {
    const { game } = this.result;
    if (!data) {
      try {
        data = await (await fetch(`api/score.php?level=${encodeURIComponent(game.level.id)}`)).json();
      } catch {
        data = { error: 'leaderboard unavailable' };
      }
    }
    const box = $('where');
    const parcel = this.parcel
      ? `<div class="label" style="margin:10px 0"><div class="cat">Post · just arrived</div><div class="sp">A parcel from Lightning Ridge</div>` +
        `<div class="ln">Heavy for its size, wrapped in newspaper, postmarked New South Wales. Open it now, or put it in the mail room for later?</div></div>` +
        `<div class="row" style="margin:6px 0"><button id="cParcel" class="on">Open it now</button><button id="cMail">Put it in the mail room</button></div>`
      : '';
    const rows = (data.top ?? []).map((t, i) =>
      `<tr class="${data.id && t.id === data.id ? 'me' : ''}"><td>${i + 1}</td><td>${esc(t.name)}</td><td class="n">${t.score}</td><td class="n">${t.minutes.toFixed(1)} min</td></tr>`).join('');
    box.innerHTML =
      parcel +
      (data.rank ? `<p style="margin:6px 0 0"><b>You're #${data.rank} of ${data.total}</b> on ${esc(game.level.title)}.</p>` : '') +
      (data.error ? `<p class="fine">Leaderboard: ${esc(data.error)}</p>` : '') +
      (rows ? `<table>${rows}</table><p class="fine">Score = 1000 × exposed × integrity, minus 5 a minute.</p>` : '') +
      `<div class="row"><button id="cNext" class="on">Next specimen</button><button id="cRetry">Try again</button><button id="cMenu">Menu</button></div>`;
    const done = () => {
      $('celebrate').classList.add('hidden');
      game.view.celebrate(false);
    };
    $('cNext').onclick = () => {
      done();
      const i = LEVELS.indexOf(game.level);
      this.start(LEVELS[(i + 1) % LEVELS.length]);
    };
    $('cRetry').onclick = () => {
      done();
      this.start(game.level, game.seed);
    };
    $('cMenu').onclick = () => {
      done();
      this.showMenu();
    };
    if (this.parcel) {
      this.parcel = false;
      $('cParcel').onclick = () => {
        done();
        this.openMail(0);
      };
      $('cMail').onclick = () => {
        import('./telemetry.js').then((t) => t.track('parcel_mailroom', 'ridge'));
        $('cParcel').parentElement.innerHTML = '<p class="fine">It\'s waiting in the mail room (on the main menu).</p>';
      };
    }
  }

  setXR(on) {
    $('hud').classList.toggle('hidden', on);
  }

  showVRButtons(enter) {
    for (const id of ['btnVR', 'btnVR2']) {
      const b = $(id);
      b.classList.remove('hidden');
      b.onclick = enter;
    }
  }
}

/** Top-down drawing of a trilobite from its anatomy: shaded shield plus spines. */
function drawSilhouette(cv, a, seed) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.fillStyle = '#121214';
  c.fillRect(0, 0, W, H);
  const sc = H / 1.55, cx = W / 2, cy = H * 0.52;
  // Spines first (under the shield).
  c.strokeStyle = '#b9a98a';
  c.lineCap = 'round';
  for (const s of shapes(a, seed, 0.006).list) {
    if (!s.part) continue;
    c.lineWidth = Math.max(1.2, (s.ra + s.rb) * sc);
    c.beginPath();
    c.moveTo(cx + s.A[0] * sc, cy - s.A[1] * sc);
    c.lineTo(cx + s.B[0] * sc, cy - s.B[1] * sc);
    c.stroke();
  }
  const img = c.getImageData(0, 0, W, H);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const X = (px - cx) / sc, Y = (cy - py) / sc;
      const [w, top] = outlineTop(a, X, Y, seed);
      if (w <= 0 || Math.abs(X) > w) continue;
      // Light from the upper left on the relief.
      const [, tx] = outlineTop(a, X + 0.006, Y, seed);
      const [, ty] = outlineTop(a, X, Y + 0.006, seed);
      const shade = Math.max(0.25, Math.min(1.25, 0.75 + (top - tx) * 60 + (ty - top) * 60 + top * 2));
      const i = (py * W + px) * 4;
      img.data[i] = 200 * shade;
      img.data[i + 1] = 178 * shade;
      img.data[i + 2] = 140 * shade;
      img.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
}

function idText(game) {
  const { matrix, fossil } = game.guess;
  if (!matrix && !fossil) return '—';
  const realM = MATRICES[game.level.matrix].name, realF = game.sp.fossilMat.kind;
  const okM = matrix && MATRICES[matrix].name === realM, okF = fossil === realF;
  return `${matrix ? (okM ? 'matrix ✓' : `matrix ✗ (${realM})`) : 'matrix —'} · ${fossil ? (okF ? 'fossil ✓' : `fossil ✗ (${realF})`) : 'fossil —'}`;
}

const GROUP = {
  ammonite: 'ammonite', gastropod: 'sea snail', bivalve: 'bivalve', brachiopod: 'brachiopod', shark_tooth: 'shark tooth',
  bivalve_opal: 'opalised freshwater mussel',
  ptychopariid: 'ptychopariid trilobite', redlichiid: 'redlichiid trilobite', asaphid: 'asaphid trilobite',
  phacopid: 'phacopid trilobite', dalmanitid: 'dalmanitid trilobite', odontopleurid: 'spiny odontopleurid trilobite',
};

/** Leaderboard score: completion and care, with a little for speed. The server recomputes it. */
export function scoreOf(g) {
  return Math.max(0, Math.round(1000 * g.exposure * g.integrity - 5 * g.minutes));
}

/**
 * Opal has no grading formula anyone agrees on: a buyer looks at tone, brightness, colour and
 * pattern and says what it'll fetch, guided by what similar stones went for. So: a guide range
 * from "comparable sales", and the price this buyer offers.
 */
function valuerNote(sp, value) {
  const o = sp.opal;
  const lo = Math.round(value * 0.7 / 10) * 10, hi = Math.round(value * 1.35 / 10) * 10;
  const why = [
    o.tone <= 2 ? 'a properly black body' : o.tone <= 4 ? 'a dark body' : 'a pale body that lets the fire wash out',
    o.top === 'red' ? 'red in it, which is rare and moves the price on its own' : o.top === 'orange' ? 'warm orange fire' : o.top === 'green' ? 'green fire' : 'mostly blue fire',
    o.pattern === 'harlequin' ? 'a true harlequin pattern' : o.pattern,
    o.bright <= 2 ? 'bright from most angles' : o.bright >= 4 ? 'a bit dull unless the light is right' : 'decent brightness',
  ];
  return `<p class="fine" style="margin:2px 0 6px">A buyer at the Ridge: “${why.join(', ')}. Similar pieces have gone for $${lo}–$${hi}.” Opal prices are judgement, not formula.</p>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function loadJSON(k, d) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
}

function saveJSON(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

function confetti() {
  const box = document.getElementById('confetti');
  box.innerHTML = '';
  const cols = ['#e0b35a', '#f2e9d8', '#9cc58a', '#7ec4ff', '#e07a5a', '#c9a345'];
  for (let i = 0; i < 140; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = cols[i % cols.length];
    p.style.animationDuration = `${2.2 + Math.random() * 2.6}s`;
    p.style.animationDelay = `${Math.random() * 0.8}s`;
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  setTimeout(() => (box.innerHTML = ''), 6000);
}

const TIPS = [
  'Preparators wet the rock to read it: water darkens the matrix, makes the shell shine, and shows a shadow where shell lies just under thin rock.',
  'Low, raking light shows relief that overhead light flattens. Swing the lamp.',
  'Shale splits along its bedding. Find the dark parting line on the side of the block.',
  'A blow straight down into the middle of a face only crushes. Work from the edges.',
  'Bicarbonate is softer than calcite. It can clean a shell without marking it.',
  'Matte grey speck on a glossy shell? That is rock.',
  'Spines snap once the rock holding them is gone. Free them last.',
  'Some trilobites rolled up like woodlice when threatened, and fossilised that way.',
  'Pyrite trilobites can preserve legs and antennae. Gentle hands.',
  'Trilobites lived for nearly 300 million years, through the Cambrian to the end of the Permian.',
];

function article(w) {
  return `${/^[aeiou]/i.test(w) ? 'An' : 'A'} ${w}`;
}
