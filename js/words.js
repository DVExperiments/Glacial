/* Formatting helpers and the race commentary. */
(function () {
  const G = (window.G = window.G || {});
  const H = G.H;
  const pad = (x) => String(x).padStart(2, '0');

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dtf = (o) => new Intl.DateTimeFormat(undefined, o);
  const fTime = dtf({ hour: 'numeric', minute: '2-digit' });
  const fDate = dtf({ weekday: 'long', day: 'numeric', month: 'long' });
  const fDateShort = dtf({ day: 'numeric', month: 'short' });
  const fDateYear = dtf({ day: 'numeric', month: 'short', year: 'numeric' });
  const fFull = dtf({ weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  G.f = {
    esc,
    time: (ms) => fTime.format(ms),
    date: (ms) => fDate.format(ms),
    dateShort: (ms) => fDateShort.format(ms),
    dateYear: (ms) => fDateYear.format(ms),
    full: (ms) => fFull.format(ms),
    dur(ms, secs) {
      ms = Math.max(0, ms);
      const h = Math.floor(ms / H), m = Math.floor((ms % H) / 60000), s = Math.floor((ms % 60000) / 1000);
      if (secs) return h ? `${h}h ${pad(m)}m ${pad(s)}s` : `${m}m ${pad(s)}s`;
      return h ? `${h}h ${pad(m)}m` : `${m}m`;
    },
    countdown(ms) {
      ms = Math.max(0, ms);
      const d = Math.floor(ms / G.DAY);
      const rest = G.f.dur(ms % G.DAY, true);
      return d ? `${d}d ${rest}` : rest;
    },
    num: (x, dp = 0) => x.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }),
    ord(n) {
      const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },
    pct: (a, b) => (b ? Math.round((100 * a) / b) + '%' : '–')
  };

  G.chip = (id) => `<span class="chip" style="--c:${G.PX[id].color}" aria-hidden="true"></span>`;
  G.pxLink = (id) => `<a class="px" href="#pixel/${id}">${G.chip(id)}${esc(G.PX[id].name)}</a>`;
  G.pxName = (id) => `<span class="px">${G.chip(id)}${esc(G.PX[id].name)}</span>`;
  G.raceLink = (race, label) => `<a href="#race/${race.id}">${esc(label || G.raceTitle(race))}</a>`;
  G.raceTitle = (race) => (race.kind === 'gp' ? race.name : `Crawl ${race.number}`);

  G.MODE = { c: 'Cruising', n: 'Napping', s: 'Sprinting', t: 'Stumbling', f: 'Finished' };

  const LINES = {
    first: ['{A} twitches first and takes the early lead.', '{A} is first off the line. Barely.', '{A} leads after the opening minutes.'],
    lead: ['{A} slips past {B} at {px} px. New leader.', 'Lead change: {A} goes ahead of {B}.',
      '{A} edges in front of {B}. Somewhere, a crowd would be murmuring.', '{B} gives up the lead to {A} at the {px} px mark.',
      '{A} creeps past {B} and takes over at the front.'],
    nap: ['{A} has stopped. Stewards confirm it is a nap.', '{A} lies down at {px} px for an unscheduled rest.',
      '{A} dozes off at {px} px.', 'Nothing is moving in {A}’s lane. Asleep.'],
    wake: ['{A} wakes after {dur} and carries on.', '{A} is moving again after a {dur} nap.', '{A} stirs. {dur} of sleep, back to work.'],
    sprint: ['{A} kicks into a sprint at {spd} px/h.', '{A} suddenly finds pace: {spd} px/h.', 'A burst from {A}! {spd} px/h, briefly.'],
    stumble: ['{A} stumbles and loses rhythm.', '{A} trips over a stray subpixel.', 'A wobble from {A} at {px} px.'],
    half: ['{A} reaches halfway first.', 'Halfway, and {A} is in front.'],
    ninety: ['{A} enters the final {rem} px.', '{A} can see the finish line. {rem} px to go.'],
    timeout: ['{A} runs out of time at {px} px.']
  };

  /** Commentary line for an event (HTML). */
  G.say = function (race, e) {
    const pick = (arr) => arr[G.hash(race.id + ':' + e.n) % arr.length];
    const name = (i) => `<b>${esc(race.pixels[i].name)}</b>`;
    let line;
    if (e.type === 'lead') line = pick(e.from < 0 ? LINES.first : LINES.lead);
    else if (e.type === 'finish') {
      const res = race.results.find((r) => r.i === e.i);
      if (res.place === 0) line = race.kind === 'gp' ? '{A} crosses the line and wins the Grand Prix in {time}!' : '{A} crosses the line and wins in {time}!';
      else line = `{A} finishes ${G.f.ord(res.place + 1)}, {behind} behind.`;
    } else line = pick(LINES[e.type]);
    const px = e.x !== undefined ? (e.x * race.trackPx).toFixed(1) : '';
    return line
      .replace('{A}', name(e.i))
      .replace('{B}', e.from >= 0 ? name(e.from) : '')
      .replace('{px}', px)
      .replace('{rem}', e.x !== undefined ? Math.ceil((1 - e.x) * race.trackPx) : '')
      .replace('{dur}', G.f.dur((e.dur || 0) * race.segMs))
      .replace('{spd}', e.v !== undefined ? ((e.v * race.trackPx) / (race.segMs / H)).toFixed(1) : '')
      .replace('{time}', G.f.dur(e.ms, true))
      .replace('{behind}', G.f.dur(e.ms - race.winMs, true));
  };
})();
