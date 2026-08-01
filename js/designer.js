// Dizajner studio — Dekorativna Cigla Niš (v2: foto-teksture, perspektiva, čarobni štapić)
// Sve se izvršava lokalno u pregledaču; fotografije se ne šalju nigde.
(function () {
  'use strict';

  // ---------- Modeli ----------
  var MODELS = [
    { id: 'rustik',   name: 'Rustik Crvena',    price: 2400, tex: 'img/tex-rustik.webp',   bricks: ['#b3562e', '#a54f2b', '#ad5230', '#b85a33', '#9c4a26', '#c06238'] },
    { id: 'antik',    name: 'Antik Bela',       price: 2400, tex: 'img/tex-antik.webp',    bricks: ['#f2ece2', '#e8e0d3', '#efe8dc', '#f5efe6', '#e4dccf', '#ece3d5'] },
    { id: 'urban',    name: 'Urban Siva',       price: 2400, tex: 'img/tex-urban.webp',    bricks: ['#6e6a66', '#7d7873', '#666260', '#87817b', '#5e5a57', '#75706b'] },
    { id: 'krem',     name: 'Krem Pastel',      price: 2400, tex: 'img/tex-krem.webp',     bricks: ['#e0cdbc', '#d6c1ae', '#dbc7b5', '#e5d3c2', '#d1bca9', '#e8d7c7'] },
    { id: 'noir',     name: 'Noir Antracit',    price: 2600, tex: 'img/tex-noir.webp',     bricks: ['#1e1a17', '#2b2622', '#26211d', '#332d28', '#1a1613', '#38322c'] },
    { id: 'braon',    name: 'Braon Klasik (fasadna)', price: 2900, tex: 'img/tex-braon.webp', bricks: ['#8a5a3b', '#7d5136', '#936043', '#84573a', '#75492f', '#9a6847'] },
    { id: 'terakota', name: 'Terakota Intenziv (fasadna)', price: 2900, tex: 'img/tex-terakota.webp', bricks: ['#c9401f', '#b53a1e', '#d04a26', '#bd3d20', '#a83619', '#d6522d'] }
  ];
  var FUGAS = [
    { id: 'pesak', name: 'Peskirana bež', color: '#d9cfc4' },
    { id: 'bela',  name: 'Bela',          color: '#f2efe9' },
    { id: 'siva',  name: 'Siva',          color: '#a8a29a' },
    { id: 'tamna', name: 'Antracit',      color: '#4a4540' }
  ];
  var PRESETS = [
    { file: 'img/soba-dnevna.webp',  label: 'Dnevna soba' },
    { file: 'img/soba-spavaca.webp', label: 'Spavaća soba' },
    { file: 'img/soba-kafic.webp',   label: 'Kafić' },
    { file: 'img/soba-fasada.webp',  label: 'Fasada' }
  ];
  var TEX_REAL_W = 1.2; // pretpostavka: tekstura pokriva ~1,2 m širine zida

  var state = {
    mode: 'wall',            // 'wall' | 'photo'
    render: 'real',          // 'real' | 'schematic' (samo wall mod)
    model: MODELS[0],
    fuga: FUGAS[0],
    fugaMm: 10,
    brush: 40,
    tool: 'brush',           // 'brush' | 'erase' | 'wand' | 'corners'
    tolerance: 32,
    opacity: 0.85,
    texScale: 1,
    ba: 100,                 // before/after (100 = pun prikaz)
    photo: null,
    quad: null,              // [{x,y}×4] TL,TR,BR,BL
    dragIdx: -1
  };

  var canvas = document.getElementById('studio-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var mask = document.createElement('canvas');
  var maskCtx = mask.getContext('2d');
  var undoStack = [], redoStack = [];

  // ---------- Teksture (mirror-tile za bešavno ponavljanje) ----------
  var texCache = {};   // id -> {img, tile}
  function getTexture(model, onReady) {
    var c = texCache[model.id];
    if (c) { if (c.tile) return c; if (onReady) c.cbs.push(onReady); return null; }
    c = texCache[model.id] = { img: null, tile: null, cbs: onReady ? [onReady] : [] };
    var img = new Image();
    img.onload = function () {
      c.img = img;
      var t = document.createElement('canvas');
      t.width = img.width * 2; t.height = img.height * 2;
      var g = t.getContext('2d');
      g.drawImage(img, 0, 0);
      g.save(); g.scale(-1, 1); g.drawImage(img, -img.width * 2, 0); g.restore();
      g.save(); g.scale(1, -1); g.drawImage(img, 0, -img.height * 2); g.restore();
      g.save(); g.scale(-1, -1); g.drawImage(img, -img.width * 2, -img.height * 2); g.restore();
      c.tile = t;
      c.cbs.forEach(function (cb) { cb(); });
      c.cbs = [];
    };
    img.onerror = function () { c.failed = true; };
    img.src = model.tex;
    return null;
  }

  function seeded(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // ---------- Šematski (proceduralni) tile ----------
  function buildTile(model, fugaColor, fugaPx, scale) {
    var bw = Math.round(96 * scale), bh = Math.round(22 * scale);
    var f = Math.max(2, Math.round(fugaPx * scale));
    var tileW = (bw + f) * 2, tileH = (bh + f) * 2;
    var t = document.createElement('canvas');
    t.width = tileW; t.height = tileH;
    var g = t.getContext('2d');
    g.fillStyle = fugaColor; g.fillRect(0, 0, tileW, tileH);
    var n = 0;
    function brick(x, y) {
      g.fillStyle = model.bricks[Math.floor(seeded(n) * model.bricks.length)]; n++;
      g.beginPath();
      var r = 2 * scale;
      g.moveTo(x + r, y);
      g.arcTo(x + bw, y, x + bw, y + bh, r);
      g.arcTo(x + bw, y + bh, x, y + bh, r);
      g.arcTo(x, y + bh, x, y, r);
      g.arcTo(x, y, x + bw, y, r);
      g.fill();
      g.save(); g.globalAlpha = 0.12; g.fillStyle = '#000';
      for (var d = 0; d < 14; d++) g.fillRect(x + seeded(n * 13 + d) * bw, y + seeded(n * 29 + d) * bh, 1.5 * scale, 1.5 * scale);
      g.globalAlpha = 0.15; g.fillStyle = '#fff'; g.fillRect(x, y, bw, 2 * scale);
      g.restore();
    }
    var y1 = f / 2, y2 = y1 + bh + f;
    for (var x = -(bw + f); x < tileW + bw; x += bw + f) {
      brick(x + f / 2, y1);
      brick(x + f / 2 + (bw + f) / 2, y2);
    }
    return t;
  }

  // ---------- Simulacija zida ----------
  function drawWall() {
    var w = parseFloat(el('wall-w').value) || 4;
    var h = parseFloat(el('wall-h').value) || 2.6;
    var ratio = w / h, cw = 900, ch = Math.round(900 / ratio);
    if (ch > 560) { ch = 560; cw = Math.round(560 * ratio); }
    canvas.width = cw; canvas.height = ch;
    var pxPerM = cw / w;

    if (state.render === 'real') {
      var tex = getTexture(state.model, redraw);
      if (tex) {
        var s = pxPerM * TEX_REAL_W / tex.img.width;
        var pat = ctx.createPattern(tex.tile, 'repeat');
        if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(s));
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, cw, ch);
      } else {
        ctx.fillStyle = '#e8e2da'; ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = '#8a7c70'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Učitavanje teksture…', cw / 2, ch / 2);
      }
    } else {
      var scale = pxPerM * 0.25 / 96;
      ctx.fillStyle = ctx.createPattern(buildTile(state.model, state.fuga.color, state.fugaMm, Math.max(0.15, scale)), 'repeat');
      ctx.fillRect(0, 0, cw, ch);
    }
    var grad = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) / 2, cw / 2, ch / 2, Math.max(cw, ch));
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
    updateResults();
  }

  // ---------- Homografija: jedinični kvadrat -> quad ----------
  function homography(q) {
    var x0 = q[0].x, y0 = q[0].y, x1 = q[1].x, y1 = q[1].y,
        x2 = q[2].x, y2 = q[2].y, x3 = q[3].x, y3 = q[3].y;
    var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    var dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    var g = 0, hh = 0;
    if (dx3 !== 0 || dy3 !== 0) {
      var den = dx1 * dy2 - dx2 * dy1;
      g = (dx3 * dy2 - dx2 * dy3) / den;
      hh = (dx1 * dy3 - dx3 * dy1) / den;
    }
    var a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
    var d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
    return function (u, v) {
      var w = g * u + hh * v + 1;
      return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
    };
  }

  function drawTri(g, img, d0, d1, d2, s0, s1, s2) {
    var den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
    if (!den) return;
    var a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
    var c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
    var b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
    var dd = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
    var e = d0.x - a * s0.x - c * s0.y;
    var f = d0.y - b * s0.x - dd * s0.y;
    g.save();
    g.beginPath();
    // blago proširen clip da ne ostaju šavovi između trouglova
    var cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
    function inflate(p) { return { x: p.x + (p.x - cx) * 0.02, y: p.y + (p.y - cy) * 0.02 }; }
    var i0 = inflate(d0), i1 = inflate(d1), i2 = inflate(d2);
    g.moveTo(i0.x, i0.y); g.lineTo(i1.x, i1.y); g.lineTo(i2.x, i2.y); g.closePath(); g.clip();
    g.transform(a, b, c, dd, e, f);
    g.drawImage(img, 0, 0);
    g.restore();
  }

  function warpToQuad(g, flat, quad) {
    var H = homography(quad), N = 14;
    for (var i = 0; i < N; i++) {
      for (var j = 0; j < N; j++) {
        var u0 = i / N, u1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N;
        var s00 = { x: u0 * flat.width, y: v0 * flat.height }, s10 = { x: u1 * flat.width, y: v0 * flat.height };
        var s11 = { x: u1 * flat.width, y: v1 * flat.height }, s01 = { x: u0 * flat.width, y: v1 * flat.height };
        var d00 = H(u0, v0), d10 = H(u1, v0), d11 = H(u1, v1), d01 = H(u0, v1);
        drawTri(g, flat, d00, d10, d11, s00, s10, s11);
        drawTri(g, flat, d00, d11, d01, s00, s11, s01);
      }
    }
  }

  // ---------- Foto režim ----------
  function drawPhoto() {
    if (!state.photo) {
      canvas.width = 900; canvas.height = 560;
      ctx.fillStyle = '#f0ebe4'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#8a7c70'; ctx.font = '19px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Otpremite fotografiju svoje prostorije,', canvas.width / 2, canvas.height / 2 - 24);
      ctx.fillText('ili izaberite jednu od gotovih prostorija ispod,', canvas.width / 2, canvas.height / 2 + 4);
      ctx.fillText('pa četkicom ili štapićem označite zid.', canvas.width / 2, canvas.height / 2 + 32);
      return;
    }
    var w = canvas.width, h = canvas.height;
    ctx.drawImage(state.photo, 0, 0, w, h);

    var tex = getTexture(state.model, redraw);
    var brickLayer = document.createElement('canvas');
    brickLayer.width = w; brickLayer.height = h;
    var bg = brickLayer.getContext('2d');

    var tileImg = tex ? tex.tile : buildTile(state.model, state.fuga.color, state.fugaMm, 0.5);
    var texW = tex ? tex.img.width : tileImg.width;
    var baseScale = (w / 6) / texW * state.texScale * 2; // tekstura ~ šestina širine slike, x2 zbog mirror-tile

    if (state.quad && state.quad.length === 4) {
      var flat = document.createElement('canvas');
      flat.width = 1200; flat.height = 900;
      var fg = flat.getContext('2d');
      var pat = fg.createPattern(tileImg, 'repeat');
      if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(baseScale * 1.4));
      fg.fillStyle = pat; fg.fillRect(0, 0, flat.width, flat.height);
      warpToQuad(bg, flat, state.quad);
    } else {
      var pat2 = bg.createPattern(tileImg, 'repeat');
      if (pat2.setTransform) pat2.setTransform(new DOMMatrix().scale(baseScale));
      bg.fillStyle = pat2; bg.fillRect(0, 0, w, h);
    }
    bg.globalCompositeOperation = 'destination-in';
    bg.drawImage(mask, 0, 0);

    // senčenje: fotografija (samo unutar maske) preko cigle u multiply režimu
    var shade = document.createElement('canvas');
    shade.width = w; shade.height = h;
    var sg = shade.getContext('2d');
    sg.drawImage(state.photo, 0, 0, w, h);
    sg.globalCompositeOperation = 'destination-in';
    sg.drawImage(mask, 0, 0);

    ctx.save();
    ctx.globalAlpha = state.opacity;
    ctx.drawImage(brickLayer, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.45;
    ctx.drawImage(shade, 0, 0);
    ctx.restore();

    // pre/posle
    if (state.ba < 100) {
      var split = w * state.ba / 100;
      ctx.save();
      ctx.beginPath(); ctx.rect(split, 0, w - split, h); ctx.clip();
      ctx.drawImage(state.photo, 0, 0, w, h);
      ctx.restore();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(split, 0); ctx.lineTo(split, h); ctx.stroke();
    }

    // ručke za uglove
    if (state.tool === 'corners' && state.quad) {
      state.quad.forEach(function (p, i) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(179,86,46,.9)'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), p.x, p.y + 3.5);
      });
      if (state.quad.length === 4) {
        ctx.beginPath();
        ctx.moveTo(state.quad[0].x, state.quad[0].y);
        for (var i = 1; i < 4; i++) ctx.lineTo(state.quad[i].x, state.quad[i].y);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function loadPhotoImage(img) {
    state.photo = img;
    state.quad = null;
    var ratio = img.width / img.height, cw = 900, ch = Math.round(900 / ratio);
    if (ch > 620) { ch = 620; cw = Math.round(620 * ratio); }
    canvas.width = cw; canvas.height = ch;
    mask.width = cw; mask.height = ch;
    maskCtx = mask.getContext('2d');
    maskCtx.clearRect(0, 0, cw, ch);
    undoStack = []; redoStack = []; updateUndoButtons();
    drawPhoto();
  }
  function loadPhoto(file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
    var img = new Image();
    img.onload = function () { loadPhotoImage(img); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(file);
  }
  function loadPreset(src) {
    var img = new Image();
    img.onload = function () { loadPhotoImage(img); };
    img.src = src;
  }

  // ---------- Undo / redo ----------
  function snapshot() {
    try {
      undoStack.push(maskCtx.getImageData(0, 0, mask.width, mask.height));
      if (undoStack.length > 15) undoStack.shift();
      redoStack = [];
      updateUndoButtons();
    } catch (e) { /* ignore */ }
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(maskCtx.getImageData(0, 0, mask.width, mask.height));
    maskCtx.putImageData(undoStack.pop(), 0, 0);
    updateUndoButtons(); drawPhoto();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(maskCtx.getImageData(0, 0, mask.width, mask.height));
    maskCtx.putImageData(redoStack.pop(), 0, 0);
    updateUndoButtons(); drawPhoto();
  }
  function updateUndoButtons() {
    el('undo-btn').disabled = !undoStack.length;
    el('redo-btn').disabled = !redoStack.length;
  }

  // ---------- Čarobni štapić (flood fill) ----------
  function wand(px, py) {
    if (!state.photo) return;
    var w = canvas.width, h = canvas.height;
    var ref = document.createElement('canvas');
    ref.width = w; ref.height = h;
    var rg = ref.getContext('2d');
    rg.drawImage(state.photo, 0, 0, w, h);
    var data;
    try { data = rg.getImageData(0, 0, w, h).data; } catch (e) { return; }
    px = Math.round(px); py = Math.round(py);
    var i0 = (py * w + px) * 4;
    var r0 = data[i0], g0 = data[i0 + 1], b0 = data[i0 + 2];
    var tol = state.tolerance * state.tolerance * 3;
    var visited = new Uint8Array(w * h);
    var out = maskCtx.getImageData(0, 0, w, h);
    var stack = [py * w + px];
    visited[py * w + px] = 1;
    while (stack.length) {
      var idx = stack.pop();
      var x = idx % w, y = (idx / w) | 0;
      var di = idx * 4;
      var dr = data[di] - r0, dg = data[di + 1] - g0, db = data[di + 2] - b0;
      if (dr * dr + dg * dg + db * db > tol) continue;
      out.data[di] = 255; out.data[di + 1] = 255; out.data[di + 2] = 255; out.data[di + 3] = 255;
      if (x > 0 && !visited[idx - 1]) { visited[idx - 1] = 1; stack.push(idx - 1); }
      if (x < w - 1 && !visited[idx + 1]) { visited[idx + 1] = 1; stack.push(idx + 1); }
      if (y > 0 && !visited[idx - w]) { visited[idx - w] = 1; stack.push(idx - w); }
      if (y < h - 1 && !visited[idx + w]) { visited[idx + w] = 1; stack.push(idx + w); }
    }
    maskCtx.putImageData(out, 0, 0);
  }

  // ---------- Proračun ----------
  function updateResults() {
    var w = parseFloat(el('wall-w').value) || 0;
    var h = parseFloat(el('wall-h').value) || 0;
    var open = parseFloat(el('wall-open').value) || 0;
    var net = Math.max(0, w * h - open);
    var bricks = Math.ceil(net * 48 * 1.1);
    var packs = Math.ceil(net * 1.1);
    var price = Math.round(net * state.model.price);
    el('r-area').textContent = net.toFixed(1).replace('.', ',') + ' m²';
    el('r-bricks').textContent = net > 0 ? bricks.toLocaleString('sr-RS') : '—';
    el('r-packs').textContent = net > 0 ? packs : '—';
    el('r-price').textContent = net > 0 ? '~' + price.toLocaleString('sr-RS') + ' RSD' : '—';
  }

  // ---------- Crtanje ----------
  var painting = false;
  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: cx * canvas.width / r.width, y: cy * canvas.height / r.height };
  }
  function paint(p) {
    maskCtx.globalCompositeOperation = state.tool === 'erase' ? 'destination-out' : 'source-over';
    maskCtx.fillStyle = '#fff';
    maskCtx.beginPath();
    maskCtx.arc(p.x, p.y, state.brush, 0, Math.PI * 2);
    maskCtx.fill();
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (state.mode !== 'photo' || !state.photo) return;
    var p = canvasPos(e);
    if (state.tool === 'corners') {
      if (state.quad) {
        for (var i = 0; i < state.quad.length; i++) {
          var q = state.quad[i];
          if ((q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y) < 400) { state.dragIdx = i; return; }
        }
      }
      if (!state.quad) state.quad = [];
      if (state.quad.length < 4) { state.quad.push(p); drawPhoto(); }
      return;
    }
    if (state.tool === 'wand') { snapshot(); wand(p.x, p.y); drawPhoto(); return; }
    snapshot(); painting = true; paint(p); drawPhoto();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (state.mode !== 'photo' || !state.photo) return;
    var p = canvasPos(e);
    if (state.dragIdx >= 0) { state.quad[state.dragIdx] = p; drawPhoto(); return; }
    if (painting) { paint(p); drawPhoto(); }
  });
  window.addEventListener('pointerup', function () { painting = false; state.dragIdx = -1; });
  canvas.addEventListener('touchmove', function (e) { if (painting || state.dragIdx >= 0) e.preventDefault(); }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
  });

  // ---------- UI ----------
  function el(id) { return document.getElementById(id); }

  var modelRow = el('model-swatches');
  MODELS.forEach(function (m, i) {
    var b = document.createElement('button');
    b.className = 'swatch' + (i === 0 ? ' selected' : '');
    b.type = 'button'; b.title = m.name; b.setAttribute('aria-label', m.name);
    b.style.background = 'linear-gradient(135deg, ' + m.bricks[0] + ' 50%, ' + m.bricks[3] + ' 50%)';
    b.style.backgroundSize = 'cover';
    var probe = new Image();
    probe.onload = function () { b.style.background = 'url(' + m.tex + ') center/cover'; };
    probe.src = m.tex;
    b.addEventListener('click', function () {
      state.model = m;
      modelRow.querySelectorAll('.swatch').forEach(function (s) { s.classList.remove('selected'); });
      b.classList.add('selected');
      el('model-name').textContent = 'Izabrano: ' + m.name + ' — oko ' + m.price.toLocaleString('sr-RS') + ' RSD/m²';
      redraw();
    });
    modelRow.appendChild(b);
  });
  el('model-name').textContent = 'Izabrano: ' + MODELS[0].name + ' — oko ' + MODELS[0].price.toLocaleString('sr-RS') + ' RSD/m²';

  var fugaRow = el('fuga-swatches');
  FUGAS.forEach(function (f, i) {
    var b = document.createElement('button');
    b.className = 'swatch' + (i === 0 ? ' selected' : '');
    b.type = 'button'; b.title = f.name; b.setAttribute('aria-label', 'Fuga: ' + f.name);
    b.style.background = f.color;
    b.addEventListener('click', function () {
      state.fuga = f;
      fugaRow.querySelectorAll('.swatch').forEach(function (s) { s.classList.remove('selected'); });
      b.classList.add('selected');
      redraw();
    });
    fugaRow.appendChild(b);
  });

  // gotove prostorije
  var presetRow = el('preset-row');
  PRESETS.forEach(function (p) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'preset-thumb'; b.title = p.label;
    b.style.backgroundImage = 'url(' + p.file + ')';
    var s = document.createElement('span'); s.textContent = p.label; b.appendChild(s);
    b.addEventListener('click', function () { loadPreset(p.file); });
    presetRow.appendChild(b);
  });

  ['wall-w', 'wall-h', 'wall-open'].forEach(function (id) { el(id).addEventListener('input', redraw); });
  el('fuga-w').addEventListener('input', function (e) {
    state.fugaMm = parseInt(e.target.value, 10);
    el('fuga-w-val').textContent = state.fugaMm;
    redraw();
  });
  el('brush-size').addEventListener('input', function (e) {
    state.brush = parseInt(e.target.value, 10);
    el('brush-size-val').textContent = state.brush;
  });
  el('overlay-op').addEventListener('input', function (e) {
    state.opacity = parseInt(e.target.value, 10) / 100;
    el('overlay-op-val').textContent = e.target.value;
    if (state.mode === 'photo') drawPhoto();
  });
  el('tolerance').addEventListener('input', function (e) {
    state.tolerance = parseInt(e.target.value, 10);
    el('tolerance-val').textContent = state.tolerance;
  });
  el('tex-scale').addEventListener('input', function (e) {
    state.texScale = parseInt(e.target.value, 10) / 100;
    el('tex-scale-val').textContent = e.target.value;
    if (state.mode === 'photo') drawPhoto();
  });
  el('ba-slider').addEventListener('input', function (e) {
    state.ba = parseInt(e.target.value, 10);
    if (state.mode === 'photo') drawPhoto();
  });

  // režim prikaza (zid)
  document.querySelectorAll('input[name="render-mode"]').forEach(function (r) {
    r.addEventListener('change', function () {
      state.render = r.value;
      el('panel-fuga-controls').style.opacity = (state.render === 'real') ? '.45' : '1';
      el('fuga-note').style.display = (state.render === 'real') ? '' : 'none';
      redraw();
    });
  });

  // alati (foto)
  function setTool(t) {
    state.tool = t;
    ['brush-mode', 'erase-mode', 'wand-mode', 'corners-mode'].forEach(function (id) {
      el(id).className = 'btn ' + ((id.indexOf(t) === 0) ? 'btn-dark' : 'btn-light-outline');
    });
    el('tolerance-wrap').style.display = t === 'wand' ? '' : 'none';
    el('corners-help').style.display = t === 'corners' ? '' : 'none';
    drawPhoto();
  }
  el('brush-mode').addEventListener('click', function () { setTool('brush'); });
  el('erase-mode').addEventListener('click', function () { setTool('erase'); });
  el('wand-mode').addEventListener('click', function () { setTool('wand'); });
  el('corners-mode').addEventListener('click', function () { setTool('corners'); });
  el('reset-corners').addEventListener('click', function () { state.quad = null; drawPhoto(); });
  el('clear-mask').addEventListener('click', function () {
    snapshot();
    maskCtx.clearRect(0, 0, mask.width, mask.height);
    drawPhoto();
  });
  el('undo-btn').addEventListener('click', undo);
  el('redo-btn').addEventListener('click', redo);

  // upload
  var drop = el('drop-zone'), fileInput = el('photo-input');
  drop.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { loadPhoto(fileInput.files[0]); });
  drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
  drop.addEventListener('drop', function (e) {
    e.preventDefault(); drop.classList.remove('drag');
    if (e.dataTransfer.files.length) loadPhoto(e.dataTransfer.files[0]);
  });

  // tabovi
  var tabWall = el('tab-wall'), tabPhoto = el('tab-photo');
  tabWall.addEventListener('click', function () { setMode('wall'); });
  tabPhoto.addEventListener('click', function () { setMode('photo'); });
  function setMode(m) {
    state.mode = m;
    tabWall.classList.toggle('active', m === 'wall');
    tabPhoto.classList.toggle('active', m === 'photo');
    el('panel-photo').style.display = m === 'photo' ? '' : 'none';
    el('panel-dims').style.display = m === 'wall' ? '' : 'none';
    el('panel-render').style.display = m === 'wall' ? '' : 'none';
    el('ba-wrap').style.display = m === 'photo' ? '' : 'none';
    redraw();
  }

  // preuzimanje PNG
  el('download-btn').addEventListener('click', function () {
    var a = document.createElement('a');
    a.download = 'dekorativna-cigla-nis-prikaz.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });

  // štampana ponuda (PDF preko print dijaloga)
  el('quote-btn').addEventListener('click', function () {
    var q = el('print-quote');
    el('pq-img').src = canvas.toDataURL('image/png');
    el('pq-model').textContent = state.model.name;
    var w = parseFloat(el('wall-w').value) || 0, h = parseFloat(el('wall-h').value) || 0;
    var open = parseFloat(el('wall-open').value) || 0;
    var net = Math.max(0, w * h - open);
    el('pq-dims').textContent = state.mode === 'wall'
      ? (w.toFixed(1).replace('.', ',') + ' × ' + h.toFixed(1).replace('.', ',') + ' m (otvori: ' + open.toFixed(1).replace('.', ',') + ' m²)')
      : 'prema fotografiji kupca';
    el('pq-area').textContent = el('r-area').textContent;
    el('pq-bricks').textContent = el('r-bricks').textContent;
    el('pq-packs').textContent = el('r-packs').textContent;
    el('pq-price').textContent = el('r-price').textContent;
    el('pq-date').textContent = new Date().toLocaleDateString('sr-RS');
    q.setAttribute('data-active', '1');
    window.print();
  });

  function redraw() {
    if (state.mode === 'wall') drawWall();
    else drawPhoto();
    updateResults();
  }

  setTool('brush');
  redraw();
})();
