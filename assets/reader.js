/* Quran Mushaf reader: renders the 604 pages of the Madinah Mushaf from
   data/mushaf.js with the King Fahd Complex QCF4 fonts, and presents them as
   a right-to-left book with page turns, an index, bookmarks and themes. */
(function () {
  'use strict';

  var D = window.MUSHAF_DATA;
  if (!D) {
    document.body.textContent = 'The Mushaf data file (data/mushaf.js) did not load.';
    return;
  }

  var TOTAL = D.pages.length;
  var LH = 162;                 // line pitch in centi-ems (1 cu = 1/100 of the text size)
  var TW = D.measure / 25;      // justified line width: measure / 2500 units-per-em * 100
  var TH = LH * 15;
  var OPEN_SCALE = 1.06;        // pages 1-2 are set slightly larger, inside the medallion
  var OPEN_PITCH = 186;
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  var STORE_KEY = 'quran-mushaf.v1';
  var THEMES = ['madinah', 'azure', 'rose', 'night'];

  var FONT_BASES = [
    'fonts/',
    'https://cdn.jsdelivr.net/npm/quran-qcf4@1.1.0/fonts-woff2/',
    'https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main/fonts-woff2/'
  ];

  var GEOMS = {
    regular: { mx: 110, mt: 200, mb: 210, band: 84, px: 44, py: 34 },
    compact: { mx: 30, mt: 150, mb: 150, band: 62, px: 28, py: 26 }
  };
  Object.keys(GEOMS).forEach(function (k) {
    var g = GEOMS[k];
    g.tw = TW;
    g.th = TH;
    g.tx = g.mx + g.band + g.px;
    g.ty = g.mt + g.band + g.py;
    g.pw = 2 * g.tx + TW;
    g.ph = g.ty + TH + g.py + g.band + g.mb;
    g.bw = TW + 2 * g.px - 12;
    g.openR = 800;
  });

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function em(cu) { return (Math.round(cu * 100) / 10000) + 'em'; }
  function ar(n) { return String(n).replace(/\d/g, function (d) { return AR_DIGITS[d]; }); }
  function clampPage(n) { n = parseInt(n, 10); return isNaN(n) ? 1 : Math.min(TOTAL, Math.max(1, n)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svgUse(id, vbw, vbh, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 ' + vbw + ' ' + vbh);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('preserveAspectRatio', 'none');
    if (cls) s.setAttribute('class', cls);
    var u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#' + id);
    u.setAttribute('width', vbw);
    u.setAttribute('height', vbh);
    s.appendChild(u);
    return s;
  }

  /* ---------- Metadata helpers ---------- */

  function chapter(s) { return D.chapters[s - 1]; }
  function suraName(s) { return chapter(s)[1]; }

  // The surah a page "belongs to": the last surah that begins on it, else the one it continues.
  var pageSura = [];
  var pageRub = [];
  (function () {
    var rub = 0;
    D.pages.forEach(function (p, i) {
      var s = p[1];
      p[5].forEach(function (l) { if (l[0] === 0) s = l[1]; });
      pageSura[i + 1] = s;
      p[6].forEach(function (m) { if (m[1] === 'r') rub = Math.max(rub, m[2]); });
      pageRub[i + 1] = rub;
    });
  })();

  /* ---------- Fonts ---------- */

  var fontJobs = {};
  var fontsReady = {};
  var bases = FONT_BASES.slice();

  function fontFile(name) { return name === 'QCF4_QBSML' ? name + '.woff2' : name + '_W.woff2'; }
  function pageFont(n) {
    var no = D.pages[n - 1][0];
    return 'QCF4_Hafs_' + (no < 10 ? '0' : '') + no;
  }

  function loadFont(name) {
    if (fontJobs[name]) return fontJobs[name];
    var job = (function attempt(i) {
      if (i >= bases.length) return Promise.reject(new Error('font ' + name));
      var base = bases[i];
      var face = new FontFace(name, 'url("' + base + fontFile(name) + '") format("woff2")', { display: 'block' });
      return face.load().then(function (loaded) {
        document.fonts.add(loaded);
        fontsReady[name] = true;
        if (i > 0) bases = [base].concat(bases.filter(function (b) { return b !== base; }));
        return true;
      }, function () { return attempt(i + 1); });
    })(0);
    job.catch(function () { delete fontJobs[name]; });
    fontJobs[name] = job;
    return job;
  }

  function fontsFor(n) {
    var p = D.pages[n - 1];
    var list = [pageFont(n)];
    var qbsml = n <= 2 || !!p[4];
    var bsml = false;
    p[5].forEach(function (l) {
      if (l[0] === 0) qbsml = true;
      if (l[0] === 1) bsml = true;
    });
    if (qbsml) list.push('QCF4_QBSML');
    if (bsml && list.indexOf('QCF4_Hafs_01') < 0) list.push('QCF4_Hafs_01');
    return list;
  }

  function prefetch(n) {
    for (var d = -4; d <= 6; d++) {
      var k = n + d;
      if (k >= 1 && k <= TOTAL) fontsFor(k).forEach(function (f) { loadFont(f).catch(function () {}); });
    }
  }

  /* ---------- Page rendering ---------- */

  function renderPage(n, gk) {
    var g = GEOMS[gk];
    var p = D.pages[n - 1];
    var opening = n <= 2;
    var side = n % 2 ? 'r' : 'l';
    var page = el('article', 'page side-' + side + (opening ? ' opening' : ''));
    page.dataset.page = n;
    page.setAttribute('role', 'img');
    page.setAttribute('aria-label', 'Page ' + n + ', Surah ' + suraName(pageSura[n]) + ', Juz ' + p[3]);

    page.appendChild(svgUse((opening ? 'frame-open-' : 'frame-') + gk, g.pw, g.ph, 'orn'));

    if (!opening && p[4]) {
      var rh = el('div', 'rh');
      var rs = el('span', 'rh-sura', String.fromCharCode(p[4]));
      var rj = el('span', 'rh-juz', String.fromCharCode(0xF1D8 + p[3] - 1));
      // Surah name on the outer edge, juz on the edge by the spine.
      if (side === 'r') { rh.appendChild(rj); rh.appendChild(rs); } else { rh.appendChild(rs); rh.appendChild(rj); }
      page.appendChild(rh);
    }

    var tx = el('div', 'tx');
    tx.style.fontFamily = "'" + pageFont(n) + "'";
    tx.setAttribute('aria-hidden', 'true');
    var s = p[1], a = p[2];
    var openCy = g.ty + g.th * 0.56;
    p[5].forEach(function (l, i) {
      var ln = el('div', 'ln');
      if (l[0] === 0) {
        s = l[1];
        a = 1;
        ln.classList.add('ln-sura');
        if (!opening) ln.appendChild(svgUse('banner-' + gk, g.bw, 150, 'banner'));
        ln.appendChild(el('span', 'sn', String.fromCharCode(0xF100 + s - 1)));
      } else if (l[0] === 1) {
        ln.classList.add('ln-bsm');
        ln.appendChild(el('span', null, String.fromCharCode(l[1])));
      } else {
        var glyphs = l[0], types = l[1], w = l[2];
        if (opening) ln.classList.add('ln-c');
        else if (w < D.centerBelow) ln.classList.add('ln-c');
        else if (w > D.measure) {
          ln.classList.add('ln-x');
          ln.style.setProperty('--w', em(w / 25));
          ln.style.setProperty('--k', (D.measure / w).toFixed(4));
        }
        for (var j = 0; j < glyphs.length; j++) {
          var t = types[j];
          var sp = el('span', null, glyphs[j]);
          if (t === 'q') {
            sp.className = 'rq';
          } else {
            sp.dataset.v = s + ':' + a;
            if (t === 'e') { sp.className = 'ae'; a++; } else if (t === 'a') sp.className = 'jl';
          }
          ln.appendChild(sp);
        }
      }
      if (opening) {
        ln.classList.add('ln-open');
        if (i === 0) {
          ln.style.top = em(250 - LH / 2);
        } else {
          ln.style.top = em(openCy + (i - 4) * OPEN_PITCH - OPEN_PITCH / 2 - g.ty);
        }
      }
      tx.appendChild(ln);
    });
    page.appendChild(tx);

    (opening ? [] : p[6]).forEach(function (m) {
      var mk = el('div', 'mk');
      var label, title;
      if (m[1] === 'r') {
        var hizb = Math.floor(m[2] / 4) + 1, q = m[2] % 4;
        label = q === 0 ? ar(hizb) : ['', '¼', '½', '¾'][q];
        title = q === 0 ? 'Hizb ' + hizb + (hizb % 2 ? ' · Juz ' + ((hizb + 1) / 2) : '') : ['', '¼', '½', '¾'][q] + ' Hizb ' + hizb;
        if (q === 0) mk.classList.add('mk-hizb');
      } else {
        label = '۩';
        title = 'Prostration (sajdah)';
        mk.classList.add('mk-sajda');
      }
      mk.title = title;
      var cx = side === 'r' ? g.pw - g.mx - g.band / 2 : g.mx + g.band / 2;
      var cy = g.ty + (m[0] - 0.5) * LH;
      mk.style.left = em(cx - 60);
      mk.style.top = em(cy - 60);
      mk.appendChild(svgUse('medal', 120, 120));
      mk.appendChild(el('span', null, label));
      page.appendChild(mk);
    });

    var folio = el('div', 'folio');
    folio.appendChild(svgUse('folio', 300, 120));
    folio.appendChild(el('span', null, ar(n)));
    page.appendChild(folio);
    page.appendChild(el('div', 'ribbon'));
    page.appendChild(el('div', 'loading'));

    var need = fontsFor(n);
    if (need.every(function (f) { return fontsReady[f]; })) {
      page.classList.add('ready');
    } else {
      Promise.all(need.map(loadFont)).then(function () {
        page.classList.add('ready');
        page.classList.remove('font-error');
      }, function () {
        page.classList.add('font-error');
        cache.delete(gk + ':' + n);
      });
    }
    return page;
  }

  var cache = new Map();
  function getPage(n) {
    var key = geomKey + ':' + n;
    var page = cache.get(key);
    if (!page) {
      page = renderPage(n, geomKey);
      cache.set(key, page);
      if (cache.size > 18) {
        cache.forEach(function (v, k) {
          if (cache.size > 14 && !v.isConnected) cache.delete(k);
        });
      }
    }
    page.classList.toggle('marked', isBookmarked(n));
    return page;
  }

  /* ---------- Settings & persistence ---------- */

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ page: current, settings: settings, bookmarks: bookmarks }));
    } catch (e) { /* storage unavailable: settings last for this visit only */ }
  }

  var saved = readStore();
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var settings = Object.assign({
    theme: prefersDark ? 'night' : 'madinah',
    view: 'auto',
    markers: 'tint',
    jalalah: false,
    anim: !reduceMotion
  }, saved.settings || {});
  if (THEMES.indexOf(settings.theme) < 0) settings.theme = 'madinah';
  var bookmarks = Array.isArray(saved.bookmarks) ? saved.bookmarks.filter(function (b) { return b && b.p >= 1 && b.p <= TOTAL; }) : [];

  function hashPage() {
    var m = /^#(?:p|page)?(\d{1,3})$/i.exec(location.hash || '');
    return m ? clampPage(m[1]) : 0;
  }
  var current = hashPage() || clampPage(saved.page || 1);

  function isBookmarked(n) { return bookmarks.some(function (b) { return b.p === n; }); }

  function applySettings() {
    var root = document.documentElement;
    root.dataset.mushaf = settings.theme;
    root.classList.toggle('tint-markers', settings.markers === 'tint');
    root.classList.toggle('jalalah', !!settings.jalalah);
    $all('[data-set]').forEach(function (b) {
      var on = String(settings[b.dataset.set]) === b.dataset.value;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $all('[data-toggle]').forEach(function (b) {
      b.setAttribute('aria-checked', settings[b.dataset.toggle] ? 'true' : 'false');
    });
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--stage').trim() || '#1b2420');
  }

  /* ---------- Book layout ---------- */

  var book = $('#book');
  var sheetR = $('.sheet-r', book), sheetL = $('.sheet-l', book);
  var leaf = $('.leaf', book), front = $('.face.front', leaf), back = $('.face.back', leaf);
  var castR = $('.cast-r', book), castL = $('.cast-l', book);
  var mode = 'spread';
  var geomKey = 'regular';
  var turning = null;

  function layout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var narrow = vw < 640;
    var short = vh < 560; // phones held sideways: let the auto-hiding bars overlap the page
    var gk = narrow || short ? 'compact' : 'regular';
    var g = GEOMS[gk];
    var padX = narrow ? 8 : 28;
    var padTop = short ? 6 : narrow ? 58 : 70, padBottom = short ? 6 : narrow ? 70 : 78;
    var availW = vw - padX * 2, availH = vh - padTop - padBottom;
    var pw = g.pw / 100, ph = g.ph / 100;
    var stack = 0.5;
    var fSpread = Math.min(availW / (2 * pw + 2 * stack), availH / ph);
    var fSingle = Math.min(availW / pw, availH / ph);
    var wantSpread = settings.view === 'two' ||
      (settings.view === 'auto' && vw > vh * 1.08 && fSpread >= 13.5);
    var newMode = wantSpread ? 'spread' : 'single';
    var f = Math.floor((wantSpread ? fSpread : fSingle) * 100) / 100;

    if (turning) turning.finish();
    var changed = newMode !== mode || gk !== geomKey;
    mode = newMode;
    geomKey = gk;
    book.className = 'book ' + mode;
    var st = book.style;
    st.setProperty('--f', f + 'px');
    st.setProperty('--pw', em(g.pw));
    st.setProperty('--ph', em(g.ph));
    st.setProperty('--tx', em(g.tx));
    st.setProperty('--ty', em(g.ty));
    st.setProperty('--tw', em(g.tw));
    st.setProperty('--mt', em(g.mt));
    st.setProperty('--mx', em(g.mx));
    st.setProperty('--mb', em(g.mb));
    st.setProperty('--bl', em(-(g.px - 6)));
    st.setProperty('--bw', em(g.bw));
    st.setProperty('--opitch', (OPEN_PITCH / 100 / OPEN_SCALE).toFixed(4) + 'em');
    $('#stage').style.paddingTop = padTop + 'px';
    $('#stage').style.paddingBottom = padBottom + 'px';
    place(changed);
  }

  function spreadOf(n) { return Math.ceil(n / 2); }
  function spreadPages(sp) { return [2 * sp - 1, 2 * sp]; }

  function place() {
    leaf.hidden = true;
    if (mode === 'spread') {
      var pr = spreadPages(spreadOf(current));
      sheetR.replaceChildren(getPage(pr[0]));
      sheetL.replaceChildren(getPage(pr[1]));
    } else {
      sheetR.replaceChildren(getPage(current));
      sheetL.replaceChildren();
    }
    updateStacks();
  }

  function updateStacks() {
    var read = (current - 1) / (TOTAL - 1);
    book.style.setProperty('--read', read.toFixed(3));
  }

  function shade() { return el('div', 'shade'); }

  function animateLeaf(fromDeg, toDeg, duration) {
    var easing = 'cubic-bezier(.42,.06,.28,1)';
    return leaf.animate(
      [{ transform: 'rotateY(' + fromDeg + 'deg)' }, { transform: 'rotateY(' + toDeg + 'deg)' }],
      { duration: duration, easing: easing, fill: 'both' }
    );
  }

  function runTurn(anims, done) {
    var ended = false;
    function end() {
      if (ended) return;
      ended = true;
      anims.forEach(function (a) { a.cancel(); });
      leaf.hidden = true;
      leaf.className = 'leaf';
      front.replaceChildren();
      back.replaceChildren();
      castR.style.opacity = castL.style.opacity = 0;
      turning = null;
      done();
    }
    anims[0].onfinish = end;
    turning = { finish: end };
  }

  function turnSpread(fromSpread, toSpread) {
    var forward = toSpread > fromSpread;
    var fp = spreadPages(fromSpread), tp = spreadPages(toSpread);
    var dur = 820;
    leaf.className = 'leaf ' + (forward ? 'on-left' : 'on-right');
    if (forward) {
      front.replaceChildren(getPage(fp[1]), shade());
      back.replaceChildren(getPage(tp[0]), shade());
      sheetL.replaceChildren(getPage(tp[1]));
    } else {
      front.replaceChildren(getPage(fp[0]), shade());
      back.replaceChildren(getPage(tp[1]), shade());
      sheetR.replaceChildren(getPage(tp[0]));
    }
    leaf.hidden = false;
    var sign = forward ? 1 : -1;
    var under = forward ? castL : castR, over = forward ? castR : castL;
    var anims = [
      animateLeaf(0, 180 * sign, dur),
      $('.shade', front).animate([{ opacity: 0 }, { opacity: 0.5 }], { duration: dur / 2, easing: 'ease-in', fill: 'both' }),
      $('.shade', back).animate([{ opacity: 0.55, offset: 0 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0, offset: 1 }], { duration: dur, fill: 'both' }),
      under.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: dur * 0.8, easing: 'ease-out', fill: 'both' }),
      over.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 0.7, offset: 0.92 }, { opacity: 0, offset: 1 }], { duration: dur, fill: 'both' })
    ];
    runTurn(anims, place);
  }

  function turnSingle(from, to) {
    var forward = to > from;
    var dur = 700;
    var blank = el('div', 'page blank');
    leaf.className = 'leaf on-single';
    if (forward) {
      front.replaceChildren(getPage(from), shade());
      back.replaceChildren(blank, shade());
      sheetR.replaceChildren(getPage(to));
    } else {
      front.replaceChildren(getPage(to), shade());
      back.replaceChildren(blank, shade());
    }
    leaf.hidden = false;
    var anims = forward ? [
      animateLeaf(0, 180, dur),
      $('.shade', front).animate([{ opacity: 0 }, { opacity: 0.5 }], { duration: dur / 2, easing: 'ease-in', fill: 'both' }),
      castR.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: dur * 0.8, easing: 'ease-out', fill: 'both' })
    ] : [
      animateLeaf(180, 0, dur),
      $('.shade', front).animate([{ opacity: 0.5, offset: 0 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0, offset: 1 }], { duration: dur, fill: 'both' }),
      castR.animate([{ opacity: 0 }, { opacity: 0.8 }], { duration: dur, easing: 'ease-in', fill: 'both' })
    ];
    runTurn(anims, place);
  }

  function go(n, opts) {
    n = clampPage(n);
    var animate = !(opts && opts.animate === false) && settings.anim;
    if (turning) turning.finish();
    var from = current;
    current = n;
    clearAyah();
    if (n !== from) {
      if (mode === 'spread') {
        var a = spreadOf(from), b = spreadOf(n);
        if (a !== b && animate) turnSpread(a, b); else place();
      } else if (animate) {
        turnSingle(from, n);
      } else {
        place();
      }
    } else {
      place();
    }
    updateStacks();
    updateChrome();
    writeStore();
    prefetch(n);
    try { history.replaceState(null, '', '#' + n); } catch (e) { /* sandboxed frames may refuse */ }
  }

  function step(dir) {
    if (mode === 'spread') {
      var sp = spreadOf(current) + dir;
      if (sp < 1 || sp > spreadOf(TOTAL)) return;
      go(spreadPages(sp)[0]);
    } else {
      go(current + dir);
    }
  }
  var next = function () { step(1); };
  var prev = function () { step(-1); };

  /* ---------- Chrome (top bar, slider, panels) ---------- */

  var whereAr = $('#where-ar'), whereEn = $('#where-en'), whereMeta = $('#where-meta');
  var slider = $('#slider'), sliderOut = $('#slider-out'), bubble = $('#bubble');
  var bookmarkBtn = $('#btn-bookmark');

  function pagesLabel() {
    if (mode === 'spread') {
      var pr = spreadPages(spreadOf(current));
      return 'Pages ' + pr[0] + '–' + pr[1];
    }
    return 'Page ' + current;
  }

  function updateChrome() {
    var s = pageSura[current];
    var c = chapter(s);
    whereAr.textContent = c[0];
    whereEn.textContent = s + '. ' + c[1];
    var hizb = Math.floor(pageRub[current] / 4) + 1;
    whereMeta.textContent = 'Juz ' + D.pages[current - 1][3] + ' · Hizb ' + hizb + ' · ' + pagesLabel();
    slider.value = current;
    sliderOut.textContent = current;
    var marked = isBookmarked(current);
    bookmarkBtn.setAttribute('aria-pressed', marked ? 'true' : 'false');
    bookmarkBtn.title = marked ? 'Remove bookmark (B)' : 'Bookmark this page (B)';
    $all('.row.is-current').forEach(function (r) { r.classList.remove('is-current'); });
    var row = $('#list-surah .row[data-sura="' + s + '"]');
    if (row) row.classList.add('is-current');
    var jrow = $('#list-juz .row[data-juz="' + D.pages[current - 1][3] + '"]');
    if (jrow) jrow.classList.add('is-current');
    document.title = c[1] + ' · Page ' + current + ' — Quran Mushaf';
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function toggleBookmark() {
    if (isBookmarked(current)) {
      bookmarks = bookmarks.filter(function (b) { return b.p !== current; });
      toast('Bookmark removed from page ' + current);
    } else {
      bookmarks.push({ p: current, t: Date.now() });
      toast('Page ' + current + ' bookmarked');
    }
    writeStore();
    $all('.page[data-page]').forEach(function (pg) { pg.classList.toggle('marked', isBookmarked(+pg.dataset.page)); });
    updateChrome();
    renderBookmarks();
  }

  /* Ayah highlight */
  var selected = null;
  function clearAyah() {
    if (!selected) return;
    $all('.ln span.sel').forEach(function (s) { s.classList.remove('sel'); });
    selected = null;
  }
  function selectAyah(key) {
    var same = key === selected;
    clearAyah();
    if (same) return;
    selected = key;
    $all('#book [data-v="' + key + '"]').forEach(function (s) { s.classList.add('sel'); });
    var parts = key.split(':');
    toast(suraName(+parts[0]) + ' · Ayah ' + parts[1]);
  }

  /* Panels */
  var drawer = $('#drawer'), settingsPanel = $('#settings'), scrim = $('#scrim');
  function openPanel(panel, focusSel) {
    closePanels();
    panel.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(function () {
      panel.classList.add('open');
      scrim.classList.add('open');
      var f = focusSel ? $(focusSel, panel) : panel;
      if (f) f.focus({ preventScroll: true });
    });
    document.body.classList.remove('idle');
  }
  function closePanels() {
    [drawer, settingsPanel].forEach(function (p) {
      if (!p.hidden) {
        p.classList.remove('open');
        setTimeout(function () { if (!p.classList.contains('open')) p.hidden = true; }, 260);
      }
    });
    scrim.classList.remove('open');
    setTimeout(function () { if (!scrim.classList.contains('open')) scrim.hidden = true; }, 260);
  }
  function panelOpen() { return !drawer.hidden || !settingsPanel.hidden; }

  /* Index lists */
  function buildLists() {
    var ls = $('#list-surah');
    D.chapters.forEach(function (c, i) {
      var s = i + 1;
      var b = el('button', 'row');
      b.type = 'button';
      b.dataset.page = c[5];
      b.dataset.sura = s;
      b.dataset.search = (s + ' ' + c[0] + ' ' + c[1] + ' ' + c[2]).toLowerCase().replace(/[-'ʿʾ’āīūḥṣḍṭẓ]/g, function (ch) {
        return { 'ā': 'a', 'ī': 'i', 'ū': 'u', 'ḥ': 'h', 'ṣ': 's', 'ḍ': 'd', 'ṭ': 't', 'ẓ': 'z' }[ch] || '';
      });
      var num = el('span', 'num');
      num.appendChild(svgUse('m-star', 100, 100));
      num.appendChild(el('span', null, s));
      var names = el('span', 'names');
      names.appendChild(el('span', 'en', c[1]));
      names.appendChild(el('span', 'sub', (c[4] === 'm' ? 'Meccan' : 'Medinan') + ' · ' + c[3] + ' āyāt'));
      b.appendChild(num);
      b.appendChild(names);
      b.appendChild(el('span', 'ar-glyph', String.fromCharCode(0xF100 + i)));
      b.appendChild(el('span', 'pg', c[5]));
      b.setAttribute('aria-label', 'Surah ' + s + ', ' + c[1] + ', page ' + c[5]);
      ls.appendChild(b);
    });
    var lj = $('#list-juz');
    D.juz.forEach(function (j, i) {
      var b = el('button', 'row');
      b.type = 'button';
      b.dataset.page = j[0];
      b.dataset.juz = i + 1;
      var num = el('span', 'num');
      num.appendChild(svgUse('m-star', 100, 100));
      num.appendChild(el('span', null, i + 1));
      var names = el('span', 'names');
      names.appendChild(el('span', 'en', 'Juz ' + (i + 1)));
      names.appendChild(el('span', 'sub', 'Begins ' + suraName(j[1]) + ' ' + j[1] + ':' + j[2]));
      b.appendChild(num);
      b.appendChild(names);
      b.appendChild(el('span', 'ar-glyph juz', String.fromCharCode(0xF1D8 + i)));
      b.appendChild(el('span', 'pg', j[0]));
      b.setAttribute('aria-label', 'Juz ' + (i + 1) + ', page ' + j[0]);
      lj.appendChild(b);
    });
  }

  function renderBookmarks() {
    var lb = $('#list-bookmarks');
    lb.replaceChildren();
    var sorted = bookmarks.slice().sort(function (a, b) { return a.p - b.p; });
    $('#bm-count').textContent = bookmarks.length ? String(bookmarks.length) : '';
    if (!sorted.length) {
      var empty = el('div', 'empty');
      empty.appendChild(el('p', 'empty-title', 'No bookmarks yet'));
      empty.appendChild(el('p', null, 'Press the ribbon button above the page, or B on a keyboard, to keep your place. Bookmarked pages show a ribbon.'));
      lb.appendChild(empty);
      return;
    }
    sorted.forEach(function (bm) {
      var wrap = el('div', 'row-wrap');
      var b = el('button', 'row');
      b.type = 'button';
      b.dataset.page = bm.p;
      var num = el('span', 'num ribbon-num');
      num.appendChild(el('span', null, bm.p));
      var names = el('span', 'names');
      var s = pageSura[bm.p];
      names.appendChild(el('span', 'en', suraName(s)));
      var when = new Date(bm.t);
      names.appendChild(el('span', 'sub', 'Juz ' + D.pages[bm.p - 1][3] + ' · saved ' + when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })));
      b.appendChild(num);
      b.appendChild(names);
      b.appendChild(el('span', 'ar-glyph', String.fromCharCode(0xF100 + s - 1)));
      var del = el('button', 'icon-btn del');
      del.type = 'button';
      del.title = 'Remove bookmark';
      del.setAttribute('aria-label', 'Remove bookmark on page ' + bm.p);
      del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        bookmarks = bookmarks.filter(function (x) { return x.p !== bm.p; });
        writeStore();
        renderBookmarks();
        $all('.page[data-page="' + bm.p + '"]').forEach(function (pg) { pg.classList.remove('marked'); });
        updateChrome();
      });
      wrap.appendChild(b);
      wrap.appendChild(del);
      lb.appendChild(wrap);
    });
  }

  function setTab(name) {
    $all('.tab').forEach(function (t) {
      var on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    $all('.tabpanel').forEach(function (p) { p.hidden = p.id !== 'tab-' + name; });
    $('#search-wrap').hidden = name === 'bookmarks';
    if (name !== 'bookmarks') filterLists();
    var cur = $('#tab-' + name + ' .row.is-current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  function filterLists() {
    var q = $('#search').value.trim().toLowerCase().replace(/[-'ʿʾ’]/g, '');
    $all('#list-surah .row').forEach(function (r) { r.hidden = !!q && r.dataset.search.indexOf(q) < 0; });
    $all('#list-juz .row').forEach(function (r) {
      r.hidden = !!q && ('juz ' + r.dataset.juz + ' ' + r.textContent.toLowerCase()).indexOf(q) < 0;
    });
  }

  /* ---------- Input ---------- */

  function bindUI() {
    $('#btn-index').addEventListener('click', function () { openPanel(drawer, '.tab[aria-selected="true"]'); setTab(currentTab); });
    $('#btn-settings').addEventListener('click', function () { openPanel(settingsPanel); });
    bookmarkBtn.addEventListener('click', toggleBookmark);
    $('#btn-full').addEventListener('click', toggleFullscreen);
    $('#btn-next').addEventListener('click', next);
    $('#btn-prev').addEventListener('click', prev);
    scrim.addEventListener('click', closePanels);
    $all('[data-close]').forEach(function (b) { b.addEventListener('click', closePanels); });

    $all('.tab').forEach(function (t) {
      t.addEventListener('click', function () { currentTab = t.dataset.tab; setTab(currentTab); });
      t.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        var tabs = $all('.tab');
        var i = tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1);
        var nt = tabs[(i + tabs.length) % tabs.length];
        currentTab = nt.dataset.tab;
        setTab(currentTab);
        nt.focus();
        e.stopPropagation();
      });
    });
    $('#search').addEventListener('input', filterLists);
    drawer.addEventListener('click', function (e) {
      var row = e.target.closest('.row');
      if (!row) return;
      closePanels();
      go(+row.dataset.page);
    });
    $('#goto').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('#goto-page').value;
      if (!v) return;
      closePanels();
      go(clampPage(v));
      $('#goto-page').value = '';
    });

    $all('[data-set]').forEach(function (b) {
      b.addEventListener('click', function () {
        settings[b.dataset.set] = b.dataset.value;
        applySettings();
        writeStore();
        if (b.dataset.set === 'view') layout();
      });
    });
    $all('[data-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        settings[b.dataset.toggle] = !settings[b.dataset.toggle];
        applySettings();
        writeStore();
      });
    });

    slider.addEventListener('input', function () {
      var v = +slider.value;
      sliderOut.textContent = v;
      bubble.textContent = suraName(pageSura[v]) + ' · ' + v;
      bubble.hidden = false;
      var pct = (v - 1) / (TOTAL - 1);
      bubble.style.setProperty('--pos', pct);
    });
    slider.addEventListener('change', function () {
      bubble.hidden = true;
      go(+slider.value);
    });
    slider.addEventListener('blur', function () { bubble.hidden = true; });

    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea';
      if (e.key === 'Escape') {
        if (panelOpen()) closePanels(); else clearAyah();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (panelOpen()) return;
      var k = e.key;
      if (tag === 'button' && (k === ' ' || k === 'Enter')) return;
      if (k === 'ArrowLeft' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) { e.preventDefault(); next(); }
      else if (k === 'ArrowRight' || k === 'PageUp' || (k === ' ' && e.shiftKey)) { e.preventDefault(); prev(); }
      else if (k === 'Home') { e.preventDefault(); go(1); }
      else if (k === 'End') { e.preventDefault(); go(TOTAL); }
      else if (k === 'b' || k === 'B') toggleBookmark();
      else if (k === 'i' || k === 'I') { openPanel(drawer, '.tab[aria-selected="true"]'); setTab(currentTab); }
      else if (k === 'g' || k === 'G') { e.preventDefault(); openPanel(drawer, '#goto-page'); setTab(currentTab); }
      else if (k === 'f' || k === 'F') toggleFullscreen();
      else if (k === 't' || k === 'T') {
        settings.theme = THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length];
        applySettings();
        writeStore();
      }
    });

    var stage = $('#stage');
    var down = null, pressTimer = null, longPressed = false;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      down = { x: e.clientX, y: e.clientY, t: Date.now(), type: e.pointerType, target: e.target };
      longPressed = false;
      if (e.pointerType !== 'mouse') {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(function () {
          var w = down && down.target.closest && down.target.closest('[data-v]');
          if (w) { longPressed = true; selectAyah(w.dataset.v); }
        }, 480);
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) clearTimeout(pressTimer);
      if (e.pointerType === 'mouse') hoverZone(e);
    });
    stage.addEventListener('pointerleave', function () { book.dataset.hover = ''; });
    stage.addEventListener('pointercancel', function () { clearTimeout(pressTimer); down = null; });
    stage.addEventListener('pointerup', function (e) {
      clearTimeout(pressTimer);
      if (!down || longPressed) { down = null; return; }
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      var d = down;
      down = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        // Right-to-left book: drag the page from left to right to move forward.
        if (dx > 0) next(); else prev();
        return;
      }
      if (Math.hypot(dx, dy) > 12 || Date.now() - d.t > 700) return;
      var zone = zoneAt(e.clientX, e.clientY, d.type);
      if (zone === 'next') next();
      else if (zone === 'prev') prev();
      else if (d.type === 'mouse') {
        var w = d.target.closest && d.target.closest('[data-v]');
        if (w) selectAyah(w.dataset.v); else clearAyah();
      } else {
        document.body.classList.toggle('idle');
      }
    });

    var wheelAcc = 0, wheelLock = 0;
    stage.addEventListener('wheel', function (e) {
      if (e.ctrlKey) return; // pinch-zoom on a trackpad
      e.preventDefault();
      var now = Date.now();
      if (now < wheelLock) return;
      var dominant = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? -e.deltaX : e.deltaY;
      wheelAcc += dominant;
      if (Math.abs(wheelAcc) > 90) {
        if (wheelAcc > 0) next(); else prev();
        wheelAcc = 0;
        wheelLock = now + 650;
      }
    }, { passive: false });

    document.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') wake(); });
    document.addEventListener('focusin', function (e) { if (e.target.closest && e.target.closest('.bar')) wake(); });
    window.addEventListener('resize', debounce(layout, 120));
    window.addEventListener('hashchange', function () {
      var h = hashPage();
      if (h && h !== current) go(h);
    });
  }

  var currentTab = 'surah';

  function zoneAt(x, y, type) {
    var r = book.getBoundingClientRect();
    if (type !== 'mouse') {
      var w = window.innerWidth;
      if (x < w * 0.24) return 'next';
      if (x > w * 0.76) return 'prev';
      return '';
    }
    if (y < r.top - 40 || y > r.bottom + 40) return '';
    // The outer margin up to the frame, and the cloth beside the book, turn the page;
    // the text itself stays free for selecting an ayah.
    var g = GEOMS[geomKey];
    var edge = (g.mx + g.band * 0.6) / 100 * parseFloat(book.style.getPropertyValue('--f'));
    if (x < r.left + edge) return 'next';
    if (x > r.right - edge) return 'prev';
    return '';
  }

  function hoverZone(e) {
    var z = zoneAt(e.clientX, e.clientY, 'mouse');
    if (z === 'next' && current >= TOTAL - (mode === 'spread' ? 1 : 0)) z = '';
    if (z === 'prev' && current <= (mode === 'spread' ? 2 : 1)) z = '';
    book.dataset.hover = z;
  }

  var idleTimer;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      var focusInBar = document.activeElement && document.activeElement.closest && document.activeElement.closest('.bar');
      if (!panelOpen() && !focusInBar && !document.querySelector('.bar:hover') && !bubble.offsetParent) document.body.classList.add('idle');
    }, 3200);
  }

  function toggleFullscreen() {
    var d = document;
    try {
      if (d.fullscreenElement) d.exitFullscreen();
      else if (d.documentElement.requestFullscreen) {
        d.documentElement.requestFullscreen().catch(function () { toast('Full screen is not available here'); });
      } else toast('Full screen is not available here');
    } catch (e) { toast('Full screen is not available here'); }
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ---------- Boot ---------- */

  window.MushafOrnaments.build(GEOMS);
  buildLists();
  renderBookmarks();
  applySettings();
  bindUI();
  loadFont('QCF4_QBSML').then(function () { document.documentElement.classList.add('qbsml-ready'); }, function () {});
  layout();
  updateChrome();
  prefetch(current);
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches) wake();
  try { history.replaceState(null, '', '#' + current); } catch (e) { /* ignore */ }

  // Exposed for debugging and automated checks.
  window.mushaf = { go: go, next: next, prev: prev, get page() { return current; } };
})();
