const nodemailer = require('nodemailer');

const PROFILES = ['joueur', 'agent', 'club', 'selection', 'autre'];
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i;

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

function validateContact(body) {
  const data = {
    name: clean(body.name, 80),
    email: clean(body.email, 254),
    profile: clean(body.profile, 20),
    message: String(body.message ?? '').trim().slice(0, 3000),
    consent: body.consent === true || body.consent === 'on',
    lang: body.lang === 'en' ? 'en' : 'fr',
  };
  const errors = {};
  if (data.name.length < 2) errors.name = 'name';
  if (!EMAIL_RE.test(data.email)) errors.email = 'email';
  if (!PROFILES.includes(data.profile)) errors.profile = 'profile';
  if (data.message.length < 20) errors.message = 'message';
  if (!data.consent) errors.consent = 'consent';
  return { errors, data };
}

let transporter;
function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  transporter ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

async function sendContact(d) {
  const tx = getTransporter();
  const text = `Nouvelle demande via le site STORM\n\nNom : ${d.name}\nEmail : ${d.email}\nProfil : ${d.profile}\nLangue : ${d.lang}\n\n${d.message}`;
  if (!tx) {
    console.log('[contact] SMTP non configuré — message reçu :\n' + text);
    return;
  }
  await tx.sendMail({
    from: `"Site STORM" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: process.env.CONTACT_TO || 'theobrugel.video@gmail.com',
    replyTo: d.email,
    subject: `[STORM] Demande d'analyse — ${d.name} (${d.profile})`,
    text,
  });
}

module.exports = { validateContact, sendContact, PROFILES };
