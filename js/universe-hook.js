/*
 * The Pixel Universe hook. Glacial shows the weather and obeys the laws of the Pixel Senate, cosmetically:
 * colours, typefaces, race names, the tone of the commentary, and the conditions at the stadium.
 *
 * Nothing here touches the race. This file reads nothing that affects results, and if the other
 * sites cannot be reached, Glacial simply keeps its original look.
 *
 * Load it after words.js and before views.js. It fetches the Weather Bureau's and the Senate's
 * universe.js by itself, weather first, because the Senate depends on it.
 * For testing, add ?lawsAt=2029-06-01 to preview the laws in force on another date.
 */
(function () {
  const G = (window.G = window.G || {});
  const WEATHER = 'https://dvexperiments.github.io/Weather/universe.js';
  const SENATE = 'https://dvexperiments.github.io/Senate/universe.js';
  const DAY = 86400000;
  const DEFAULTS = { 'names.crawl': 'Daily Crawl', 'names.gp': 'Grand Prix', 'names.trophy': 'Grand Prix Trophy', 'commentary.tone': 'measured' };
  // The short form used in "Crawl 412" and "Crawl wins".
  const SHORT = { 'Daily Crawl': 'Crawl', 'Daily Creep': 'Creep', 'Daily Drift': 'Drift', 'The Long Afternoon': 'Afternoon', 'Daily Shuffle': 'Shuffle', 'The Slow Mile': 'Mile' };
  const FONT_AXES = {
    'Bricolage Grotesque': 'opsz,wght@12..96,500;12..96,700;12..96,800', 'Space Grotesk': 'wght@500;700', 'Fraunces': 'opsz,wght@9..144,500;9..144,700;9..144,800',
    'DM Serif Display': '', 'Syne': 'wght@500;700;800', 'Archivo Narrow': 'wght@500;600;700', 'IBM Plex Sans': 'ital,wght@0,400;0,500;0,600;1,400',
    'Source Serif 4': 'opsz,wght@8..60,400;8..60,600', 'Work Sans': 'wght@400;500;600', 'Atkinson Hyperlegible': 'wght@400;700',
    'IBM Plex Mono': 'wght@400;500;600', 'Literata': 'opsz,wght@7..72,400;7..72,600'
  };

  const q = new URLSearchParams(location.search);
  const preview = q.get('lawsAt') ? Date.parse(q.get('lawsAt') + (q.get('lawsAt').length <= 10 ? 'T12:00:00Z' : '')) : NaN;
  const lawTime = () => (isNaN(preview) ? Date.now() : preview);

  let senate = null;
  let laws = Object.assign({}, DEFAULTS);
  G.laws = () => laws;

  // ---------------------------------------------------------------- commentary tone
  const TONES = {
    breathless: { pre: ['Oh! ', 'Unbelievable! ', 'Here we go! ', '', ''], post: [''], bang: true },
    solemn: { pre: ['', '', 'Solemnly: '], post: [' The stadium falls silent.', ' Heads are bowed.', '', ''] },
    poetic: { pre: ['', ''], post: [' Like frost upon glass.', ' The light lingers a moment.', ' Time pools, then moves on.', ''] },
    clipped: { clip: true },
    bureaucratic: { pre: ['For the record: ', 'Officials note: ', 'Per regulation 4(b): ', ''], post: [' This has been logged.', '', ''] }
  };
  const toneCache = {};
  /** The tone in force on the day an event happened, so the archive reads as it was broadcast. */
  function toneAt(ms) {
    if (isNaN(preview) && senate) {
      const day = ms - (ms % DAY);
      if (!(day in toneCache)) {
        try { toneCache[day] = senate.lawsAt(day + DAY / 2)['commentary.tone']; } catch (e) { toneCache[day] = laws['commentary.tone']; }
      }
      return toneCache[day];
    }
    return laws['commentary.tone'];
  }
  function applyTone(html, tone, seed) {
    const T = TONES[tone];
    if (!T) return html;
    if (T.clip) return html.replace(/([.!])\s+[^<.!]+[.!]\s*$/, '.').replace(/,[^<,]*?\.\s*$/, '.').replace(/!/g, '.');
    const pick = (arr) => arr[seed % arr.length];
    let out = html;
    if (T.bang) out = out.replace(/\.\s*$/, '!');
    return pick(T.pre || ['']) + out + pick(T.post || ['']);
  }
  function wrapSay() {
    if (!G.say || G.say.senateWrapped) return;
    const original = G.say;
    G.say = function (race, e) {
      const html = original(race, e);
      return applyTone(html, toneAt(race.startMs + (e.ms || 0)), G.hash(race.id + ':tone:' + e.n));
    };
    G.say.senateWrapped = true;
  }
  wrapSay();

  // ---------------------------------------------------------------- race names
  // Glacial's pages are written with the original names. The hook rewrites visible text after each render,
  // remembering each text node's original so names can change again without a reload.
  const ORIG = '__senateOriginal';
  function renamer() {
    const crawl = laws['names.crawl'], gp = laws['names.gp'];
    const short = SHORT[crawl] || crawl;
    if (crawl === DEFAULTS['names.crawl'] && gp === DEFAULTS['names.gp']) return null;
    return (s) => s.replace(/Daily Crawl|Grand Prix|\bCrawl\b/g, (m) => (m === 'Daily Crawl' ? crawl : m === 'Grand Prix' ? gp : short));
  }
  let rename = null;
  function processNode(node) {
    if (node[ORIG] !== undefined && node.nodeValue === node.__senateOutput) return;
    const orig = node.nodeValue;
    node[ORIG] = orig;
    const out = rename ? rename(orig) : orig;
    node.__senateOutput = out;
    if (out !== orig) node.nodeValue = out;
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { processNode(root); return; }
    if (root.nodeName === 'SCRIPT' || root.nodeName === 'STYLE') return;
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) processNode(n);
  }
  function renameAll() {
    rename = renamer();
    const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) {
      if (n[ORIG] !== undefined && n.nodeValue === n.__senateOutput) n.nodeValue = n[ORIG];
      n[ORIG] = undefined;
      processNode(n);
    }
    titleOrig = null;
    renameTitle();
    trophyLine();
  }
  let titleOrig = null, titleOut = null;
  function renameTitle() {
    if (document.title !== titleOut) titleOrig = document.title;
    titleOut = rename ? rename(titleOrig || document.title) : (titleOrig || document.title);
    if (document.title !== titleOut) document.title = titleOut;
  }
  /** On the Grand Prix page, say what the pixels are racing for. */
  function trophyLine() {
    const head = document.querySelector('#app .page-head');
    let p = head && head.querySelector('.senate-trophy');
    if (!/^#gp/.test(location.hash) || !head || laws['names.trophy'] === DEFAULTS['names.trophy']) { if (p) p.remove(); return; }
    const text = 'The winner takes home ' + (/^The /.test(laws['names.trophy']) ? laws['names.trophy'] : 'the ' + laws['names.trophy']) + ', as named by the Pixel Senate.';
    if (!p) { p = document.createElement('p'); p.className = 'lede senate-trophy'; head.appendChild(p); }
    if (p.textContent !== text) p.textContent = text;
  }
  // ---------------------------------------------------------------- the weather at the stadium
  let climate = null;
  const WORD = { N: 'northerly', NE: 'northeasterly', E: 'easterly', SE: 'southeasterly', S: 'southerly', SW: 'southwesterly', W: 'westerly', NW: 'northwesterly' };
  function windWords(x) {
    const w = WORD[x.compass.length === 3 ? x.compass.slice(1) : x.compass] || 'westerly';
    return x.wind < 6 ? 'barely a breath of wind' : x.wind < 20 ? 'a light ' + w : x.wind < 40 ? 'a fresh ' + w : x.wind < 62 ? 'a strong ' + w : 'a gale-force ' + w;
  }
  function raceWindow(id) {
    let m = /^C-(\d{4})-(\d{2})-(\d{2})$/.exec(id);
    if (m) return { start: Date.UTC(+m[1], +m[2] - 1, +m[3]), days: 1 };
    m = /^GP-(\d{4})-(\d{2})$/.exec(id);
    return m ? { start: Date.UTC(+m[1], +m[2] - 1, 1), days: 2 } : null;
  }
  function weatherLine() {
    if (!climate) return;
    const head = document.querySelector('#app .page-head');
    if (!head) return;
    const hash = location.hash || '#live';
    let text = null;
    if (/^#live/.test(hash)) {
      const x = climate.sample(Date.now());
      text = 'At the stadium: ' + x.cond.charAt(0).toLowerCase() + x.cond.slice(1) + ' and ' + x.temp.toFixed(1) + '\u00b0C, with ' + windWords(x) + '.';
      if (/^Storm /.test(x.cond)) text = 'At the stadium: ' + x.cond + ', ' + x.temp.toFixed(1) + '\u00b0C, with ' + windWords(x) + '. The race goes on.';
    } else if (/^#race\//.test(hash)) {
      const w = raceWindow(decodeURIComponent(hash.slice(6)));
      if (w && w.start + w.days * 86400000 <= Date.now()) {
        const days = climate.historyBetween(w.start, w.start + w.days * 86400000);
        if (days.length) {
          let lo = 99, hi = -99, rain = 0, gust = 0;
          for (const d of days) { lo = Math.min(lo, d.min); hi = Math.max(hi, d.max); rain += d.rain; gust = Math.max(gust, d.gust); }
          const conds = days.map((d) => d.cond).filter((c, i, a) => a.indexOf(c) === i).join(', then ');
          text = 'Race weather: ' + conds + ', ' + Math.round(lo) + '\u2013' + Math.round(hi) + '\u00b0C' + (rain >= 0.5 ? ', ' + rain.toFixed(1) + ' mm of rain' : ', dry') + ', gusts to ' + gust + ' km/h.';
        }
      }
    }
    let p = head.querySelector('.universe-weather');
    if (!text) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('p'); p.className = 'lede universe-weather'; p.style.color = 'var(--muted)'; p.style.marginTop = '8px'; head.appendChild(p); }
    if (p.textContent !== text) p.textContent = text;
  }

  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') processNode(m.target);
      else for (const n of m.addedNodes) walk(n);
      if (m.addedNodes.length && m.target.id === 'app') { trophyLine(); weatherLine(); }
    }
  });

  // ---------------------------------------------------------------- colours and typefaces
  const loadedFonts = {};
  function loadFont(name) {
    if (!name || loadedFonts[name] || !(name in FONT_AXES) || name === 'Bricolage Grotesque' || name === 'IBM Plex Sans') return;
    loadedFonts[name] = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + name.replace(/ /g, '+') + (FONT_AXES[name] ? ':' + FONT_AXES[name] : '') + '&display=swap';
    document.head.appendChild(link);
  }
  const dark = matchMedia('(prefers-color-scheme: dark)');
  function applyStyle() {
    if (!senate) return;
    const vars = senate.styleVars(lawTime(), dark.matches ? 'dark' : 'light');
    const root = document.documentElement.style;
    for (const k in vars) root.setProperty(k, vars[k]);
    G.screenColour = vars['--screen'];
    const meta = document.querySelector('meta[name="theme-color"][media*="' + (dark.matches ? 'dark' : 'light') + '"]');
    if (meta) meta.setAttribute('content', vars['--bg']);
  }

  // ---------------------------------------------------------------- staying in step with the Senate
  let lastKey = '';
  function refresh() {
    if (!senate) return;
    try {
      laws = Object.assign({}, DEFAULTS, senate.lawsAt(lawTime()));
    } catch (e) { return; }
    const key = JSON.stringify(laws);
    if (key === lastKey) return;
    lastKey = key;
    applyStyle();
    loadFont(laws['style.display']);
    loadFont(laws['style.body']);
    renameAll();
  }
  function start() {
    senate = window.PixelUniverse && window.PixelUniverse.senate;
    if (!senate || (senate.ready && !senate.ready())) { senate = null; return; }
    refresh();
    // commentary already on screen was written before the laws arrived: redraw the page once
    if (laws['commentary.tone'] !== DEFAULTS['commentary.tone'] && G.views) window.dispatchEvent(new HashChangeEvent('hashchange'));
    setInterval(refresh, 60000); // laws take effect at 00:00 UTC; checking each minute is plenty
    const title = document.querySelector('title');
    if (title) new MutationObserver(renameTitle).observe(title, { childList: true, characterData: true, subtree: true });
    dark.addEventListener('change', applyStyle);
  }

  function load(src, done) {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => done(true);
    s.onerror = () => done(false);
    document.head.appendChild(s);
  }
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.PixelUniverseOptions = Object.assign(window.PixelUniverseOptions || {}, { senateSkipGlacial: true });
    // load after Glacial has painted, so the race is never kept waiting. Weather first: the Senate depends on it.
    load(WEATHER, (ok) => {
      if (!ok) return; // no weather, so no Senate either: Glacial keeps its original look
      climate = window.PixelUniverse && window.PixelUniverse.climate;
      weatherLine();
      setInterval(weatherLine, 60000);
      load(SENATE, (ok2) => { if (ok2) setTimeout(start, 0); });
    });
  });
})();
