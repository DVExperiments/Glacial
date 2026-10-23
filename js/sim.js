/*
 * Deterministic race simulator.
 * Every race is generated from its id, so every visitor sees the identical race
 * at the identical moment with no server. Only +, -, *, / and integer maths are
 * used inside the simulation so results are identical in every browser.
 */
(function () {
  const G = (window.G = window.G || {});
  const H = 3600000;
  const DAY = 86400000;
  G.H = H;
  G.DAY = DAY;

  G.rng = function (a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.hash = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  function gauss(r) {
    return (r() + r() + r() + r() + r() + r() - 3) * 1.4142;
  }

  /**
   * race: { id, kind: 'crawl'|'gp', lineup: [pixelIds], startMs, windowMs, trackPx }
   * Time is simulated in segments (about 5 minutes each) and then stretched so the
   * winner finishes at the race's target time.
   */
  G.simulate = function (race) {
    const r = G.rng(G.hash(race.id));
    const gp = race.kind === 'gp';
    const nominal = gp ? 576 : 288;
    const target = (gp ? 44 + r() * 2.5 : 22 + r() * 1.5) * H;
    const P = race.lineup.map((id) => G.PX[id]);
    const n = P.length;
    const base = 1 / nominal;
    const maxSegs = nominal * 2;

    const pos = [], spd = [], modes = [], st = [];
    for (let i = 0; i < n; i++) {
      pos.push([0]);
      spd.push([]);
      modes.push([]);
      st.push({ x: 0, mood: (r() - 0.5) * 0.3, mode: 'c', left: 0, mult: 1, fin: null,
        naps: 0, napSegs: 0, longestNap: 0, napLen: 0, sprints: 0, stumbles: 0 });
    }
    const ev = [];
    const leadSegs = new Array(n).fill(0);
    let leader = -1, leadChanges = 0, half = false, ninety = false, done = 0;

    for (let k = 0; k < maxSegs && done < n; k++) {
      let maxX = 0;
      for (let i = 0; i < n; i++) if (st[i].x > maxX) maxX = st[i].x;
      const hour = (k / 12) % 24;
      const night = Math.abs(hour - 12) / 6 - 1; // +1 at midnight UTC, -1 at noon
      const prog = k / nominal;

      for (let i = 0; i < n; i++) {
        const s = st[i], t = P[i].t;
        if (s.fin !== null) {
          pos[i].push(1); spd[i].push(0); modes[i].push('f');
          continue;
        }
        let started = null;
        if (s.left <= 0) {
          if (s.mode === 'n') ev.push({ seg: k, type: 'wake', i, dur: s.napLen, x: s.x });
          s.mode = 'c'; s.mult = 1;
          const roll = r();
          const pN = 0.0015 + 0.009 * t.nap;
          const pS = 0.004 + 0.009 * t.kick;
          const pT = 0.001 + 0.006 * (1 - t.grit);
          if (roll < pN && s.x < 0.96) {
            const len = 3 + Math.floor(r() * (4 + 26 * t.nap));
            s.mode = 'n'; s.left = len; s.mult = 0; s.napLen = len;
            s.naps++; s.napSegs += len;
            if (len > s.longestNap) s.longestNap = len;
            started = { seg: k, type: 'nap', i, dur: len, x: s.x };
          } else if (roll < pN + pS) {
            const len = 2 + Math.floor(r() * 5);
            s.mode = 's'; s.left = len; s.mult = 1.5 + r() * 0.7; s.sprints++;
            started = { seg: k, type: 'sprint', i, dur: len, x: s.x };
          } else if (roll < pN + pS + pT) {
            const len = 1 + Math.floor(r() * 3);
            s.mode = 't'; s.left = len; s.mult = 0.3; s.stumbles++;
            started = { seg: k, type: 'stumble', i, dur: len, x: s.x };
          }
        }
        s.left--;
        s.mood = s.mood * 0.93 + gauss(r) * 0.07 * (1.5 - t.grit);
        if (s.mood > 0.6) s.mood = 0.6;
        if (s.mood < -0.6) s.mood = -0.6;
        const fatigue = 1 - (1 - t.stamina) * 0.22 * (prog > 1.3 ? 1.3 : prog);
        const tod = 1 + 0.05 * t.night * night;
        const kick = s.x > 0.9 ? 1 + 0.3 * t.kick * (s.x - 0.9) * 10 : 1;
        const gap = maxX - s.x;
        const chase = 1 + (gap * 4 > 0.12 ? 0.12 : gap * 4) * (0.5 + t.heart * 0.5);
        let v = base * t.pace * (1 + s.mood * 0.3) * fatigue * tod * kick * chase * s.mult;
        if (v < 0) v = 0;
        if (started) { started.v = v; ev.push(started); }
        spd[i].push(v);
        modes[i].push(s.mode);
        let nx = s.x + v;
        if (nx >= 1) {
          s.fin = k + (v > 0 ? (1 - s.x) / v : 0);
          nx = 1; done++;
          ev.push({ seg: s.fin, type: 'finish', i });
        }
        s.x = nx;
        pos[i].push(nx);
      }

      let L = 0, best = -1;
      for (let i = 0; i < n; i++) {
        const sc = st[i].fin !== null ? 10 - st[i].fin / 1e5 : st[i].x;
        if (sc > best) { best = sc; L = i; }
      }
      if (L !== leader) {
        ev.push({ seg: k + 1, type: 'lead', i: L, from: leader, x: st[L].x });
        if (leader >= 0) leadChanges++;
        leader = L;
      }
      if (done === 0) leadSegs[L]++;
      if (!half && st[L].x >= 0.5) { half = true; ev.push({ seg: k + 1, type: 'half', i: L, x: st[L].x }); }
      if (!ninety && st[L].x >= 0.9) { ninety = true; ev.push({ seg: k + 1, type: 'ninety', i: L, x: st[L].x }); }
    }

    let w = -1;
    for (let i = 0; i < n; i++) if (st[i].fin !== null && (w < 0 || st[i].fin < st[w].fin)) w = i;
    const segMs = target / st[w].fin;
    const W = race.windowMs;

    const out = Object.assign({}, race, { segMs, pos, spd, modes, n, pixels: P });

    const results = P.map((p, i) => {
      const fm = st[i].fin !== null ? st[i].fin * segMs : null;
      const ok = fm !== null && fm <= W;
      let top = 0;
      const lastSeg = Math.min(spd[i].length, Math.floor(W / segMs));
      for (let k = 0; k < lastSeg; k++) if (spd[i][k] > top) top = spd[i][k];
      return {
        i, id: p.id,
        finishMs: ok ? fm : null,
        endX: ok ? 1 : G.posAt(out, i, W),
        naps: st[i].naps, napMs: st[i].napSegs * segMs, longestNapMs: st[i].longestNap * segMs,
        sprints: st[i].sprints, stumbles: st[i].stumbles,
        leadMs: leadSegs[i] * segMs,
        topSpeed: (top * race.trackPx) / (segMs / H)
      };
    });
    results.sort((a, b) => {
      if (a.finishMs !== null && b.finishMs !== null) return a.finishMs - b.finishMs;
      if (a.finishMs !== null) return -1;
      if (b.finishMs !== null) return 1;
      return b.endX - a.endX;
    });
    results.forEach((res, place) => (res.place = place));

    const events = ev
      .map((e) => Object.assign(e, { ms: e.seg * segMs }))
      .filter((e) => e.ms <= W);
    results.forEach((res) => {
      if (res.finishMs === null) events.push({ type: 'timeout', i: res.i, ms: W, x: res.endX });
    });
    const order = { lead: 0, half: 1, ninety: 2, finish: 3 };
    events.sort((a, b) => a.ms - b.ms || (order[a.type] ?? 9) - (order[b.type] ?? 9));
    events.forEach((e, idx) => (e.n = idx));

    const winner = results[0];
    const second = results[1];
    out.results = results;
    out.events = events;
    out.leadChanges = leadChanges;
    out.winner = winner;
    out.winMs = winner.finishMs;
    out.marginMs = second.finishMs !== null ? second.finishMs - winner.finishMs : null;
    out.marginPx = (1 - G.posAt(out, second.i, winner.finishMs)) * race.trackPx;
    out.sprintCount = results.reduce((a, b) => a + b.sprints, 0);
    return out;
  };

  /** Fractional distance (0..1) of lane i at ms after the start. */
  G.posAt = function (race, i, ms) {
    if (ms <= 0) return 0;
    const k = ms / race.segMs;
    const arr = race.pos[i];
    const kf = Math.floor(k);
    if (kf >= arr.length - 1) return arr[arr.length - 1];
    return arr[kf] + (arr[kf + 1] - arr[kf]) * (k - kf);
  };
  /** Speed in px per hour. */
  G.speedAt = function (race, i, ms) {
    const kf = Math.max(0, Math.floor(ms / race.segMs));
    const v = race.spd[i][kf] ?? 0;
    return (v * race.trackPx) / (race.segMs / H);
  };
  /** 'c' cruising, 'n' napping, 's' sprinting, 't' stumbling, 'f' finished */
  G.modeAt = function (race, i, ms) {
    const fin = race.results.find((r) => r.i === i).finishMs;
    if (fin !== null && ms >= fin) return 'f';
    const kf = Math.max(0, Math.floor(ms / race.segMs));
    return race.modes[i][kf] ?? 'f';
  };
})();
