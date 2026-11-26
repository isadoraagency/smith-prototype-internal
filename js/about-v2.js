/* =========================================================
   SMITH — Company / About v2 (Figma 2994:12650)
   Built on js/about.js (V1): same helpers, timeline drum, footer and overlays.
   ========================================================= */
gsap.registerPlugin(ScrollTrigger);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---------------------------------------------------------
   1. Smooth scrolling
   --------------------------------------------------------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.2 }) : window.scrollTo({ top: y, behavior: 'smooth' }));

/* ---------------------------------------------------------
   2. Canvas scaling — pinned scenes fit 1440 × 900 into the
      viewport (--s); regular modules scale to the page width (--sw)
   --------------------------------------------------------- */
function fit() {
  const w = document.documentElement.clientWidth, h = window.innerHeight;
  document.documentElement.style.setProperty('--s', Math.min(w / 1440, h / 900).toFixed(4));
  document.documentElement.style.setProperty('--sw', (w / 1440).toFixed(4));
  document.documentElement.style.setProperty('--sp', Math.min(w / 1440, h / 1088).toFixed(4));
}
fit();
window.addEventListener('resize', fit);
const S = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1;

/* ---------------------------------------------------------
   3. Header: nav theme follows the section under the logo
   --------------------------------------------------------- */
const navHeader = $('.header');
let navRaf = 0;
function syncNavTheme() {
  navRaf = 0;
  const logo = $('.logo', navHeader).getBoundingClientRect();
  const under = document.elementsFromPoint(logo.left + logo.width / 2, logo.top + logo.height / 2).find((el) => !navHeader.contains(el));
  const zone = under && under.closest('[data-nav]');
  navHeader.classList.toggle('is-on-light', !!zone && zone.dataset.nav === 'light');
}
const queueNavTheme = () => { if (!navRaf) navRaf = requestAnimationFrame(syncNavTheme); };
window.addEventListener('scroll', queueNavTheme, { passive: true });
window.addEventListener('resize', queueNavTheme);
if (lenis) lenis.on('scroll', queueNavTheme);
queueNavTheme();

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */
function prepLine(el) {
  el.setAttribute('pathLength', '1');
  el.setAttribute('stroke-dasharray', '1 1');
  el.setAttribute('stroke-dashoffset', '1');
  return el;
}
const DRAWN = { attr: { 'stroke-dashoffset': 0 } };
// split a title into words; `mask` wraps each in an overflow box so it can rise
function splitWords(el, mask = false) {
  // keeps authored <br> line breaks: split per line, then per word
  const tmp = document.createElement('div');
  const lines = el.innerHTML.split(/<br\s*\/?>/i).map((h) => { tmp.innerHTML = h; return tmp.textContent.trim().split(/\s+/).filter(Boolean); });
  el.textContent = '';
  lines.forEach((words, l) => {
    if (l) el.appendChild(document.createElement('br'));
    words.forEach((w, i) => {
      const wd = document.createElement('span'); wd.className = 'wd'; wd.textContent = w;
      if (mask) { const wm = document.createElement('span'); wm.className = 'wm'; wm.appendChild(wd); el.appendChild(wm); } else el.appendChild(wd);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });
  return $$('.wd', el);
}
// section title that lights up word by word as it scrolls into view (A&D / homepage pattern)
function lightUp(el, start = 'top 85%', end = 'top 35%') {
  const words = splitWords(el);
  if (reduceMotion) return words;
  gsap.fromTo(words, { opacity: 0.15 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start, end, scrub: true } });
  return words;
}
// swap the text of a detail block with a short crossfade
function swap(els, apply) {
  if (reduceMotion) return apply();
  gsap.to(els, { autoAlpha: 0, y: -8, duration: 0.18, ease: 'power1.in', overwrite: true, onComplete: () => {
    apply();
    gsap.fromTo(els, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' });
  } });
}
// scroll to the point of a pinned ScrollTrigger where step i of n is centred
const scrollToStep = (st, from, i, n) => scrollToY(st.start + (st.end - st.start) * (from + (1 - from) * (i + 0.5) / n));

/* ---------------------------------------------------------
   4. Hero — the timeline is the hero (V1 drum, reused): it
      autoplays through the years and the page scrolls on freely;
      the arrows, the index, ←/→ and dragging the photos pick a
      year, the year rolls like an odometer
   --------------------------------------------------------- */
const heroTitle = $('#heroTitle');
const heroWords = splitWords(heroTitle, true);
gsap.set(heroTitle, { visibility: 'visible' });

const tl = $('#top');
const stage = $('#dpStage');
const slides = $$('.dp-slide', tl);
const idxItems = $$('.dp-index__item', tl);
const texts = $$('template', tl).map((t) => t.innerHTML);
const yearCols = $$('#dpYear .odo__strip', tl);
const textEl = $('#dpText');
const nowEl = $('#tlNow');
const prevBtn = $('#tlPrev');
const nextBtn = $('#tlNext');
const N = slides.length;
const YEARS = idxItems.map((li) => li.textContent.trim());

// drum geometry, in canvas px / degrees
const STEP = 42;      // degrees between neighbouring photos
const R = 600;        // drum radius
const DIGIT = 168;    // odometer digit height

function render(c) {
  slides.forEach((s, i) => {
    const d = i - c;
    const th = d * STEP;
    const a = Math.abs(th);
    if (a > 95) { s.style.visibility = 'hidden'; return; }
    s.style.visibility = 'visible';
    const rad = th * Math.PI / 180;
    const y = Math.sin(rad) * R;
    const z = (Math.cos(rad) - 1) * R;
    s.style.transform = `translate3d(0, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${(-th).toFixed(2)}deg)`;
    s.style.opacity = Math.max(0, 1 - Math.max(0, a - 42) / 50).toFixed(3);
    s.style.setProperty('--shade', Math.min(0.8, a / 60).toFixed(3));
    s.style.zIndex = String(100 - Math.round(a));
  });
}

let active = -1;
function setActive(i, instant) {
  i = clamp(i, 0, N - 1);
  if (i === active) return;
  const from = active;
  active = i;
  idxItems.forEach((li, k) => li.classList.toggle('is-active', k === i));
  nowEl.textContent = String(i + 1).padStart(2, '0');
  prevBtn.disabled = i === 0;
  nextBtn.disabled = i === N - 1;
  // odometer: each digit column rolls to its new digit (the change reads left to right)
  YEARS[i].split('').forEach((dg, k) => {
    gsap.to(yearCols[k], { y: -dg * DIGIT, duration: instant || reduceMotion ? 0 : 0.9, delay: instant ? 0 : k * 0.05, ease: 'expo.out', overwrite: true });
  });
  if (instant || reduceMotion || from < 0) { textEl.innerHTML = texts[i]; return; }
  const dir = i > from ? 1 : -1;
  gsap.to(textEl, { autoAlpha: 0, y: -12 * dir, duration: 0.18, ease: 'power1.in', overwrite: true, onComplete: () => {
    textEl.innerHTML = texts[i];
    gsap.fromTo(textEl, { autoAlpha: 0, y: 14 * dir }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' });
  } });
}

const drum = { c: 0 };      // the year in focus (fractional while rolling)
const intro = { o: 0 };     // the entrance swing, added on top
const draw = () => render(drum.c + intro.o);
render(0);
setActive(0, true);

if (!reduceMotion) {
  // intro on load: the hero title rises word by word, the drum swings up from below
  gsap.timeline({ delay: 0.15 })
    .from(heroWords, { yPercent: 110, duration: 1.1, stagger: 0.05, ease: 'expo.out' })
    .from(intro, { o: -1.4, duration: 1.8, ease: 'expo.out', onUpdate: draw }, 0.1)
    .from('.dp__info > *, .dp-index li', { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.03, ease: 'power3.out' }, 0.4);
}

// roll the drum to year i (the hero is not pinned: the page scrolls on freely)
let roll = null;
function goTo(i, opts = {}) {
  i = clamp(i, 0, N - 1);
  if (roll) roll.kill();
  if (reduceMotion) { drum.c = i; draw(); setActive(i); return; }
  const dist = Math.abs(i - drum.c);
  roll = gsap.to(drum, {
    c: i, duration: opts.duration || clamp(0.9 + dist * 0.12, 0.9, 2.2), ease: 'power3.inOut',
    onUpdate: () => { draw(); setActive(Math.round(drum.c)); },
  });
  setActive(i);
  if (!opts.auto) schedule();   // a visitor's choice restarts the countdown
}
prevBtn.addEventListener('click', () => goTo(active - 1));
nextBtn.addEventListener('click', () => goTo(active + 1));
idxItems.forEach((li, i) => li.querySelector('button').addEventListener('click', () => goTo(i)));

/* autoplay: a new year every few seconds, looping back to 1984; it holds
   while the hero is off screen, the tab is hidden, or a pointer rests on
   the photos, the controls or the year list */
const DWELL = 5000;
let timer = 0, inView = true, hovering = false, dragging = false;
function schedule() {
  clearTimeout(timer);
  if (reduceMotion || !inView || hovering || dragging || document.hidden) return;
  timer = setTimeout(() => { goTo((active + 1) % N, { auto: true, duration: active === N - 1 ? 2.2 : 1.2 }); schedule(); }, DWELL);
}
ScrollTrigger.create({ trigger: tl, start: 'top bottom', end: 'bottom 30%', onToggle: (st) => { inView = st.isActive; schedule(); } });
document.addEventListener('visibilitychange', schedule);
[stage, $('.dp__controls', tl), $('.dp-index', tl)].forEach((el) => {
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; clearTimeout(timer); } });
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hovering = false; schedule(); } });
});
document.addEventListener('keydown', (e) => {
  if (!inView || (e.target.closest && e.target.closest('input, textarea'))) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); }
});
if (!reduceMotion) gsap.delayedCall(2.2, schedule);   // first move once the intro has played

// drag the drum: pull up to move forward in time, release to settle on a year
// (vertical swipes on touch still scroll the page; mouse drags roll the drum)
let drag = null;
stage.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse') return;
  drag = { y: e.clientY, c: drum.c };
  dragging = true; clearTimeout(timer);
  if (roll) roll.kill();
  stage.setPointerCapture(e.pointerId);
  stage.classList.add('is-dragging');
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dy = drag.y - e.clientY;
  drum.c = clamp(drag.c + dy / (380 * S()), 0, N - 1);   // one photo per ~380 canvas px of drag
  draw(); setActive(Math.round(drum.c));
});
const release = () => {
  if (!drag) return;
  drag = null; dragging = false;
  stage.classList.remove('is-dragging');
  goTo(Math.round(drum.c));
};
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);


/* ---------------------------------------------------------
   5. Smith at a glance — the cards rise in turn and the
      figures count up (#1 stays put)
   --------------------------------------------------------- */
lightUp($('#glanceTitle'));
$$('.stat__value').forEach((el) => {
  const to = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length;
  const pre = el.dataset.pre, post = el.dataset.post;
  const accent = (s) => (s === '$' || s === '#' || s === '×' ? `<b>${s}</b>` : s);
  const paint = (v) => { el.innerHTML = accent(pre) + (dec ? v.toFixed(dec) : Math.round(v)) + accent(post); };
  if (reduceMotion || to <= 1) return;
  const o = { v: 0 };
  paint(0);
  ScrollTrigger.create({ trigger: '.glance__stats', start: 'top 85%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.8, ease: 'expo.out', onUpdate: () => paint(o.v) }) });
});
if (!reduceMotion) {
  gsap.from('.stat', { y: 48, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.glance__stats', start: 'top 85%' } });
  gsap.from('.glance__link', { autoAlpha: 0, y: 16, duration: 0.7, delay: 0.3, ease: 'power2.out', scrollTrigger: { trigger: '.glance__stats', start: 'top 85%' } });
}

/* ---------------------------------------------------------
   6. Built differently — the section pins and the strip of five
      pillars slides sideways under the title; photos drift
      inside their frames and the dotted visuals turn slightly
   --------------------------------------------------------- */
lightUp($('#builtTitle'));
if (!reduceMotion) {
  const track = $('#provenTrack');
  const SP = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sp')) || 1;
  // canvas px: travel until the last column ends 48px in from the viewport's right edge
  const travel = () => { const sp = SP(), w = document.documentElement.clientWidth; const canvasLeft = 0; return Math.max(0, 48 + track.scrollWidth - (w - 48 - canvasLeft) / sp); };
  gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
    trigger: '.proven', start: 'top top', end: () => '+=' + Math.round(travel() * 1.6 * SP()),
    pin: true, scrub: 0.8, invalidateOnRefresh: true,
  } })
    .to(track, { x: () => -travel(), duration: 1 }, 0)
    .fromTo('.pcol__photo img', { xPercent: -6, scale: 1.12 }, { xPercent: 6, scale: 1.12, duration: 1 }, 0)
    .fromTo('.pcol__dots', { rotate: -4, scale: 1.04 }, { rotate: 3, scale: 1, duration: 1 }, 0);
  gsap.from('.pcol', { y: 60, autoAlpha: 0, duration: 1, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.proven', start: 'top 70%' } });
}

/* ---------------------------------------------------------
   7. Franchises — the logos rise along the belt
   --------------------------------------------------------- */
lightUp($('#franTitle'));
if (!reduceMotion) {
  gsap.from('.logo-belt li', { y: 28, autoAlpha: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: '.logo-belt', start: 'top 90%' } });
}

/* ---------------------------------------------------------
   8. Recognition — the routes draw themselves as the section
      scrolls through, the nodes pop on, the award cards rise in
      onto their routes
   --------------------------------------------------------- */
lightUp($('#recogTitle'));
if (!reduceMotion) {
  const routes = $$('.recog__route').map(prepLine);
  gsap.to(routes, { ...DRAWN, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: '.recog', start: 'top 85%', end: 'bottom 60%', scrub: 0.6 } });
  gsap.from('.recog__node', { scale: 0, transformOrigin: '50% 50%', duration: 0.6, stagger: 0.12, ease: 'back.out(2.4)', scrollTrigger: { trigger: '.recog', start: 'top 55%' } });
  gsap.from('.recog__all', { autoAlpha: 0, y: 16, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: '.recog', start: 'top 60%' } });
  $$('.award').forEach((card, i) => {
    gsap.from(card, { y: 80, autoAlpha: 0, duration: 1, delay: i * 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.recog', start: 'top 65%' } });
    gsap.from(card.querySelector('.award__icon'), { rotate: -120, scale: 0.4, autoAlpha: 0, duration: 1, delay: 0.15 + i * 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.recog', start: 'top 65%' } });
  });
}

/* ---------------------------------------------------------
   9. Experience — the card opens from the centre, the render
      settles from a zoom, the Explore links slide in
   --------------------------------------------------------- */
lightUp($('#expTitle'));
if (!reduceMotion) {
  gsap.fromTo('.exp__card', { clipPath: 'inset(8% 6% 8% 6% round 48px)' }, { clipPath: 'inset(0% 0% 0% 0% round 24px)', ease: 'none', scrollTrigger: { trigger: '.exp', start: 'top 90%', end: 'top 20%', scrub: true } });
  // the backdrop and the floating relay settle from the same zoom, so they stay registered
  gsap.fromTo(['.exp__media img', '.exp__stage'], { scale: 1.2 }, { scale: 1, ease: 'none', transformOrigin: '50% 50%', scrollTrigger: { trigger: '.exp', start: 'top bottom', end: 'bottom 60%', scrub: true } });

  /* the relay floats like a WebGL object: a slow bob with a little sway, and it
     turns, tips and rolls as the section scrolls; the light shifts as it turns
     and the floor shadow tightens as it rises */
  const part = $('#expPart'), shadow = $('#expShadow');
  const rs = { p: 0.5, sp: 0.5 };
  ScrollTrigger.create({ trigger: '.exp', start: 'top bottom', end: 'bottom top', onUpdate: (st) => { rs.p = st.progress; } });
  const t0 = performance.now();
  const floatTick = () => {
    const t = (performance.now() - t0) / 1000;
    rs.sp += (rs.p - rs.sp) * 0.08;
    const k = rs.sp - 0.5;
    const bob = Math.sin(t * 0.9) * 12, sway = Math.sin(t * 0.55) * 1.8;
    part.style.transform = `translate3d(0, ${(-bob).toFixed(1)}px, 0) rotateX(${(6 - k * 16 + sway * 0.4).toFixed(2)}deg) rotateY(${(k * 30 + sway).toFixed(2)}deg) rotateZ(${(k * -10).toFixed(2)}deg)`;
    part.style.filter = `brightness(${(1 + k * 0.14).toFixed(3)})`;
    const lift = (bob + 12) / 24;
    shadow.style.opacity = (0.9 - lift * 0.35).toFixed(3);
    shadow.style.transform = `scale(${(1.04 - lift * 0.22).toFixed(3)}, ${(1 - lift * 0.2).toFixed(3)})`;
  };
  ScrollTrigger.create({ trigger: '.exp', start: 'top bottom', end: 'bottom top', onToggle: (st) => (st.isActive ? gsap.ticker.add(floatTick) : gsap.ticker.remove(floatTick)) });
  gsap.from('.exp__sub', { autoAlpha: 0, y: 16, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '.exp', start: 'top 55%' } });
  gsap.from('.explore__title, .explore__list li', { autoAlpha: 0, x: 24, duration: 0.7, stagger: 0.07, ease: 'power3.out', scrollTrigger: { trigger: '.explore', start: 'top 85%' } });
}

/* ---------------------------------------------------------
   13. Footer circuit + chat lift (from the homepage)
   --------------------------------------------------------- */
const footLine = $('.footer__circuit-line');
if (footLine) {
  prepLine(footLine);
  const markers = $$('.footer__circuit .marker');
  markers.forEach((m) => (m.tagName === 'circle'
    ? (m.dataset.r = m.getAttribute('r'), m.setAttribute('r', 0))
    : gsap.set(m, { scale: 0, transformOrigin: '50% 50%' })));
  gsap.timeline({ scrollTrigger: { trigger: '.footer__circuit', start: 'top 90%', toggleActions: 'play none none reverse' } })
    .to(footLine, { ...DRAWN, duration: 2.5, ease: 'power2.out' })
    .to(markers, { attr: { r: (i, m) => +(m.dataset.r || 0) }, scale: 1, duration: 0.45, stagger: 0.25, ease: 'back.out(2.2)' }, 1);
}
const chatEl = $('#chatBtn');
ScrollTrigger.create({
  trigger: '.footer__meta', start: 'top bottom', end: 'max',
  onUpdate: (st) => chatEl.classList.toggle('is-lifted', st.progress > 0),
  onRefresh: (st) => chatEl.classList.toggle('is-lifted', st.progress > 0),
});

/* ---------------------------------------------------------
   14. Overlays — Industries dropdown, chat panel
   --------------------------------------------------------- */
function reveal(el, from) {
  el.hidden = false;
  gsap.fromTo(el, from, { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out', clearProps: 'transform' });
}
function conceal(el, to, done) {
  gsap.to(el, { ...to, autoAlpha: 0, duration: 0.2, ease: 'power2.in', onComplete: () => { el.hidden = true; done && done(); } });
}
const indBtn = $('#industriesBtn');
const indMenu = $('#industriesMenu');
function setDropdown(open) {
  if (open === (indBtn.getAttribute('aria-expanded') === 'true')) return;
  indBtn.setAttribute('aria-expanded', String(open));
  if (open) reveal(indMenu, { autoAlpha: 0, y: -8 }); else conceal(indMenu, { y: -8 });
}
if (indBtn) indBtn.addEventListener('click', (e) => { e.stopPropagation(); setDropdown(indBtn.getAttribute('aria-expanded') !== 'true'); });
if (indMenu) document.addEventListener('click', (e) => { if (!indMenu.hidden && !indMenu.contains(e.target)) setDropdown(false); });
const selfLink = $('.nav__menu a[aria-current="page"]');
if (selfLink) selfLink.addEventListener('click', (e) => { e.preventDefault(); scrollToY(0); });

const chatBtn = $('#chatBtn');
const chatPanel = $('#chatPanel');
const chatThread = $('#chatThread');
const chatInput = $('#chatInput');
function setChat(open) {
  chatBtn.setAttribute('aria-expanded', String(open));
  if (open) { reveal(chatPanel, { autoAlpha: 0, y: 24, scale: 0.96 }); setTimeout(() => chatInput.focus(), 200); }
  else conceal(chatPanel, { y: 24, scale: 0.96 }, () => chatBtn.focus());
}
chatBtn.addEventListener('click', () => setChat(true));
$('#chatClose').addEventListener('click', () => setChat(false));
function sendChat(text) {
  if (!text.trim()) return;
  const msg = document.createElement('p');
  msg.className = 'msg msg--me';
  msg.textContent = text.trim();
  chatThread.appendChild(msg);
  gsap.from(msg, { y: 12, autoAlpha: 0, duration: 0.3, ease: 'power2.out' });
  chatThread.scrollTop = chatThread.scrollHeight;
}
$('#chatQuick').addEventListener('click', (e) => { if (e.target.closest('button')) sendChat(e.target.closest('button').textContent); });
$('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); sendChat(chatInput.value); chatInput.value = ''; });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!chatPanel.hidden) return setChat(false);
  if (indMenu && !indMenu.hidden) { setDropdown(false); indBtn.focus(); }
});

// in-page anchors glide with Lenis
$$('a[href^="#"]').forEach((a) => {
  const id = a.getAttribute('href');
  if (id.length < 2 || !document.querySelector(id)) return;
  a.addEventListener('click', (e) => { e.preventDefault(); if (lenis) lenis.scrollTo(id, { duration: 1.4 }); else document.querySelector(id).scrollIntoView({ behavior: 'smooth' }); });
});

/* ---------------------------------------------------------
   15. Electronics / Solar switch — fade out, then go
   --------------------------------------------------------- */
$$('[data-site-switch]').forEach((link) => {
  link.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    document.body.classList.add('is-leaving');
    setTimeout(() => { window.location.href = link.href; }, reduceMotion ? 0 : 350);
  });
});
window.addEventListener('pageshow', () => document.body.classList.remove('is-leaving'));

/* ---------------------------------------------------------
   Header hides while scrolling down and slides back in on the
   way up (stays near the top and while the menu is open)
   --------------------------------------------------------- */
(() => {
  const bar = $('.header');
  const menu = $('#industriesMenu');
  let lastY = window.scrollY, hidden = false;
  const setHidden = (h) => {
    if (h === hidden) return;
    hidden = h;
    gsap.to(bar, { yPercent: h ? -130 : 0, duration: h ? 0.45 : 0.6, ease: h ? 'power2.in' : 'expo.out', overwrite: 'auto' });
  };
  const onScroll = () => {
    const y = window.scrollY, dy = y - lastY;
    if (Math.abs(dy) < 4) return;
    lastY = y;
    if (y < 120 || (menu && !menu.hidden)) return setHidden(false);
    setHidden(dy > 0);
  };
  if (lenis) lenis.on('scroll', onScroll); else window.addEventListener('scroll', onScroll, { passive: true });
  bar.addEventListener('focusin', () => setHidden(false));
})();

window.addEventListener('resize', () => ScrollTrigger.refresh());
if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
