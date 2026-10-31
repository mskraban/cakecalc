'use strict';
// Generates the favicon set and the social preview image. Run: npm run assets
const fs = require('fs'), path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const pub = path.join(__dirname, '..', 'public');
GlobalFonts.registerFromPath(path.join(pub, 'fonts/bricolage-grotesque-latin-wght-normal.woff2'), 'Bricolage');
GlobalFonts.registerFromPath(path.join(pub, 'fonts/inter-latin-wght-normal.woff2'), 'InterV');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#d9466f"/><path d="M14 36h36v12a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#fff"/><path d="M14 36c4 5 8-3 12 0s8-3 12 0 8-3 12 0V30a4 4 0 0 0-4-4H18a4 4 0 0 0-4 4z" fill="#ffe3ea"/><rect x="30" y="14" width="4" height="12" rx="2" fill="#ffd36e"/><ellipse cx="32" cy="12" rx="3.2" ry="4.4" fill="#ff9d3a"/></svg>\n`;
fs.writeFileSync(path.join(pub, 'favicon.svg'), svg);
function mark(x, px, py, s) { const k = s / 64; x.save(); x.translate(px, py); x.scale(k, k); x.fillStyle = '#d9466f'; x.beginPath(); x.roundRect(0, 0, 64, 64, 16); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.roundRect(14, 36, 36, 16, 4); x.fill(); x.fillStyle = '#ffe3ea'; x.beginPath(); x.roundRect(14, 26, 36, 12, [4, 4, 0, 0]); x.fill(); x.fillStyle = '#ffd36e'; x.beginPath(); x.roundRect(30, 14, 4, 12, 2); x.fill(); x.fillStyle = '#ff9d3a'; x.beginPath(); x.ellipse(32, 12, 3.2, 4.4, 0, 0, 7); x.fill(); x.restore(); }
for (const [n, s] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['favicon-32.png', 32]]) { const c = createCanvas(s, s), x = c.getContext('2d'); mark(x, 0, 0, s); fs.writeFileSync(path.join(pub, n), c.toBuffer('image/png')); }
const W = 1200, H = 630, c = createCanvas(W, H), x = c.getContext('2d'); x.fillStyle = '#fff6ec'; x.fillRect(0, 0, W, H);
mark(x, 72, 62, 64); x.fillStyle = '#3b2a24'; x.font = '800 40px Bricolage'; x.fillText('Cakecalc', 148, 108);
x.font = '800 96px Bricolage'; x.fillText('Change the pan.', 72, 280); x.fillStyle = '#d9466f'; x.fillText('Keep the cake.', 72, 384);
x.fillStyle = '#7d6a62'; x.font = '500 30px InterV'; x.fillText('Scale any recipe to any pan: ingredients, eggs, baking time.', 74, 456);
// two pans
x.fillStyle = '#ffd6df'; x.strokeStyle = '#d9466f'; x.lineWidth = 6; x.beginPath(); x.arc(900, 250, 110, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.arc(1010, 300, 80, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.roundRect(850, 380, 250, 150, 16); x.fill(); x.stroke();
let cx = 74; for (const t of ['free', 'offline', 'printable']) { x.font = '600 24px InterV'; const w = x.measureText(t).width; x.fillStyle = '#ffeedd'; x.beginPath(); x.roundRect(cx, 500, w + 36, 48, 24); x.fill(); x.fillStyle = '#3b2a24'; x.fillText(t, cx + 18, 533); cx += w + 52; }
fs.writeFileSync(path.join(pub, 'og.jpg'), c.toBuffer('image/jpeg', 90)); console.log('assets done');
