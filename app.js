/* Draws the whole profile from data/profile.json.
 *
 * Everything is written with textContent and checked links, never innerHTML, so nothing in the
 * data can become markup. An area with no projects says so plainly instead of being hidden, because
 * the three areas are the shape of the page. */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}

function svg(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  for (const kid of kids) e.append(kid);
  return e;
}

/** Only https links are ever rendered. */
function safeUrl(u) {
  try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch { return null; }
}

function link(label, url, cls) {
  const href = safeUrl(url);
  return href ? h('a', { class: cls, href, rel: 'noopener', target: '_blank' }, label) : null;
}

/* One drawing per area, in the line style the page uses everywhere. */
const ICONS = {
  telecom: () => svg('svg', { viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    svg('path', { d: 'M24 22v20M17 42h14' }), svg('circle', { cx: 24, cy: 17, r: 3 }),
    svg('path', { d: 'M15 10a13 13 0 0 0 0 14M33 10a13 13 0 0 1 0 14M9.5 5.5a21 21 0 0 0 0 23M38.5 5.5a21 21 0 0 1 0 23' })),
  networks: () => svg('svg', { viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    svg('circle', { cx: 24, cy: 10, r: 5 }), svg('circle', { cx: 9, cy: 36, r: 5 }), svg('circle', { cx: 39, cy: 36, r: 5 }),
    svg('path', { d: 'M21.5 14.5 11.5 31.5M26.5 14.5l10 17M14 36h20' })),
  ai: () => svg('svg', { viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    svg('circle', { cx: 8, cy: 14, r: 3.5 }), svg('circle', { cx: 8, cy: 34, r: 3.5 }),
    svg('circle', { cx: 24, cy: 8, r: 3.5 }), svg('circle', { cx: 24, cy: 24, r: 3.5 }), svg('circle', { cx: 24, cy: 40, r: 3.5 }),
    svg('circle', { cx: 40, cy: 24, r: 3.5 }),
    svg('path', { d: 'M11 14l10-5M11 14l10 9M11 34l10-9M11 34l10 5M27 9l10 13M27 24h10M27 39l10-13' })),
};

/* ------------------------------------------------------------------ pieces */

function hero(d) {
  const wave = (cls, amp, y, len) => {
    // A sine drawn twice as wide as the screen, so sliding it by half its width loops without a seam.
    let p = `M0 ${y}`;
    for (let x = 0; x <= len * 2; x += 20) p += ` L${x} ${(y + Math.sin((x / len) * Math.PI * 4) * amp).toFixed(1)}`;
    return svg('path', { class: cls, d: p });
  };
  return h('section', { class: 'hero', 'aria-label': 'Introduction' },
    h('div', { class: 'glow a' }), h('div', { class: 'glow b' }),
    svg('svg', { class: 'waves', viewBox: '0 0 1200 600', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      wave('w1', 46, 250, 1200), wave('w2', 30, 330, 900), wave('w3', 60, 410, 1500)),
    h('div', { class: 'inner' },
      h('p', { class: 'kicker' }, 'Profile'),
      h('h1', {}, d.handle),
      h('p', { class: 'title' }, d.title),
      h('div', { class: 'links' },
        link('GitHub', `https://github.com/${d.handle}`, 'btn primary'),
        d.areas.some((a) => a.projects.length) && h('a', { class: 'btn', href: '#areas' }, 'Projects ↓'))));
}

function picker(d) {
  return h('nav', { class: 'areas', id: 'areas', 'aria-label': 'Project areas' }, d.areas.map((a) =>
    h('a', { class: 'area-card', 'data-area': a.id, href: `#${a.id}` },
      ICONS[a.id] && ICONS[a.id](),
      h('span', { class: 'count' }, a.projects.length ? `${a.projects.length} project${a.projects.length > 1 ? 's' : ''}` : 'soon'),
      h('h2', {}, a.name),
      h('p', {}, a.blurb))));
}

function chips(items, cls) {
  return items && items.length ? h('ul', { class: 'chips' }, items.map((t) => h('li', { class: `chip ${cls || ''}` }, t))) : null;
}

/* ----------------------------------------------------------------- lightbox */

let shots = [], at = 0, box;

function showShot(i) {
  at = (i + shots.length) % shots.length;
  const s = shots[at];
  $('img', box).src = s.full || s.src;
  $('img', box).alt = s.alt || s.caption || '';
  $('figcaption', box).textContent = s.caption || '';
}

function openShots(list, i) {
  shots = list;
  if (!box) {
    box = h('dialog', { 'aria-label': 'Screenshot viewer' },
      h('figure', {}, h('img', { alt: '' }), h('figcaption', {}),
        h('div', { class: 'nav' },
          h('button', { type: 'button', 'data-go': '-1' }, '← Previous'),
          h('button', { type: 'button', 'data-go': '1' }, 'Next →'),
          h('button', { type: 'button', 'data-go': 'x' }, 'Close'))));
    box.addEventListener('click', (e) => {
      const go = e.target.dataset && e.target.dataset.go;
      if (go === 'x' || e.target === box) box.close();
      else if (go) showShot(at + Number(go));
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') showShot(at - 1);
      if (e.key === 'ArrowRight') showShot(at + 1);
    });
    document.body.append(box);
  }
  showShot(i);
  box.showModal();
}

function gallery(images) {
  if (!images || !images.length) return null;
  return h('div', { class: 'gallery' }, images.map((im, i) =>
    h('button', { class: 'shot', type: 'button', 'aria-label': `Open: ${im.caption || im.alt || 'screenshot'}`, onclick: null },
      h('img', { src: im.thumb || im.src, alt: im.alt || '', loading: 'lazy', width: 320, height: 200 }),
      h('span', {}, im.caption))));
}

/* ------------------------------------------------------------------ sections */

function project(p) {
  const card = h('article', { class: 'project', id: p.id },
    h('header', {}, h('h3', {}, p.name), p.year && h('span', { class: 'year' }, p.year)),
    h('p', { class: 'summary' }, p.summary),
    p.details && p.details.length ? h('ul', { class: 'details' }, p.details.map((t) => h('li', {}, t))) : null,
    chips([...(p.tags || [])]),
    chips(p.stack, 'stack'),
    gallery(p.images),
    h('div', { class: 'links' },
      link('View on GitHub', p.repo, 'btn primary'),
      link('Download', p.download, 'btn'),
      link('Live demo', p.demo, 'btn')));

  // The thumbnails open the viewer; wired here so the data can stay plain.
  [...card.querySelectorAll('.shot')].forEach((b, i) => b.addEventListener('click', () => openShots(p.images, i)));
  return card;
}

function area(a) {
  return h('section', { class: 'area', id: a.id, 'data-area': a.id, 'aria-labelledby': `${a.id}-h` },
    h('div', { class: 'area-head' }, ICONS[a.id] && ICONS[a.id](), h('h2', { id: `${a.id}-h` }, a.name)),
    h('p', { class: 'blurb' }, a.blurb),
    a.projects.length
      ? a.projects.map(project)
      : h('div', { class: 'soon' }, h('strong', {}, 'Projects coming soon'), `${a.name} work will appear here.`));
}

function build(d) {
  document.title = `${d.handle} · ${d.title}`;
  const main = $('#main');
  main.replaceChildren(hero(d), picker(d), ...d.areas.map(area));
  $('#foot').replaceChildren(h('span', {}, `${d.handle} · ${d.title}`),
    h('a', { href: `https://github.com/${d.handle}`, rel: 'noopener' }, 'github.com/' + d.handle));
}

const dataFile = new URLSearchParams(location.search).get('data') || 'data/profile.json';
fetch(dataFile).then((r) => r.json()).then(build).catch(() => {
  $('#main').replaceChildren(h('p', { class: 'note' }, 'Could not load the profile data.'));
});
