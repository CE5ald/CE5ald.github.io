// Generates the GitHub profile README from data/profile.json, so the profile front page and the
// site always say the same thing. Run it after editing the data:
//
//   node tools/build-readme.js
//
// It writes ../CE5ald/README.md (the special <username>/<username> profile repository).

const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'profile.json'), 'utf8'));
const out = path.join(__dirname, '..', '..', data.handle, 'README.md');
const site = `https://${data.handle.toLowerCase()}.github.io`;

const GLYPH = { telecom: '📡', networks: '🕸️', ai: '🧠' };
const md = [];
const add = (...lines) => md.push(...lines, '');

add(`# ${data.handle}`);
add(`### ${data.title}`);
add(`[Profile site](${site}) · [GitHub](https://github.com/${data.handle})`);

// The three areas as a table, so the shape of the profile is visible before anything is opened.
add('| ' + data.areas.map((a) => `${GLYPH[a.id] || ''} ${a.name}`).join(' | ') + ' |',
    '|' + data.areas.map(() => ' --- ').join('|') + '|',
    '| ' + data.areas.map((a) => a.blurb).join(' | ') + ' |');

for (const a of data.areas) {
  add(`## ${GLYPH[a.id] || ''} ${a.name}`.trim());
  if (!a.projects.length) { add('*Projects coming soon.*'); continue; }
  for (const p of a.projects) {
    add(`### [${p.name}](${p.repo})`);
    if (/^https:\/\//.test(p.readmeImage || '')) {
      const alt = (p.images && p.images[0] && p.images[0].alt) || p.name;
      add(`[![${alt}](${p.readmeImage})](${p.repo})`);
    }
    add(p.summary);
    if (p.stack && p.stack.length) add(`Built with ${p.stack.join(', ')}.`);
    const links = [[`Source`, p.repo], [`Download`, p.download], [`More`, `${site}/#${a.id}`]]
      .filter(([, u]) => u).map(([l, u]) => `[${l}](${u})`);
    add(links.join(' · '));
  }
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, md.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
console.log(`wrote ${out}`);
