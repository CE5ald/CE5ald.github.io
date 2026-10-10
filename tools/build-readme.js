// Generates the GitHub profile README from data/cv.json, so the profile front page and the
// CV site are always saying the same thing. Run it after editing the data:
//
//   node tools/build-readme.js
//
// It writes ../CE5ald/README.md (the special <username>/<username> profile repository).
// Like the site, a section with no data is left out entirely.

const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cv.json'), 'utf8'));
const out = path.join(__dirname, '..', '..', data.handle, 'README.md');

const has = (v) => (Array.isArray(v) ? v.length > 0 : !!v);
const range = (a, b) => [a, b || (a ? 'Present' : '')].filter(Boolean).join(' to ');
const site = `https://${data.handle.toLowerCase()}.github.io`;
const c = data.contact || {};

const md = [];
const add = (...lines) => md.push(...lines, '');

add(`# ${data.name || data.handle}`);
if (data.headline) add(`**${data.headline}**`);
if (data.location) add(data.location);

const links = [
  [`CV and projects`, site],
  [`LinkedIn`, c.linkedin],
  [`Website`, c.website],
  [`Email`, c.email && `mailto:${c.email}`],
  ...(c.other || []).map((o) => [o.label, o.url]),
].filter(([, u]) => u).map(([l, u]) => `[${l}](${u})`);
add(links.join(' | '));

if (data.summary) add('## About', data.summary);

const featured = (data.projects || []).filter((p) => p.featured);
if (featured.length) {
  add('## Featured projects');
  for (const p of featured) {
    const title = p.published && p.repo ? `[${p.name}](${p.repo})` : p.name;
    add(`### ${title}`);
    add(p.summary);
    if (has(p.stack)) add(`Built with ${p.stack.join(', ')}.`);
  }
  add(`The full list, with details, is on the [CV site](${site}/#projects).`);
}

if (has(data.skills)) {
  add('## Skills', ...data.skills.map((g) => `- **${g.group}:** ${g.items.join(', ')}`));
}

if (has(data.experience)) {
  add('## Experience', ...data.experience.map((x) =>
    `- **${x.role}**${x.org ? `, ${x.org}` : ''} (${range(x.start, x.end)})`));
}

if (has(data.education)) {
  add('## Education', ...data.education.map((x) =>
    `- **${[x.degree, x.field].filter(Boolean).join(', ') || x.school}**${(x.degree || x.field) && x.school ? `, ${x.school}` : ''} (${range(x.start, x.end)})`));
}

const certs = (data.certifications || []).map((x) => `- ${[x.name, x.issuer, x.status, x.date].filter(Boolean).join(', ')}`);
if (certs.length) add('## Certifications', ...certs);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, md.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
console.log(`wrote ${path.relative(process.cwd(), out)} (${md.length} blocks)`);
