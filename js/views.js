/* Page views. Each view returns { html, mount?(root), tick?(now), frame?(now), destroy?() }. */
(function () {
  const G = (window.G = window.G || {});
  const V = (G.views = {});
  const f = () => G.f;
  const H = () => G.H;

  function setHTML(el, html) {
    if (el && el.__html !== html) { el.innerHTML = html; el.__html = html; }
  }
  function setText(el, txt) {
    if (el && el.textContent !== txt) el.textContent = txt;
  }

  /** Order of lanes by current position (finished first by finish time). */
  function standingAt(race, ms) {
    return race.pixels.map((p, i) => {
      const res = race.results.find((r) => r.i === i);
      const done = res.finishMs !== null && ms >= res.finishMs;
      return { i, id: p.id, x: G.posAt(race, i, ms), done, finishMs: res.finishMs, place: res.place };
    }).sort((a, b) => {
      if (a.done && b.done) return a.finishMs - b.finishMs;
      if (a.done) return -1;
      if (b.done) return 1;
      return b.x - a.x;
    });
  }

  function napSoFar(race, i, ms) {
    const k = Math.min(Math.floor(ms / race.segMs), race.modes[i].length);
    let c = 0;
    for (let j = 0; j < k; j++) if (race.modes[i][j] === 'n') c++;
    return c * race.segMs;
  }

  function nextLine(L) {
    const nx = L.next;
    if (nx.kind === 'gp') return `Up next: the ${nx.name}, starting ${f().full(nx.startMs)}. The top eight by rating on the day will qualify.`;
    const [a, b] = nx.lineup;
    return `Up next: Crawl ${nx.number}, ${G.pxLink(a)} against ${G.pxLink(b)}, starting ${f().full(nx.startMs)}.`;
  }

  function screenHTML(extra = '') {
    return `<figure class="screen">
      <canvas class="track" aria-hidden="true"></canvas>
      <div class="screen-bar"><span>Close-up on the leader, one square per pixel</span><span class="clock"></span></div>
      <canvas class="loupe" aria-hidden="true"></canvas>
      ${extra}
    </figure>`;
  }

  function feedHTML(race, ms, startMs) {
    const evs = race.events.filter((e) => e.ms <= ms).slice().reverse();
    if (!evs.length) return '<li class="empty">The pixels are lining up. First movement any moment.</li>';
    return evs.map((e) => `<li><time>${f().time(startMs + e.ms)}</time><span>${G.say(race, e)}</span></li>`).join('');
  }

  // ---------------------------------------------------------------- live
  V.live = function (L) {
    const race = L.current;
    const isGP = race.kind === 'gp';
    let root, track, loupe, lastFeedCount = -1;
    const title = isGP ? race.name : `Crawl ${race.number}`;

    const html = `<section class="live">
      <header class="page-head">
        <p class="race-name">${G.f.esc(title)}, ${f().date(race.startMs)}</p>
        <h1 class="status" data-f="status"></h1>
        <p class="lede" data-f="meta"></p>
      </header>
      ${screenHTML()}
      <div class="live-body">
        <div class="tele-wrap" data-f="tele"></div>
        <section class="log" aria-live="off">
          <h2>Race log</h2>
          <ol class="feed" data-f="feed"></ol>
          <p class="next">${nextLine(L)}</p>
        </section>
      </div>
    </section>`;

    function teleCrawl(ms, order) {
      return order.map((o) => {
        const p = G.PX[o.id];
        const rival = race.lineup.find((x) => x !== o.id);
        const h = L.stats[o.id].h2h[rival] || [0, 0];
        const togo = (1 - o.x) * race.trackPx;
        const spd = o.done ? 0 : G.speedAt(race, o.i, ms);
        const mode = G.modeAt(race, o.i, ms);
        return `<article class="tele" style="--c:${p.color}">
          <header>${G.pxLink(o.id)}<span class="place">${o.done ? G.f.ord(o.place + 1) : order[0] === o ? 'Leading' : 'Chasing'}</span></header>
          <dl>
            <div class="big"><dt>Distance</dt><dd>${(o.x * race.trackPx).toFixed(3)}<small> px</small></dd></div>
            <div><dt>Speed</dt><dd>${spd.toFixed(1)} px/h</dd></div>
            <div><dt>Status</dt><dd class="mode-${mode}">${G.MODE[mode]}</dd></div>
            <div><dt>${o.done ? 'Time' : 'To go'}</dt><dd>${o.done ? f().dur(o.finishMs, true) : togo.toFixed(2) + ' px'}</dd></div>
            <div><dt>Asleep so far</dt><dd>${f().dur(napSoFar(race, o.i, ms))}</dd></div>
            <div><dt>Rating</dt><dd>${L.rating[o.id].toFixed(0)}</dd></div>
            <div><dt>Record vs ${G.f.esc(G.PX[rival].name)}</dt><dd>${h[0]}–${h[1]}</dd></div>
          </dl>
        </article>`;
      }).join('');
    }

    function teleGP(ms, order) {
      const lead = order[0];
      const rows = order.map((o, k) => {
        const mode = G.modeAt(race, o.i, ms);
        const gap = k === 0 ? 'Leader' : o.done ? '+' + f().dur(o.finishMs - lead.finishMs, true) : '−' + ((lead.x - o.x) * race.trackPx).toFixed(2) + ' px';
        return `<tr><td class="n">${k + 1}</td><td>${G.pxLink(o.id)}</td>
          <td class="n">${(o.x * race.trackPx).toFixed(2)}</td><td class="n">${gap}</td>
          <td class="n">${o.done ? '–' : G.speedAt(race, o.i, ms).toFixed(1)}</td>
          <td class="mode-${mode}">${G.MODE[mode]}</td></tr>`;
      }).join('');
      return `<div class="table-wrap"><table class="data">
        <caption>Running order</caption>
        <thead><tr><th class="n">Pos</th><th>Pixel</th><th class="n">Distance (px)</th><th class="n">Gap</th><th class="n">Speed (px/h)</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    }

    function tick(now) {
      const ms = Math.min(now - race.startMs, race.windowMs);
      const order = standingAt(race, ms);
      const q = (k) => root.querySelector(`[data-f="${k}"]`);
      const a = order[0], b = order[1];
      let status, meta;
      if (ms >= race.winMs) {
        const w = race.results[0], s = race.results[1];
        status = `${G.pxLink(w.id)} wins ${isGP ? 'the ' + G.f.esc(race.name) : 'Crawl ' + race.number}`;
        meta = `Finished in ${f().dur(race.winMs, true)}, ${race.marginPx.toFixed(2)} px ahead of ${G.pxLink(s.id)}. ` +
          `The next race starts in <span class="tnum">${f().countdown(race.startMs + race.windowMs - now)}</span>.`;
      } else {
        const gap = ((a.x - b.x) * race.trackPx).toFixed(3);
        const lspd = G.speedAt(race, a.i, ms);
        const togo = (1 - a.x) * race.trackPx;
        status = isGP ? `${G.pxLink(a.id)} leads ${G.pxLink(b.id)} by ${gap} px` : `${G.pxLink(a.id)} leads ${G.pxLink(b.id)} by ${gap} px`;
        meta = `${f().dur(ms)} gone. The leader has ${togo.toFixed(1)} px to go` +
          (lspd > 0.5 ? `, about ${f().dur((togo / lspd) * H())} at this pace.` : ', and is currently asleep.');
      }
      setHTML(q('status'), status);
      setHTML(q('meta'), meta);
      setHTML(q('tele'), isGP ? teleGP(ms, order) : teleCrawl(ms, order));
      const count = race.events.filter((e) => e.ms <= ms).length;
      if (count !== lastFeedCount) { setHTML(q('feed'), feedHTML(race, ms, race.startMs)); lastFeedCount = count; }
      setText(root.querySelector('.clock'), 'Race clock ' + f().dur(ms, true));
      const t = (G.raceTitle(race));
      document.title = ms >= race.winMs ? `${G.PX[race.results[0].id].name} wins, Glacial` : `${G.PX[a.id].name} leads ${t}, Glacial`;
    }

    return {
      html, keepTitle: true,
      mount(r) { root = r; track = r.querySelector('.track'); loupe = r.querySelector('.loupe'); },
      tick,
      frame(now) {
        const ms = Math.min(now - race.startMs, race.windowMs);
        G.drawTrack(track, race, ms);
        G.drawLoupe(loupe, race, ms);
      }
    };
  };

  // ---------------------------------------------------------------- race replay
  V.race = function (L, id) {
    const race = L.byId[id];
    if (!race) return V.notFound();
    if (race === L.current) return { redirect: '#live' };
    const endMs = Math.min(race.windowMs, Math.max(...race.results.map((r) => r.finishMs || race.windowMs)) + 20 * 60000);
    let t = endMs, playing = false, last = 0, root, track, loupe, slider, btn;
    const w = race.results[0], s = race.results[1];
    const isGP = race.kind === 'gp';
    const head = isGP
      ? `${G.pxLink(w.id)} wins the ${G.f.esc(race.name)}`
      : `${G.pxLink(w.id)} beat ${G.pxLink(s.id)}`;
    const rows = race.results.map((r) => {
      const d = race.ratingDelta ? race.ratingDelta[r.id] : 0;
      return `<tr><td class="n">${r.finishMs !== null ? r.place + 1 : 'Out of time'}</td><td>${G.pxLink(r.id)}</td>
        <td class="n">${r.finishMs !== null ? f().dur(r.finishMs, true) : (r.endX * race.trackPx).toFixed(1) + ' px'}</td>
        <td class="n">${r.place === 0 ? '–' : r.finishMs !== null ? '+' + f().dur(r.finishMs - race.winMs, true) : '–'}</td>
        <td class="n">${r.naps}</td><td class="n">${f().dur(r.napMs)}</td><td class="n">${r.topSpeed.toFixed(1)}</td>
        <td class="n">${f().dur(r.leadMs)}</td><td class="n">${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}</td></tr>`;
    }).join('');

    const html = `<section>
      <header class="page-head">
        <p class="race-name">${G.f.esc(G.raceTitle(race))}, ${f().date(race.startMs)} ${new Date(race.startMs).getUTCFullYear()}</p>
        <h1 class="status">${head}</h1>
        <p class="lede">Won in ${f().dur(race.winMs, true)} by ${race.marginPx.toFixed(2)} px${race.marginMs !== null && !isGP ? ` (${f().dur(race.marginMs, true)})` : ''}. ${race.leadChanges} lead ${race.leadChanges === 1 ? 'change' : 'changes'} over ${race.trackPx.toLocaleString()} px.</p>
      </header>
      ${screenHTML()}
      <div class="replay">
        <button type="button" class="btn" data-act="play">Play time-lapse</button>
        <label class="scrub"><span class="sr">Race time</span><input type="range" min="0" max="${Math.round(endMs)}" step="1000" value="${Math.round(endMs)}"></label>
        <output class="tnum" data-f="t"></output>
      </div>
      <p class="hint">The time-lapse plays the whole race in one minute. Drag the slider to scrub.</p>
      <h2>Result</h2>
      <div class="table-wrap"><table class="data">
        <thead><tr><th class="n">Pos</th><th>Pixel</th><th class="n">Time</th><th class="n">Behind</th><th class="n">Naps</th><th class="n">Asleep</th><th class="n">Top speed (px/h)</th><th class="n">Time leading</th><th class="n">Rating</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <h2>Gap to the leader</h2>
      <figure class="chart">${G.gapChart(race, endMs)}<figcaption>Pixels behind the leader across the race. The top edge is the lead.</figcaption></figure>
      <h2>Race log</h2>
      <ol class="feed feed-full">${feedHTML(race, endMs, race.startMs)}</ol>
    </section>`;

    function draw() {
      G.drawTrack(track, race, t);
      G.drawLoupe(loupe, race, t);
      slider.value = Math.round(t);
      setText(root.querySelector('[data-f="t"]'), f().dur(t, true));
      setText(root.querySelector('.clock'), 'Race clock ' + f().dur(t, true));
    }
    return {
      html, title: `${G.raceTitle(race)}, ${G.PX[w.id].name} wins`,
      mount(r) {
        root = r; track = r.querySelector('.track'); loupe = r.querySelector('.loupe');
        slider = r.querySelector('input[type=range]'); btn = r.querySelector('[data-act=play]');
        slider.addEventListener('input', () => { t = +slider.value; playing = false; btn.textContent = 'Play time-lapse'; draw(); });
        btn.addEventListener('click', () => {
          playing = !playing;
          if (playing && t >= endMs) t = 0;
          last = performance.now();
          btn.textContent = playing ? 'Pause' : 'Play time-lapse';
        });
      },
      frame(now) {
        const p = performance.now();
        if (playing) {
          t += (p - last) * (endMs / 60000);
          if (t >= endMs) { t = endMs; playing = false; btn.textContent = 'Play again'; }
        }
        last = p;
        draw();
      }
    };
  };

  // ---------------------------------------------------------------- grand prix
  V.gp = function (L, now) {
    const year = L.seasonYear;
    const gps = L.races.filter((r) => r.kind === 'gp').reverse();
    const champ = G.championship(L, year);
    const cur = L.current.kind === 'gp' ? L.current : null;
    const nextGP = (() => {
      const d = new Date(now);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    })();
    const grid = G.topByRating(L, 8);

    const nowBlock = cur
      ? `<p class="callout">The ${G.f.esc(cur.name)} is running right now. <a href="#live">Watch it live</a>.</p>`
      : `<div class="next-gp">
          <p>The ${G.MONTHS[new Date(nextGP).getUTCMonth()]} Grand Prix starts ${f().full(nextGP)}, in <span class="tnum" data-f="cd"></span>.</p>
          <h2>Grid if it started now</h2>
          <ol class="grid-list">${grid.map((id) => `<li>${G.pxLink(id)}<span class="tnum">${L.rating[id].toFixed(0)}</span></li>`).join('')}</ol>
        </div>`;

    const champRows = champ.map((c, k) => `<tr><td class="n">${k + 1}</td><td>${G.pxLink(c.id)}</td><td class="n strong">${c.points}</td><td class="n">${c.gpWins}</td><td class="n">${c.crawlWins}</td><td class="n">${c.starts}</td></tr>`).join('');
    const gpRows = gps.map((r) => `<tr><td>${G.raceLink(r, r.name.replace(' Grand Prix', ''))} <span class="muted">${new Date(r.startMs).getUTCFullYear()}</span></td>
      <td>${G.pxLink(r.results[0].id)}</td><td class="podium">${r.results.slice(1, 3).map((x) => G.pxName(x.id)).join('')}</td>
      <td class="n">${f().dur(r.winMs)}</td><td class="n">${r.marginPx.toFixed(2)} px</td><td class="n">${r.leadChanges}</td></tr>`).join('');

    return {
      html: `<section>
        <header class="page-head">
          <h1>Grand Prix</h1>
          <p class="lede">Once a month the eight highest-rated pixels race 1,920 px, the width of a full HD screen. It starts at midnight UTC on the 1st and takes about two days. Points go 25, 18, 15, 12, 10, 8, 6, 4.</p>
        </header>
        ${nowBlock}
        <h2>${year} championship</h2>
        <p class="hint">Grand Prix points plus 3 for every Daily Crawl win and 1 for every Crawl loss.</p>
        <div class="table-wrap"><table class="data"><thead><tr><th class="n">Pos</th><th>Pixel</th><th class="n">Points</th><th class="n">GP wins</th><th class="n">Crawl wins</th><th class="n">Races</th></tr></thead><tbody>${champRows}</tbody></table></div>
        <h2>Past winners</h2>
        <div class="table-wrap"><table class="data"><thead><tr><th>Grand Prix</th><th>Winner</th><th>Second and third</th><th class="n">Time</th><th class="n">Margin</th><th class="n">Lead changes</th></tr></thead><tbody>${gpRows}</tbody></table></div>
      </section>`,
      title: 'Grand Prix',
      mount(r) { this.root = r; },
      tick(n) { if (!cur) setText(this.root.querySelector('[data-f="cd"]'), f().countdown(nextGP - n)); }
    };
  };

  // ---------------------------------------------------------------- standings
  V.standings = function (L) {
    const ids = G.PIXELS.map((p) => p.id).sort((a, b) => L.rating[b] - L.rating[a]);
    const rows = ids.map((id, k) => {
      const s = L.stats[id];
      const form = s.results.slice(-5).map((r) => `<i class="${r.place === 0 ? 'w' : 'l'}" title="${r.place === 0 ? 'Win' : G.f.ord(r.place + 1)}"></i>`).join('');
      return `<tr><td class="n">${k + 1}</td><td>${G.pxLink(id)}</td><td class="n strong">${L.rating[id].toFixed(0)}</td>
        <td class="n">${s.starts}</td><td class="n">${s.wins}</td><td class="n">${G.f.pct(s.wins, s.starts)}</td>
        <td class="n">${s.gpWins}</td><td><span class="form" aria-label="Last five">${form}</span></td></tr>`;
    }).join('');

    const cols = [
      ['Distance (px)', (s) => s.distancePx, (v) => G.f.num(v)],
      ['Avg speed (px/h)', (s) => (s.raceMs ? s.distancePx / (s.raceMs / H()) : 0), (v) => v.toFixed(2)],
      ['Top speed (px/h)', (s) => s.topSpeed.v, (v) => v.toFixed(1)],
      ['Naps', (s) => s.naps, (v) => v],
      ['Asleep', (s) => s.napMs, (v) => f().dur(v)],
      ['Time leading', (s) => s.leadMs, (v) => f().dur(v)],
      ['Overtakes', (s) => s.overtakes, (v) => v],
      ['Sprints', (s) => s.sprints, (v) => v],
      ['Stumbles', (s) => s.stumbles, (v) => v],
      ['Best crawl', (s) => (s.bestCrawl.ms === Infinity ? 1e15 : s.bestCrawl.ms), (v) => (v === 1e15 ? '–' : f().dur(v, true))]
    ];
    const statRows = (sortCol, dir) => {
      const list = G.PIXELS.map((p) => p.id).sort((a, b) => (cols[sortCol][1](L.stats[a]) - cols[sortCol][1](L.stats[b])) * dir);
      return list.map((id) => `<tr><td>${G.pxLink(id)}</td>${cols.map((c) => `<td class="n">${c[2](c[1](L.stats[id]))}</td>`).join('')}</tr>`).join('');
    };
    const head = (sortCol, dir) => `<tr><th>Pixel</th>${cols.map((c, k) => `<th class="n" aria-sort="${k === sortCol ? (dir < 0 ? 'descending' : 'ascending') : 'none'}"><button type="button" data-col="${k}">${c[0]}</button></th>`).join('')}</tr>`;

    return {
      html: `<section>
        <header class="page-head">
          <h1>Standings</h1>
          <p class="lede">Every pixel starts on a rating of 1500. Beat a higher-rated pixel and you gain more. The eight highest on the 1st of the month race the Grand Prix.</p>
        </header>
        <div class="table-wrap"><table class="data"><thead><tr><th class="n">Rank</th><th>Pixel</th><th class="n">Rating</th><th class="n">Races</th><th class="n">Wins</th><th class="n">Win rate</th><th class="n">GP wins</th><th>Last five</th></tr></thead><tbody>${rows}</tbody></table></div>
        <h2>Career statistics</h2>
        <p class="hint">Select a column heading to sort.</p>
        <div class="table-wrap"><table class="data stats"><thead data-f="sh">${head(0, -1)}</thead><tbody data-f="sb">${statRows(0, -1)}</tbody></table></div>
      </section>`,
      title: 'Standings',
      mount(r) {
        let col = 0, dir = -1;
        r.querySelector('[data-f="sh"]').addEventListener('click', (e) => {
          const b = e.target.closest('button[data-col]');
          if (!b) return;
          const c = +b.dataset.col;
          dir = c === col ? -dir : -1;
          col = c;
          r.querySelector('[data-f="sh"]').innerHTML = head(col, dir);
          r.querySelector('[data-f="sb"]').innerHTML = statRows(col, dir);
          r.querySelector(`button[data-col="${c}"]`).focus();
        });
      }
    };
  };

  // ---------------------------------------------------------------- pixels
  V.pixels = function (L) {
    const tiles = G.PIXELS.map((p) => {
      const s = L.stats[p.id];
      return `<li><a href="#pixel/${p.id}" class="tile">
        <span class="swatch" style="--c:${p.color}"><i></i></span>
        <span class="tile-name">${G.f.esc(p.name)}</span>
        <span class="tile-meta">${L.rating[p.id].toFixed(0)} rating, ${s.wins} wins</span>
      </a></li>`;
    }).join('');
    return {
      html: `<section>
        <header class="page-head">
          <h1>The pixels</h1>
          <p class="lede">Sixteen pixels, each one colour and one square. They differ in pace, stamina, temperament and how much they like to sleep.</p>
        </header>
        <ul class="tiles">${tiles}</ul>
      </section>`,
      title: 'The pixels'
    };
  };

  V.pixel = function (L, id) {
    const p = G.PX[id];
    if (!p) return V.notFound();
    const s = L.stats[id];
    const rank = G.PIXELS.map((x) => x.id).sort((a, b) => L.rating[b] - L.rating[a]).indexOf(id) + 1;
    const traits = G.TRAITS.map(([k, label]) => {
      let v = p.t[k];
      let shown;
      if (k === 'pace') { v = (v - 0.95) / 0.12; }
      if (k === 'night') { v = (v + 1) / 2; }
      shown = Math.max(0.04, Math.min(1, v));
      return `<div class="trait"><dt>${label}</dt><dd><span class="bar" style="--v:${shown};--c:${p.color}"></span></dd></div>`;
    }).join('');
    const facts = [
      ['Rating', `${L.rating[id].toFixed(0)} <small>(${G.f.ord(rank)})</small>`],
      ['Wins', `${s.wins} <small>of ${s.starts}</small>`],
      ['Grand Prix', `${s.gpWins} wins, ${s.podiums} podiums`],
      ['Best crawl', s.bestCrawl.raceId ? `<a href="#race/${s.bestCrawl.raceId}">${f().dur(s.bestCrawl.ms, true)}</a>` : '–'],
      ['Top speed', s.topSpeed.raceId ? `<a href="#race/${s.topSpeed.raceId}">${s.topSpeed.v.toFixed(1)} px/h</a>` : '–'],
      ['Distance', `${G.f.num(s.distancePx)} px`],
      ['Time asleep', f().dur(s.napMs)],
      ['Longest nap', s.longestNap.raceId ? `<a href="#race/${s.longestNap.raceId}">${f().dur(s.longestNap.ms)}</a>` : '–'],
      ['Time leading', f().dur(s.leadMs)],
      ['Overtakes', s.overtakes],
      ['Best win streak', s.bestStreak]
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    const recent = s.results.slice(-15).reverse().map((r) => {
      const race = L.byId[r.raceId];
      const opp = race.kind === 'crawl' ? 'vs ' + G.pxName(race.lineup.find((x) => x !== id)) : `${r.n} pixels`;
      return `<tr><td>${f().dateShort(r.startMs)}</td><td>${G.raceLink(race)}</td><td>${opp}</td><td class="n ${r.place === 0 ? 'strong' : ''}">${G.f.ord(r.place + 1)}</td></tr>`;
    }).join('');
    const h2h = G.PIXELS.filter((x) => x.id !== id).map((x) => {
      const h = s.h2h[x.id] || [0, 0];
      return { id: x.id, w: h[0], l: h[1] };
    }).sort((a, b) => b.w + b.l - (a.w + a.l));
    const h2hRows = h2h.map((h) => `<tr><td>${G.pxLink(h.id)}</td><td class="n">${h.w}</td><td class="n">${h.l}</td><td class="n">${G.f.pct(h.w, h.w + h.l)}</td></tr>`).join('');

    return {
      html: `<section class="profile">
        <header class="profile-head">
          <div class="big-swatch" style="--c:${p.color}"><i></i></div>
          <div>
            <h1>${G.f.esc(p.name)}</h1>
            <p class="hex">${p.color}</p>
            <p class="lede">${G.f.esc(p.bio)}</p>
          </div>
        </header>
        <div class="profile-grid">
          <dl class="facts">${facts}</dl>
          <div>
            <h2>Temperament</h2>
            <dl class="traits">${traits}</dl>
          </div>
        </div>
        <h2>Rating over time</h2>
        <figure class="chart">${G.sparkline(s.ratingHistory, p.color)}</figure>
        <div class="two-col">
          <div><h2>Recent races</h2>
            <div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Race</th><th>Field</th><th class="n">Finish</th></tr></thead><tbody>${recent || '<tr><td colspan="4">No races yet.</td></tr>'}</tbody></table></div></div>
          <div><h2>Head to head</h2>
            <div class="table-wrap"><table class="data"><thead><tr><th>Against</th><th class="n">Won</th><th class="n">Lost</th><th class="n">Rate</th></tr></thead><tbody>${h2hRows}</tbody></table></div></div>
        </div>
      </section>`,
      title: p.name
    };
  };

  // ---------------------------------------------------------------- archive
  V.archive = function (L, filter) {
    const list = () => {
      const races = L.races.filter((r) => !filter || r.lineup.includes(filter)).slice().reverse();
      let month = '', out = '';
      races.forEach((r) => {
        const d = new Date(r.startMs);
        const m = `${G.MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
        if (m !== month) {
          if (month) out += '</tbody></table></div>';
          month = m;
          out += `<h2>${m}</h2><div class="table-wrap"><table class="data archive"><thead><tr><th>Date</th><th>Race</th><th>Result</th><th class="n">Winning time</th><th class="n">Margin</th><th class="n">Lead changes</th></tr></thead><tbody>`;
        }
        const res = r.kind === 'gp'
          ? `${G.pxName(r.results[0].id)} <span class="muted">won from 7 others</span>`
          : `${G.pxName(r.results[0].id)} <span class="muted">beat</span> ${G.pxName(r.results[1].id)}`;
        out += `<tr class="${r.kind}"><td>${f().dateShort(r.startMs)}</td><td>${G.raceLink(r)}</td><td>${res}</td><td class="n">${f().dur(r.winMs)}</td><td class="n">${r.marginPx.toFixed(2)} px</td><td class="n">${r.leadChanges}</td></tr>`;
      });
      if (month) out += '</tbody></table></div>';
      return out || '<p>No races for this pixel yet.</p>';
    };
    const opts = G.PIXELS.map((p) => `<option value="${p.id}" ${filter === p.id ? 'selected' : ''}>${G.f.esc(p.name)}</option>`).join('');
    return {
      html: `<section>
        <header class="page-head">
          <h1>Archive</h1>
          <p class="lede">${L.races.length} races since ${f().dateYear(G.EPOCH)}. Open any race to replay it as a time-lapse.</p>
        </header>
        <label class="filter">Show races with <select data-f="sel"><option value="">any pixel</option>${opts}</select></label>
        <div data-f="list">${list()}</div>
      </section>`,
      title: 'Archive',
      mount(r) {
        r.querySelector('[data-f="sel"]').addEventListener('change', (e) => {
          location.hash = e.target.value ? '#archive/' + e.target.value : '#archive';
        });
      }
    };
  };

  // ---------------------------------------------------------------- records
  V.records = function (L) {
    const R = L.records;
    const item = (title, value, holder, raceId, note) => `<div class="record">
      <dt>${title}</dt>
      <dd class="rec-value">${value}</dd>
      <dd class="rec-holder">${holder ? G.pxLink(holder) : ''}${raceId ? ` in <a href="#race/${raceId}">${G.f.esc(G.raceTitle(L.byId[raceId]))}</a>, ${f().dateYear(L.byId[raceId].startMs)}` : ''}${note ? ` ${note}` : ''}</dd>
    </div>`;
    const ok = (x) => x && x.raceId;
    const parts = [];
    if (ok(R.fastestCrawl)) parts.push(item('Fastest Daily Crawl', f().dur(R.fastestCrawl.ms, true), R.fastestCrawl.id, R.fastestCrawl.raceId));
    if (ok(R.slowestCrawl)) parts.push(item('Slowest winning Crawl', f().dur(R.slowestCrawl.ms, true), R.slowestCrawl.id, R.slowestCrawl.raceId));
    if (ok(R.fastestGP)) parts.push(item('Fastest Grand Prix', f().dur(R.fastestGP.ms, true), R.fastestGP.id, R.fastestGP.raceId));
    if (ok(R.closest)) parts.push(item('Closest finish', `${R.closest.px.toFixed(3)} px`, R.closest.id, R.closest.raceId));
    if (ok(R.biggest)) parts.push(item('Biggest winning margin', `${R.biggest.px.toFixed(1)} px`, R.biggest.id, R.biggest.raceId));
    if (ok(R.leadChanges)) parts.push(item('Most lead changes', R.leadChanges.count, null, R.leadChanges.raceId));
    if (ok(R.topSpeed)) parts.push(item('Top speed', `${R.topSpeed.v.toFixed(1)} px/h`, R.topSpeed.id, R.topSpeed.raceId));
    if (ok(R.longestNap)) parts.push(item('Longest nap', f().dur(R.longestNap.ms), R.longestNap.id, R.longestNap.raceId));
    if (ok(R.streak)) parts.push(item('Longest Crawl win streak', `${R.streak.count} wins`, R.streak.id, null, `, ended or extended in <a href="#race/${R.streak.raceId}">${G.f.esc(G.raceTitle(L.byId[R.streak.raceId]))}</a>`));
    const total = G.PIXELS.reduce((a, p) => a + L.stats[p.id].distancePx, 0);
    const naps = G.PIXELS.reduce((a, p) => a + L.stats[p.id].napMs, 0);
    return {
      html: `<section>
        <header class="page-head">
          <h1>Records</h1>
          <p class="lede">Across every race, the pixels have travelled ${G.f.num(total)} px between them, roughly ${G.f.num(total / 1920, 1)} widths of a full HD screen. They have spent ${G.f.num(naps / G.DAY, 1)} days asleep.</p>
        </header>
        <dl class="records">${parts.join('')}</dl>
      </section>`,
      title: 'Records'
    };
  };

  // ---------------------------------------------------------------- about
  V.about = function () {
    return {
      html: `<section class="about prose">
        <header class="page-head">
          <h1>About the race</h1>
          <p class="lede">Two pixels cross a 1,024 px screen. It takes them about a day.</p>
        </header>
        <h2>The Daily Crawl</h2>
        <p>A new Crawl starts every day at midnight UTC (${f().time(Date.UTC(2026, 0, 3))} where you are). Two pixels are drawn from the roster of sixteen. The winner usually crosses the line between 22 and 23½ hours in, averaging somewhere around 45 px an hour, or less than one pixel a minute. If the loser has not finished when the day runs out, it is recorded as out of time.</p>
        <h2>The Grand Prix</h2>
        <p>On the 1st of every month the Crawl is replaced by the Grand Prix: the eight highest-rated pixels on a 1,920 px track, lasting about 46 hours of a 48-hour window. Points from the Grand Prix decide the season championship, with a few more for Daily Crawl results.</p>
        <h2>What happens in a race</h2>
        <p>Each pixel has a temperament: pace, consistency, stamina, a finishing kick, a chasing instinct, a preference for night or day, and a tendency to nap. During a race they cruise, sprint, stumble and fall asleep. Pixels that fall behind get a small lift from having someone to chase, which is why so many races are decided in the last few hours.</p>
        <h2>Ratings</h2>
        <p>Every pixel started on 1500. After each race the winner takes points from the loser, more when the result is a surprise. In a Grand Prix every pair of finishers counts as a small head-to-head.</p>
        <h2>How it works</h2>
        <p>There is no server. Each race is generated from its date, so every visitor sees the same race at the same moment, and every past race can be replayed exactly. Your browser rebuilds the whole history, every lead change and every nap, each time you open the page.</p>
      </section>`,
      title: 'About'
    };
  };

  V.notFound = function () {
    return {
      html: `<section class="page-head"><h1>Nothing on this screen</h1><p class="lede">That page does not exist. <a href="#live">Go to the live race</a>.</p></section>`,
      title: 'Not found'
    };
  };
})();
