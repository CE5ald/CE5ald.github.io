/* Builds the whole page from data/cv.json.
 *
 * One file holds every fact, and a section with no data simply does not exist: no heading,
 * no nav link, no placeholder. That makes it impossible to publish an empty "Experience"
 * heading or a visible TODO, and it means editing the CV never touches this file.
 *
 * Everything is written with textContent and checked links, never innerHTML, so nothing in
 * the data can become markup. */
'use strict';

const $ = (s, r = document) => r.querySelector(s);

/** Element builder. Children may be nodes, strings, arrays, or null/false to skip. */
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

/** Only https and mailto links are ever rendered. */
function safeUrl(u) {
  if (!u) return null;
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || x.protocol === 'mailto:' ? x.href : null;
  } catch { return null; }
}

const filled = (v) => (Array.isArray(v) ? v.length > 0 : !!v);
const range = (a, b) => [a, b || (a ? 'Present' : '')].filter(Boolean).join(' to ');

function link(label, url, cls) {
  const href = safeUrl(url);
  // data-print is the address as it should read on paper, where a button has no meaning and a
  // bare "LinkedIn" tells the reader nothing they can type.
  return href ? h('a', {
    class: cls, href, rel: 'noopener', 'data-print': href.replace(/^mailto:|^https:\/\//, ''),
    target: href.startsWith('mailto:') ? null : '_blank',
  }, label) : null;
}

function chips(items) {
  return filled(items) ? h('ul', { class: 'chips' }, items.map((t) => h('li', { class: 'chip' }, t))) : null;
}

/* ------------------------------------------------------------------ sections */

function hero(d) {
  const c = d.contact || {};
  const github = `https://github.com/${d.handle}`;
  return h('section', { class: 'hero', id: 'about-me', 'aria-label': 'Introduction' },
    h('h1', {}, d.name || d.handle),
    d.headline && h('p', { class: 'headline' }, d.headline),
    d.location && h('p', { class: 'where' }, d.location),
    h('div', { class: 'links' },
      link('GitHub', github, 'btn primary'),
      link('Email', c.email && `mailto:${c.email}`, 'btn'),
      link('LinkedIn', c.linkedin, 'btn'),
      link('Website', c.website, 'btn'),
      (c.other || []).map((o) => link(o.label, o.url, 'btn'))));
}

function about(d) {
  return filled(d.summary) && section('about', 'About', h('p', { class: 'prose' }, d.summary));
}

function entries(list, build) {
  return h('ol', { class: 'entries' }, list.map(build));
}

function experience(d) {
  return filled(d.experience) && section('experience', 'Experience', entries(d.experience, (x) =>
    h('li', { class: 'entry' },
      h('div', { class: 'when' }, range(x.start, x.end)),
      h('div', {},
        h('h3', {}, x.role, x.org && h('span', { class: 'org' }, ` at ${x.org}`)),
        x.location && h('div', { class: 'org' }, x.location),
        filled(x.bullets) && h('ul', {}, x.bullets.map((b) => h('li', {}, b)))))));
}

function education(d) {
  return filled(d.education) && section('education', 'Education', entries(d.education, (x) =>
    h('li', { class: 'entry' },
      h('div', { class: 'when' }, range(x.start, x.end)),
      h('div', {},
        h('h3', {}, [x.degree, x.field].filter(Boolean).join(', ') || x.school),
        (x.degree || x.field) && x.school && h('div', { class: 'org' }, x.school),
        x.details && h('div', { class: 'org' }, x.details)))));
}

function skills(d) {
  return filled(d.skills) && section('skills', 'Skills', h('div', { class: 'groups' }, d.skills.map((g) =>
    h('div', { class: 'group' }, h('h3', {}, g.group), chips(g.items)))));
}

function credentials(d) {
  const certs = (d.certifications || []).map((c) =>
    [c.name, c.issuer, c.status, c.date].filter(Boolean).join(', '));
  const langs = (d.languages || []).map((l) => (l.level ? `${l.name} (${l.level})` : l.name));
  if (!certs.length && !langs.length) return false;
  return section('credentials', 'Credentials', h('div', { class: 'groups' },
    certs.length && h('div', { class: 'group' }, h('h3', {}, 'Certifications'), chips(certs)),
    langs.length && h('div', { class: 'group' }, h('h3', {}, 'Languages'), chips(langs))));
}

/* ------------------------------------------------------------------ gallery */

/** Images must live in assets/ and may not climb out of it. */
const okImage = (src) => typeof src === 'string' && /^assets\/[\w./-]+$/.test(src) && !src.includes('..');

let viewer = null;

/**
 * The enlarged view: one <dialog> for the whole page, reused by every gallery. A native dialog
 * brings focus trapping, Escape to close and a backdrop for free, so only the arrows and the
 * click-outside behaviour are written here.
 */
function openViewer(list, index) {
  if (!viewer) {
    const img = h('img', { class: 'lb-img', alt: '' });
    const cap = h('p', { class: 'lb-cap' });
    const count = h('span', { class: 'lb-count' });
    const button = (cls, label, glyph, onClick) => {
      const b = h('button', { class: `lb-btn ${cls}`, type: 'button', 'aria-label': label }, glyph);
      b.addEventListener('click', onClick);
      return b;
    };
    const dialog = h('dialog', { class: 'lightbox', 'aria-label': 'Screenshot viewer' });
    const step = (d) => show((viewer.index + d + viewer.list.length) % viewer.list.length);
    const show = (i) => {
      viewer.index = i;
      const it = viewer.list[i];
      img.src = it.full || it.src;
      img.alt = it.alt || '';
      cap.textContent = it.caption || '';
      count.textContent = `${i + 1} / ${viewer.list.length}`;
    };
    dialog.append(
      button('close', 'Close', '\u00d7', () => dialog.close()),
      button('prev', 'Previous screenshot', '\u2039', () => step(-1)),
      button('next', 'Next screenshot', '\u203a', () => step(1)),
      h('figure', {}, img, h('figcaption', {}, cap, count)));
    // A click on the dim backdrop, outside the picture, closes it.
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
    document.body.append(dialog);
    viewer = { dialog, show, list: [], index: 0 };
  }
  viewer.list = list;
  viewer.show(index);
  if (!viewer.dialog.open) viewer.dialog.showModal();
}

/** A main picture, a strip of thumbnails to choose from, and a click-to-enlarge viewer. */
function gallery(p) {
  const list = (p.images || []).filter((i) => okImage(i.src));
  if (!list.length) return null;

  let current = 0;
  const main = h('img', { class: 'shot', src: list[0].src, alt: list[0].alt || '', width: 1280, height: 750 });
  const caption = h('figcaption', { class: 'shot-cap' }, list[0].caption || '');
  const enlarge = h('button', { class: 'shot-btn', type: 'button', 'aria-label': 'Enlarge this screenshot' }, main);
  enlarge.addEventListener('click', () => openViewer(list, current));

  const thumbs = list.map((it, i) => {
    const b = h('button', {
      class: 'thumb', type: 'button', 'aria-pressed': String(i === 0),
      'aria-label': it.caption || `Screenshot ${i + 1}`,
    }, h('img', { src: okImage(it.thumb) ? it.thumb : it.src, alt: '', loading: 'lazy', width: 160, height: 94 }));
    b.addEventListener('click', () => {
      current = i;
      main.src = it.src;
      main.alt = it.alt || '';
      caption.textContent = it.caption || '';
      thumbs.forEach((t, j) => t.setAttribute('aria-pressed', String(j === i)));
    });
    return b;
  });

  return h('figure', { class: 'gallery' }, enlarge, caption,
    list.length > 1 && h('div', { class: 'thumbs', role: 'group', 'aria-label': 'Choose a screenshot' }, thumbs));
}

/* ------------------------------------------------------------------ projects */

function projectCard(p) {
  const repo = p.published ? link('Repository', p.repo, 'btn primary') : null;
  const demo = link('Live demo', p.demo, 'btn');
  // Images must live in assets/. Anything else, including ../ paths, is ignored.
  const src = p.image && /^assets\/[\w.-]+$/.test(p.image) ? p.image : null;

  const gal = gallery(p);
  return h('article', { class: p.featured ? 'card featured' : 'card', 'data-id': p.id },
    gal || (src && h('img', { src, alt: p.imageAlt || '', loading: 'lazy', width: 1024, height: 576 })),
    h('div', { class: 'body' },
      h('h3', {}, p.name, p.year && h('small', {}, p.year)),
      h('p', {}, p.summary),
      filled(p.details) && h('details', {}, h('summary', {}, 'How it works'),
        h('ul', {}, p.details.map((t) => h('li', {}, t)))),
      h('div', { class: 'stack' }, chips(p.stack)),
      (repo || demo) && h('div', { class: 'actions' }, repo, demo)));
}

function projects(d) {
  const all = d.projects || [];
  if (!all.length) return false;

  // Featured work first, then newest, so the top of the library is the best of it.
  const sorted = [...all].sort((a, b) =>
    Number(!!b.featured) - Number(!!a.featured) || String(b.year).localeCompare(String(a.year)));

  const tags = [...new Set(all.flatMap((p) => p.tags || []))].sort();
  const state = { tag: null, q: '' };
  const grid = h('div', { class: 'grid', id: 'grid' });
  const none = h('p', { class: 'empty', hidden: true }, 'No projects match that.');

  const matches = (p) => {
    if (state.tag && !(p.tags || []).includes(state.tag)) return false;
    if (!state.q) return true;
    const hay = [p.name, p.summary, ...(p.tags || []), ...(p.stack || [])].join(' ').toLowerCase();
    return hay.includes(state.q);
  };

  const draw = () => {
    const shown = sorted.filter(matches);
    grid.replaceChildren(...shown.map(projectCard));
    none.hidden = shown.length > 0;
  };

  // Filters only earn their space once there is something to filter.
  const tools = all.length > 2 && h('div', { class: 'tools' },
    h('input', {
      class: 'search', type: 'search', placeholder: 'Search projects', 'aria-label': 'Search projects',
    }),
    tags.length > 1 && h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter by topic' },
      tags.map((t) => h('button', { class: 'filter', type: 'button', 'aria-pressed': 'false', 'data-tag': t }, t))));

  const node = section('projects', 'Projects', tools, grid, none);

  if (tools) {
    $('.search', node).addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); draw(); });
    $('.filters', node)?.addEventListener('click', (e) => {
      const b = e.target.closest('.filter');
      if (!b) return;
      state.tag = state.tag === b.dataset.tag ? null : b.dataset.tag;
      node.querySelectorAll('.filter').forEach((x) => x.setAttribute('aria-pressed', String(x === b && !!state.tag)));
      draw();
    });
  }

  draw();
  return node;
}

function contact(d) {
  const c = d.contact || {};
  const items = [
    link(c.email, c.email && `mailto:${c.email}`),
    link('LinkedIn', c.linkedin),
    link('Website', c.website),
    ...(c.other || []).map((o) => link(o.label, o.url)),
  ].filter(Boolean);
  if (!items.length) return false;
  return section('contact', 'Contact', h('div', { class: 'links' }, items.map((a) => { a.classList.add('btn'); return a; })));
}

/* ---------------------------------------------------------------------- page */

function section(id, title, ...body) {
  return h('section', { id, 'aria-labelledby': `${id}-h` }, h('h2', { id: `${id}-h` }, title), body);
}

function nav(sections) {
  const nav = $('#nav');
  nav.replaceChildren(...sections
    .filter((s) => s.id && s.querySelector('h2'))
    .map((s) => h('a', { href: `#${s.id}` }, $('h2', s).textContent)));

  // Mark the section being read, so the bar answers "where am I" without a click.
  if (!('IntersectionObserver' in window)) return;
  const links = new Map([...nav.children].map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((hits) => {
    for (const hit of hits) {
      if (!hit.isIntersecting) continue;
      links.forEach((a, id) => {
        if (id === hit.target.id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => s.id && links.has(s.id) && io.observe(s));
}

async function main() {
  let d;
  try {
    // ?data=data/other.json previews an alternative file. Only a plain file inside data/ is
    // accepted, so a crafted link cannot make this page render someone else's content.
    const asked = new URLSearchParams(location.search).get('data');
    const file = asked && /^data\/[\w.-]+\.json$/.test(asked) ? asked : 'data/cv.json';
    const res = await fetch(file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    d = await res.json();
  } catch (e) {
    $('#main').replaceChildren(h('p', { class: 'note' },
      'Could not load data/cv.json. If this is a local copy, serve the folder over http instead of opening the file directly.'));
    return;
  }

  const who = d.name || d.handle;
  document.title = d.headline ? `${who} - ${d.headline}` : who;
  $('meta[name="description"]').content = d.headline || 'CV and project library.';
  $('meta[property="og:title"]').content = who;
  $('#brand').textContent = who;

  const built = [hero(d), about(d), experience(d), education(d), skills(d), projects(d), credentials(d), contact(d)]
    .filter(Boolean);
  $('#main').replaceChildren(...built);
  nav(built);

  $('#foot').textContent = d.updated ? `Updated ${d.updated}.` : '';
  $('#print').addEventListener('click', () => window.print());

  // A closed <details> prints as closed, so open them all while the print sheet is built.
  window.addEventListener('beforeprint', () => document.querySelectorAll('details').forEach((x) => { x.open = true; }));
}

main();
