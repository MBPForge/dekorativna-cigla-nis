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
  function openLightbox(src, caption) {
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML = '<button class="lb-close" aria-label="Zatvori">×</button>' +
        '<figure><img alt=""><figcaption></figcaption>' +
        '<div class="lb-note">Ilustrativni prikaz primene — stvarne modele pogledajte u katalogu.</div></figure>';
      document.body.appendChild(lb);
      lb.addEventListener('click', function (e) {
        if (e.target !== lb.querySelector('figcaption')) lb.classList.remove('open');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') lb.classList.remove('open');
      });
    }
    lb.querySelector('img').src = src;
    lb.querySelector('figcaption').textContent = caption || '';
    lb.classList.add('open');
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-lightbox]');
    if (t) { e.preventDefault(); openLightbox(t.getAttribute('data-lightbox'), t.getAttribute('data-caption')); }
  });

  // Kontakt forma: na hostingu bez form-backenda (npr. Vercel) šaljemo upit mejlom
  var form = document.querySelector('form[name="kontakt"]');
  if (form && location.hostname.indexOf('netlify') === -1) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { return (form.elements[n] && form.elements[n].value || '').trim(); };
      var body = 'Ime: ' + v('ime') + '\nFirma: ' + v('firma') + '\nEmail: ' + v('email') +
        '\nTelefon: ' + v('telefon') + '\nJavljam se kao: ' + v('tip') + '\n\n' + v('poruka');
      location.href = 'mailto:info@dekorativnacigla.rs' +
        '?subject=' + encodeURIComponent('Upit sa sajta — ' + v('tip')) +
        '&body=' + encodeURIComponent(body);
      setTimeout(function () { location.href = 'hvala.html'; }, 800);
    });
  }
})();
