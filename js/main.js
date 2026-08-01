// Dekorativna Cigla Niš — zajednički skript
(function () {
  // Mobilna navigacija
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
  }

  // Aktivan link u navigaciji
  var page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-nav a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === page) a.classList.add('active');
  });

  // Scroll reveal
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
  }

  // Godina u podnožju
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Lightbox za slike inspiracije (elementi sa data-lightbox atributom)
  var lb = null;
  var gallery = [];   // [{src, caption}]
  var gIndex = 0;
  var gNote = false;

  function buildLightbox() {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML =
      '<button class="lb-close" aria-label="Zatvori">×</button>' +
      '<button class="lb-nav lb-prev" aria-label="Prethodna">‹</button>' +
      '<button class="lb-nav lb-next" aria-label="Sledeća">›</button>' +
      '<figure>' +
        '<div class="lb-counter"></div>' +
        '<img alt="">' +
        '<figcaption></figcaption>' +
        '<div class="lb-note">Ilustrativni prikaz primene — stvarne modele pogledajte u katalogu.</div>' +
        '<div class="lb-thumbs"></div>' +
      '</figure>';
    document.body.appendChild(lb);
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lb-close')) lb.classList.remove('open');
    });
    lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); lbNav(-1); });
    lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); lbNav(1); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') lb.classList.remove('open');
      if (e.key === 'ArrowLeft') lbNav(-1);
      if (e.key === 'ArrowRight') lbNav(1);
    });
  }
  function lbNav(d) {
    if (gallery.length < 2) return;
    gIndex = (gIndex + d + gallery.length) % gallery.length;
    renderLightbox();
  }
  function renderLightbox() {
    var multi = gallery.length > 1;
    lb.querySelector('img').src = gallery[gIndex].src;
    lb.querySelector('figcaption').textContent = gallery[gIndex].caption || '';
    lb.querySelector('.lb-counter').textContent = multi ? (gIndex + 1) + ' / ' + gallery.length : '';
    lb.querySelector('.lb-counter').style.display = multi ? '' : 'none';
    lb.querySelector('.lb-prev').style.display = multi ? '' : 'none';
    lb.querySelector('.lb-next').style.display = multi ? '' : 'none';
    lb.querySelector('.lb-note').style.display = gNote ? '' : 'none';
    var thumbs = lb.querySelector('.lb-thumbs');
    if (multi) {
      thumbs.style.display = '';
      thumbs.innerHTML = '';
      gallery.forEach(function (g, i) {
        var t = document.createElement('button');
        t.className = 'lb-thumb' + (i === gIndex ? ' active' : '');
        t.style.backgroundImage = 'url(' + g.src + ')';
        t.addEventListener('click', function (e) { e.stopPropagation(); gIndex = i; renderLightbox(); });
        thumbs.appendChild(t);
      });
    } else {
      thumbs.style.display = 'none';
    }
  }
  function openLightbox(images, note) {
    if (!lb) buildLightbox();
    gallery = images; gIndex = 0; gNote = !!note;
    renderLightbox();
    lb.classList.add('open');
  }
  document.addEventListener('click', function (e) {
    // Galerija (portfolio): data-gallery="a.webp|b.webp", data-caps="Cap A|Cap B"
    var g = e.target.closest('[data-gallery]');
    if (g) {
      e.preventDefault();
      var srcs = g.getAttribute('data-gallery').split('|');
      var caps = (g.getAttribute('data-caps') || '').split('|');
      openLightbox(srcs.map(function (s, i) { return { src: s.trim(), caption: (caps[i] || caps[0] || '').trim() }; }), false);
      return;
    }
    // Pojedinačna slika (inspiracija/katalog) — sa napomenom da je ilustrativno
    var t = e.target.closest('[data-lightbox]');
    if (t) {
      e.preventDefault();
      openLightbox([{ src: t.getAttribute('data-lightbox'), caption: t.getAttribute('data-caption') }], true);
    }
  });

  // Kontakt forma: na hostingu bez form-backenda (npr. Vercel) šaljemo upit mejlom
  var form = document.querySelector('form[name="kontakt"]');
  if (form && location.hostname.indexOf('netlify') === -1) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { return (form.elements[n] && form.elements[n].value || '').trim(); };
      var body = 'Ime: ' + v('ime') + '\nFirma: ' + v('firma') + '\nEmail: ' + v('email') +
        '\nTelefon: ' + v('telefon') + '\nJavljam se kao: ' + v('tip') + '\n\n' + v('poruka');
      location.href = 'mailto:info@dekorativnaciglanis.ai' +
        '?subject=' + encodeURIComponent('Upit sa sajta — ' + v('tip')) +
        '&body=' + encodeURIComponent(body);
      setTimeout(function () { location.href = 'hvala.html'; }, 800);
    });
  }
})();
