// Dizajner studio — Dekorativna Cigla Niš (v2: foto-teksture, perspektiva, čarobni štapić)
// Sve se izvršava lokalno u pregledaču; fotografije se ne šalju nigde.
(function () {
  'use strict';

  // ---------- Modeli ----------
  // texMeters: koliko metara zida (po širini) pokriva tekstura — kalibrisano prebrojavanjem
  // redova cigala na svakoj fotografiji, da cigla od 24 cm bude iste veličine u svim modelima.
  var MODELS = [
    { id: 'rustik',   name: 'Rustik Crvena',    price: 2400, tex: 'img/tex-rustik.webp',   texMeters: 2.35, bricks: ['#b3562e', '#a54f2b', '#ad5230', '#b85a33', '#9c4a26', '#c06238'] },
    { id: 'antik',    name: 'Antik Bela',       price: 2400, tex: 'img/tex-antik.webp',    texMeters: 1.37, bricks: ['#f2ece2', '#e8e0d3', '#efe8dc', '#f5efe6', '#e4dccf', '#ece3d5'] },
    { id: 'urban',    name: 'Urban Siva',       price: 2400, tex: 'img/tex-urban.webp',    texMeters: 1.66, bricks: ['#6e6a66', '#7d7873', '#666260', '#87817b', '#5e5a57', '#75706b'] },
    { id: 'krem',     name: 'Krem Pastel',      price: 2400, tex: 'img/tex-krem.webp',     texMeters: 1.85, bricks: ['#e0cdbc', '#d6c1ae', '#dbc7b5', '#e5d3c2', '#d1bca9', '#e8d7c7'] },
    { id: 'noir',     name: 'Noir Antracit',    price: 2600, tex: 'img/tex-noir.webp',     texMeters: 1.27, bricks: ['#1e1a17', '#2b2622', '#26211d', '#332d28', '#1a1613', '#38322c'] },
    { id: 'braon',    name: 'Braon Klasik (fasadna)', price: 2900, tex: 'img/tex-braon.webp', texMeters: 1.56, bricks: ['#8a5a3b', '#7d5136', '#936043', '#84573a', '#75492f', '#9a6847'] },
    { id: 'terakota', name: 'Terakota Intenziv (fasadna)', price: 2900, tex: 'img/tex-terakota.webp', texMeters: 1.07, bricks: ['#c9401f', '#b53a1e', '#d04a26', '#bd3d20', '#a83619', '#d6522d'] }
  ];
  var FUGAS = [
    { id: 'pesak', name: 'Peskirana bež', color: '#d9cfc4' },
    { id: 'bela',  name: 'Bela',          color: '#f2efe9' },
    { id: 'siva',  name: 'Siva',          color: '#a8a29a' },
    { id: 'tamna', name: 'Antracit',      color: '#4a4540' }
  ];
  var PHOTO_WALL_M = 4; // pretpostavljena širina prizora na fotografiji (koriguje se klizačem)
  var PRESETS = [
    { file: 'img/soba-dnevna.webp',  label: 'Dnevna soba' },
    { file: 'img/soba-spavaca.webp', label: 'Spavaća soba' },
    { file: 'img/soba-kafic.webp',   label: 'Kafić' },
    { file: 'img/soba-fasada.webp',  label: 'Fasada' }
  ];
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
    smart: true,             // pametna četkica: boji samo piksele slične boji zida
    photo: null,
    quad: null,              // [{x,y}×4] TL,TR,BR,BL
    dragIdx: -1,
    refColor: null           // boja zida uzorkovana na početku poteza
  };
  var photoData = null;      // pikseli fotografije (za pametnu četkicu / štapić)
  var gradMap = null;        // mapa ivica (za štapić koji staje na ivicama objekata)
  var aiMask = null;         // Ciglićeva maska zida — sve slikanje se ograničava na nju

  var canvas = document.getElementById('studio-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var mask = document.createElement('canvas');
  var maskCtx = mask.getContext('2d');
  var undoStack = [], redoStack = [];

  // ---------- Teksture (mirror-tile za bešavno ponavljanje) ----------
  // Svaka kombinacija modela i boje fuge ima svoju foto-teksturu:
  // img/tex-{model}-{fuga}.webp  (npr. tex-rustik-bela.webp)
  var texCache = {};   // "model-fuga" -> {img, tile}
  function texUrl(model, fuga) { return 'img/tex-' + model.id + '-' + fuga.id + '.webp'; }
  function getTexture(model, fuga, onReady) {
    var key = model.id + '-' + fuga.id;
    var c = texCache[key];
    if (c) { if (c.tile) return c; if (onReady) c.cbs.push(onReady); return null; }
    c = texCache[key] = { img: null, tile: null, cbs: onReady ? [onReady] : [] };
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
    img.src = texUrl(model, fuga);
    return null;
  }

  function seeded(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // ---------- Šematski (proceduralni) tile ----------
  function buildTile(model, fugaColor, fugaPx, scale) {
    var bw = Math.round(96 * scale), bh = Math.round(24 * scale); // 24×6 cm → odnos 4:1
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
      var tex = getTexture(state.model, state.fuga, redraw);
      if (tex) {
        var s = pxPerM * state.model.texMeters / tex.img.width;
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

  // Redosled klikova ne sme da menja smer cigle: tačke uvek sortiramo u TL,TR,BR,BL
  function normalizeQuad(q) {
    if (!q || q.length !== 4) return q;
    var pts = q.slice();
    function take(score) {
      var best = 0;
      for (var i = 1; i < pts.length; i++) if (score(pts[i]) > score(pts[best])) best = i;
      return pts.splice(best, 1)[0];
    }
    var tl = take(function (p) { return -(p.x + p.y); });
    var br = take(function (p) { return p.x + p.y; });
    var tr = take(function (p) { return p.x - p.y; });
    var bl = pts[0];
    return [tl, tr, br, bl];
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

    var tex = getTexture(state.model, state.fuga, redraw);
    var brickLayer = document.createElement('canvas');
    brickLayer.width = w; brickLayer.height = h;
    var bg = brickLayer.getContext('2d');

    var useTex = state.render === 'real' && tex;
    var tileImg = useTex ? tex.tile : buildTile(state.model, state.fuga.color, state.fugaMm, 0.5);
    var texW = useTex ? tex.img.width : tileImg.width;
    var texM = useTex ? state.model.texMeters : 0.5; // šematski tile = 2 cigle ≈ 0,5 m
    // fizička kalibracija: pretpostavljamo da fotografija prikazuje ~4 m širine prizora
    var pxPerM2 = w / PHOTO_WALL_M;
    var baseScale = pxPerM2 * texM / texW * state.texScale;

    if (state.quad && state.quad.length === 4) {
      var q = state.quad;
      var flat = document.createElement('canvas');
      flat.width = 1200; flat.height = 900;
      var fg = flat.getContext('2d');
      // veličina cigle u flat prostoru tako da posle preslikavanja na quad ostane fizički tačna
      var avgW = (Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) + Math.hypot(q[2].x - q[3].x, q[2].y - q[3].y)) / 2 || 1;
      var pat = fg.createPattern(tileImg, 'repeat');
      if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(baseScale * flat.width / avgW));
      fg.fillStyle = pat; fg.fillRect(0, 0, flat.width, flat.height);
      warpToQuad(bg, flat, q);
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
    // keširaj piksele i mapu ivica za pametne alate
    photoData = null; gradMap = null; aiMask = null;
    try {
      var ref = document.createElement('canvas');
      ref.width = cw; ref.height = ch;
      var rg = ref.getContext('2d');
      rg.drawImage(img, 0, 0, cw, ch);
      photoData = rg.getImageData(0, 0, cw, ch).data;
      gradMap = new Uint8Array(cw * ch);
      for (var y = 0; y < ch - 1; y++) {
        for (var x = 0; x < cw - 1; x++) {
          var i = (y * cw + x) * 4;
          var l = photoData[i] * 0.3 + photoData[i + 1] * 0.59 + photoData[i + 2] * 0.11;
          var ir = i + 4, id = i + cw * 4;
          var lr = photoData[ir] * 0.3 + photoData[ir + 1] * 0.59 + photoData[ir + 2] * 0.11;
          var ld = photoData[id] * 0.3 + photoData[id + 1] * 0.59 + photoData[id + 2] * 0.11;
          gradMap[y * cw + x] = Math.min(255, Math.abs(l - lr) + Math.abs(l - ld));
        }
      }
    } catch (e) { /* CORS i sl. — alati rade bez pameti */ }
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

  // ---------- AI prepoznavanje zida (semantička segmentacija u pregledaču) ----------
  var segmenter = null, segLoading = false;
  var WALL_LABELS = { wall: 1, building: 1, house: 1 };
  function aiDetectWall() {
    if (!state.photo || segLoading) return;
    var status = el('ai-status');
    segLoading = true;
    el('ai-wall').disabled = true;
    status.textContent = segmenter ? 'Ciglić analizira fotografiju…' : 'Ciglić se sprema (prvi put preuzima ~20 MB)…';
    var run = function () {
      // fotografiju smanjujemo radi brzine
      var s = document.createElement('canvas');
      var sw = 512, sh = Math.round(512 * canvas.height / canvas.width);
      s.width = sw; s.height = sh;
      s.getContext('2d').drawImage(state.photo, 0, 0, sw, sh);
      segmenter(s.toDataURL('image/jpeg', 0.9)).then(function (segments) {
        var found = false;
        snapshot();
        var m = document.createElement('canvas');
        m.width = sw; m.height = sh;
        var mg = m.getContext('2d');
        var out = mg.createImageData(sw, sh);
        segments.forEach(function (seg) {
          if (!WALL_LABELS[seg.label]) return;
          found = true;
          var md = seg.mask.data;
          for (var i = 0; i < md.length; i++) {
            if (md[i] > 128) {
              var o = i * 4;
              out.data[o] = 255; out.data[o + 1] = 255; out.data[o + 2] = 255; out.data[o + 3] = 255;
            }
          }
        });
        if (found) {
          mg.putImageData(out, 0, 0);
          // zapamti Ciglićevu masku zida — od sada se svako slikanje drži zida
          aiMask = document.createElement('canvas');
          aiMask.width = mask.width; aiMask.height = mask.height;
          aiMask.getContext('2d').drawImage(m, 0, 0, mask.width, mask.height);
          maskCtx.clearRect(0, 0, mask.width, mask.height);
          maskCtx.drawImage(aiMask, 0, 0);
          status.textContent = 'Ciglić je označio zid! Od sada četkica i uglovi rade samo po zidu. Doterajte po potrebi.';
        } else {
          status.textContent = 'Ciglić nije prepoznao zid na ovoj fotografiji — označite ga štapićem ili četkicom.';
        }
        segLoading = false;
        el('ai-wall').disabled = false;
        drawPhoto();
      }).catch(function () {
        status.textContent = 'Ciglićeva analiza nije uspela — koristite štapić ili četkicu.';
        segLoading = false;
        el('ai-wall').disabled = false;
      });
    };
    if (segmenter) { run(); return; }
    import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm').then(function (tf) {
      return tf.pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512');
    }).then(function (p) {
      segmenter = p;
      status.textContent = 'Ciglić analizira fotografiju…';
      run();
    }).catch(function () {
      status.textContent = 'Ciglić trenutno nije dostupan — koristite štapić ili četkicu.';
      segLoading = false;
      el('ai-wall').disabled = false;
    });
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
    var EDGE = 30; // štapić ne prelazi preko izraženih ivica (granica zida i objekata)
    while (stack.length) {
      var idx = stack.pop();
      var x = idx % w, y = (idx / w) | 0;
      var di = idx * 4;
      var dr = data[di] - r0, dg = data[di + 1] - g0, db = data[di + 2] - b0;
      if (dr * dr + dg * dg + db * db > tol) continue;
      if (gradMap && gradMap[idx] > EDGE) continue;
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
    var bricks = Math.ceil(net * 57 * 1.1); // ~57 kom/m² (format 24×6 cm, fuga ~1 cm) + 10% rezerve
    var packs = Math.ceil(net * 1.1);
    var price = Math.round(net * state.model.price);
    el('r-area').textContent = net.toFixed(1).replace('.', ',') + ' m²';
    el('r-bricks').textContent = net > 0 ? bricks.toLocaleString('sr-RS') : '—';
    el('r-packs').textContent = net > 0 ? packs : '—';
    el('r-price').textContent = net > 0 ? '~' + price.toLocaleString('sr-RS') + ' RSD' : '—';
  }

  // Kad Ciglić zna gde je zid, sve što se naslika ograničava se na zid —
  // cigla ne može da završi na nameštaju čak ni kad potez pređe preko njega.
  function clipToWall() {
    if (!aiMask) return;
    maskCtx.globalCompositeOperation = 'destination-in';
    maskCtx.drawImage(aiMask, 0, 0);
    maskCtx.globalCompositeOperation = 'source-over';
  }

  // Kad su 4 ugla postavljena, označeni deo zida odmah dobija ciglu
  function fillQuadMask() {
    if (!state.quad || state.quad.length !== 4) return;
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = '#fff';
    maskCtx.beginPath();
    maskCtx.moveTo(state.quad[0].x, state.quad[0].y);
    for (var i = 1; i < 4; i++) maskCtx.lineTo(state.quad[i].x, state.quad[i].y);
    maskCtx.closePath();
    maskCtx.fill();
    clipToWall();
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
    var erase = state.tool === 'erase';
    // Pametna četkica: boji samo piksele slične boji zida na kojoj je potez počeo,
    // pa cigla ne prelazi preko nameštaja, biljaka i drugih objekata.
    if (!erase && state.smart && photoData && state.refColor) {
      var w = mask.width, h = mask.height, R = state.brush;
      var x0 = Math.max(0, Math.round(p.x - R)), y0 = Math.max(0, Math.round(p.y - R));
      var x1 = Math.min(w - 1, Math.round(p.x + R)), y1 = Math.min(h - 1, Math.round(p.y + R));
      if (x1 <= x0 || y1 <= y0) return;
      var region = maskCtx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
      var rd = region.data, rw = x1 - x0 + 1;
      var tol = state.tolerance * state.tolerance * 3;
      var rc = state.refColor;
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          var dx = x - p.x, dy = y - p.y;
          if (dx * dx + dy * dy > R * R) continue;
          var pi = (y * w + x) * 4;
          var dr = photoData[pi] - rc[0], dg = photoData[pi + 1] - rc[1], db = photoData[pi + 2] - rc[2];
          if (dr * dr + dg * dg + db * db > tol) continue;
          var ri = ((y - y0) * rw + (x - x0)) * 4;
          rd[ri] = 255; rd[ri + 1] = 255; rd[ri + 2] = 255; rd[ri + 3] = 255;
        }
      }
      maskCtx.putImageData(region, x0, y0);
      clipToWall();
      return;
    }
    maskCtx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    maskCtx.fillStyle = '#fff';
    maskCtx.beginPath();
    maskCtx.arc(p.x, p.y, state.brush, 0, Math.PI * 2);
    maskCtx.fill();
    if (!erase) clipToWall();
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
      if (state.quad.length < 4) {
        state.quad.push(p);
        if (state.quad.length === 4) {
          state.quad = normalizeQuad(state.quad);
          snapshot();
          fillQuadMask();
        }
        drawPhoto();
      }
      return;
    }
    if (state.tool === 'wand') { snapshot(); wand(p.x, p.y); clipToWall(); drawPhoto(); return; }
    // uzorkuj boju zida na početku poteza (za pametnu četkicu)
    if (photoData) {
      var si = (Math.round(p.y) * mask.width + Math.round(p.x)) * 4;
      state.refColor = [photoData[si], photoData[si + 1], photoData[si + 2]];
    }
    snapshot(); painting = true; paint(p); drawPhoto();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (state.mode !== 'photo' || !state.photo) return;
    var p = canvasPos(e);
    if (state.dragIdx >= 0) { state.quad[state.dragIdx] = p; drawPhoto(); return; }
    if (painting) { paint(p); drawPhoto(); }
  });
  window.addEventListener('pointerup', function () {
    painting = false;
    if (state.dragIdx >= 0 && state.quad && state.quad.length === 4) {
      state.quad = normalizeQuad(state.quad);
      fillQuadMask();
      drawPhoto();
    }
    state.dragIdx = -1;
  });
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
    var thumb = texUrl(m, FUGAS[0]);
    var probe = new Image();
    probe.onload = function () { b.style.background = 'url(' + thumb + ') center/cover'; };
    probe.src = thumb;
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

  // Debljina fuge se vidi samo u šematskom prikazu (kod foto-teksture je debljina snimljena).
  // Boja fuge, međutim, RADI i u realnom prikazu — učitava odgovarajuću foto-teksturu.
  function ensureSchematic() {
    if (state.render === 'schematic') return;
    var radio = document.querySelector('input[name="render-mode"][value="schematic"]');
    if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
  }

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
      redraw(); // boja fuge radi i u realnom i u šematskom prikazu
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
    ensureSchematic();
    redraw();
  });
  el('smart-brush').addEventListener('change', function (e) { state.smart = e.target.checked; });
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
      // Boja fuge je uvek aktivna; samo debljina fuge zavisi od šematskog prikaza.
      el('fuga-w-wrap').style.opacity = (state.render === 'real') ? '.45' : '1';
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
    el('tolerance-wrap').style.display = (t === 'wand' || t === 'brush') ? '' : 'none';
    el('smart-wrap').style.display = t === 'brush' ? '' : 'none';
    el('corners-help').style.display = t === 'corners' ? '' : 'none';
    drawPhoto();
  }
  el('ai-wall').addEventListener('click', aiDetectWall);
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
