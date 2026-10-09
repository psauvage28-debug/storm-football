// Export statique du site (aperçu sur GitHub Pages).
// Usage : BASE_PATH=/storm-football SITE_ORIGIN=https://user.github.io node scripts/export-static.js
// Le formulaire de contact n'a pas de serveur en statique : il bascule sur l'envoi par email.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { routes } = require('../src/i18n');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const ORIGIN = (process.env.SITE_ORIGIN || 'http://localhost').replace(/\/+$/, '');
const PORT = 3199;

const prefix = (html) => html
  .replace(/(=")\/(?!\/)/g, `$1${BASE}/`)                       // href, src, poster, action, data-*
  .replace(/(srcset="[^"]*")/g, (m) => m.replace(/(,\s*)\/(?!\/)/g, `$1${BASE}/`))
  .replace(/("full":")\/(?!\/)/g, `$1${BASE}/`);                 // données JSON de la galerie

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
      fs.writeFileSync(file, prefix(html).replace('data-form ', 'data-form data-static '));
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
