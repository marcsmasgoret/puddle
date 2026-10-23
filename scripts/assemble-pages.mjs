// Assembles the gh-pages site from two Vite builds.
//   node scripts/assemble-pages.mjs <siteDir> <latestDir> <snapDir> <sha7>
// - replaces the site root with the latest build (keeping c/ and builds.json)
// - copies the snapshot to c/<sha7>/
// - keeps the newest KEEP snapshots and writes builds.html
import fs from 'node:fs';
import path from 'node:path';

const KEEP = 30;
const [site, latest, snap, sha] = process.argv.slice(2);
const message = (process.env.COMMIT_MSG ?? '').split('\n')[0];

const PRESERVE = new Set(['.git', 'c', 'builds.json']);
for (const entry of fs.readdirSync(site)) {
  if (!PRESERVE.has(entry)) fs.rmSync(path.join(site, entry), { recursive: true, force: true });
}
fs.cpSync(latest, site, { recursive: true });
fs.mkdirSync(path.join(site, 'c'), { recursive: true });
fs.rmSync(path.join(site, 'c', sha), { recursive: true, force: true });
fs.cpSync(snap, path.join(site, 'c', sha), { recursive: true });
fs.writeFileSync(path.join(site, '.nojekyll'), '');

const listFile = path.join(site, 'builds.json');
let builds = fs.existsSync(listFile) ? JSON.parse(fs.readFileSync(listFile, 'utf8')) : [];
builds = [{ sha, message, date: new Date().toISOString() }, ...builds.filter((b) => b.sha !== sha)];
for (const old of builds.slice(KEEP)) {
  fs.rmSync(path.join(site, 'c', old.sha), { recursive: true, force: true });
}
builds = builds.slice(0, KEEP);
fs.writeFileSync(listFile, JSON.stringify(builds, null, 2));

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rows = builds
  .map(
    (b, i) => `<li><a href="c/${b.sha}/"><code>${b.sha}</code></a>
      <span class="msg">${esc(b.message)}</span>
      <time>${b.date.slice(0, 16).replace('T', ' ')} UTC</time>${i === 0 ? ' <b>latest</b>' : ''}</li>`,
  )
  .join('\n');

fs.writeFileSync(
  path.join(site, 'builds.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Puddle builds</title>
<style>
  body{font:15px/1.5 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#2c2430;background:#fbf6f2}
  h1{font-weight:300;letter-spacing:.2em;text-transform:uppercase}
  ul{list-style:none;padding:0} li{padding:10px 0;border-bottom:1px solid #e8dcd4;display:flex;gap:12px;flex-wrap:wrap;align-items:baseline}
  code{font-size:14px} .msg{flex:1;min-width:200px} time{color:#8a7d86;font-size:13px} b{color:#b4566a;font-size:12px}
  a{color:#5b6fb0}
</style></head><body>
<h1>Puddle builds</h1>
<p><a href="./">Open the latest version</a>. Each link below is a frozen copy of that commit.</p>
<ul>
${rows}
</ul></body></html>`,
);
console.log(`assembled ${sha}; ${builds.length} snapshots kept`);
