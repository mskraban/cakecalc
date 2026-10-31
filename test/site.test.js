'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const PUB = path.join(__dirname, '..', 'public'), SITE = 'https://cakecalc-sigma.vercel.app';
const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const meta = (re) => { const m = html.match(re); return m ? m[1] : null; };

test('title, description, canonical, social tags and a single h1', () => {
  const title = meta(/<title>([^<]+)<\/title>/); assert.ok(title.length >= 20 && title.length <= 75, `title ${title.length}`);
  const desc = meta(/<meta name="description" content="([^"]+)"/); assert.ok(desc.length >= 70 && desc.length <= 175, `description ${desc.length}`);
  assert.equal(meta(/<link rel="canonical" href="([^"]+)"/), SITE + '/');
  for (const t of ['og:title', 'og:description', 'og:url', 'og:image']) assert.ok(html.includes(`property="${t}"`), t);
  assert.ok(html.includes('name="twitter:card"') && html.includes('rel="apple-touch-icon"') && /<html lang="en">/.test(html));
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
});
test('structured data parses; local files exist', () => {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
  for (const m of html.replace(/<script>[\s\S]*?<\/script>/g, '').matchAll(/(?:href|src)="([^"#?]+)[^"]*"/g)) { const u = m[1]; if (/^(https?:|mailto:|data:)/.test(u)) continue; assert.ok(fs.existsSync(path.join(PUB, u)), `missing ${u}`); }
});
test('the pan chart in the page is up to date (run `npm run chart`)', () => {
  const file = path.join(PUB, 'index.html'), before = fs.readFileSync(file, 'utf8'); execFileSync('node', [path.join(__dirname, '..', 'scripts', 'build-chart.js')]);
  assert.equal(fs.readFileSync(file, 'utf8'), before); assert.ok(before.includes('<td>9×13″ rectangle'));
});
test('every element id the script uses exists', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/\$\('([A-Za-z0-9-]+)'\)/g)) assert.ok(ids.has(m[1]) || ['fromCustom', 'toCustom'].includes(m[1]) || /^(print|copy|grams)$/.test(m[1]), `#${m[1]} missing`);
});
test('fonts and licences are present', () => {
  for (const m of fs.readFileSync(path.join(PUB, 'fonts.css'), 'utf8').matchAll(/url\('(fonts\/[^']+)'\)/g)) assert.ok(fs.existsSync(path.join(PUB, m[1])));
  assert.ok(fs.readdirSync(path.join(PUB, 'fonts')).filter((f) => /LICENSE/.test(f)).length >= 3);
});
