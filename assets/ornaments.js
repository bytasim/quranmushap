/* Mushaf ornaments. Each Mushaf style has its own kit, modelled on a printed
   copy: the border band, corner pieces, surah banner, cartouche shape and
   page-number cartouche. Everything is drawn into one hidden <svg> as
   symbols and patterns with fixed ids, so pages reference them with <use>
   and a style change only rebuilds the definitions. Colours come from CSS
   custom properties (see the ornament section of mushaf.css). */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var TW = 120, TH = 100; // band tile: 120 along the band, 100 across (outer edge at y = 0)

  function f(n) { return Math.round(n * 100) / 100; }
  function rectPath(x0, y0, x1, y1) {
    return 'M' + f(x0) + ' ' + f(y0) + 'H' + f(x1) + 'V' + f(y1) + 'H' + f(x0) + 'Z';
  }
  function circlePath(cx, cy, r) {
    return 'M' + f(cx - r) + ' ' + f(cy) + 'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0' +
      'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0Z';
  }
  function at(x, y, rot, s) {
    return 'translate(' + f(x) + ' ' + f(y) + ')' + (rot ? ' rotate(' + f(rot) + ')' : '') + (s && s !== 1 ? ' scale(' + f(s) + ')' : '');
  }
  function p(cls, d, sw, extra) {
    return '<path class="' + cls + '" d="' + d + '"' + (sw ? ' stroke-width="' + sw + '"' : '') + (extra || '') + '/>';
  }
  function c(cls, cx, cy, r, sw) {
    return '<circle class="' + cls + '" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '"' + (sw ? ' stroke-width="' + sw + '"' : '') + '/>';
  }

  /* ---------- Shapes ---------- */

  // Cartouche outlines centred on cx, cy with half width hw and half height hh.
  var CARTOUCHE = {
    // Pointed ogee ends (Madinah print).
    ogee: function (cx, cy, hw, hh) {
      var t = hh * 1.3;
      return 'M' + f(cx - hw) + ' ' + f(cy) +
        'C' + f(cx - hw + t * 0.3) + ' ' + f(cy - hh * 0.1) + ' ' + f(cx - hw + t * 0.42) + ' ' + f(cy - hh) + ' ' + f(cx - hw + t) + ' ' + f(cy - hh) +
        'H' + f(cx + hw - t) +
        'C' + f(cx + hw - t * 0.42) + ' ' + f(cy - hh) + ' ' + f(cx + hw - t * 0.3) + ' ' + f(cy - hh * 0.1) + ' ' + f(cx + hw) + ' ' + f(cy) +
        'C' + f(cx + hw - t * 0.3) + ' ' + f(cy + hh * 0.1) + ' ' + f(cx + hw - t * 0.42) + ' ' + f(cy + hh) + ' ' + f(cx + hw - t) + ' ' + f(cy + hh) +
        'H' + f(cx - hw + t) +
        'C' + f(cx - hw + t * 0.42) + ' ' + f(cy + hh) + ' ' + f(cx - hw + t * 0.3) + ' ' + f(cy + hh * 0.1) + ' ' + f(cx - hw) + ' ' + f(cy) + 'Z';
    },
    // Cusped ends: three lobes closing to a point (Ottoman-style blue print).
    lobed: function (cx, cy, hw, hh) {
      var e = hh * 1.2;
      // Right end, top to bottom, as quadratic segments [control, point].
      var x0 = cx + hw - e;
      var segs = [
        [[x0 + e * 0.62, cy - hh * 1.06], [x0 + e * 0.46, cy - hh * 0.44]],
        [[x0 + e * 0.98, cy - hh * 0.62], [cx + hw, cy]],
        [[x0 + e * 0.98, cy + hh * 0.62], [x0 + e * 0.46, cy + hh * 0.44]],
        [[x0 + e * 0.62, cy + hh * 1.06], [x0, cy + hh]]
      ];
      function mx(x) { return 2 * cx - x; }
      var d = 'M' + f(mx(x0)) + ' ' + f(cy - hh) + 'H' + f(x0);
      segs.forEach(function (sg) { d += 'Q' + f(sg[0][0]) + ' ' + f(sg[0][1]) + ' ' + f(sg[1][0]) + ' ' + f(sg[1][1]); });
      d += 'H' + f(mx(x0));
      // Left end, bottom to top: the right end mirrored and reversed.
      var pts = [[x0, cy - hh]].concat(segs.map(function (sg) { return sg[1]; }));
      for (var i = segs.length - 1; i >= 0; i--) {
        d += 'Q' + f(mx(segs[i][0][0])) + ' ' + f(segs[i][0][1]) + ' ' + f(mx(pts[i][0])) + ' ' + f(pts[i][1]);
      }
      return d + 'Z';
    },
    // Rounded ends (red and black print).
    round: function (cx, cy, hw, hh) {
      return 'M' + f(cx - hw + hh) + ' ' + f(cy - hh) + 'H' + f(cx + hw - hh) +
        'A' + f(hh) + ' ' + f(hh) + ' 0 0 1 ' + f(cx + hw - hh) + ' ' + f(cy + hh) +
        'H' + f(cx - hw + hh) + 'A' + f(hh) + ' ' + f(hh) + ' 0 0 1 ' + f(cx - hw + hh) + ' ' + f(cy - hh) + 'Z';
    }
  };

  function rosette(cx, cy, r, n, outerCls, innerCls, sw) {
    var out = '<g transform="' + at(cx, cy) + '">';
    var w = r * Math.sin(Math.PI / n) * 1.25;
    var outer = 'M0 ' + f(-r * 0.3) + 'C' + f(w) + ' ' + f(-r * 0.46) + ' ' + f(w * 0.8) + ' ' + f(-r * 0.86) + ' 0 ' + f(-r) +
      'C' + f(-w * 0.8) + ' ' + f(-r * 0.86) + ' ' + f(-w) + ' ' + f(-r * 0.46) + ' 0 ' + f(-r * 0.3) + 'Z';
    for (var i = 0; i < n; i++) out += p(outerCls, outer, sw, ' transform="rotate(' + f(360 / n * i) + ')"');
    var ri = r * 0.62, wi = ri * Math.sin(Math.PI / (n / 2)) * 1.1;
    var inner = 'M0 0C' + f(wi) + ' ' + f(-ri * 0.3) + ' ' + f(wi * 0.7) + ' ' + f(-ri * 0.85) + ' 0 ' + f(-ri) +
      'C' + f(-wi * 0.7) + ' ' + f(-ri * 0.85) + ' ' + f(-wi) + ' ' + f(-ri * 0.3) + ' 0 0Z';
    for (var j = 0; j < n / 2; j++) out += p(innerCls, inner, sw, ' transform="rotate(' + f(720 / n * j + 360 / n) + ')"');
    out += c('ke', 0, 0, r * 0.2) + c('kp', 0, 0, r * 0.08);
    return out + '</g>';
  }

  // Tulip bud pointing up from its base at the origin, 26 units tall.
  var TULIP =
    p('kl', 'M0 0C-5 1-10-2-12-7C-7-7-3-5 0 0Z', '1.2') +
    p('kl', 'M0 0C5 1 10-2 12-7C7-7 3-5 0 0Z', '1.2') +
    p('kf', 'M0-2C-9-4-10-14-6-19C-4-22-2-24 0-27C2-24 4-22 6-19C10-14 9-4 0-2Z', '1.3') +
    p('ki', 'M0-5C-3-10-3-17 0-22C3-17 3-10 0-5Z');

  // Half palmette, curling to the right from its base at the origin.
  var HALF_PALMETTE =
    'M0 0C2-12 10-22 24-26C34-29 44-25 48-17C40-21 32-20 27-15C33-15 38-11 39-5C33-9 26-9 21-5C25-3 27 1 26 5C20 0 10-2 0 0Z';

  function spiral(cx, cy, r, a0, quarters, cw) {
    var a = a0, rad = r, d = 'M' + f(cx + rad * Math.cos(a)) + ' ' + f(cy + rad * Math.sin(a));
    for (var i = 0; i < quarters; i++) {
      var a2 = a + (cw ? 1 : -1) * Math.PI / 2, rad2 = rad * 0.74;
      var rm = (rad + rad2) / 2;
      d += 'A' + f(rm) + ' ' + f(rm) + ' 0 0 ' + (cw ? 1 : 0) + ' ' + f(cx + rad2 * Math.cos(a2)) + ' ' + f(cy + rad2 * Math.sin(a2));
      a = a2;
      rad = rad2;
    }
    return d;
  }

  function star8(cx, cy, r, cls, sw) {
    var s = r * 0.72;
    return '<g transform="' + at(cx, cy) + '">' +
      '<rect class="' + cls + '" x="' + f(-s) + '" y="' + f(-s) + '" width="' + f(2 * s) + '" height="' + f(2 * s) + '"' + (sw ? ' stroke-width="' + sw + '"' : '') + '/>' +
      '<rect class="' + cls + '" x="' + f(-s) + '" y="' + f(-s) + '" width="' + f(2 * s) + '" height="' + f(2 * s) + '" transform="rotate(45)"' + (sw ? ' stroke-width="' + sw + '"' : '') + '/></g>';
  }

  // Draw a stroke twice: a dark outline, then the light line on top.
  function lined(d, wide, thin) {
    return p('ko', d, wide) + p('kv', d, thin);
  }

  /* ---------- Kits ---------- */

  var KITS = {
    /* Green floral print: a cream vine with pink tulips on a green band. */
    madinah: {
      cart: 'ogee',
      tile: function () {
        var vine = 'M0 50C18 16 42 16 60 50S102 84 120 50';
        return '<rect class="kg" width="120" height="100"/>' +
          lined('M44 34C46 20 56 12 66 15' + spiral(68, 25, 9, -1.8, 5, true).replace('M', 'L'), 5.2, 2.4) +
          lined('M76 66C74 80 64 88 54 85' + spiral(52, 75, 9, 1.34, 5, true).replace('M', 'L'), 5.2, 2.4) +
          lined(vine, 8, 4) +
          p('kl', 'M8 40C12 30 20 28 24 30C20 36 14 40 8 40Z', '1.2') +
          p('kl', 'M112 60C108 70 100 72 96 70C100 64 106 60 112 60Z', '1.2') +
          '<g transform="' + at(30, 30, 0, 1.12) + '">' + TULIP + '</g>' +
          '<g transform="' + at(90, 70, 180, 1.12) + '">' + TULIP + '</g>';
      },
      corner: function (s) {
        return rosette(s / 2, s / 2, s * 0.38, 12, 'kf', 'kw', '1.3');
      },
      cornerGround: 'kg',
      panel: function (px, cy, h) {
        return '<circle class="kgo" cx="' + f(px) + '" cy="' + f(cy) + '" r="' + f(h * 0.4) + '" stroke-width="3"/>' +
          c('kvo', px, cy, h * 0.355, 2) +
          rosette(px, cy, h * 0.33, 12, 'kw', 'kf', '1.4');
      },
      tipDot: true
    },

    /* Blue print: a white interlaced chain on a blue band, palmette banner ends. */
    azure: {
      cart: 'lobed',
      tabs: true,
      tile: function () {
        function ring(cx) {
          var d = 'M' + (cx - 74) + ' 50A74 31 0 1 0 ' + (cx + 74) + ' 50A74 31 0 1 0 ' + (cx - 74) + ' 50Z';
          return lined(d, 6.4, 2.8);
        }
        return '<rect class="kg" width="120" height="100"/>' +
          ring(-60) + ring(180) + ring(60) +
          '<g transform="' + at(60, 50) + '">' +
            p('kw', 'M0-15C6-15 8-6 0 0C8-6 15-6 15 0C15 6 6 8 0 0C6 8 6 15 0 15C-6 15-8 6 0 0C-8 6-15 6-15 0C-15-6-6-8 0 0C-6-8-6-15 0-15Z', '1.4') +
            c('ke', 0, 0, 3.2) +
          '</g>' +
          c('kw', 0, 50, 5, '1.2') + c('kw', 120, 50, 5, '1.2') +
          p('kw', 'M60 4L64 10L60 16L56 10Z', '1') + p('kw', 'M60 84L64 90L60 96L56 90Z', '1');
      },
      corner: function (s) {
        var h = s / 2;
        return star8(h, h, s * 0.4, 'kvline', 2.6) + c('kw', h, h, s * 0.15, '1.4') + c('ke', h, h, s * 0.05);
      },
      cornerGround: 'kg',
      panel: function (px, cy, h, dir) {
        // A fan palmette facing the title, held by two split-leaf scrolls.
        var s = h / 82;
        var fan = 'M-36 0C-32-18-18-32 0-33C9-34 15-29 13-23C23-27 31-21 27-13C35-13 41-7 39 0C41 7 35 13 27 13C31 21 23 27 13 23C15 29 9 34 0 33C-18 32-32 18-36 0Z';
        var inner = 'M-24 0C-21-11-11-20 0-20C6-20 9-16 8-12C14-14 19-10 17-5C21-4 23-2 23 0C23 2 21 4 17 5C19 10 14 14 8 12C9 16 6 20 0 20C-11 20-21 11-24 0Z';
        var scroll = 'M-30-4C-46-16-48-36-30-42C-18-46-8-38-12-28C-15-21-24-22-24-28';
        return '<g transform="' + at(px, cy, dir > 0 ? 0 : 180, s) + '">' +
          lined(scroll, 6, 2.6) + '<g transform="scale(1 -1)">' + lined(scroll, 6, 2.6) + '</g>' +
          p('kv', fan, '7') + p('kw', fan, '1.8') +
          p('kpale', inner, '1.4') +
          p('ko', 'M-18 0H16M-18 0L12-11M-18 0L12 11M-18 0L4-17M-18 0L4 17', '1.3') +
          c('kw', -18, 0, 4.2, '1.4') +
          '</g>';
      }
    },

    /* Red and black print: a dark scrolling stem with red half palmettes. */
    rose: {
      cart: 'round',
      tabs: true,
      info: true,
      tile: function () {
        var vine = 'M0 50C18 18 42 18 60 50S102 82 120 50';
        return '<rect class="kg" width="120" height="100"/>' +
          p('kstem', vine, '4.2') +
          p('kf', HALF_PALMETTE, '1.5', ' transform="translate(31 26) scale(.9)"') +
          p('kf', HALF_PALMETTE, '1.5', ' transform="translate(91 74) scale(.9 -.9)"') +
          p('kstem', 'M12 38C6 30 8 20 16 18', '2.4') + c('kdot', 16, 18, 3) +
          p('kstem', 'M72 62C66 70 68 80 76 82', '2.4') + c('kdot', 76, 82, 3) +
          c('kdot', 60, 50, 3.4);
      },
      corner: function (s) {
        return rosette(s / 2, s / 2, s * 0.42, 8, 'kf', 'kw', '1.4');
      },
      cornerGround: 'kdark',
      panel: function (px, cy, h) {
        return c('kgo', px, cy, h * 0.36, '2.4') + c('kvo', px, cy, h * 0.3, '1.6') + rosette(px, cy, h * 0.27, 8, 'kf', 'kw', '1.2');
      }
    },

    /* Night: gold strapwork stars on charcoal, like an illuminated copy. */
    night: {
      cart: 'ogee',
      info: true,
      tile: function () {
        return '<rect class="kg" width="120" height="100"/>' +
          p('kvline', 'M0 50H38M82 50H120', '2.2') +
          p('kvline', 'M0 20L20 50L0 80M120 20L100 50L120 80', '1.4') +
          star8(60, 50, 30, 'kstarfill', 2.2) +
          c('kvo', 60, 50, 12, 1.6) + c('kw', 60, 50, 4) +
          c('kw', 0, 50, 4) + c('kw', 120, 50, 4) +
          c('kw', 60, 8, 2.6) + c('kw', 60, 92, 2.6);
      },
      corner: function (s) {
        var h = s / 2;
        return star8(h, h, s * 0.42, 'kstarfill', 2.2) + rosette(h, h, s * 0.26, 8, 'kf', 'kw', '1');
      },
      cornerGround: 'kg',
      panel: function (px, cy, h) {
        return star8(px, cy, h * 0.42, 'kstarfill', 2.4) + star8(px, cy, h * 0.28, 'kvline', 1.6) + c('kw', px, cy, h * 0.06);
      }
    }
  };

  /* ---------- Frame ---------- */

  function bandPatterns(g, prefix, kit) {
    var x0 = g.mx, y0 = g.mt, x1 = g.pw - g.mx, y1 = g.ph - g.mb, b = g.band;
    var inset = 5, t = b - 2 * inset;
    var lh = x1 - x0 - 2 * b, lv = y1 - y0 - 2 * b;
    var nh = Math.max(3, Math.round(lh / (t * 1.2))), nv = Math.max(3, Math.round(lv / (t * 1.2)));
    var sh = lh / nh, sv = lv / nv;
    var tile = kit.tile();
    function pat(id, len, m) {
      return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="' + f(len) + '" height="' + f(t) + '" patternTransform="' + m + '">' +
        '<g transform="scale(' + f(len / TW) + ' ' + f(t / TH) + ')">' + tile + '</g></pattern>';
    }
    return {
      defs:
        pat(prefix + 'top', sh, 'matrix(1 0 0 1 ' + f(x0 + b) + ' ' + f(y0 + inset) + ')') +
        pat(prefix + 'bottom', sh, 'matrix(-1 0 0 -1 ' + f(x1 - b) + ' ' + f(y1 - inset) + ')') +
        pat(prefix + 'left', sv, 'matrix(0 -1 1 0 ' + f(x0 + inset) + ' ' + f(y1 - b) + ')') +
        pat(prefix + 'right', sv, 'matrix(0 1 -1 0 ' + f(x1 - inset) + ' ' + f(y0 + b) + ')'),
      body:
        '<rect fill="url(#' + prefix + 'top)" x="' + f(x0 + b) + '" y="' + f(y0 + inset) + '" width="' + f(lh) + '" height="' + f(t) + '"/>' +
        '<rect fill="url(#' + prefix + 'bottom)" x="' + f(x0 + b) + '" y="' + f(y1 - inset - t) + '" width="' + f(lh) + '" height="' + f(t) + '"/>' +
        '<rect fill="url(#' + prefix + 'left)" x="' + f(x0 + inset) + '" y="' + f(y0 + b) + '" width="' + f(t) + '" height="' + f(lv) + '"/>' +
        '<rect fill="url(#' + prefix + 'right)" x="' + f(x1 - inset - t) + '" y="' + f(y0 + b) + '" width="' + f(t) + '" height="' + f(lv) + '"/>'
    };
  }

  function frame(g, k, kit) {
    var x0 = g.mx, y0 = g.mt, x1 = g.pw - g.mx, y1 = g.ph - g.mb, b = g.band;
    var bands = bandPatterns(g, 'band-' + k + '-', kit);
    var body = '';
    body += '<path class="kpaperfill" fill-rule="evenodd" d="' + rectPath(x0, y0, x1, y1) + rectPath(x0 + b, y0 + b, x1 - b, y1 - b) + '"/>';
    body += bands.body;
    body += p('kframe', rectPath(x0 + 5, y0 + 5, x1 - 5, y1 - 5), '1.6');
    body += p('kframe', rectPath(x0 + b - 5, y0 + b - 5, x1 - b + 5, y1 - b + 5), '1.6');
    body += p('kframe', rectPath(x0, y0, x1, y1), '3.6');
    body += p('kframe', rectPath(x0 + b, y0 + b, x1 - b, y1 - b), '3.6');
    body += p('kframe', rectPath(x0 + b + 9, y0 + b + 9, x1 - b - 9, y1 - b - 9), '1.2');
    body += p('kframe', rectPath(x0 - 10, y0 - 10, x1 + 10, y1 + 10), '1.2');
    [[x0, y0], [x1 - b, y0], [x0, y1 - b], [x1 - b, y1 - b]].forEach(function (q) {
      body += '<rect class="' + kit.cornerGround + '" x="' + f(q[0]) + '" y="' + f(q[1]) + '" width="' + f(b) + '" height="' + f(b) + '"/>';
      body += '<rect class="kframe" x="' + f(q[0]) + '" y="' + f(q[1]) + '" width="' + f(b) + '" height="' + f(b) + '" stroke-width="3.6"/>';
      body += '<rect class="kframe" x="' + f(q[0] + 6) + '" y="' + f(q[1] + 6) + '" width="' + f(b - 12) + '" height="' + f(b - 12) + '" stroke-width="1.2"/>';
      body += '<g transform="translate(' + f(q[0]) + ' ' + f(q[1]) + ')">' + kit.corner(b) + '</g>';
    });
    return { defs: bands.defs, body: body };
  }

  function opening(g, kit) {
    var cx = g.pw / 2, cy = g.ty + g.th * 0.56;
    var R = g.openR, ring = 46;
    var ix0 = g.mx + g.band, iy0 = g.mt + g.band, ix1 = g.pw - g.mx - g.band, iy1 = g.ph - g.mb - g.band;
    var cart = CARTOUCHE[kit.cart];
    var out = '';
    out += '<path class="op-ground" fill-rule="evenodd" d="' + rectPath(ix0 + 9, iy0 + 9, ix1 - 9, iy1 - 9) + circlePath(cx, cy, R + ring) + '"/>';
    out += '<path class="kg" fill-rule="evenodd" d="' + circlePath(cx, cy, R + ring) + circlePath(cx, cy, R) + '"/>';
    var n = 40;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      out += '<g transform="' + at(cx + Math.cos(a) * (R + ring / 2), cy + Math.sin(a) * (R + ring / 2), a * 180 / Math.PI + 90) + '">' +
        (i % 2 ? c('kw', 0, 0, 5, '1.2') : rosette(0, 0, ring * 0.36, 8, 'kw', 'kf', '1')) + '</g>';
    }
    out += p('kframe', circlePath(cx, cy, R + ring), '3.6') + p('kframe', circlePath(cx, cy, R), '3.6');
    out += p('kframe', circlePath(cx, cy, R + ring + 9), '1.2') + p('kframe', circlePath(cx, cy, R - 9), '1.2');
    var tcY = g.ty + 250, bcY = cy + R + ring + (iy1 - (cy + R + ring)) / 2;
    [[tcY, 420, 88], [bcY, 220, 50]].forEach(function (q, k) {
      out += p('kgo', rectPath(cx - q[1] - 150, q[0] - q[2] - 22, cx + q[1] + 150, q[0] + q[2] + 22), '3');
      out += p('kvo', rectPath(cx - q[1] - 140, q[0] - q[2] - 12, cx + q[1] + 140, q[0] + q[2] + 12), '1.6');
      out += p('kv', cart(cx, q[0], q[1] + 12, q[2] + 10), '9') + p('kc', cart(cx, q[0], q[1], q[2]), '2.6');
      var d = q[1] + 80;
      out += rosette(cx - d, q[0], q[2] * 0.75, 12, 'kw', 'kf', '1.2') + rosette(cx + d, q[0], q[2] * 0.75, 12, 'kw', 'kf', '1.2');
      if (k === 1) out += rosette(cx, q[0], q[2] * 0.7, 8, 'kf', 'kw', '1.2');
    });
    return out;
  }

  /* ---------- Banner ---------- */

  function banner(id, w, k, kit) {
    var h = 150, cx = w / 2, cy = h / 2, hw = 300, hh = 50;
    var cart = CARTOUCHE[kit.cart];
    var ins = 10, t = h - 2 * ins;
    var pid = 'bp-' + k + '-' + id;
    var pat = '<pattern id="' + pid + '" patternUnits="userSpaceOnUse" width="' + f(t * 1.2) + '" height="' + f(t) + '" patternTransform="translate(' + f(cx) + ' ' + ins + ')">' +
      '<g transform="scale(' + f(t * 1.2 / TW) + ' ' + f(t / TH) + ')">' + kit.tile() + '</g></pattern>';
    var out = '<symbol id="' + id + '" viewBox="0 0 ' + f(w) + ' ' + h + '">';
    out += '<rect class="kgo" x="2" y="2" width="' + f(w - 4) + '" height="' + (h - 4) + '" stroke-width="3.6"/>';
    out += '<rect fill="url(#' + pid + ')" x="' + ins + '" y="' + ins + '" width="' + f(w - 2 * ins) + '" height="' + t + '"/>';
    out += p('kframe', rectPath(ins, ins, w - ins, h - ins), '1.6');
    var panelEnd = cx - hw - 26;
    var px = (ins + panelEnd) / 2;
    out += kit.panel(px, cy, t, 1) + kit.panel(w - px, cy, t, -1);
    out += p('kv', cart(cx, cy, hw + 14, hh + 12), '10') + p('kc', cart(cx, cy, hw, hh), '2.8');
    out += p('kinner', cart(cx, cy, hw - 13, hh - 10), '1.4');
    if (kit.tipDot) out += c('kf', cx - hw - 20, cy, 7, '1.4') + c('kf', cx + hw + 20, cy, 7, '1.4');
    if (kit.info) {
      [cx - hw - 6, cx + hw + 6].forEach(function (mx) {
        out += c('kgo', mx, cy, 58, '3') + c('kvo', mx, cy, 51, '2') + c('kroundel', mx, cy, 45, '2.4');
      });
    }
    return { defs: pat, symbol: out + '</symbol>' };
  }

  /* ---------- Small pieces ---------- */

  function small(kit) {
    var cart = CARTOUCHE[kit.cart];
    return '<symbol id="folio" viewBox="0 0 300 120">' +
      p('kv', cart(150, 60, 132, 40), '8') + p('kc', cart(150, 60, 128, 36), '2.6') + p('kinner', cart(150, 60, 116, 28), '1.2') +
      '</symbol>' +
      '<symbol id="medal" viewBox="-60 -60 120 120">' +
      '<g transform="scale(1.15)">' + star8(0, 0, 46, 'md-star', 2.4) + '</g>' +
      c('md-in', 0, 0, 30, '1.6') +
      '</symbol>' +
      '<symbol id="m-star" viewBox="-50 -50 100 100" overflow="visible">' +
      star8(0, 0, 46, 'o-starfill', 3.2) +
      '</symbol>' +
      '<pattern id="p-girih" width="120" height="120" patternUnits="userSpaceOnUse">' +
      '<rect width="120" height="120" class="o-girihbg"/>' +
      '<g transform="translate(60 60)">' +
      p('o-girih', 'M0-44L13-31H31V-13L44 0L31 13V31H13L0 44L-13 31H-31V13L-44 0L-31-13V-31H-13Z') +
      p('o-girih', 'M0-24L9-9L24 0L9 9L0 24L-9 9L-24 0L-9-9Z') +
      '</g>' +
      p('o-girih', 'M0 0L17 17M120 0L103 17M0 120L17 103M120 120L103 103M60 0V16M60 120V104M0 60H16M120 60H104') +
      '</pattern>';
  }

  // A stretchable cartouche for running-header tabs, as a CSS border image.
  function tabImage(kit) {
    var cs = getComputedStyle(document.documentElement);
    function v(name) { return cs.getPropertyValue(name).trim() || '#000'; }
    var cart = CARTOUCHE[kit.cart];
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="64" viewBox="0 0 160 64">' +
      '<path d="' + cart(80, 32, 74, 25) + '" fill="' + v('--orn-cart') + '" stroke="' + v('--orn-line') + '" stroke-width="2.4"/>' +
      '<path d="' + cart(80, 32, 66, 19) + '" fill="none" stroke="' + v('--orn-accent') + '" stroke-width="1.2"/></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  var holder = null;

  function build(geoms, theme) {
    var k = KITS[theme] ? theme : 'madinah';
    var kit = KITS[k];
    var defs = '', symbols = small(kit);
    Object.keys(geoms).forEach(function (gk) {
      var g = geoms[gk];
      var fr = frame(g, gk, kit);
      defs += fr.defs;
      symbols += '<symbol id="frame-' + gk + '" viewBox="0 0 ' + g.pw + ' ' + g.ph + '">' + fr.body + '</symbol>';
      symbols += '<symbol id="frame-open-' + gk + '" viewBox="0 0 ' + g.pw + ' ' + g.ph + '">' + fr.body + opening(g, kit) + '</symbol>';
      var bn = banner('banner-' + gk, g.bw, gk, kit);
      defs += bn.defs;
      symbols += bn.symbol;
    });
    if (!holder) {
      holder = document.createElementNS(NS, 'svg');
      holder.setAttribute('aria-hidden', 'true');
      holder.setAttribute('width', '0');
      holder.setAttribute('height', '0');
      holder.style.position = 'absolute';
      document.body.prepend(holder);
    }
    holder.innerHTML = '<defs>' + defs + symbols + '</defs>';
    var root = document.documentElement;
    root.style.setProperty('--tab-img', kit.tabs ? tabImage(kit) : 'none');
    root.classList.toggle('kit-tabs', !!kit.tabs);
    root.classList.toggle('kit-info', !!kit.info);
  }

  window.MushafOrnaments = { build: build };
})();
