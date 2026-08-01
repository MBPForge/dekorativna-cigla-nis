// Dizajner studio — Dekorativna Cigla Niš
// Sve se izvršava lokalno u pregledaču; fotografije se ne šalju nigde.
(function () {
  'use strict';

  // ---------- Modeli cigli (boje i okvirna cena po m²) ----------
  var MODELS = [
    { id: 'rustik',   name: 'Rustik Crvena',    price: 2400, bricks: ['#b3562e', '#a54f2b', '#ad5230', '#b85a33', '#9c4a26', '#c06238'] },
    { id: 'antik',    name: 'Antik Bela',       price: 2400, bricks: ['#f2ece2', '#e8e0d3', '#efe8dc', '#f5efe6', '#e4dccf', '#ece3d5'] },
    { id: 'urban',    name: 'Urban Siva',       price: 2400, bricks: ['#6e6a66', '#7d7873', '#666260', '#87817b', '#5e5a57', '#75706b'] },
    { id: 'krem',     name: 'Krem Pastel',      price: 2400, bricks: ['#e0cdbc', '#d6c1ae', '#dbc7b5', '#e5d3c2', '#d1bca9', '#e8d7c7'] },
    { id: 'noir',     name: 'Noir Antracit',    price: 2600, bricks: ['#1e1a17', '#2b2622', '#26211d', '#332d28', '#1a1613', '#38322c'] },
    { id: 'braon',    name: 'Braon Klasik (fasadna)', price: 2900, bricks: ['#8a5a3b', '#7d5136', '#936043', '#84573a', '#75492f', '#9a6847'] },
    { id: 'terakota', name: 'Terakota Intenziv (fasadna)', price: 2900, bricks: ['#c9401f', '#b53a1e', '#d04a26', '#bd3d20', '#a83619', '#d6522d'] }
  ];
  var FUGAS = [
    { id: 'pesak', name: 'Peskirana bež', color: '#d9cfc4' },
    { id: 'bela',  name: 'Bela',          color: '#f2efe9' },
    { id: 'siva',  name: 'Siva',          color: '#a8a29a' },
    { id: 'tamna', name: 'Antracit',      color: '#4a4540' }
  ];

  var state = {
    mode: 'wall',           // 'wall' | 'photo'
    model: MODELS[0],
    fuga: FUGAS[0],
    fugaMm: 10,
    brush: 40,
    tool: 'brush',          // 'brush' | 'erase'
    opacity: 0.85,
    photo: null             // Image
  };

  var canvas = document.getElementById('studio-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  // Maska za foto-režim (belo = obojeno ciglom)
  var mask = document.createElement('canvas');
  var maskCtx = mask.getContext('2d');
  var patternCache = null;

  // ---------- Deterministički šum (da zid uvek izgleda isto) ----------
  function seeded(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------- Generisanje teksture cigle ----------
  // Vraća offscreen canvas sa jednim "tile"-om sloga (2 reda), spreman za createPattern.
  function buildTile(model, fugaColor, fugaPx, scale) {
    var bw = Math.round(96 * scale);          // širina cigle u px
    var bh = Math.round(22 * scale);          // visina cigle u px
    var f = Math.max(2, Math.round(fugaPx * scale));
    var tileW = (bw + f) * 2;
    var tileH = (bh + f) * 2;
    var t = document.createElement('canvas');
    t.width = tileW; t.height = tileH;
    var g = t.getContext('2d');

    g.fillStyle = fugaColor;
    g.fillRect(0, 0, tileW, tileH);

    var n = 0;
    function brick(x, y) {
      var col = model.bricks[Math.floor(seeded(n) * model.bricks.length)];
      n++;
      g.fillStyle = col;
      roundRect(g, x, y, bw, bh, 2 * scale);
      // blaga tekstura: par tamnijih tačkica
      g.save();
      g.globalAlpha = 0.12;
      g.fillStyle = '#000';
      for (var d = 0; d < 14; d++) {
        var px = x + seeded(n * 13 + d) * bw;
        var py = y + seeded(n * 29 + d) * bh;
        g.fillRect(px, py, 1.5 * scale, 1.5 * scale);
      }
      // svetliji gornji rub — utisak reljefa
      g.globalAlpha = 0.15;
      g.fillStyle = '#fff';
      g.fillRect(x, y, bw, 2 * scale);
      g.restore();
    }
    function roundRect(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.fill();
    }

    // red 1 (pun), red 2 (smaknut za pola)
    var y1 = f / 2, y2 = y1 + bh + f;
    for (var x = -(bw + f); x < tileW + bw; x += bw + f) {
      brick(x + f / 2, y1);
      brick(x + f / 2 + (bw + f) / 2, y2);
    }
    return t;
  }

  function getPattern(scale) {
    patternCache = ctx.createPattern(buildTile(state.model, state.fuga.color, state.fugaMm, scale), 'repeat');
    return patternCache;
  }

  // ---------- Režim: simulacija zida ----------
  function drawWall() {
    var w = parseFloat(document.getElementById('wall-w').value) || 4;
    var h = parseFloat(document.getElementById('wall-h').value) || 2.6;

    // canvas srazmeran zidu (max 900x560)
    var ratio = w / h;
    var cw = 900, ch = Math.round(900 / ratio);
    if (ch > 560) { ch = 560; cw = Math.round(560 * ratio); }
    canvas.width = cw; canvas.height = ch;

    // razmera: koliko px ima 1 m (cigla 24cm -> bw 96px pri scale=1 znači 1m ≈ 400px*scale... )
    // Držimo prirodnu veličinu cigle: 24 cm + fuga = vidljivo na zidu
    var pxPerM = cw / w;
    var scale = pxPerM * 0.25 / 96; // cigla od 24cm+fuga treba da bude ~0.25m široka

    ctx.fillStyle = '#eee';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = getPattern(Math.max(0.15, scale));
    ctx.fillRect(0, 0, cw, ch);

    // vinjeta radi dubine
    var grad = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) / 2, cw / 2, ch / 2, Math.max(cw, ch));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    updateResults();
  }

  // ---------- Proračun ----------
  function updateResults() {
    var w = parseFloat(document.getElementById('wall-w').value) || 0;
    var h = parseFloat(document.getElementById('wall-h').value) || 0;
    var open = parseFloat(document.getElementById('wall-open').value) || 0;
    var net = Math.max(0, w * h - open);
    var bricks = Math.ceil(net * 48 * 1.1);
    var packs = Math.ceil(net * 1.1);
    var price = Math.round(net * state.model.price);

    document.getElementById('r-area').textContent = net.toFixed(1).replace('.', ',') + ' m²';
    document.getElementById('r-bricks').textContent = net > 0 ? bricks.toLocaleString('sr-RS') : '—';
    document.getElementById('r-packs').textContent = net > 0 ? packs : '—';
    document.getElementById('r-price').textContent = net > 0 ? '~' + price.toLocaleString('sr-RS') + ' RSD' : '—';
  }

  // ---------- Režim: fotografija ----------
  function drawPhoto() {
    if (!state.photo) {
      canvas.width = 900; canvas.height = 560;
      ctx.fillStyle = '#f0ebe4';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#8a7c70';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Otpremite fotografiju svoje prostorije (levo)', canvas.width / 2, canvas.height / 2 - 12);
      ctx.fillText('pa četkicom pređite preko zida koji želite u cigli', canvas.width / 2, canvas.height / 2 + 20);
      return;
    }
    // fotografija
    ctx.drawImage(state.photo, 0, 0, canvas.width, canvas.height);

    // sloj cigle kroz masku
    var layer = document.createElement('canvas');
    layer.width = canvas.width; layer.height = canvas.height;
    var lg = layer.getContext('2d');
    lg.fillStyle = lg.createPattern(buildTile(state.model, state.fuga.color, state.fugaMm, 0.5), 'repeat');
    lg.fillRect(0, 0, layer.width, layer.height);
    lg.globalCompositeOperation = 'destination-in';
    lg.drawImage(mask, 0, 0);

    // multiply preko fotografije čuva senke i svetlo prostorije
    ctx.save();
    ctx.globalAlpha = state.opacity;
    ctx.drawImage(layer, 0, 0);
    ctx.globalAlpha = Math.min(0.5, 1 - state.opacity + 0.25);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(state.photo, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function loadPhoto(file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
    var img = new Image();
    img.onload = function () {
      state.photo = img;
      // canvas u razmeri fotografije (max 900 x 620)
      var ratio = img.width / img.height;
      var cw = 900, ch = Math.round(900 / ratio);
      if (ch > 620) { ch = 620; cw = Math.round(620 * ratio); }
      canvas.width = cw; canvas.height = ch;
      mask.width = cw; mask.height = ch;
      maskCtx = mask.getContext('2d');
      maskCtx.clearRect(0, 0, cw, ch);
      drawPhoto();
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  // ---------- Crtanje četkicom ----------
  var painting = false;
  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: cx * canvas.width / r.width, y: cy * canvas.height / r.height };
  }
  function paint(e) {
    if (state.mode !== 'photo' || !state.photo) return;
    var p = canvasPos(e);
    maskCtx.globalCompositeOperation = state.tool === 'erase' ? 'destination-out' : 'source-over';
    maskCtx.fillStyle = '#fff';
    maskCtx.beginPath();
    maskCtx.arc(p.x, p.y, state.brush, 0, Math.PI * 2);
    maskCtx.fill();
    drawPhoto();
  }
  canvas.addEventListener('pointerdown', function (e) { painting = true; paint(e); });
  canvas.addEventListener('pointermove', function (e) { if (painting) paint(e); });
  window.addEventListener('pointerup', function () { painting = false; });
  canvas.addEventListener('touchmove', function (e) { if (painting) e.preventDefault(); }, { passive: false });

  // ---------- UI: swatchevi ----------
  var modelRow = document.getElementById('model-swatches');
  MODELS.forEach(function (m, i) {
    var b = document.createElement('button');
    b.className = 'swatch' + (i === 0 ? ' selected' : '');
    b.type = 'button';
    b.title = m.name;
    b.setAttribute('aria-label', m.name);
    b.style.background = 'linear-gradient(135deg, ' + m.bricks[0] + ' 50%, ' + m.bricks[3] + ' 50%)';
    b.addEventListener('click', function () {
      state.model = m;
      modelRow.querySelectorAll('.swatch').forEach(function (s) { s.classList.remove('selected'); });
      b.classList.add('selected');
      document.getElementById('model-name').textContent = 'Izabrano: ' + m.name + ' — oko ' + m.price.toLocaleString('sr-RS') + ' RSD/m²';
      redraw();
    });
    modelRow.appendChild(b);
  });
  document.getElementById('model-name').textContent = 'Izabrano: ' + MODELS[0].name + ' — oko ' + MODELS[0].price.toLocaleString('sr-RS') + ' RSD/m²';

  var fugaRow = document.getElementById('fuga-swatches');
  FUGAS.forEach(function (f, i) {
    var b = document.createElement('button');
    b.className = 'swatch' + (i === 0 ? ' selected' : '');
    b.type = 'button';
    b.title = f.name;
    b.setAttribute('aria-label', 'Fuga: ' + f.name);
    b.style.background = f.color;
    b.addEventListener('click', function () {
      state.fuga = f;
      fugaRow.querySelectorAll('.swatch').forEach(function (s) { s.classList.remove('selected'); });
      b.classList.add('selected');
      redraw();
    });
    fugaRow.appendChild(b);
  });

  // ---------- UI: kontrole ----------
  ['wall-w', 'wall-h', 'wall-open'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', redraw);
  });
  document.getElementById('fuga-w').addEventListener('input', function (e) {
    state.fugaMm = parseInt(e.target.value, 10);
    document.getElementById('fuga-w-val').textContent = state.fugaMm;
    redraw();
  });
  document.getElementById('brush-size').addEventListener('input', function (e) {
    state.brush = parseInt(e.target.value, 10);
    document.getElementById('brush-size-val').textContent = state.brush;
  });
  document.getElementById('overlay-op').addEventListener('input', function (e) {
    state.opacity = parseInt(e.target.value, 10) / 100;
    document.getElementById('overlay-op-val').textContent = e.target.value;
    if (state.mode === 'photo') drawPhoto();
  });

  document.getElementById('brush-mode').addEventListener('click', function () { setTool('brush'); });
  document.getElementById('erase-mode').addEventListener('click', function () { setTool('erase'); });
  function setTool(t) {
    state.tool = t;
    document.getElementById('brush-mode').className = t === 'brush' ? 'btn btn-dark' : 'btn btn-light-outline';
    document.getElementById('erase-mode').className = t === 'erase' ? 'btn btn-dark' : 'btn btn-light-outline';
  }
  document.getElementById('clear-mask').addEventListener('click', function () {
    maskCtx.clearRect(0, 0, mask.width, mask.height);
    drawPhoto();
  });

  // ---------- Upload fotografije ----------
  var drop = document.getElementById('drop-zone');
  var fileInput = document.getElementById('photo-input');
  drop.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { loadPhoto(fileInput.files[0]); });
  drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
  drop.addEventListener('drop', function (e) {
    e.preventDefault(); drop.classList.remove('drag');
    if (e.dataTransfer.files.length) loadPhoto(e.dataTransfer.files[0]);
  });

  // ---------- Tabovi ----------
  var tabWall = document.getElementById('tab-wall');
  var tabPhoto = document.getElementById('tab-photo');
  tabWall.addEventListener('click', function () { setMode('wall'); });
  tabPhoto.addEventListener('click', function () { setMode('photo'); });
  function setMode(m) {
    state.mode = m;
    tabWall.classList.toggle('active', m === 'wall');
    tabPhoto.classList.toggle('active', m === 'photo');
    document.getElementById('panel-photo').style.display = m === 'photo' ? '' : 'none';
    document.getElementById('panel-dims').style.display = m === 'wall' ? '' : 'none';
    redraw();
  }

  // ---------- Preuzimanje ----------
  document.getElementById('download-btn').addEventListener('click', function () {
    var a = document.createElement('a');
    a.download = 'dekorativna-cigla-nis-prikaz.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });

  function redraw() {
    if (state.mode === 'wall') drawWall();
    else drawPhoto();
    updateResults();
  }

  redraw();
})();
