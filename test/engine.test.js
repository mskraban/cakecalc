'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/engine.js');
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

test('pan areas match the maths', () => {
  near(C.area(C.panById('round-20')), Math.PI * 100, 0.01);
  near(C.area(C.panById('rect-23x33')), 759, 0.01);
  near(C.area(C.customPan({ shape: 'round', a: 8, unit: 'in' })), Math.PI * (8 * 2.54 / 2) ** 2, 0.01);
  near(C.volume(C.panById('bundt-10')), 2400, 0.01);
});

test('pan factor: familiar cases', () => {
  const r8 = { pan: C.panById('round-20'), count: 1 }, r9 = { pan: C.panById('round-23'), count: 1 };
  near(C.panFactor(r8, r9), (23 / 20) ** 2, 0.001);                                  // 9" is ~1.32× an 8"
  near(C.panFactor({ ...r8, count: 2 }, { pan: C.panById('rect-23x33'), count: 1 }), 759 / (2 * Math.PI * 100), 0.001);
  near(C.panFactor(r8, r8), 1, 1e-9);
  near(C.panFactor(r9, r8) * C.panFactor(r8, r9), 1, 1e-9);                          // there and back again
});

test('quantities: integers, decimals, fractions, mixed numbers, unicode and ranges', () => {
  const q = (s) => C.parseQty(s);
  assert.equal(q('2 cups').qty, 2); assert.equal(q('1.5 cups').qty, 1.5); assert.equal(q('1,5 dl').qty, 1.5);
  assert.equal(q('1/2 cup').qty, 0.5); assert.equal(q('1 1/2 cups').qty, 1.5); assert.equal(q('1½ cups').qty, 1.5); assert.equal(q('½ cup').qty, 0.5); assert.equal(q('2 ¼ tsp').qty, 2.25);
  assert.deepEqual([q('2-3 tbsp').qty, q('2-3 tbsp').qtyMax], [2, 3]); assert.deepEqual([q('2 to 3 eggs').qty, q('2 to 3 eggs').qtyMax], [2, 3]);
  assert.equal(q('salt'), null);
});

test('lines: units, names, notes and parenthesised metric amounts', () => {
  let p = C.parseLine('2 1/2 cups (300g) all-purpose flour, sifted');
  assert.deepEqual([p.qty, p.unit, p.name, p.note, p.alt.qty, p.alt.unit], [2.5, 'cup', 'all-purpose flour', 'sifted', 300, 'g']);
  p = C.parseLine('3 large eggs'); assert.deepEqual([p.qty, p.unit, p.name], [3, null, 'large eggs']);
  p = C.parseLine('250ml cream'); assert.deepEqual([p.qty, p.unit], [250, 'ml']);
  p = C.parseLine('- 1 tbsp. vanilla'); assert.deepEqual([p.qty, p.unit, p.name], [1, 'tbsp', 'vanilla']);
  assert.equal(C.parseLine('Salt, to taste').qty, null); assert.equal(C.parseLine('   '), null);
});

test('scaling: everything moves together and eggs stay whole', () => {
  const lines = (txt, f, o) => C.scaleRecipe(txt, f, o).filter((l) => l.ingredient).map((l) => l.line);
  assert.deepEqual(lines('2 cups flour\n1 cup sugar\n1/2 tsp salt', 2), ['4 cups flour', '2 cups sugar', '1 tsp salt']);
  assert.deepEqual(lines('1 cup milk', 0.5), ['½ cup milk']);
  assert.deepEqual(lines('3 large eggs', 1.5), ['5 large eggs']);
  const egg = C.scaleRecipe('2 eggs', 1.25)[0]; assert.equal(egg.ingredient.text, '3'); assert.match(egg.tip, /adjust/);
  assert.deepEqual(lines('200 g butter', 1.5), ['300 g butter']);
  assert.deepEqual(lines('3 tsp baking powder', 1), ['1 tbsp baking powder']);                      // friendlier unit
  assert.deepEqual(lines('1 tbsp vanilla', 0.66), ['2 tsp vanilla']);
  assert.deepEqual(lines('2-3 tbsp cocoa', 2), ['¼–⅜ cup cocoa']);
});

test('scaling keeps parenthesised metric amounts in step and can add grams', () => {
  assert.deepEqual(C.scaleRecipe('1 cup (240 ml) milk', 1.5).map((l) => l.line), ['1 ½ cups (360 ml) milk']);
  assert.match(C.scaleRecipe('1 cup flour', 2, { grams: true })[0].line, /^2 cups \(240 g\) flour/);
  assert.doesNotMatch(C.scaleRecipe('1 cup mystery', 2, { grams: true })[0].line, /\(\d+ g\)/);
});

test('lines without quantities and steps are untouched', () => {
  const out = C.scaleRecipe('Cake\nSalt to taste\nMix well.', 3);
  assert.deepEqual(out.map((l) => l.text), ['Cake', 'Salt to taste', 'Mix well.']);
});

test('formatting never produces NaN, undefined or empty amounts (fuzz)', () => {
  const units = ['cup', 'cups', 'tbsp', 'tsp', 'g', 'ml', 'oz', 'lb', 'kg', 'l', 'stick', ''];
  for (let i = 0; i < 400; i++) {
    const q = [0.125, 0.25, 1 / 3, 0.5, 1, 1.5, 2, 3, 10, 125, 500][i % 11], f = [0.2, 0.5, 0.66, 1, 1.21, 1.5, 2.5, 4, 9][i % 9];
    const line = C.scaleRecipe(`${q} ${units[i % units.length]} thing`, f)[0].line;
    assert.ok(!/NaN|undefined|Infinity/.test(line) && /^\S/.test(line), line);
  }
});

test('oven advice: same depth keeps the time, deeper is longer and cooler, thinner is shorter', () => {
  const same = C.bakeAdjust({ minutes: 30, temp: 180, depthRatio: 1 }); assert.equal(same.minutes, 30); assert.equal(same.temp, 180);
  const deep = C.bakeAdjust({ minutes: 30, temp: 180, depthRatio: 1.6 }); assert.ok(deep.minutes > 40 && deep.temp < 180);
  const thin = C.bakeAdjust({ minutes: 30, temp: 180, depthRatio: 0.5 }); assert.ok(thin.minutes < 20 && thin.temp === 180);
  assert.equal(C.bakeAdjust({ minutes: 30, temp: 350, tempUnit: 'F', depthRatio: 1.6 }).temp, 325);
  let last = 0; for (const r of [0.4, 0.7, 1, 1.3, 1.6, 2, 3]) { const m = C.bakeAdjust({ minutes: 30, temp: 180, depthRatio: r }).minutes; assert.ok(m >= last, 'time is monotonic in depth'); last = m; }
});

test('plan: volume mode compares depth too', () => {
  const p = C.plan({ from: { pan: C.panById('round-20'), count: 1 }, to: { pan: C.panById('loaf-2lb'), count: 1 }, mode: 'volume', bake: { minutes: 30, temp: 180 } });
  near(p.factor, C.volume(C.panById('loaf-2lb')) / C.volume(C.panById('round-20')), 1e-9); assert.ok(p.bake.minutes >= 30);
});

test('describe is plain English', () => { assert.match(C.describe(1.32), /32% more batter/); assert.match(C.describe(0.66), /34% less batter/); assert.match(C.describe(1.01), /same size/); });
