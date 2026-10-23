/*
 * The league: schedule, history, ratings, stats and records.
 * Rebuilt from scratch on every page load by replaying every race since the epoch.
 */
(function () {
  const G = (window.G = window.G || {});
  const DAY = G.DAY;
  G.EPOCH = Date.UTC(2025, 11, 3); // first Daily Crawl
  G.GP_POINTS = [25, 18, 15, 12, 10, 8, 6, 4];
  G.CRAWL_POINTS = [3, 1];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  G.MONTHS = MONTHS;

  const pad = (x) => String(x).padStart(2, '0');

  function topByRating(L, count) {
    return G.PIXELS.map((p) => p.id)
      .sort((a, b) => L.rating[b] - L.rating[a] || (a < b ? -1 : 1))
      .slice(0, count);
  }
  G.topByRating = topByRating;

  function describe(day, L) {
    const d = new Date(day);
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), dom = d.getUTCDate();
    if (dom === 1) {
      return {
        id: `GP-${y}-${pad(m + 1)}`, kind: 'gp', name: `${MONTHS[m]} Grand Prix`,
        lineup: topByRating(L, 8), startMs: day, windowMs: 2 * DAY, trackPx: 1920, year: y
      };
    }
    const id = `C-${y}-${pad(m + 1)}-${pad(dom)}`;
    const r = G.rng(G.hash('pair:' + id));
    const a = Math.floor(r() * 16);
    let b = Math.floor(r() * 15);
    if (b >= a) b++;
    return {
      id, kind: 'crawl', name: 'Daily Crawl', lineup: [G.PIXELS[a].id, G.PIXELS[b].id],
      startMs: day, windowMs: DAY, trackPx: 1024, year: y
    };
  }

  function blankStats() {
    return {
      starts: 0, wins: 0, crawlStarts: 0, crawlWins: 0, gpStarts: 0, gpWins: 0, podiums: 0,
      points: {}, distancePx: 0, raceMs: 0, topSpeed: { v: 0, raceId: null },
      naps: 0, napMs: 0, longestNap: { ms: 0, raceId: null }, sprints: 0, stumbles: 0,
      leadMs: 0, overtakes: 0, results: [], bestCrawl: { ms: Infinity, raceId: null },
      h2h: {}, ratingHistory: [], streak: 0, bestStreak: 0
    };
  }

  function apply(L, race) {
    const year = race.year;
    const n = race.results.length;
    const ids = race.lineup;
    race.results.forEach((res) => {
      const s = L.stats[res.id];
      s.starts++;
      if (race.kind === 'crawl') s.crawlStarts++; else s.gpStarts++;
      const won = res.place === 0;
      if (won) { s.wins++; if (race.kind === 'crawl') s.crawlWins++; else s.gpWins++; }
      if (race.kind === 'gp' && res.place < 3) s.podiums++;
      const pts = race.kind === 'gp' ? G.GP_POINTS[res.place] || 0 : G.CRAWL_POINTS[res.place] || 0;
      s.points[year] = (s.points[year] || 0) + pts;
      s.distancePx += res.endX * race.trackPx;
      s.raceMs += res.finishMs !== null ? res.finishMs : race.windowMs;
      if (res.topSpeed > s.topSpeed.v) s.topSpeed = { v: res.topSpeed, raceId: race.id };
      s.naps += res.naps; s.napMs += res.napMs; s.sprints += res.sprints; s.stumbles += res.stumbles;
      if (res.longestNapMs > s.longestNap.ms) s.longestNap = { ms: res.longestNapMs, raceId: race.id };
      s.leadMs += res.leadMs;
      if (race.kind === 'crawl' && res.finishMs !== null && res.finishMs < s.bestCrawl.ms)
        s.bestCrawl = { ms: res.finishMs, raceId: race.id };
      s.results.push({ raceId: race.id, place: res.place, n, kind: race.kind, startMs: race.startMs });
      if (race.kind === 'crawl') {
        s.streak = won ? s.streak + 1 : 0;
        if (s.streak > s.bestStreak) { s.bestStreak = s.streak; s.bestStreakEnd = race.id; }
        if (s.streak > L.records.streak.count)
          L.records.streak = { count: s.streak, id: res.id, raceId: race.id };
      }
      // records
      if (res.topSpeed > L.records.topSpeed.v) L.records.topSpeed = { v: res.topSpeed, id: res.id, raceId: race.id };
      if (res.longestNapMs > L.records.longestNap.ms) L.records.longestNap = { ms: res.longestNapMs, id: res.id, raceId: race.id };
    });
    race.events.forEach((e) => {
      if (e.type === 'lead' && e.from >= 0) L.stats[ids[e.i]].overtakes++;
    });
    // head to head + rating
    const K = race.kind === 'gp' ? 8 : 24;
    const delta = {};
    ids.forEach((id) => (delta[id] = 0));
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const A = race.results[a].id, B = race.results[b].id;
        const ha = (L.stats[A].h2h[B] = L.stats[A].h2h[B] || [0, 0]);
        const hb = (L.stats[B].h2h[A] = L.stats[B].h2h[A] || [0, 0]);
        ha[0]++; hb[1]++;
        let e = 0.5 + (L.rating[A] - L.rating[B]) / 800;
        if (e > 0.95) e = 0.95;
        if (e < 0.05) e = 0.05;
        delta[A] += K * (1 - e);
        delta[B] -= K * (1 - e);
      }
    }
    ids.forEach((id) => {
      L.rating[id] += delta[id];
      L.stats[id].ratingHistory.push({ ms: race.startMs, r: L.rating[id] });
    });
    race.ratingDelta = delta;

    const rec = L.records;
    const winnerId = race.winner.id;
    if (race.kind === 'crawl') {
      if (race.winMs < rec.fastestCrawl.ms) rec.fastestCrawl = { ms: race.winMs, id: winnerId, raceId: race.id };
      if (race.winMs > rec.slowestCrawl.ms) rec.slowestCrawl = { ms: race.winMs, id: winnerId, raceId: race.id };
    } else if (race.winMs < rec.fastestGP.ms) rec.fastestGP = { ms: race.winMs, id: winnerId, raceId: race.id };
    if (race.marginPx < rec.closest.px) rec.closest = { px: race.marginPx, id: winnerId, raceId: race.id };
    if (race.marginPx > rec.biggest.px) rec.biggest = { px: race.marginPx, id: winnerId, raceId: race.id };
    if (race.leadChanges > rec.leadChanges.count) rec.leadChanges = { count: race.leadChanges, raceId: race.id };
  }

  G.buildLeague = function (now) {
    const L = {
      races: [], byId: {}, current: null, rating: {}, stats: {}, built: now,
      records: {
        fastestCrawl: { ms: Infinity }, slowestCrawl: { ms: 0 }, fastestGP: { ms: Infinity },
        closest: { px: Infinity }, biggest: { px: 0 }, leadChanges: { count: -1 },
        longestNap: { ms: 0 }, topSpeed: { v: 0 }, streak: { count: 0 }
      }
    };
    G.PIXELS.forEach((p) => {
      L.rating[p.id] = 1500;
      L.stats[p.id] = blankStats();
    });
    let day = G.EPOCH;
    let crawlNo = 0;
    while (day <= now) {
      const desc = describe(day, L);
      if (desc.kind === 'crawl') desc.number = ++crawlNo;
      const race = G.simulate(desc);
      L.byId[race.id] = race;
      if (day + desc.windowMs <= now) {
        apply(L, race);
        L.races.push(race);
      } else {
        L.current = race;
      }
      day += desc.windowMs;
    }
    L.next = describe(day, L);
    if (L.next.kind === 'crawl') L.next.number = crawlNo + 1;
    L.seasonYear = new Date(now).getUTCFullYear();
    return L;
  };

  /** Pixels ranked by season points. */
  G.championship = function (L, year) {
    return G.PIXELS.map((p) => {
      const s = L.stats[p.id];
      const yr = s.results.filter((r) => new Date(r.startMs).getUTCFullYear() === year);
      return {
        id: p.id, points: s.points[year] || 0,
        gpWins: yr.filter((r) => r.kind === 'gp' && r.place === 0).length,
        crawlWins: yr.filter((r) => r.kind === 'crawl' && r.place === 0).length,
        starts: yr.length
      };
    }).sort((a, b) => b.points - a.points || b.gpWins - a.gpWins || b.crawlWins - a.crawlWins);
  };
})();
