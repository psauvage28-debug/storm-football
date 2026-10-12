// Export statique du site (Netlify en production, GitHub Pages pour l'aperçu).
// Usage : node scripts/export-static.js   (sur Netlify, l'URL du site vient de la variable URL)
//         BASE_PATH=/storm-football SITE_ORIGIN=https://user.github.io node scripts/export-static.js
// Le formulaire de contact est confié à Netlify Forms (aucune clé ni mot de passe dans le site).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { routes } = require('../src/i18n');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const ORIGIN = (process.env.SITE_ORIGIN || process.env.URL || 'http://localhost').replace(/\/+$/, '');
const PORT = 3199;

const prefix = (html) => html
  .replace(/(=")\/(?!\/)/g, `$1${BASE}/`)                       // href, src, poster, action, data-*
  .replace(/(srcset="[^"]*")/g, (m) => m.replace(/(,\s*)\/(?!\/)/g, `$1${BASE}/`))
  .replace(/("full":")\/(?!\/)/g, `$1${BASE}/`);                 // données JSON de la galerie

// Formulaire de contact -> Netlify Forms (détecté au déploiement, honeypot "website")
const netlifyForm = (html, pagePath) => html
  .replace('data-form novalidate action="/api/contact" method="post"',
    `data-form data-static name="contact" data-netlify="true" netlify-honeypot="website" novalidate action="${pagePath}" method="post"`)
  .replace('<input type="hidden" name="lang"', '<input type="hidden" name="form-name" value="contact">\n        <input type="hidden" name="lang"');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, f.name);
    const d = path.join(dst, f.name);
    if (f.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'public'), OUT);

  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, env: { ...process.env, PORT, NODE_ENV: 'development', SITE_URL: ORIGIN + BASE }, stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 50; i++) {
      try { await fetch(`http://localhost:${PORT}/robots.txt`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    const urls = [...new Set(Object.values(routes).flatMap((r) => Object.values(r)))];
    for (const u of urls) {
      const html = await (await fetch(`http://localhost:${PORT}${u}`)).text();
      const file = path.join(OUT, u === '/' ? '' : u, 'index.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, prefix(netlifyForm(html, u)));
    }
    const notFound = await (await fetch(`http://localhost:${PORT}/__404__`)).text();
    fs.writeFileSync(path.join(OUT, '404.html'), prefix(notFound));
    for (const f of ['sitemap.xml', 'robots.txt']) {
      fs.writeFileSync(path.join(OUT, f), await (await fetch(`http://localhost:${PORT}/${f}`)).text());
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'site.webmanifest'), 'utf8'));
    manifest.start_url = `${BASE}/`;
    manifest.icons.forEach((i) => { i.src = BASE + i.src; });
    fs.writeFileSync(path.join(OUT, 'site.webmanifest'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
    console.log(`Export OK : ${urls.length} pages dans dist/`);
  } finally {
    server.kill();
  }
})();
