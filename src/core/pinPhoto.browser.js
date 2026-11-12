/*
 * Replaces green "placeholder" pins in a photo with another design, keeping the photo's own light, shadow and gloss.
 *
 * Plain JavaScript on purpose: it runs INSIDE a Chromium page (Playwright), loaded as a script by `pinPhoto.ts`
 * (a TypeScript function would be serialised with esbuild helpers that do not exist in the page). Exposes `window.__pinPhoto`.
 *
 * Ported from scripts/pin-photo-prototype.py. Pipeline:
 *   detect     key-green mask -> connected components -> filled row spans -> ellipse from moments
 *   replace    per pin: warp the face (upright, squashed to the ellipse), light it (ambient colour from the cloth, light direction,
 *              convex-glass lens, soft highlight, the photo's real glare, bevelled rim, blur, grain), composite with an analytic mask
 *              that is a little LARGER than the green area (`grow`) so the original rim and key spill are covered,
 *              unmix the green share from the remaining edge pixels, despill.
 */
(function () {
  "use strict";

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    return rnd() + rnd() - 1; // sum of two uniforms: close to gaussian, no extreme specks
  }
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

  /** Key green: relative to its own brightness, so neon (9,232,26) and muted (1,169,63) are found but a darker real green is not. */
  function isKey(r, g, b) {
    return g > 100 && r < 0.3 * g && g - (r > b ? r : b) > 0.58 * g;
  }

  /** @returns {{cx,cy,a,b,theta,area}[]} in reading order */
  function detect(img, minArea) {
    var w = img.width, h = img.height, d = img.data;
    minArea = minArea || 1200;
    var mask = new Uint8Array(w * h);
    for (var i = 0, p = 0; i < w * h; i++, p += 4) if (isKey(d[p], d[p + 1], d[p + 2])) mask[i] = 1;

    var seen = new Uint8Array(w * h);
    var stack = new Int32Array(w * h);
    var pins = [];
    var small = 0; // green discs too small to use (>= 200 px but under minArea)
    for (var start = 0; start < w * h; start++) {
      if (!mask[start] || seen[start]) continue;
      var sp = 0;
      stack[sp++] = start;
      seen[start] = 1;
      var rowLo = new Int32Array(h).fill(1 << 30);
      var rowHi = new Int32Array(h).fill(-1);
      var count = 0;
      while (sp) {
        var j = stack[--sp];
        var x = j % w, y = (j / w) | 0;
        count++;
        if (x < rowLo[y]) rowLo[y] = x;
        if (x > rowHi[y]) rowHi[y] = x;
        if (x + 1 < w && mask[j + 1] && !seen[j + 1]) { seen[j + 1] = 1; stack[sp++] = j + 1; }
        if (x > 0 && mask[j - 1] && !seen[j - 1]) { seen[j - 1] = 1; stack[sp++] = j - 1; }
        if (y + 1 < h && mask[j + w] && !seen[j + w]) { seen[j + w] = 1; stack[sp++] = j + w; }
        if (y > 0 && mask[j - w] && !seen[j - w]) { seen[j - w] = 1; stack[sp++] = j - w; }
      }
      if (count < minArea) { if (count >= 200) small++; continue; }
      // fill the gloss holes: every row from its first to its last key pixel
      var n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      for (var yy = 0; yy < h; yy++) {
        var lo = rowLo[yy], hi = rowHi[yy];
        if (hi < 0) continue;
        var c = hi - lo + 1;
        var sumX = ((lo + hi) * c) / 2;
        var sumX2 = (hi * (hi + 1) * (2 * hi + 1) - (lo - 1) * lo * (2 * lo - 1)) / 6;
        n += c; sx += sumX; sy += yy * c; sxx += sumX2; syy += yy * yy * c; sxy += yy * sumX;
      }
      var cx = sx / n, cy = sy / n;
      var vxx = sxx / n - cx * cx, vyy = syy / n - cy * cy, vxy = sxy / n - cx * cy;
      var theta = 0.5 * Math.atan2(2 * vxy, vxx - vyy);
      var tr = (vxx + vyy) / 2;
      var dd = Math.sqrt(Math.max(0, ((vxx - vyy) / 2) * ((vxx - vyy) / 2) + vxy * vxy));
      var l1 = tr + dd, l2 = Math.max(tr - dd, 1e-6);
      var a = 2 * Math.sqrt(l1), b = 2 * Math.sqrt(l2);
      // near-circle: the axis ratio is detection noise, do not shear the design
      if (a / b < 1.08) { a = b = (a + b) / 2; theta = 0; }
      pins.push({ cx: cx, cy: cy, a: a, b: b, theta: theta, area: n });
    }
    pins.small = small;
    pins.sort(function (p, q) {
      var rp = Math.round(p.cy / 80), rq = Math.round(q.cy / 80);
      return rp !== rq ? rp - rq : p.cx - q.cx;
    });
    return pins;
  }


  /**
   * Measures the pin's own rim from the OUTSIDE, to choose `grow` and `shift` automatically.
   * Along 72 rays it finds where the key green ends and then the outermost strong colour step after it (rim metal -> cloth).
   * Rays that never reach a clear edge (the rim merges into the cast shadow) are skipped. A circle is fitted, in the pin's own
   * normalised ellipse frame, to the remaining edge points with outlier rejection; its radius is `grow` and its centre is `shift`.
   * @returns {{grow, shift:[number,number], n:number, rmse:number}|null} null when fewer than 16 consistent points were found
   */
  function measureRim(img, pin, rimless) {
    var w = img.width, h = img.height, d = img.data;
    var c = Math.cos(pin.theta), s = Math.sin(pin.theta);
    var Rg = (pin.a + pin.b) / 2;
    function at(x, y, o) {
      var xi = clamp(Math.round(x), 0, w - 1), yi = clamp(Math.round(y), 0, h - 1), p = (yi * w + xi) * 4;
      o[0] = d[p]; o[1] = d[p + 1]; o[2] = d[p + 2];
    }
    var A = [0, 0, 0], B = [0, 0, 0], pts = [], flat = 0;
    // Edge strength needed to count as the rim's outer edge. A pin with a faint rim (thin metal, bright cloth) never reaches 90, so the fit
    // falls back to a weaker threshold when too few rays found an edge (seen on one neon pin: no rim, only the cast shadow).
    for (var thr = 90; thr >= 50 && pts.length < 16; thr -= 20) {
    pts = []; flat = 0;
    for (var k = 0; k < 72; k++) {
      var phi = (k * 5 * Math.PI) / 180, psi = phi - pin.theta;
      var re = (pin.a * pin.b) / Math.sqrt(Math.pow(pin.b * Math.cos(psi), 2) + Math.pow(pin.a * Math.sin(psi), 2)); // green radius on this ray
      var dx = Math.cos(phi), dy = Math.sin(phi);
      var keyEnd = -1;
      for (var t = re * 0.8; t <= re * 1.2; t += 0.5) {
        at(pin.cx + dx * t, pin.cy + dy * t, A);
        if (isKey(A[0], A[1], A[2])) keyEnd = t;
      }
      if (keyEnd < re * 0.85) continue;
      var win = re * 0.2, prev = 0, prev2 = 0, peakT = -1;
      for (var u = keyEnd + 0.5; !rimless && u <= keyEnd + win; u += 0.5) {
        at(pin.cx + dx * (u - 1.0), pin.cy + dy * (u - 1.0), A);
        at(pin.cx + dx * (u + 1.0), pin.cy + dy * (u + 1.0), B);
        var g = Math.abs(B[0] - A[0]) + Math.abs(B[1] - A[1]) + Math.abs(B[2] - A[2]);
        if (prev > prev2 && prev >= g && prev > thr) peakT = u - 0.5; // local maximum of the colour step: an edge; the LAST one is the outermost
        prev2 = prev; prev = g;
      }
      if (peakT < 0) {
        // no edge after the green: either a rim that merges into the shadow (skip the ray), or NO rim at all, where the green disc ends straight
        // in cloth (the strong step sits right at keyEnd, so it is never a local maximum). Then the green edge itself is the edge.
        at(pin.cx + dx * (keyEnd - 1.0), pin.cy + dy * (keyEnd - 1.0), A);
        at(pin.cx + dx * (keyEnd + 2.0), pin.cy + dy * (keyEnd + 2.0), B);
        if (Math.abs(B[0] - A[0]) + Math.abs(B[1] - A[1]) + Math.abs(B[2] - A[2]) <= 150) continue;
        peakT = keyEnd; flat++;
      }
      var px = pin.cx + dx * peakT, py = pin.cy + dy * peakT;
      pts.push([((px - pin.cx) * c + (py - pin.cy) * s) / pin.a, (-(px - pin.cx) * s + (py - pin.cy) * c) / pin.b]);
    }
    }
    // least-squares circle (Kasa) with iterative outlier rejection
    var cu = 0, cv = 0, rad = 1;
    for (var iter = 0; iter < 4 && pts.length >= 16; iter++) {
      var n = pts.length, Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, Sxz = 0, Syz = 0, Sz = 0;
      for (var i = 0; i < n; i++) {
        var x = pts[i][0], y = pts[i][1], z = x * x + y * y;
        Sx += x; Sy += y; Sxx += x * x; Syy += y * y; Sxy += x * y; Sxz += x * z; Syz += y * z; Sz += z;
      }
      // solve [Sxx Sxy Sx; Sxy Syy Sy; Sx Sy n] * [D E F] = -[Sxz Syz Sz]
      var M = [[Sxx, Sxy, Sx, -Sxz], [Sxy, Syy, Sy, -Syz], [Sx, Sy, n, -Sz]];
      for (var col = 0; col < 3; col++) {
        var piv = col;
        for (var r2 = col + 1; r2 < 3; r2++) if (Math.abs(M[r2][col]) > Math.abs(M[piv][col])) piv = r2;
        var tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
        if (Math.abs(M[col][col]) < 1e-12) return null;
        for (var r3 = col + 1; r3 < 3; r3++) {
          var f = M[r3][col] / M[col][col];
          for (var cc = col; cc < 4; cc++) M[r3][cc] -= f * M[col][cc];
        }
      }
      var F = M[2][3] / M[2][2], E = (M[1][3] - M[1][2] * F) / M[1][1], D = (M[0][3] - M[0][1] * E - M[0][2] * F) / M[0][0];
      cu = -D / 2; cv = -E / 2; rad = Math.sqrt(Math.max(0, cu * cu + cv * cv - F));
      var kept = pts.filter(function (p) { return Math.abs(Math.hypot(p[0] - cu, p[1] - cv) - rad) <= 0.03; });
      if (kept.length === pts.length) break;
      pts = kept;
    }
    if (pts.length < 16) return rimless ? null : measureRim(img, pin, true); // maybe a pin with no rim at all: cloth texture then fakes edges further out
    var sq = 0;
    pts.forEach(function (p) { var e = Math.hypot(p[0] - cu, p[1] - cv) - rad; sq += e * e; });
    // The edge found is the steepest colour step, i.e. the MIDDLE of the rim's outer edge. Calibrated against hand-picked values on four photos:
    // measured+0.012 left ghost rims and key spill (about 0.02 short), +0.03 covers them.
    // rimless pin: its edge is the key green's own edge, which carries the key spill (a ring of green-tinted pixels), so cover a bit more
    var grow = rad + (rimless || flat > pts.length / 2 ? 0.06 : 0.03);
    if (!(grow >= 1.0 && grow <= 1.3)) return null; // not a rim around this pin
    var sx = (cu * pin.a * c - cv * pin.b * s) / Rg, sy = (cu * pin.a * s + cv * pin.b * c) / Rg;
    // A large shift means the fit followed the cast shadow, not the rim (seen on a neon-green photo: the disc slid into the shadow and drew a white halo).
    // Real rims were off-centre by at most ~0.045 of the radius; keep the direction, cap the size.
    var smag = Math.hypot(sx, sy), SMAX = 0.045;
    if (smag > SMAX) { sx *= SMAX / smag; sy *= SMAX / smag; }
    return { grow: grow, shift: [sx, sy], n: pts.length, rmse: Math.sqrt(sq / pts.length) };
  }


  /**
   * Brightness of the photo just OUTSIDE the green disc, per direction (72 bins, median, then smoothed): the bevel ring the new, larger disc
   * draws there. Per-pixel brightness would copy the cloth texture and the shadow's noise into the ring (it looks furry); per direction it
   * still follows the light: bright where the cloth is lit, dim where the pin's cast shadow lies.
   */
  function bloomByAngle(img, pin, p0, outer) {
    var w = img.width, h = img.height, d = img.data, N = 72, bins = [];
    for (var k = 0; k < N; k++) {
      var phi = ((k + 0.5) * 2 * Math.PI) / N, psi = phi - pin.theta;
      var re = (pin.a * pin.b) / Math.sqrt(Math.pow(pin.b * Math.cos(psi), 2) + Math.pow(pin.a * Math.sin(psi), 2));
      var vals = [];
      for (var f = 1.0; f <= outer; f += (outer - 1.0) / 6 || 1) {
        var x = Math.round(pin.cx + Math.cos(phi) * re * f), y = Math.round(pin.cy + Math.sin(phi) * re * f);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        var q = (y * w + x) * 4;
        vals.push(clamp((Math.min(d[q], d[q + 2]) - p0) / Math.max(1, 255 - p0), 0, 1));
      }
      vals.sort(function (a, b) { return a - b; });
      bins.push(vals.length ? vals[(vals.length / 2) | 0] : 0);
    }
    var sm = [];
    for (var i = 0; i < N; i++) sm.push((bins[(i + N - 1) % N] + 2 * bins[i] + bins[(i + 1) % N]) / 4);
    return sm;
  }
  /**
   * Direction TOWARD the light, as a unit vector in image coordinates (+x right, +y down), from the per-direction ring brightness:
   * the ring is brightest on the lit side and dimmest where the pin's cast shadow lies. Falls back to the upper left when the ring
   * is nearly uniform (flat light: the direction does not matter then, and the old default looked right on every sample photo).
   */
  function lightFromBloom(bins) {
    var N = bins.length, sx = 0, sy = 0, tot = 0, mean = 0, i;
    for (i = 0; i < N; i++) mean += bins[i];
    mean /= N;
    for (i = 0; i < N; i++) {
      var phi = ((i + 0.5) * 2 * Math.PI) / N, v = bins[i] - mean;
      sx += v * Math.cos(phi); sy += v * Math.sin(phi); tot += Math.abs(v);
    }
    var mag = Math.hypot(sx, sy);
    if (!(tot > 0.02) || mag / tot < 0.25) return [-0.62, -0.78];
    return [sx / mag, sy / mag];
  }
  /** Baseline of min(R,B) inside the green disc (the key colour's own value), used to isolate glare and the bevel ring. */
  function keyBaseline(img, pin) {
    var w = img.width, d = img.data, out = [];
    var x0 = Math.trunc(pin.cx - pin.a), x1 = Math.trunc(pin.cx + pin.a), y0 = Math.trunc(pin.cy - pin.a), y1 = Math.trunc(pin.cy + pin.a);
    for (var y = y0; y < y1; y += 3) for (var x = x0; x < x1; x += 3) {
      if (x < 0 || y < 0 || x >= w || y >= img.height || ellipseRe(x, y, pin, 0.9) > 1) continue;
      var q = (y * w + x) * 4; out.push(Math.min(d[q], d[q + 2]));
    }
    out.sort(function (a, b) { return a - b; });
    return out.length ? out[(out.length / 2) | 0] : 0;
  }
  /** One light direction for the whole photo (one light source): the mean of the per-pin directions, weighted by their contrast. */
  function measureLight(img, pins) {
    var sx = 0, sy = 0, n = 0;
    pins.forEach(function (pin) {
      var bins = bloomByAngle(img, pin, keyBaseline(img, pin), 1.15);
      var l = lightFromBloom(bins), mean = 0, i;
      for (i = 0; i < bins.length; i++) mean += bins[i];
      mean /= bins.length;
      var contrast = 0;
      for (i = 0; i < bins.length; i++) contrast += Math.abs(bins[i] - mean);
      sx += l[0] * contrast; sy += l[1] * contrast; n += contrast;
    });
    var mag = Math.hypot(sx, sy);
    return n > 0 && mag / n > 0.3 ? [sx / mag, sy / mag] : [-0.62, -0.78];
  }
  function bloomAt(bins, theta) {
    var N = bins.length, t = ((theta / (2 * Math.PI)) * N - 0.5 + N * 4) % N, i = Math.floor(t), f = t - i;
    return bins[i % N] * (1 - f) + bins[(i + 1) % N] * f;
  }

  /** Normalised elliptical radius of (x,y) for a pin (1 = on the ellipse), plus the local pixel scale. */
  function ellipseRe(x, y, pin, scale) {
    var dx = x - pin.cx, dy = y - pin.cy;
    var c = Math.cos(pin.theta), s = Math.sin(pin.theta);
    var u = dx * c + dy * s, v = -dx * s + dy * c;
    return Math.sqrt((u / (pin.a * scale)) * (u / (pin.a * scale)) + (v / (pin.b * scale)) * (v / (pin.b * scale)));
  }
  /** Coverage of an ellipse (semi-axes a*scale, b*scale) with a ~1.4 px soft edge. */
  function ellipseAlpha(x, y, pin, scale) {
    var re = ellipseRe(x, y, pin, scale);
    var distPx = (re - 1) * Math.sqrt(pin.a * pin.b) * scale;
    return clamp(0.5 - distPx / 1.4, 0, 1);
  }

  /** Median colour of the non-green surface around the pin: the light the pin sits in. */
  function ambient(img, pin) {
    var w = img.width, h = img.height, d = img.data;
    var R = Math.max(pin.a, pin.b), vals = [[], [], []];
    for (var k = 0; k < 360; k += 6) {
      for (var ti = 0; ti < 3; ti++) {
        var t = [1.28, 1.4, 1.52][ti];
        var x = Math.trunc(pin.cx + R * t * Math.cos((k * Math.PI) / 180));
        var y = Math.trunc(pin.cy + R * t * Math.sin((k * Math.PI) / 180));
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        var p = (y * w + x) * 4, r = d[p], g = d[p + 1], b = d[p + 2];
        if (g - Math.max(r, b) < 6) { vals[0].push(r); vals[1].push(g); vals[2].push(b); }
      }
    }
    if (!vals[0].length) return [235, 235, 235];
    return vals.map(function (v) { v.sort(function (p, q) { return p - q; }); return v[(v.length / 2) | 0]; });
  }

  function bilinear(fd, size, x, y, out) {
    x = clamp(x, 0, size - 1.001);
    y = clamp(y, 0, size - 1.001);
    var x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    var p00 = (y0 * size + x0) * 4, p10 = p00 + 4, p01 = p00 + size * 4, p11 = p01 + 4;
    var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    for (var k = 0; k < 3; k++) out[k] = fd[p00 + k] * w00 + fd[p10 + k] * w10 + fd[p01 + k] * w01 + fd[p11 + k] * w11;
  }

  /** Draw any image into a square, cover-cropped, high-quality downscaled canvas and return its pixels. */
  function prepareFace(bitmap, size) {
    var side = Math.min(bitmap.width, bitmap.height);
    var sx = (bitmap.width - side) / 2, sy = (bitmap.height - side) / 2;
    var cur = document.createElement("canvas");
    cur.width = cur.height = side;
    var cctx = cur.getContext("2d");
    cctx.drawImage(bitmap, sx, sy, side, side, 0, 0, side, side);
    // halve step by step: one big jump aliases thin shapes
    while (cur.width > size * 2) {
      var next = document.createElement("canvas");
      next.width = next.height = Math.max(size, Math.round(cur.width / 2));
      var nctx = next.getContext("2d");
      nctx.imageSmoothingQuality = "high";
      nctx.drawImage(cur, 0, 0, next.width, next.height);
      cur = next;
    }
    var fin = document.createElement("canvas");
    fin.width = fin.height = size;
    var fctx = fin.getContext("2d");
    fctx.imageSmoothingQuality = "high";
    fctx.drawImage(cur, 0, 0, size, size);
    return fctx.getImageData(0, 0, size, size);
  }

  function blurLayer(layerImg, px) {
    var a = document.createElement("canvas");
    a.width = layerImg.width; a.height = layerImg.height;
    a.getContext("2d").putImageData(layerImg, 0, 0);
    var b = document.createElement("canvas");
    b.width = a.width; b.height = a.height;
    var bctx = b.getContext("2d");
    bctx.filter = "blur(" + px + "px)";
    bctx.drawImage(a, 0, 0);
    return bctx.getImageData(0, 0, b.width, b.height);
  }

  /**
   * @param photo  ImageData of the photo
   * @param pins   from detect() (or edited by the caller)
   * @param faces  ImageData[] already prepared (square); pin i uses faces[i % faces.length]
   * @param opts   {grow, shift:[sx,sy], seed}
   */
  function replace(photo, pins, faces, opts) {
    opts = opts || {};
    var rnd = mulberry32(opts.seed == null ? 7 : opts.seed);
    var w = photo.width, h = photo.height, po = photo.data;
    var out = new ImageData(new Uint8ClampedArray(po), w, h);
    var od = out.data;
    var layers = [];
    var tmp = [0, 0, 0];

    for (var i = 0; i < pins.length; i++) {
      var orig = pins[i];
      // per pin (set by measureRim or by the caller), else the shared options
      var grow = orig.grow != null ? orig.grow : opts.grow == null || opts.grow === "auto" ? 1.1 : opts.grow;
      var shift = orig.shift || opts.shift || [0, 0];
      var Rg = (orig.a + orig.b) / 2;
      var d = { cx: orig.cx + shift[0] * Rg, cy: orig.cy + shift[1] * Rg, a: orig.a, b: orig.b, theta: orig.theta };
      var face = faces[i % faces.length];
      var Sd = face.width, fd = face.data;
      var c = Math.cos(d.theta), s = Math.sin(d.theta);
      var ia = 1 / (d.a * grow), ib = 1 / (d.b * grow);
      var m00 = c * c * ia + s * s * ib, m01 = c * s * (ia - ib), m10 = m01, m11 = s * s * ia + c * c * ib;

      var amb = ambient(photo, d);
      var amax = Math.max(amb[0], amb[1], amb[2]);
      var bright = 0.99;
      var tint = amb.map(function (v) { return 1 + 0.18 * (v / amax - 1); });

      var Rm = Math.max(d.a, d.b) * grow + 6;
      var x0 = Math.max(0, Math.trunc(d.cx - Rm)), x1 = Math.min(w, Math.trunc(d.cx + Rm));
      var y0 = Math.max(0, Math.trunc(d.cy - Rm)), y1 = Math.min(h, Math.trunc(d.cy + Rm));
      var maskScale = grow > 1.0 ? grow * 0.985 : 0.965;

      // baseline of min(R,B) inside the disc, to isolate the specular glare
      var samples = [];
      for (var yy = y0; yy < y1; yy += 3) for (var xx = x0; xx < x1; xx += 3) {
        if (ellipseAlpha(xx, yy, d, maskScale) > 0.98) { var q = (yy * w + xx) * 4; samples.push(Math.min(po[q], po[q + 2])); }
      }
      samples.sort(function (p, q2) { return p - q2; });
      var p0 = samples.length ? samples[(samples.length / 2) | 0] : 0;

      var bloom = bloomByAngle(photo, orig, p0, Math.max(1.02, 1 + (grow * 1.0 - 1) * 1.4));
      var L = orig.light || opts.light || lightFromBloom(bloom);
      orig.light = L; // the light actually used, reported to the caller
      var lw = x1 - x0, lh = y1 - y0;
      var layer = new ImageData(lw, lh);
      var ld = layer.data;
      for (var y = y0; y < y1; y++) {
        for (var x = x0; x < x1; x++) {
          var dx = x - d.cx, dy = y - d.cy;
          var mx = m00 * dx + m01 * dy, my = m10 * dx + m11 * dy; // design-normalised coords, -1..1 across the new disc
          var rr = Math.min(1, Math.hypot(mx, my));
          var lens = 1 - 0.03 * rr * rr; // convex glass: the print looks slightly compressed toward the rim
          bilinear(fd, Sd, (Sd / 2) * (1 + mx * lens), (Sd / 2) * (1 + my * lens), tmp);
          var fr = tmp[0], fg = tmp[1], fb = tmp[2];
          var lx = mx * L[0] + my * L[1]; // +1 toward the light, -1 away (L comes from the photo: ring brightness per direction)
          var shade = 1 + 0.045 * lx;
          var rim = 1 - 0.06 * Math.pow(rr, 4) - 0.07 * Math.max(0, -lx) * Math.pow(rr, 3);
          var blob = 0.10 * Math.exp(-((mx - L[0] * 0.61) * (mx - L[0] * 0.61) + (my - L[1] * 0.61) * (my - L[1] * 0.61)) / 0.16);
          // the photo's own specular glare: only where the ORIGINAL green disc was (cloth outside it is not glare)
          var q0 = (y * w + x) * 4, r0 = po[q0], g0 = po[q0 + 1], b0 = po[q0 + 2];
          // Glare. Inside the original green it is the photo's real specular highlight (per pixel; the green is flat, so it is smooth).
          // OUTSIDE it (the band the larger new disc covers: rim metal and the cloth next to it) it is the soft bevel ring, taken per direction
          // (see bloomByAngle). Right at the green's edge the pixels are a mix of key and rim, so there it is switched off (it would draw a hairline).
          var reO = ellipseRe(x, y, orig, 1.0);
          var gl = 0;
          if (reO < 0.95) {
            gl = clamp((Math.min(r0, b0) - p0) / Math.max(1, 255 - p0), 0, 1) * 0.9 * (reO < 0.86 ? 1 : 1 - (reO - 0.86) / 0.09);
          } else if (reO >= 1.0) {
            gl = bloomAt(bloom, Math.atan2(y - orig.cy, x - orig.cx)) * 0.9;
          }
          // print under gloss is punchier than a flat render
          var lum = 0.299 * fr + 0.587 * fg + 0.114 * fb;
          fr = lum + (fr - lum) * 1.1; fg = lum + (fg - lum) * 1.1; fb = lum + (fb - lum) * 1.1;
          // bevelled rim: thin bright band on the lit side, thin dark band on the far side
          var eband = clamp((rr - 0.9) / 0.07, 0, 1) * (1 - clamp((rr - 0.985) / 0.015, 0, 1));
          var rimlight = 0.42 * eband * Math.max(0, lx), rimdark = 0.16 * eband * Math.max(0, -lx);
          var lp = ((y - y0) * lw + (x - x0)) * 4;
          var chans = [fr, fg, fb];
          for (var k = 0; k < 3; k++) {
            var v = chans[k] * bright * tint[k] * shade * rim;
            v = v * (1 - rimdark);
            v = v * (1 - rimlight) + 255 * rimlight;
            v = v * (1 - blob) + 255 * blob;
            v = v * (1 - gl) + 255 * gl;
            v += gauss(rnd) * 1.3;
            ld[lp + k] = clamp(Math.trunc(v), 0, 255);
          }
          ld[lp + 3] = 255;
        }
      }
      var soft = blurLayer(layer, 0.35); // the photo is slightly soft
      var sd = soft.data;
      for (var y2 = y0; y2 < y1; y2++) {
        for (var x2 = x0; x2 < x1; x2++) {
          var a = ellipseAlpha(x2, y2, d, maskScale);
          if (a <= 0) continue;
          var o = (y2 * w + x2) * 4, l = ((y2 - y0) * lw + (x2 - x0)) * 4;
          od[o] = od[o] + (sd[l] - od[o]) * a;
          od[o + 1] = od[o + 1] + (sd[l + 1] - od[o + 1]) * a;
          od[o + 2] = od[o + 2] + (sd[l + 2] - od[o + 2]) * a;
        }
      }
      layers.push({ d: d, layer: soft, x0: x0, y0: y0, grow: grow });
    }

    for (var li = 0; li < layers.length; li++) edgeUnmix(out, photo, layers[li]);
    for (var lj = 0; lj < layers.length; lj++) finalDespill(out, layers[lj]);
    return out;
  }

  /**
   * Edge pixels are a mix of the green key and what is under it. Estimate the green share (alpha) from the ORIGINAL, subtract it
   * (P = a*G0 + (1-a)*U  ->  U = (P - a*G0)/(1-a)) and put the new print in its place. Pixels with no green stay exactly as photographed.
   */
  function edgeUnmix(out, orig, L) {
    var w = orig.width, h = orig.height, po = orig.data, od = out.data, d = L.d, grow = L.grow;
    var lo = 0.93, hi = 1.1;
    var R = (d.a + d.b) / 2;
    var ref = [];
    for (var k = 0; k < 13; k++) {
      var t = k * 0.5;
      var x = Math.trunc(d.cx + R * 0.55 * Math.cos(t)), y = Math.trunc(d.cy + R * 0.55 * Math.sin(t));
      var p = (clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)) * 4;
      ref.push([po[p], po[p + 1], po[p + 2]]);
    }
    var g0 = [0, 1, 2].map(function (i) { var v = ref.map(function (r) { return r[i]; }).sort(function (a, b) { return a - b; }); return v[(v.length / 2) | 0]; });
    var gd0 = Math.max(1, g0[1] - Math.max(g0[0], g0[2]));
    var ly = L.layer, lw = ly.width, lh = ly.height, ld = ly.data;
    for (var y2 = Math.max(0, Math.trunc(d.cy - R * hi - 2)); y2 < Math.min(h, Math.trunc(d.cy + R * hi + 3)); y2++) {
      for (var x2 = Math.max(0, Math.trunc(d.cx - R * hi - 2)); x2 < Math.min(w, Math.trunc(d.cx + R * hi + 3)); x2++) {
        var dx = x2 - d.cx, dy = y2 - d.cy, dist = Math.hypot(dx, dy), rr = dist / R;
        if (rr < lo || rr > hi) continue;
        var o = (y2 * w + x2) * 4;
        var pr = po[o], pg = po[o + 1], pb = po[o + 2], gd = pg - Math.max(pr, pb);
        if (gd <= 3 || (rr < grow * 0.985 && grow > 1.0)) continue; // no green, or already covered by the (larger) new disc
        var ag = clamp(gd / (gd0 * 0.85), 0, 1);
        var ur, ug, ub;
        if (ag > 0.92) { // (almost) pure key colour: nothing of the original survives, use the surface just outside
          var ex = dist > 0 ? dx / dist : 1, ey = dist > 0 ? dy / dist : 0;
          var sx = clamp(Math.trunc(d.cx + ex * R * 1.08), 0, w - 1), sy = clamp(Math.trunc(d.cy + ey * R * 1.08), 0, h - 1);
          var so = (sy * w + sx) * 4;
          ur = po[so]; ug = po[so + 1]; ub = po[so + 2];
          ag = 1;
        } else {
          ur = clamp((pr - ag * g0[0]) / (1 - ag), 0, 255);
          ug = clamp((pg - ag * g0[1]) / (1 - ag), 0, 255);
          ub = clamp((pb - ag * g0[2]) / (1 - ag), 0, 255);
          var m = Math.max(ur, ub);
          ug = Math.min(ug, m + 2);
          ug = Math.max(ug, ((ur + ub) / 2) * 0.93); // removing green must not leave magenta
        }
        var lx = clamp(x2 - L.x0, 0, lw - 1), ly2 = clamp(y2 - L.y0, 0, lh - 1);
        var lo4 = (ly2 * lw + lx) * 4;
        od[o] = Math.trunc(ag * ld[lo4] + (1 - ag) * ur);
        od[o + 1] = Math.trunc(ag * ld[lo4 + 1] + (1 - ag) * ug);
        od[o + 2] = Math.trunc(ag * ld[lo4 + 2] + (1 - ag) * ub);
      }
    }
  }

  /** Last pass on the edge band: green may not exceed the larger of R/B. The faces carry no green, so this only removes key spill. */
  function finalDespill(out, L) {
    var w = out.width, h = out.height, od = out.data, d = L.d, grow = L.grow;
    var inner = 0.86 * grow, outer = 1.14 * Math.max(1, grow);
    var R = Math.max(d.a, d.b) * outer + 3;
    for (var y = Math.max(0, Math.trunc(d.cy - R)); y < Math.min(h, Math.trunc(d.cy + R)); y++) {
      for (var x = Math.max(0, Math.trunc(d.cx - R)); x < Math.min(w, Math.trunc(d.cx + R)); x++) {
        var re = ellipseRe(x, y, d, 1.0);
        if (re > outer || re <= inner) continue;
        var o = (y * w + x) * 4, r = od[o], g = od[o + 1], b = od[o + 2], m = Math.max(r, b);
        if (g > m + 6) { od[o] = m; od[o + 1] = m; od[o + 2] = m; } // clearly keyed: the rim is neutral grey, not teal
        else if (g > m) od[o + 1] = m;
      }
    }
  }

  function toImageData(bitmap) {
    var c = document.createElement("canvas");
    c.width = bitmap.width; c.height = bitmap.height;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height);
  }
  async function decode(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return createImageBitmap(new Blob([bytes]));
  }

  /** Entry points called from Node. Images come in as base64, the result goes out as base64 PNG. */
  window.__pinPhoto = {
    detect: async function (photoB64, minArea) {
      var img = toImageData(await decode(photoB64));
      var found = detect(img, minArea);
      return { width: img.width, height: img.height, pins: found, small: found.small };
    },
    /** Detection plus the rim measurement per pin (what `grow: "auto"` would use). */
    measure: async function (photoB64, minArea) {
      var img = toImageData(await decode(photoB64));
      var pins = detect(img, minArea);
      pins.forEach(function (p) { p.rim = measureRim(img, p); });
      return { width: img.width, height: img.height, pins: pins, small: pins.small };
    },
    run: async function (photoB64, facesB64, opts) {
      opts = opts || {};
      var img = toImageData(await decode(photoB64));
      var pins = opts.pins && opts.pins.length ? opts.pins : detect(img, opts.minArea);
      if (!pins.length) return { width: img.width, height: img.height, pins: [], png: null, small: pins.small || 0 };
      if (!opts.light) opts.light = measureLight(img, pins); // one light source per photo
      // grow/shift: measured per pin from its rim unless the caller gave a number. A measurement that fails falls back to 1.1 / no shift.
      var auto = opts.grow == null || opts.grow === "auto";
      if (auto) {
        for (var m = 0; m < pins.length; m++) {
          var rim = pins[m].grow != null ? null : measureRim(img, pins[m]);
          pins[m].rim = rim ? { n: rim.n, rmse: rim.rmse } : null;
          if (pins[m].grow == null) {
            pins[m].grow = rim ? rim.grow : 1.1;
            pins[m].shift = opts.shift || (rim ? rim.shift : [0, 0]);
          }
        }
      }
      var faces = [];
      for (var i = 0; i < pins.length; i++) {
        var fb = facesB64[i % facesB64.length];
        // pre-filter the face to ~2x the pin so sampling never aliases
        var size = Math.max(64, Math.trunc(2 * 2 * Math.max(pins[i].a, pins[i].b)));
        faces.push(prepareFace(await decode(fb), size));
      }
      var res = replace(img, pins, faces, opts);
      var c = document.createElement("canvas");
      c.width = res.width; c.height = res.height;
      c.getContext("2d").putImageData(res, 0, 0);
      return { width: res.width, height: res.height, pins: pins, png: c.toDataURL("image/png").split(",")[1], small: 0 };
    },
  };
})();
