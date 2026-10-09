/* STORM Football — interactions (sans dépendance) */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* stockage bloqué */ } },
  };

  /* ---------- Navigation ---------- */
  const nav = $('[data-nav]');
  const progress = $('[data-progress]');
  const burger = $('[data-burger]');
  const links = $('#nav-links');
  burger?.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', open);
    links.classList.toggle('is-open', open);
  });
  links?.addEventListener('click', (e) => {
    if (e.target.closest('a')) { burger?.setAttribute('aria-expanded', 'false'); links.classList.remove('is-open'); }
  });

  /* ---------- Logos 3D pilotés par le scroll ---------- */
  const heroLogo = $('[data-logo3d="scroll"] .logo3d__stack');
  const heroShadow = $('[data-logo3d="scroll"] .logo3d__shadow');
  const hero = $('[data-hero]');
  const navMark = $('[data-spin]');
  const spinLogos = $$('[data-logo3d="spin"] .logo3d__stack');
  const inviewLogos = $$('[data-logo3d="inview"]');
  const steps = $('[data-steps]');
  let mouse = { x: 0, y: 0 };

  if (finePointer && !reduce && hero) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      mouse = { x: (e.clientX - r.left) / r.width - .5, y: (e.clientY - r.top) / r.height - .5 };
      requestTick();
    });
    hero.addEventListener('pointerleave', () => { mouse = { x: 0, y: 0 }; requestTick(); });
  }

  function onScroll() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    nav?.classList.toggle('is-scrolled', y > 20);
    progress?.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    if (reduce) return;

    // Pictogramme de la nav : tourne sur lui-même avec le scroll
    if (navMark) navMark.style.transform = `rotateY(${(y * .6) % 360}deg)`;
    // Logos des pages intérieures : rotation continue liée au scroll
    spinLogos.forEach((s) => { s.style.setProperty('--ry', `${y * .45}deg`); s.style.setProperty('--rx', `${Math.sin(y / 300) * 12}deg`); });

    // Logo du hero : rotation 3D + recul pendant qu'on quitte le hero
    if (heroLogo && hero) {
      const p = Math.min(1.2, y / hero.offsetHeight);
      heroLogo.style.setProperty('--ry', `${p * 360 + mouse.x * 30}deg`);
      heroLogo.style.setProperty('--rx', `${p * -18 - mouse.y * 22}deg`);
      heroLogo.style.setProperty('--rz', `${p * -6}deg`);
      heroLogo.style.setProperty('--s', (1 - p * .25).toFixed(3));
      heroShadow?.style.setProperty('--sh', Math.abs(Math.cos(p * Math.PI)).toFixed(3));
      hero.style.setProperty('--hero-p', p.toFixed(3));
    }

    // Logo du footer : se « déplie » en entrant à l'écran
    inviewLogos.forEach((el) => {
      const r = el.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (innerHeight - r.top) / (r.height * 1.3)));
      const s = $('.logo3d__stack', el);
      s.style.setProperty('--ry', `${(1 - t) * -160}deg`);
      s.style.setProperty('--rx', `${(1 - t) * 30}deg`);
    });

    // Ligne de progression des étapes d'accompagnement
    if (steps) {
      const r = steps.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (innerHeight * .8 - r.top) / (r.height + innerHeight * .3)));
      steps.style.setProperty('--steps-p', t.toFixed(3));
    }
  }
  let ticking = false;
  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }
  addEventListener('scroll', requestTick, { passive: true });
  addEventListener('resize', requestTick);
  onScroll();


  /* ---------- Accompagnement : l'éclair se dessine au scroll ---------- */
  const journey = $('[data-journey]');
  if (journey) {
    const svg = $('.journey__svg', journey);
    const [track, glow, bolt] = $$('path', svg);
    const head = $('.journey__head', journey);
    const flash = $('.journey__flash', journey);
    const stops = $$('[data-stop]', journey);
    let samples = [];   // [{ l, x, y }] pour retrouver vite la longueur à une hauteur donnée
    let total = 0;
    let drawn = 0;
    let target = 0;
    let anchors = [];
    let running = false;

    // Pseudo-aléatoire stable : l'éclair garde la même forme à chaque rendu
    const rand = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

    function build() {
      const box = journey.getBoundingClientRect();
      const W = box.width;
      const H = journey.scrollHeight;
      const mobile = innerWidth <= 860;
      const cx = mobile ? Math.max(18, ($('.journey__inner', journey).getBoundingClientRect().left - box.left) + 14) : W / 2;
      const amp = mobile ? 12 : 46;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

      anchors = stops.map((el) => {
        const r = el.getBoundingClientRect();
        const top = r.top - box.top;
        return { el, y: el.matches('.jchap, [data-final]') ? top : top + r.height / 2 };
      });

      // Ligne brisée : départ en haut, passage par chaque étape, zigzags entre deux étapes
      const pts = [[cx, 0]];
      let k = 1;
      [{ y: 0 }, ...anchors].forEach((a, i, arr) => {
        const next = arr[i + 1];
        if (!next) return;
        const span = next.y - a.y;
        const n = Math.max(2, Math.round(span / 70));
        for (let j = 1; j < n; j++) {
          const dir = j % 2 ? 1 : -1;
          pts.push([cx + dir * amp * (0.45 + rand(k++) * 0.75), a.y + span * (j / n) + (rand(k++) - 0.5) * 18]);
        }
        pts.push([cx, next.y]);
      });
      const d = 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L');
      [track, glow, bolt].forEach((p) => p.setAttribute('d', d));

      total = bolt.getTotalLength();
      [glow, bolt].forEach((p) => { p.style.strokeDasharray = `${total} ${total}`; });
      samples = [];
      for (let i = 0; i <= 300; i++) {
        const l = (total * i) / 300;
        const pt = bolt.getPointAtLength(l);
        samples.push({ l, x: pt.x, y: pt.y });
      }
      update(true);
    }

    // Longueur de l'éclair dont la pointe atteint la hauteur y
    const lengthAt = (y) => {
      if (y <= 0) return 0;
      const s = samples.find((p) => p.y >= y);
      return s ? s.l : total;
    };

    function paint(len) {
      const off = total - len;
      glow.style.strokeDashoffset = off;
      bolt.style.strokeDashoffset = off;
      if (!samples.length) return;
      const s = samples[Math.min(samples.length - 1, Math.round((len / total) * 300))];
      head.setAttribute('transform', `translate(${s.x} ${s.y})`);
      head.classList.toggle('is-on', len > 4 && len < total - 4);
      anchors.forEach((a) => {
        const lit = s.y >= a.y - 6;
        if (lit && !a.el.classList.contains('is-lit')) {
          a.el.classList.add('is-lit');
          if (!reduce) {
            flash.style.setProperty('--fx', `${(s.x / journey.clientWidth) * 100}%`);
            flash.style.setProperty('--fy', `${(s.y / journey.scrollHeight) * 100}%`);
            flash.classList.remove('is-flashing'); void flash.offsetWidth; flash.classList.add('is-flashing');
          }
        } else if (!lit && a.el.classList.contains('is-lit')) {
          a.el.classList.remove('is-lit');
        }
      });
    }

    function update(instant) {
      const r = journey.getBoundingClientRect();
      target = reduce ? total : lengthAt(innerHeight * 0.62 - r.top);
      if (instant || reduce) { drawn = target; paint(drawn); return; }
      if (!running) { running = true; requestAnimationFrame(loop); }
    }

    // Lissage : la pointe de l'éclair rattrape le scroll de façon fluide
    function loop() {
      drawn += (target - drawn) * 0.14;
      if (Math.abs(target - drawn) < 0.5) drawn = target;
      paint(drawn);
      if (drawn !== target) requestAnimationFrame(loop); else running = false;
    }

    addEventListener('scroll', () => update(), { passive: true });
    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 150); });
    build();
    document.fonts?.ready.then(build);
    addEventListener('load', build);
  }

  /* ---------- Apparitions + lien actif ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el) => io.observe(el));


  /* ---------- Cartes inclinables en 3D ---------- */
  if (finePointer && !reduce) {
    $$('.tilt').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        if (!el.classList.contains('is-in')) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(6px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Galerie : filtres + visionneuse ---------- */
  const gallery = $('[data-gallery]');
  if (gallery) {
    const shots = $$('.shot', gallery);
    $$('[data-filter]').forEach((btn) => btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      $$('[data-filter]').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', b === btn); });
      shots.forEach((s) => { s.hidden = f !== 'all' && s.dataset.phase !== f; });
    }));

    const data = JSON.parse($('#gallery-data').textContent);
    const lb = $('[data-lightbox]');
    const img = $('img', lb);
    const cap = $('figcaption', lb);
    let index = 0;
    const visible = () => shots.filter((s) => !s.hidden).map((s) => Number($('.shot__btn', s).dataset.index));
    const show = (i) => {
      index = i;
      img.src = data[i].full; img.alt = data[i].caption;
      cap.innerHTML = '';
      const b = document.createElement('strong'); b.textContent = `${data[i].title} — `;
      cap.append(b, data[i].caption);
    };
    const step = (d) => { const v = visible(); show(v[(v.indexOf(index) + d + v.length) % v.length]); };
    gallery.addEventListener('click', (e) => {
      const btn = e.target.closest('.shot__btn');
      if (!btn) return;
      show(Number(btn.dataset.index));
      lb.showModal();
    });
    lb.addEventListener('click', (e) => {
      const a = e.target.closest('[data-lb]')?.dataset.lb;
      if (a === 'close' || e.target === lb) lb.close();
      if (a === 'prev') step(-1);
      if (a === 'next') step(1);
    });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  /* ---------- Formulaire de contact ---------- */
  const form = $('[data-form]');
  if (form) {
    form.ts.value = Date.now();
    const status = $('.form__status', form);
    const fields = ['name', 'email', 'profile', 'message', 'consent'];
    const rules = {
      name: (v) => v.trim().length >= 2,
      email: (v) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i.test(v.trim()),
      profile: (v) => v !== '',
      message: (v) => v.trim().length >= 20,
      consent: (_, el) => el.checked,
    };
    const check = (name, force) => {
      const el = form[name];
      const ok = rules[name](el.value, el);
      const err = $(`#err-${name}`);
      const wrap = el.closest('.field');
      if (!ok && (force || wrap.classList.contains('is-touched'))) {
        err.textContent = err.dataset.err; wrap.classList.add('is-invalid'); el.setAttribute('aria-invalid', 'true');
      } else if (ok) {
        err.textContent = ''; wrap.classList.remove('is-invalid'); el.removeAttribute('aria-invalid');
      }
      return ok;
    };
    fields.forEach((n) => {
      form[n].addEventListener('blur', () => { form[n].closest('.field').classList.add('is-touched'); check(n); });
      form[n].addEventListener('input', () => check(n));
      form[n].addEventListener('change', () => check(n));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bad = fields.filter((n) => !check(n, true));
      if (bad.length) { form[bad[0]].focus(); return; }
      // Version statique (aperçu sans serveur) : ouverture de la messagerie avec le message pré-rempli
      if ('static' in form.dataset) {
        const sel = form.profile.options[form.profile.selectedIndex].text;
        const body = `${form.name.value}\n${form.email.value}\n${sel}\n\n${form.message.value}`;
        location.href = `mailto:theobrugel.video@gmail.com?subject=${encodeURIComponent(`[STORM] ${form.name.value} (${sel})`)}&body=${encodeURIComponent(body)}`;
        status.className = 'form__status is-ok'; status.textContent = form.dataset.msgOk;
        return;
      }
      const btn = $('button[type="submit"]', form);
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = form.dataset.msgSending;
      status.className = 'form__status'; status.textContent = '';
      try {
        const payload = Object.fromEntries(new FormData(form));
        payload.consent = form.consent.checked;
        const res = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) {
          status.classList.add('is-ok'); status.textContent = form.dataset.msgOk;
          form.reset(); form.ts.value = Date.now();
          track('generate_lead');
        } else if (json.errors) {
          Object.keys(json.errors).forEach((n) => form[n] && check(n, true));
        } else {
          status.classList.add('is-err');
          status.textContent = res.status === 429 ? form.dataset.msgRate : form.dataset.msgFail;
        }
      } catch {
        status.classList.add('is-err'); status.textContent = form.dataset.msgFail;
      } finally {
        btn.disabled = false; btn.textContent = label;
      }
    });
  }

  /* ---------- Cookies + Google Analytics (chargé uniquement après accord) ---------- */
  const GA_ID = document.body.dataset.ga;
  const banner = $('[data-cookie]');
  const KEY = 'storm-consent';
  function loadGA() {
    if (!GA_ID || window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
    const s = document.createElement('script');
    s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.append(s);
  }
  function track(name) { if (window.gtag) window.gtag('event', name); }
  const choice = store.get(KEY);
  if (choice === 'accept') loadGA();
  const showBanner = () => { if (!store.get(KEY) && banner) banner.hidden = false; };
  $$('[data-cookie-choice]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.cookieChoice;
    store.set(KEY, v);
    banner.hidden = true;
    if (v === 'accept') loadGA();
    else {
      // Retrait du consentement : suppression des cookies GA puis rechargement sans GA
      document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => n.startsWith('_ga'))
        .forEach((n) => { document.cookie = `${n}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, '')}`; document.cookie = `${n}=; Max-Age=0; path=/`; });
      if (window.gtag) location.reload();
    }
  }));
  /* ---------- Choix de la langue à la première visite ---------- */
  const gate = $('[data-lang-gate]');
  const LANG_KEY = 'storm-lang';
  const current = document.documentElement.lang;
  $$('[data-set-lang]').forEach((a) => a.addEventListener('click', (e) => {
    store.set(LANG_KEY, a.dataset.setLang);
    if (gate?.open && a.dataset.setLang === current) { e.preventDefault(); gate.close(); }
  }));
  if (gate && !store.get(LANG_KEY) && typeof gate.showModal === 'function') {
    gate.addEventListener('close', () => { store.set(LANG_KEY, current); showBanner(); });
    gate.showModal();
    $(`[data-set-lang="${current}"]`, gate)?.focus();
  } else {
    showBanner();
  }

  $$('[data-cookie-open]').forEach((b) => b.addEventListener('click', () => { banner.hidden = false; }));
})();
