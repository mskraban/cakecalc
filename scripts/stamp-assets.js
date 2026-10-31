'use strict';
// Adds a content hash to the engine and CSS URLs in public/index.html (engine.js?v=abc123) so a browser or CDN
// can never pair a new page with an old cached engine. Run automatically by `npm test`'s freshness check; run `npm run stamp` after editing.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const pub = path.join(__dirname, '..', 'public'), file = path.join(pub, 'index.html');
const h = (f) => crypto.createHash('md5').update(fs.readFileSync(path.join(pub, f))).digest('hex').slice(0, 8);
let html = fs.readFileSync(file, 'utf8');
for (const f of ['engine.js', 'fonts.css']) html = html.replace(new RegExp(`(["'])${f.replace('.', '\\.')}(\\?v=[0-9a-f]+)?(["'])`, 'g'), `$1${f}?v=${h(f)}$3`);
fs.writeFileSync(file, html); console.log('stamped', h('engine.js'), h('fonts.css'));
