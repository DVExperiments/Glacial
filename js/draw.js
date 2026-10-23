/* Drawing: the track screen, the close-up and the gap chart. */
(function () {
  const G = (window.G = window.G || {});
  // The screen colour can be changed by the Pixel Senate (see senate-hook.js); this is the original.
  const screen = () => G.screenColour || '#0E171C';
  const DIM = 'rgba(190, 215, 225, 0.16)';
  const TEXT = 'rgba(210, 228, 235, 0.62)';
  const FONT = '"IBM Plex Sans", system-ui, sans-serif';

  function fit(canvas, cssH) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.height = cssH + 'px';
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h: cssH };
  }

  function scanlines(ctx, w, h) {
    ctx.fillStyle = screen();
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  }

  function checker(ctx, x, y0, y1, size) {
    for (let y = y0, row = 0; y < y1; y += size, row++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (row + c) % 2 ? 'rgba(240,245,247,0.85)' : 'rgba(240,245,247,0.12)';
        ctx.fillRect(x + c * size, y, size, Math.min(size, y1 - y));
      }
    }
  }

  /** Full-length track. Returns the lane order used. */
  G.drawTrack = function (canvas, race, ms) {
    const n = race.n;
    const laneH = n <= 2 ? 58 : 30;
    const top = 14, bottom = 26;
    const { ctx, w, h } = fit(canvas, top + laneH * n + bottom);
    scanlines(ctx, w, h);
    const x0 = 16, x1 = w - 22;
    const span = x1 - x0;

    // distance ticks every 128 px of track
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let px = 0; px <= race.trackPx; px += 128) {
      const x = x0 + (px / race.trackPx) * span;
      ctx.fillStyle = DIM;
      ctx.fillRect(Math.round(x), top, 1, laneH * n);
      if (px > 0 && px < race.trackPx && w > 520) {
        ctx.fillStyle = TEXT;
        ctx.fillText(px + '', x, h - 9);
      }
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = TEXT;
    ctx.fillText('Start', x0, h - 9);
    ctx.textAlign = 'right';
    ctx.fillText(race.trackPx + ' px', x1 + 8, h - 9);
    checker(ctx, x1, top, top + laneH * n, 4);

    const sz = n <= 2 ? 8 : 6;
    for (let i = 0; i < n; i++) {
      const p = race.pixels[i];
      const cy = top + laneH * i + laneH / 2;
      const f = G.posAt(race, i, ms);
      const x = x0 + f * span;
      // lane divider
      if (i > 0) {
        ctx.fillStyle = 'rgba(190,215,225,0.07)';
        ctx.fillRect(x0, top + laneH * i, span, 1);
      }
      // trail
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(x0, Math.round(cy), x - x0, 1);
      ctx.globalAlpha = 1;
      // the pixel
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fillRect(Math.round(x - sz / 2), Math.round(cy - sz / 2), sz, sz);
      ctx.shadowBlur = 0;
      // name
      ctx.font = `${n <= 2 ? 13 : 11.5}px ${FONT}`;
      ctx.textBaseline = 'middle';
      const label = p.name;
      const lw = ctx.measureText(label).width;
      let lx, align;
      if (x - x0 > lw + 18) { lx = x - sz - 6; align = 'right'; } else { lx = x + sz + 6; align = 'left'; }
      ctx.textAlign = align;
      ctx.fillStyle = 'rgba(225,236,240,0.82)';
      ctx.fillText(label, lx, cy + 0.5);
    }
    ctx.textAlign = 'left';
  };

  /** Close-up window: 1 grid square = 1 track pixel. */
  G.drawLoupe = function (canvas, race, ms) {
    const n = race.n;
    const laneH = n <= 2 ? 64 : 24;
    const { ctx, w, h } = fit(canvas, laneH * n + 16);
    scanlines(ctx, w, h);
    const span = w < 560 ? 16 : 28; // track pixels visible
    const cell = w / span;
    const xs = race.pixels.map((p, i) => G.posAt(race, i, ms) * race.trackPx);
    const lead = Math.max(...xs);
    let left = lead - span * 0.68;
    if (left + span > race.trackPx + 2) left = race.trackPx + 2 - span;
    if (left < -1) left = -1;

    // grid
    ctx.fillStyle = 'rgba(190,215,225,0.07)';
    for (let k = Math.ceil(left); k < left + span; k++) {
      ctx.fillRect(Math.round((k - left) * cell), 0, 1, h);
    }
    // finish line
    const fx = (race.trackPx - left) * cell;
    if (fx > 0 && fx < w) checker(ctx, fx, 0, h, 6);

    const t = performance.now() / 1000;
    for (let i = 0; i < n; i++) {
      const p = race.pixels[i];
      const cy = 8 + laneH * i + laneH / 2;
      const size = Math.min(cell, laneH - 6);
      const x = (xs[i] - left) * cell;
      const mode = G.modeAt(race, i, ms);
      ctx.font = `12px ${FONT}`;
      ctx.textBaseline = 'middle';
      if (x + size < 0) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(6, cy); ctx.lineTo(14, cy - 5); ctx.lineTo(14, cy + 5); ctx.fill();
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(225,236,240,0.82)';
        ctx.fillText(`${p.name}, ${(lead - xs[i]).toFixed(1)} px back`, 20, cy);
        continue;
      }
      // pixel square: its right edge is its position
      const px = x - size;
      if (mode === 's') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.35;
        for (let s = 1; s <= 3; s++) ctx.fillRect(px - s * 9, cy - size / 2 + s * 3, 6, 1);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 18;
      ctx.fillRect(px, cy - size / 2, size, size);
      ctx.shadowBlur = 0;
      if (n > 2 && x + 4 < w - 70) {
        ctx.font = `11px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(225,236,240,0.7)';
        ctx.fillText(p.name, x + (mode === 'n' ? 22 : 6), cy);
      }
      if (mode === 'n') {
        ctx.fillStyle = 'rgba(225,236,240,0.8)';
        ctx.textAlign = 'left';
        const bob = Math.sin(t * 1.5 + i) * 2;
        ctx.font = `600 ${n <= 2 ? 13 : 10}px ${FONT}`;
        ctx.fillText('z', x + 4, cy - size / 2 + bob);
        ctx.font = `600 ${n <= 2 ? 10 : 8}px ${FONT}`;
        ctx.fillText('z', x + 12, cy - size / 2 - 7 + bob);
      }
    }
    ctx.textAlign = 'left';
  };

  /** Gap-to-leader chart as SVG markup. */
  G.gapChart = function (race, endMs) {
    const W = 900, Hh = 260, padL = 44, padB = 26, padT = 12, padR = 12;
    const steps = 240;
    const n = race.n;
    const series = Array.from({ length: n }, () => []);
    let maxGap = 1;
    for (let s = 0; s <= steps; s++) {
      const ms = (endMs * s) / steps;
      const xs = race.pixels.map((p, i) => G.posAt(race, i, ms) * race.trackPx);
      const lead = Math.max(...xs);
      xs.forEach((x, i) => {
        const g = lead - x;
        if (g > maxGap) maxGap = g;
        series[i].push([ms, g]);
      });
    }
    const nice = [2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const yMax = nice.find((v) => v >= maxGap) || Math.ceil(maxGap);
    const X = (ms) => padL + (ms / endMs) * (W - padL - padR);
    const Y = (g) => padT + (g / yMax) * (Hh - padT - padB);
    let out = `<svg class="gapchart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Gap to the leader over the race, in pixels">`;
    out += `<rect width="${W}" height="${Hh}" fill="${screen()}"/>`;
    for (let k = 0; k <= 4; k++) {
      const g = (yMax * k) / 4;
      out += `<line x1="${padL}" x2="${W - padR}" y1="${Y(g)}" y2="${Y(g)}" stroke="rgba(190,215,225,0.1)"/>`;
      out += `<text x="${padL - 8}" y="${Y(g) + 4}" text-anchor="end" fill="${TEXT}" font-size="11">${k === 0 ? 'lead' : '−' + (+g.toFixed(1))}</text>`;
    }
    const hours = endMs / G.H;
    const stepH = hours > 30 ? 6 : 3;
    for (let hh = 0; hh <= hours; hh += stepH) {
      out += `<text x="${X(hh * G.H)}" y="${Hh - 8}" text-anchor="middle" fill="${TEXT}" font-size="11">${hh}h</text>`;
    }
    series.forEach((pts, i) => {
      const d = pts.map(([ms, g], k) => `${k ? 'L' : 'M'}${X(ms).toFixed(1)},${Y(g).toFixed(1)}`).join('');
      out += `<path d="${d}" fill="none" stroke="${race.pixels[i].color}" stroke-width="1.6" stroke-linejoin="round"/>`;
    });
    out += '</svg>';
    return out;
  };

  /** Small rating sparkline (SVG, uses currentColor). */
  G.sparkline = function (hist, color) {
    if (hist.length < 2) return '';
    const W = 600, Hh = 120, pad = 6;
    const rs = hist.map((h) => h.r);
    const lo = Math.min(...rs), hi = Math.max(...rs);
    const X = (k) => pad + (k / (hist.length - 1)) * (W - 2 * pad);
    const Y = (r) => pad + (1 - (r - lo) / (hi - lo || 1)) * (Hh - 2 * pad);
    const d = rs.map((r, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(r).toFixed(1)}`).join('');
    return `<svg class="spark" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Rating history, from ${lo.toFixed(0)} to ${hi.toFixed(0)}">
      <rect width="${W}" height="${Hh}" fill="${screen()}"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  };
})();
