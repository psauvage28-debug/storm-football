// Génère les assets web optimisés à partir de assets-src/ (images, logo, vidéo).
// Usage : npm run media
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const ffmpeg = require('ffmpeg-static');

const SRC = path.join(__dirname, '..', 'assets-src');
const IMG = path.join(__dirname, '..', 'public', 'img');
const VID = path.join(__dirname, '..', 'public', 'video');
fs.mkdirSync(IMG, { recursive: true });
fs.mkdirSync(VID, { recursive: true });

// Nom source -> slug publique (ordre = ordre de la galerie)
const shots = {
  'PHOTO-2026-10-08-17-43-13.jpg': 'sans-ballon-pressing',
  'PHOTO-2026-10-08-17-43-13 2.jpg': 'sans-ballon-bloc-451',
  'PHOTO-2026-10-08-17-43-13 3.jpg': 'sans-ballon-bloc-442',
  'PHOTO-2026-10-08-17-43-13 4.jpg': 'sans-ballon-contre-pressing',
  'PHOTO-2026-10-08-17-43-13 5.jpg': 'avec-ballon-sortie-triangles',
  'PHOTO-2026-10-08-17-43-13 6.jpg': 'avec-ballon-sortie-renversement',
  'PHOTO-2026-10-08-17-43-13 7.jpg': 'avec-ballon-sortie-2v1',
  'PHOTO-2026-10-08-17-43-13 8.jpg': 'avec-ballon-sortie-difficultes',
  'PHOTO-2026-10-08-17-43-14.jpg': 'avec-ballon-sortie-pressing-adverse',
  'PHOTO-2026-10-08-17-43-14 2.jpg': 'avec-ballon-attaque-demi-espace',
  'PHOTO-2026-10-08-17-43-14 3.jpg': 'avec-ballon-attaque-2v1',
  'PHOTO-2026-10-08-17-43-14 4.jpg': 'avec-ballon-attaque-surface',
};

async function images() {
  for (const [file, slug] of Object.entries(shots)) {
    const input = path.join(SRC, file);
    await sharp(input).resize(1600).webp({ quality: 78 }).toFile(path.join(IMG, `${slug}-1600.webp`));
    await sharp(input).resize(800).webp({ quality: 74 }).toFile(path.join(IMG, `${slug}-800.webp`));
  }
}

async function logo() {
  const input = path.join(SRC, 'PHOTO-2026-10-08-17-11-13.jpg');
  // Fond gris foncé -> transparent : alpha = luminosité du jaune (le logo est jaune pur sur #2b2b2b)
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += info.channels, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = (r + g) / 2 - b; // "jaunitude" : ~0 pour le gris, ~255 pour le jaune
    const a = Math.max(0, Math.min(255, (y - 15) * 1.4));
    out[j] = 255; out[j + 1] = 240; out[j + 2] = 0; out[j + 3] = a;
  }
  const transparent = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
  const png = await transparent.png().toBuffer();
  await sharp(png).resize(720).webp({ quality: 90 }).toFile(path.join(IMG, 'logo-storm.webp'));
  await sharp(png).resize(720).png({ compressionLevel: 9 }).toFile(path.join(IMG, 'logo-storm.png'));

  // Pictogramme seul (sans le mot STORM) pour le favicon et la nav
  const mark = await sharp(png).extract({ left: 80, top: 80, width: 920, height: 620 }).png().toBuffer();
  await sharp(mark).resize(240).webp({ quality: 90 }).toFile(path.join(IMG, 'logo-mark.webp'));
  const square = await sharp({ create: { width: 920, height: 920, channels: 4, background: '#1c1c1c' } })
    .composite([{ input: mark, top: 150, left: 0 }]).png().toBuffer();
  await sharp(square).resize(32).png().toFile(path.join(__dirname, '..', 'public', 'favicon-32.png'));
  await sharp(square).resize(180).png().toFile(path.join(__dirname, '..', 'public', 'apple-touch-icon.png'));
  await sharp(square).resize(512).png().toFile(path.join(__dirname, '..', 'public', 'icon-512.png'));
  await sharp(square).resize(48).toFormat('png').toFile(path.join(__dirname, '..', 'public', 'favicon.png'));

  // Image réseaux sociaux (Open Graph) 1200x630
  const logoSmall = await sharp(png).resize(520).png().toBuffer();
  const bg = await sharp(path.join(SRC, 'PHOTO-2026-10-08-17-43-13 2.jpg')).resize(1200, 630, { fit: 'cover' })
    .modulate({ brightness: 0.35 }).blur(2).toBuffer();
  await sharp(bg).composite([{ input: logoSmall, top: 55, left: 340 }]).jpeg({ quality: 82 })
    .toFile(path.join(IMG, 'og-storm.jpg'));
}

function video() {
  const input = path.join(SRC, '..', 'assets-src', 'josh-maja.mov');
  const src = fs.existsSync(input) ? input : '/Users/paulsauvagegirard/Desktop/storm/JOSH MAJA.mov';
  const out = path.join(VID, 'analyse-josh-maja.mp4');
  if (!fs.existsSync(out)) {
    execFileSync(ffmpeg, ['-y', '-i', src, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'slow',
      '-crf', '28', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  }
  execFileSync(ffmpeg, ['-y', '-ss', '1.5', '-i', out, '-frames:v', '1', '-vf', 'scale=1280:-2',
    path.join(IMG, 'poster-josh-maja.jpg')], { stdio: 'ignore' });
  return sharp(path.join(IMG, 'poster-josh-maja.jpg')).webp({ quality: 75 })
    .toFile(path.join(IMG, 'poster-josh-maja.webp'));
}

(async () => {
  const only = process.argv[2];
  if (!only || only === 'img') await images();
  if (!only || only === 'logo') await logo();
  if (!only || only === 'video') await video();
  console.log('Media OK');
})();
