require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { t, routes, alternate } = require('./src/i18n');
const { sendContact, validateContact } = require('./src/contact');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const GA_ID = process.env.GA_ID || '';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Force HTTPS (derrière le proxy de l'hébergeur) + domaine canonique
if (IS_PROD) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    next();
  });
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://www.googletagmanager.com'],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      styleSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://www.google-analytics.com', 'https://www.googletagmanager.com'],
      connectSrc: ["'self'", 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.googletagmanager.com'],
      mediaSrc: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: IS_PROD ? [] : null,
    },
  },
  hsts: IS_PROD ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '20kb' }));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: IS_PROD ? '30d' : 0,
  setHeaders(res, file) {
    if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// Variables communes à toutes les vues
function render(res, view, lang, key, extra = {}, status = 200) {
  const tr = t(lang);
  const meta = tr.meta[key];
  res.status(status).render(view, {
    pageTitle: Array.isArray(meta) ? meta[0] : undefined,
    pageDescription: Array.isArray(meta) ? meta[1] : undefined,
    langUrls: { fr: routes.fr[key || 'home'], en: routes.en[key || 'home'] },
    lang, tr, key, routes: routes[lang], SITE_URL, GA_ID,
    canonical: `${SITE_URL}${routes[lang][key] || ''}`,
    alternates: key ? alternate(key, SITE_URL) : null,
    switchUrl: routes[lang === 'fr' ? 'en' : 'fr'][key || 'home'],
    year: new Date().getFullYear(),
    ...extra,
  });
}

const pages = [
  ['home', 'pages/home'],
  ['services', 'pages/services'],
  ['work', 'pages/work'],
  ['contact', 'pages/contact'],
  ['legal', 'pages/legal'],
  ['privacy', 'pages/privacy'],
  ['terms', 'pages/terms'],
];
for (const lang of ['fr', 'en']) {
  for (const [key, view] of pages) {
    app.get(routes[lang][key], (req, res) => render(res, view, lang, key));
  }
}
// /en/ -> /en (une seule URL par page)
app.get('/en/', (req, res) => res.redirect(301, '/en'));

// API contact : la logique d'envoi et les identifiants SMTP restent côté serveur
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { ok: false, error: 'rate' },
});
app.post('/api/contact', contactLimiter, async (req, res) => {
  const body = req.body || {};
  // Anti-spam : champ piège + délai minimal de remplissage
  const elapsed = Date.now() - Number(body.ts || 0);
  if (body.website || !body.ts || elapsed < 3000 || elapsed > 1000 * 60 * 60 * 6) {
    return res.json({ ok: true }); // on ne dit rien au robot
  }
  const { errors, data } = validateContact(body);
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });
  try {
    await sendContact(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('[contact] envoi échoué :', err.message);
    res.status(502).json({ ok: false, error: 'send' });
  }
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = pages.map(([key]) => {
    const alts = alternate(key, SITE_URL);
    return ['fr', 'en'].map((lang) => `  <url>
    <loc>${SITE_URL}${routes[lang][key]}</loc>
    <lastmod>${today}</lastmod>
    <priority>${key === 'home' ? '1.0' : ['services', 'work', 'contact'].includes(key) ? '0.8' : '0.3'}</priority>
${alts.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`).join('\n')}
  </url>`).join('\n');
  }).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`);
});

// 404 personnalisée
app.use((req, res) => {
  const lang = req.path.startsWith('/en') ? 'en' : 'fr';
  render(res, 'pages/404', lang, null, { noindex: true }, 404);
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).send('Erreur serveur');
});

app.listen(PORT, () => console.log(`STORM en ligne sur ${SITE_URL}`));
