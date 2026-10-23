/* Router and update loop. */
(function () {
  const G = window.G;
  const app = document.getElementById('app');
  let L = null;
  let view = null;
  let lastFrame = 0;

  function build() {
    L = G.buildLeague(Date.now());
  }

  function route() {
    const parts = (location.hash.replace(/^#/, '') || 'live').split('/');
    const [page, arg] = parts;
    const now = Date.now();
    let v;
    switch (page) {
      case 'live': v = G.views.live(L, now); break;
      case 'gp': v = G.views.gp(L, now); break;
      case 'standings': v = G.views.standings(L, now); break;
      case 'pixels': v = G.views.pixels(L, now); break;
      case 'pixel': v = G.views.pixel(L, arg); break;
      case 'archive': v = G.views.archive(L, arg && G.PX[arg] ? arg : ''); break;
      case 'race': v = G.views.race(L, arg); break;
      case 'records': v = G.views.records(L, now); break;
      case 'about': v = G.views.about(L, now); break;
      default: v = G.views.notFound();
    }
    if (v.redirect) { location.replace(v.redirect); return; }
    if (view && view.destroy) view.destroy();
    view = v;
    app.innerHTML = v.html;
    if (v.mount) v.mount(app);
    if (v.tick) v.tick(now);
    if (!v.keepTitle) document.title = (v.title ? v.title + ', ' : '') + 'Glacial, the world’s slowest race';
    const navKey = { pixel: 'pixels', race: 'archive' }[page] || page;
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function onHash() {
    route();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (document.hidden || !view || !view.frame) return;
    if (t - lastFrame < 66) return; // ~15 fps is plenty at this speed
    lastFrame = t;
    view.frame(Date.now());
  }

  setInterval(() => {
    if (document.hidden || !L) return;
    const now = Date.now();
    if (L.current && now >= L.current.startMs + L.current.windowMs) {
      build();
      route();
      return;
    }
    if (view && view.tick) view.tick(now);
  }, 1000);

  window.addEventListener('hashchange', onHash);
  window.addEventListener('resize', () => { lastFrame = 0; });

  // Let the page paint before the history replay.
  requestAnimationFrame(() => setTimeout(() => {
    build();
    route();
    requestAnimationFrame(loop);
  }, 0));
})();
