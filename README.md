# Dekorativna Cigla Niš — website

Static marketing site for Dekorativna Cigla Niš (decorative plaster-mixture bricks, interior & exterior — own patented designs, own production).

## Pages
| File | Page |
|---|---|
| `index.html` | Home |
| `o-nama.html` | About |
| `portfolio.html` | Portfolio (6 projects) |
| `katalog.html` | Catalogue (9 models + spec table) |
| `kako-radimo.html` | How we work (6 steps + FAQ) |
| `utisci.html` | Testimonials |
| `blog.html` | Blog — 4 articles (install guide, color guide, maintenance, news) |
| `dizajner.html` | **Interactive Designer Studio** (see below) |
| `partneri.html` | Partners / B2B hub + contact form |
| `hvala.html` | Form thank-you page |

## Designer Studio (`js/designer.js`)
Runs 100% client-side (photos never leave the browser):
- **Wall mode:** enter wall width/height and openings → live procedurally-generated brick wall preview, brick count (48/m² +10% reserve), packages, price estimate.
- **Photo mode:** upload/drag a room photo → paint brick texture onto the wall with a brush (eraser, brush size, light-blending opacity), download the result as PNG.
- 7 brick models × 4 grout colors × adjustable grout width.

## Placeholders to replace before launch
- ~~Phone and email~~ — done: +381 61 176 0695 / info@dekorativnacigla.ai / Branislava Nušića 6, Trupale, 18211 Niš.
- Prices in `js/designer.js` (`MODELS[].price`, RSD/m²) and consumption (48 pcs/m²).
- Portfolio/catalogue SVG illustrations → real photos when available (swap `.card-media` contents for `<img>`).
- Testimonials are sample copy — replace with real ones.

## Deploy
Any static host. For Netlify (like mbpforge.com):
```
netlify deploy --dir . --prod
```
The contact form on `partneri.html` already has `data-netlify="true"` — it activates automatically on Netlify (submissions appear in the Netlify dashboard; enable email notifications there). On other hosts, replace the form with a Formspree/mailto action.

## Local preview
```
npx http-server . -p 8137
```
