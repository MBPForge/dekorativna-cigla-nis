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
