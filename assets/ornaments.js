/* Mushaf ornaments: the page frame, surah banners, the opening-page medallion,
   folio cartouche and margin medallions. Everything is drawn once into a hidden
   <svg> as <symbol>s and then placed on each page with <use>, so a theme change
   only swaps CSS colours. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function f(n) { return Math.round(n * 100) / 100; }

  function rectPath(x0, y0, x1, y1) {
    return 'M' + f(x0) + ' ' + f(y0) + 'H' + f(x1) + 'V' + f(y1) + 'H' + f(x0) + 'Z';
  }

  function circlePath(cx, cy, r) {
    return 'M' + f(cx - r) + ' ' + f(cy) +
      'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0' +
      'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0Z';
  }

  // A cartouche with ogee (pointed, curved) ends, centred on cx,cy.
  function cartouchePath(cx, cy, hw, hh) {
    var t = hh * 1.25;
    return 'M' + f(cx - hw) + ' ' + f(cy) +
      'C' + f(cx - hw + t * 0.35) + ' ' + f(cy - hh * 0.15) + ' ' + f(cx - hw + t * 0.45) + ' ' + f(cy - hh) + ' ' + f(cx - hw + t) + ' ' + f(cy - hh) +
      'H' + f(cx + hw - t) +
      'C' + f(cx + hw - t * 0.45) + ' ' + f(cy - hh) + ' ' + f(cx + hw - t * 0.35) + ' ' + f(cy - hh * 0.15) + ' ' + f(cx + hw) + ' ' + f(cy) +
      'C' + f(cx + hw - t * 0.35) + ' ' + f(cy + hh * 0.15) + ' ' + f(cx + hw - t * 0.45) + ' ' + f(cy + hh) + ' ' + f(cx + hw - t) + ' ' + f(cy + hh) +
      'H' + f(cx - hw + t) +
      'C' + f(cx - hw + t * 0.45) + ' ' + f(cy + hh) + ' ' + f(cx - hw + t * 0.35) + ' ' + f(cy + hh * 0.15) + ' ' + f(cx - hw) + ' ' + f(cy) + 'Z';
  }

  function use(id, cx, cy, size, rot) {
    var s = '<use href="#' + id + '" x="' + f(cx - size / 2) + '" y="' + f(cy - size / 2) +
      '" width="' + f(size) + '" height="' + f(size) + '"/>';
    return rot ? '<g transform="rotate(' + rot + ' ' + f(cx) + ' ' + f(cy) + ')">' + s + '</g>' : s;
  }

  function petals(n, path, cls, offset) {
    var out = '';
    for (var i = 0; i < n; i++) {
      var c = typeof cls === 'function' ? cls(i) : cls;
      out += '<path class="' + c + '" d="' + path + '" transform="rotate(' + f((360 / n) * i + (offset || 0)) + ')"/>';
    }
    return out;
  }

  // Motifs drawn in a -50..50 box.
  var MOTIFS =
    '<symbol id="m-flower" viewBox="-50 -50 100 100" overflow="visible">' +
      petals(4, 'M0 0C6-9 18-20 34-34C20-18 9-6 0 0Z', 'o-leaf', 45) +
      petals(5, 'M0-4C7-10 10-24 0-33C-10-24-7-10 0-4Z', 'o-petal') +
      '<circle class="o-eye" r="7.5"/><circle class="o-pip" r="3"/>' +
    '</symbol>' +
    '<symbol id="m-bud" viewBox="-50 -50 100 100" overflow="visible">' +
      '<path class="o-leaf" d="M-46 0C-34-15-14-15-4 0C-14 15-34 15-46 0Z"/>' +
      '<path class="o-leaf" d="M46 0C34-15 14-15 4 0C14 15 34 15 46 0Z"/>' +
      '<path class="o-vein" d="M-40 0H40"/>' +
      '<circle class="o-petal" r="8"/><circle class="o-eye" r="3"/>' +
    '</symbol>' +
    '<symbol id="m-rosette" viewBox="-50 -50 100 100" overflow="visible">' +
      petals(8, 'M0-6C8-14 9-30 0-42C-9-30-8-14 0-6Z', function (i) { return i % 2 ? 'o-leaf' : 'o-petal'; }) +
      '<circle class="o-eye" r="9"/><circle class="o-pip" r="4"/>' +
    '</symbol>' +
    '<symbol id="m-star" viewBox="-50 -50 100 100" overflow="visible">' +
      '<rect class="o-starfill" x="-33" y="-33" width="66" height="66"/>' +
      '<rect class="o-starfill" x="-33" y="-33" width="66" height="66" transform="rotate(45)"/>' +
      '<circle class="o-starin" r="27"/>' +
    '</symbol>';

  var PATTERNS =
    // Interlaced waves forming lenses: the strapwork inside surah banners.
    '<pattern id="p-strap" width="56" height="56" patternUnits="userSpaceOnUse">' +
      '<path class="o-strap" d="M0 28C14 4 14 4 28 28S42 52 56 28"/>' +
      '<path class="o-strap" d="M0 28C14 52 14 52 28 28S42 4 56 28"/>' +
      '<path class="o-strap" d="M28 0C4 14 4 14 28 28S52 42 28 56"/>' +
      '<path class="o-strap" d="M28 0C52 14 52 14 28 28S4 42 28 56"/>' +
      '<circle class="o-strapdot" cx="28" cy="28" r="4"/>' +
      '<circle class="o-strapdot" cx="0" cy="0" r="3"/><circle class="o-strapdot" cx="56" cy="0" r="3"/>' +
      '<circle class="o-strapdot" cx="0" cy="56" r="3"/><circle class="o-strapdot" cx="56" cy="56" r="3"/>' +
    '</pattern>' +
    // Eight-pointed star lattice: the ground around the opening-page medallion.
    '<pattern id="p-girih" width="120" height="120" patternUnits="userSpaceOnUse">' +
      '<rect width="120" height="120" class="o-girihbg"/>' +
      '<g transform="translate(60 60)">' +
        '<path class="o-girih" d="M0-44L13-31H31V-13L44 0L31 13V31H13L0 44L-13 31H-31V13L-44 0L-31-13V-31H-13Z"/>' +
        '<path class="o-girih" d="M0-24L9-9L24 0L9 9L0 24L-9 9L-24 0L-9-9Z"/>' +
      '</g>' +
      '<path class="o-girih" d="M0 0L17 17M120 0L103 17M0 120L17 103M120 120L103 103M60 0V16M60 120V104M0 60H16M120 60H104"/>' +
    '</pattern>';

  function frameBody(g, idPrefix) {
    var x0 = g.mx, y0 = g.mt, x1 = g.pw - g.mx, y1 = g.ph - g.mb, b = g.band;
    var out = '';
    out += '<path class="f-rule" d="' + rectPath(x0 - 9, y0 - 9, x1 + 9, y1 + 9) + '"/>';
    out += '<path class="f-band" fill-rule="evenodd" d="' + rectPath(x0, y0, x1, y1) + rectPath(x0 + b, y0 + b, x1 - b, y1 - b) + '"/>';
    out += '<path class="f-edge" d="' + rectPath(x0, y0, x1, y1) + '"/>';
    out += '<path class="f-rule" d="' + rectPath(x0 + 6, y0 + 6, x1 - 6, y1 - 6) + '"/>';
    out += '<path class="f-rule" d="' + rectPath(x0 + b - 6, y0 + b - 6, x1 - b + 6, y1 - b + 6) + '"/>';
    out += '<path class="f-edge" d="' + rectPath(x0 + b, y0 + b, x1 - b, y1 - b) + '"/>';
    out += '<path class="f-rule" d="' + rectPath(x0 + b + 8, y0 + b + 8, x1 - b - 8, y1 - b - 8) + '"/>';

    var size = b * 0.86;
    function run(ax, ay, bx, by, vertical) {
      var len = Math.hypot(bx - ax, by - ay);
      var n = Math.max(2, Math.round(len / (b * 1.02)));
      if (n % 2 === 0) n += 1; // odd count: a flower sits at the centre of each side
      var step = len / n;
      var s = '';
      for (var i = 0; i < n; i++) {
        var t = (i + 0.5) * step / len;
        var cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
        s += use(i % 2 ? 'm-bud' : 'm-flower', cx, cy, size, vertical ? 90 : 0);
      }
      return s;
    }
    var hb = b / 2;
    out += run(x0 + b, y0 + hb, x1 - b, y0 + hb, false);
    out += run(x0 + b, y1 - hb, x1 - b, y1 - hb, false);
    out += run(x0 + hb, y0 + b, x0 + hb, y1 - b, true);
    out += run(x1 - hb, y0 + b, x1 - hb, y1 - b, true);

    [[x0, y0], [x1 - b, y0], [x0, y1 - b], [x1 - b, y1 - b]].forEach(function (c) {
      out += '<rect class="f-corner" x="' + f(c[0] + 3) + '" y="' + f(c[1] + 3) + '" width="' + f(b - 6) + '" height="' + f(b - 6) + '"/>';
      out += use('m-rosette', c[0] + hb, c[1] + hb, b * 0.92);
    });
    return out;
  }

  function openingBody(g) {
    var cx = g.pw / 2, cy = g.ty + g.th * 0.56;
    var R = g.openR, ring = 44;
    var ix0 = g.mx + g.band, iy0 = g.mt + g.band, ix1 = g.pw - g.mx - g.band, iy1 = g.ph - g.mb - g.band;
    var out = '';
    out += '<path class="op-ground" fill-rule="evenodd" d="' + rectPath(ix0 + 8, iy0 + 8, ix1 - 8, iy1 - 8) + circlePath(cx, cy, R + ring) + '"/>';
    out += '<path class="op-ring" fill-rule="evenodd" d="' + circlePath(cx, cy, R + ring) + circlePath(cx, cy, R) + '"/>';
    out += '<circle class="f-edge" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(R + ring) + '"/>';
    out += '<circle class="f-edge" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(R) + '"/>';
    out += '<circle class="f-rule" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(R - 10) + '"/>';
    var n = 36;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var px = cx + Math.cos(a) * (R + ring / 2), py = cy + Math.sin(a) * (R + ring / 2);
      out += use(i % 2 ? 'm-bud' : 'm-flower', px, py, ring * 0.9, f(a * 180 / Math.PI + 90));
    }
    // Title cartouche above the medallion, and a matching one below it.
    var tcY = g.ty + 250, bcY = cy + R + ring + (iy1 - (cy + R + ring)) / 2;
    [[tcY, 420, 92], [bcY, 250, 56]].forEach(function (c, k) {
      out += '<path class="b-fill" d="' + cartouchePath(cx, c[0], c[1] + 70, c[2] + 22) + '"/>';
      out += '<path class="b-cart" d="' + cartouchePath(cx, c[0], c[1], c[2]) + '"/>';
      out += '<path class="b-inner" d="' + cartouchePath(cx, c[0], c[1] - 12, c[2] - 11) + '"/>';
      var d = c[1] + 70 + 40;
      out += use('m-rosette', cx - d, c[0], c[2] * 1.2) + use('m-rosette', cx + d, c[0], c[2] * 1.2);
      if (k === 1) out += use('m-flower', cx, c[0], c[2] * 1.3);
    });
    return out;
  }

  function bannerSymbol(id, w) {
    var h = 150, cx = w / 2, cy = h / 2, hw = 300, hh = 52;
    var out = '<symbol id="' + id + '" viewBox="0 0 ' + f(w) + ' ' + h + '">';
    out += '<rect class="b-fill" x="2" y="4" width="' + f(w - 4) + '" height="' + (h - 8) + '"/>';
    out += '<rect class="b-strap" x="12" y="14" width="' + f(w - 24) + '" height="' + (h - 28) + '"/>';
    out += '<rect class="f-rule" x="12" y="14" width="' + f(w - 24) + '" height="' + (h - 28) + '"/>';
    out += '<path class="b-fill" d="' + cartouchePath(cx, cy, hw + 40, hh + 14) + '"/>';
    out += '<path class="b-cart" d="' + cartouchePath(cx, cy, hw, hh) + '"/>';
    out += '<path class="b-inner" d="' + cartouchePath(cx, cy, hw - 12, hh - 10) + '"/>';
    var side = (w / 2 - hw - 40) / 2 + hw + 40;
    [cx - side, cx + side].forEach(function (mx) {
      out += '<circle class="b-medal" cx="' + f(mx) + '" cy="' + cy + '" r="50"/>';
      out += '<circle class="f-rule" cx="' + f(mx) + '" cy="' + cy + '" r="42"/>';
      out += use('m-rosette', mx, cy, 82);
    });
    [34, w - 34].forEach(function (ex) { out += use('m-flower', ex, cy, 50); });
    out += '</symbol>';
    return out;
  }

  var SMALL =
    '<symbol id="folio" viewBox="0 0 300 120">' +
      '<path class="b-fill" d="' + cartouchePath(150, 60, 140, 40) + '"/>' +
      '<path class="b-cart" d="' + cartouchePath(150, 60, 112, 30) + '"/>' +
      '<path class="b-inner" d="' + cartouchePath(150, 60, 102, 23) + '"/>' +
    '</symbol>' +
    '<symbol id="medal" viewBox="-60 -60 120 120">' +
      '<g transform="scale(1.15)"><rect class="md-star" x="-33" y="-33" width="66" height="66"/>' +
      '<rect class="md-star" x="-33" y="-33" width="66" height="66" transform="rotate(45)"/></g>' +
      '<circle class="md-in" r="30"/>' +
    '</symbol>';

  function build(geoms) {
    var html = '<defs>' + MOTIFS + PATTERNS + SMALL;
    Object.keys(geoms).forEach(function (k) {
      var g = geoms[k];
      html += '<symbol id="frame-' + k + '" viewBox="0 0 ' + g.pw + ' ' + g.ph + '">' + frameBody(g) + '</symbol>';
      html += '<symbol id="frame-open-' + k + '" viewBox="0 0 ' + g.pw + ' ' + g.ph + '">' + frameBody(g) + openingBody(g) + '</symbol>';
      html += bannerSymbol('banner-' + k, g.bw);
    });
    html += '</defs>';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = html;
    document.body.prepend(svg);
  }

  window.MushafOrnaments = { build: build };
})();
