'use strict';
// Injects the pan comparison chart into public/index.html so search engines can read it. Run: npm run chart
const fs = require('fs'), path = require('path');
const C = require('../public/engine.js');
const ref = C.area(C.panById('round-20'));
const rows = C.PANS.filter((p) => !p.each).map((p) => `<tr><td>${p.name}</td><td>${Math.round(C.area(p))} cm²</td><td>${Math.round(C.volume(p) / 10) * 10} ml</td><td><b>×${(C.area(p) / ref).toFixed(2)}</b></td></tr>`).join('\n');
const html = `<!--CHART--><div class="tablewrap"><table><thead><tr><th>Pan</th><th>Base area</th><th>Capacity</th><th>× an 8″ round</th></tr></thead><tbody>\n${rows}\n</tbody></table></div><!--/CHART-->`;
const file = path.join(__dirname, '..', 'public', 'index.html');
fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/<!--CHART-->[\s\S]*?<!--\/CHART-->/, html));
console.log('chart updated');
