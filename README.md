# STORM Football

Site vitrine bilingue (FR/EN) de Théo Brugel : analyse vidéo individuelle de joueurs.
Stack : Node 20+ / Express 5 / EJS, sans framework front.

Pages : Accueil `/` · Accompagnement `/accompagnement` · Analyses `/analyses` · Contact `/contact` (+ `/en/...`).
À la première visite, une fenêtre propose Français / English (choix mémorisé), puis la bannière cookies.

```bash
npm install
cp .env.example .env   # puis compléter
npm run dev            # http://localhost:3000
```

## Médias
Les fichiers bruts sont dans `assets-src/` (la vidéo `.mov` n'est pas versionnée).
`npm run media` régénère : images WebP 800/1600 px, logo détouré, favicons, image Open Graph, vidéo MP4 720p + poster.

## Checklist

| # | Exigence | Où |
|---|---|---|
| 1 | Page RGPD | `/politique-de-confidentialite` · `/en/privacy-policy` |
| 2 | CGU | `/cgu` · `/en/terms` (+ mentions légales) |
| 3 | API hors front-end | `POST /api/contact`, identifiants SMTP uniquement dans `.env` |
| 4 | HTTPS forcé | redirection 301 + HSTS en production (`server.js`) |
| 5 | Bannière cookies | GA chargé seulement après « Accepter », lien « Gérer les cookies » |
| 6 | Meta title | titre + description par page et par langue, canonical, hreflang |
| 7 | Image réseaux | `public/img/og-storm.jpg` (1200×630) |
| 8 | Favicon | `favicon-32.png`, `apple-touch-icon.png`, manifest |
| 9 | Sitemap + robots | `/sitemap.xml`, `/robots.txt` (générés) |
| 10 | Textes images | `alt` descriptif sur chaque analyse (FR/EN) |
| 11 | Compression images | WebP, vidéo 130 Mo → 15 Mo |
| 12 | Vitesse | gzip, cache 30 j, lazy-loading, `preload="none"` sur la vidéo, zéro librairie JS |
| 13 | Contraste | texte clair sur anthracite, jaune #FFF000 sur noir |
| 14 | Responsive | testé 375 px → 1440 px |
| 15 | 404 custom | `views/pages/404.ejs` |
| 16 | Liens cassés | crawl de toutes les pages : 0 lien cassé |
| 17 | Validation formulaires | côté client + côté serveur |
| 18 | Anti-spam | champ piège, délai minimal, 5 envois / 15 min par IP |
| 19 | Analytics | Google Analytics 4 (`GA_ID`) avec consentement |
| 20 | Un seul CTA | « Demander mon analyse » → page Contact |

## À compléter avant la mise en ligne
- Mentions légales : SIRET, adresse, hébergeur.
- `.env` : `SITE_URL`, `GA_ID`, SMTP (Gmail : mot de passe d'application).
- Section « Joueurs » : prévue en commentaire dans `services.ejs`, à activer quand il y aura des joueurs à présenter.
