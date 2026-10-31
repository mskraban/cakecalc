/* Cakecalc engine: pan geometry, recipe parsing, scaling and bake-time adjustment.
   Dependency-free; runs in browsers and Node. No randomness, no network. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cakecalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = 1;
  const IN = 2.54;                                  // cm per inch
  const PI = Math.PI;

  /* ───────────── pans ───────────── */
  // dims are in cm; depth is the typical batter depth in cm for that pan when the recipe is "full".
  const PANS = [
    { id: 'round-15', name: '6″ round (15 cm)', shape: 'round', d: 15, depth: 5 },
    { id: 'round-18', name: '7″ round (18 cm)', shape: 'round', d: 18, depth: 5 },
    { id: 'round-20', name: '8″ round (20 cm)', shape: 'round', d: 20, depth: 5 },
    { id: 'round-23', name: '9″ round (23 cm)', shape: 'round', d: 23, depth: 5 },
    { id: 'round-25', name: '10″ round (25 cm)', shape: 'round', d: 25, depth: 5 },
    { id: 'round-30', name: '12″ round (30 cm)', shape: 'round', d: 30, depth: 5 },
    { id: 'square-15', name: '6″ square (15 cm)', shape: 'rect', w: 15, l: 15, depth: 5 },
    { id: 'square-20', name: '8″ square (20 cm)', shape: 'rect', w: 20, l: 20, depth: 5 },
    { id: 'square-23', name: '9″ square (23 cm)', shape: 'rect', w: 23, l: 23, depth: 5 },
    { id: 'rect-23x33', name: '9×13″ rectangle (23×33 cm)', shape: 'rect', w: 23, l: 33, depth: 5 },
    { id: 'rect-28x18', name: '11×7″ rectangle (28×18 cm)', shape: 'rect', w: 18, l: 28, depth: 5 },
    { id: 'sheet-half', name: 'Half sheet 18×13″ (46×33 cm)', shape: 'rect', w: 33, l: 46, depth: 2.5 },
    { id: 'sheet-quarter', name: 'Quarter sheet 13×9″ (33×23 cm)', shape: 'rect', w: 23, l: 33, depth: 2.5 },
    { id: 'jelly-roll', name: 'Jelly roll 15×10″ (38×25 cm)', shape: 'rect', w: 25, l: 38, depth: 1.5 },
    { id: 'loaf-1lb', name: '1 lb loaf 8.5×4.5″ (22×11 cm)', shape: 'rect', w: 11, l: 22, depth: 7 },
    { id: 'loaf-2lb', name: '2 lb loaf 9×5″ (23×13 cm)', shape: 'rect', w: 13, l: 23, depth: 7 },
    { id: 'bundt-6', name: 'Bundt, 6 cup (1.4 L)', shape: 'volume', ml: 1400, depth: 7 },
    { id: 'bundt-10', name: 'Bundt, 10 cup (2.4 L)', shape: 'volume', ml: 2400, depth: 8 },
    { id: 'bundt-12', name: 'Bundt, 12 cup (2.8 L)', shape: 'volume', ml: 2800, depth: 8 },
    { id: 'tube-10', name: 'Tube / angel food 10″ (3.5 L)', shape: 'volume', ml: 3500, depth: 9 },
    { id: 'muffin-std', name: 'Standard muffin cup (≈ 120 ml)', shape: 'volume', ml: 120, depth: 3.5, each: true },
    { id: 'muffin-mini', name: 'Mini muffin cup (≈ 30 ml)', shape: 'volume', ml: 30, depth: 2.5, each: true },
    { id: 'muffin-jumbo', name: 'Jumbo muffin cup (≈ 230 ml)', shape: 'volume', ml: 230, depth: 4.5, each: true },
  ];
  const panById = (id) => PANS.find((p) => p.id === id) || null;

  /** Custom pan from user numbers. unit: 'cm' | 'in'. */
  function customPan({ shape, a, b, depth, unit = 'cm', ml }) {
    const k = unit === 'in' ? IN : 1;
    if (shape === 'round') return { id: 'custom', name: 'Custom round', shape: 'round', d: a * k, depth: (depth || 5 / k) * k };
    if (shape === 'rect') return { id: 'custom', name: 'Custom rectangle', shape: 'rect', w: a * k, l: (b || a) * k, depth: (depth || 5 / k) * k };
    return { id: 'custom', name: 'Custom volume', shape: 'volume', ml, depth: (depth || 6 / k) * k };
  }

  /** Footprint area in cm² (for volume pans: volume ÷ depth). */
  function area(p) {
    if (p.shape === 'round') return PI * (p.d / 2) * (p.d / 2);
    if (p.shape === 'rect') return p.w * p.l;
    return p.ml / p.depth;
  }
  /** Capacity in ml at the pan's nominal depth. */
  function volume(p) { return p.shape === 'volume' ? p.ml : area(p) * p.depth; }

  /**
   * Scale factor between two sets of pans.
   * from/to: { pan, count }. mode: 'depth' keeps the batter the same depth (area ratio),
   * 'volume' fills each pan to its own nominal depth (volume ratio).
   */
  function panFactor(from, to, mode = 'depth') {
    const f = (x) => (mode === 'volume' ? volume(x.pan) : area(x.pan)) * (x.count || 1);
    return f(to) / f(from);
  }

  /* ───────────── numbers ───────────── */
  const VULGAR = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
  const FRAC_CHARS = Object.keys(VULGAR).join('');

  /** Parse a leading quantity: "2", "1.5", "1/2", "1 1/2", "1½", "½", "2-3", "2 to 3". Returns { qty, qtyMax, rest } or null. */
  function parseQty(s) {
    const re = new RegExp(`^\\s*(\\d+(?:[.,]\\d+)?)?\\s*([${FRAC_CHARS}])?`);
    const frac = /^\s*(\d+)\s+(\d+)\s*\/\s*(\d+)/.exec(s) || /^\s*(\d+)\s*\/\s*(\d+)/.exec(s);
    let qty = null, rest = s, m;
    if (frac && frac.length === 4) { qty = +frac[1] + frac[2] / frac[3]; rest = s.slice(frac[0].length); }
    else if (frac) { qty = frac[1] / frac[2]; rest = s.slice(frac[0].length); }
    else if ((m = re.exec(s)) && (m[1] || m[2])) { qty = (m[1] ? parseFloat(m[1].replace(',', '.')) : 0) + (m[2] ? VULGAR[m[2]] : 0); rest = s.slice(m[0].length); }
    else return null;
    // ranges: "2-3", "2 to 3"
    const r = /^\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[¼-¾⅐-⅞])/.exec(rest);
    let qtyMax = null;
    if (r) { const q2 = parseQty(r[1]); if (q2) { qtyMax = q2.qty; rest = rest.slice(r[0].length); } }
    return { qty, qtyMax, rest };
  }

  /* ───────────── units ───────────── */
  // base: ml for volume, g for mass, null for count words
  const UNITS = {
    cup: { k: 'vol', ml: 236.588, aka: ['cup', 'cups', 'c'] },
    tbsp: { k: 'vol', ml: 14.7868, aka: ['tbsp', 'tbsps', 'tbs', 'tablespoon', 'tablespoons', 'tbl'] },
    tsp: { k: 'vol', ml: 4.92892, aka: ['tsp', 'tsps', 'teaspoon', 'teaspoons'] },
    ml: { k: 'vol', ml: 1, aka: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'] },
    l: { k: 'vol', ml: 1000, aka: ['l', 'liter', 'liters', 'litre', 'litres'] },
    dl: { k: 'vol', ml: 100, aka: ['dl', 'deciliter', 'deciliters'] },
    floz: { k: 'vol', ml: 29.5735, aka: ['floz', 'fl.oz', 'fl', 'fluid'] },
    g: { k: 'mass', g: 1, aka: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes'] },
    kg: { k: 'mass', g: 1000, aka: ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms'] },
    oz: { k: 'mass', g: 28.3495, aka: ['oz', 'ounce', 'ounces'] },
    lb: { k: 'mass', g: 453.592, aka: ['lb', 'lbs', 'pound', 'pounds'] },
    stick: { k: 'mass', g: 113.4, aka: ['stick', 'sticks'] },
    pinch: { k: 'small', aka: ['pinch', 'pinches', 'dash', 'dashes'] },
    clove: { k: 'count', aka: ['clove', 'cloves'] },
    can: { k: 'count', aka: ['can', 'cans', 'tin', 'tins', 'package', 'packages', 'pkg', 'packet', 'packets', 'bar', 'bars'] },
  };
  const UNIT_LOOKUP = {};
  for (const [id, u] of Object.entries(UNITS)) for (const a of u.aka) UNIT_LOOKUP[a] = id;

  // grams per US cup, for common baking ingredients. Used only for the optional "also show grams" display.
  const DENSITY = [
    [/all[- ]?purpose flour|plain flour|\bflour\b|cake flour|pastry flour|bread flour/, 120, 'flour'],
    [/powdered sugar|icing sugar|confectioners/, 120, 'sugar'],
    [/brown sugar/, 213, 'sugar'],
    [/granulated sugar|caster sugar|superfine sugar|\bsugar\b/, 200, 'sugar'],
    [/cocoa|cacao/, 85, 'cocoa'],
    [/butter|margarine/, 227, 'butter'],
    [/vegetable oil|canola oil|olive oil|\boil\b/, 218, 'oil'],
    [/honey|maple syrup|golden syrup|molasses|corn syrup/, 340, 'syrup'],
    [/milk|buttermilk|cream|yogh?urt|sour cream|water|juice/, 240, 'liquid'],
    [/rolled oats|oats/, 90, 'oats'],
    [/chocolate chips|chocolate chunks/, 170, 'choc'],
    [/almond flour|ground almonds|almond meal/, 96, 'nut'],
    [/chopped nuts|walnuts|pecans|almonds/, 120, 'nut'],
    [/shredded coconut|desiccated coconut/, 80, 'coconut'],
    [/rice/, 185, 'rice'],
    [/cornstarch|corn flour|cornflour/, 128, 'starch'],
    [/salt/, 288, 'salt'],
  ];
  function gramsPerCup(name) { const n = name.toLowerCase(); for (const [re, g] of DENSITY) if (re.test(n)) return g; return null; }

  const SKIP_UNIT_WORDS = new Set(['of', 'large', 'medium', 'small', 'extra', 'heaping', 'heaped', 'level', 'scant', 'generous']);

  /**
   * Parse one ingredient line. Returns { raw, qty, qtyMax, unit, name, note, section } where
   * qty is null for lines like "pinch of salt" or "salt to taste" (those are left alone).
   * Parenthesised alternatives such as "(300g)" are kept in `alt` and scaled too.
   */
  function parseLine(raw) {
    const line = raw.replace(/ /g, ' ').replace(/^[\s•*·\-–—▢☐□✓]+/, '').trim();
    if (!line) return null;
    const q = parseQty(line);
    if (!q) return { raw, qty: null, unit: null, name: line, note: '', alt: null };
    let rest = q.rest.trim(), alt = null;
    // leading parenthesised metric alternative: "(300 g)" or "(300g)"
    let um = /^([a-zA-Z.]+)\b\.?/.exec(rest.replace(/^(heaping|heaped|level|scant|generous)\s+/i, ''));
    let unit = null;
    if (um) { const id = UNIT_LOOKUP[um[1].toLowerCase().replace(/\.$/, '')]; if (id) { unit = id; rest = rest.replace(/^(heaping|heaped|level|scant|generous)\s+/i, '').slice(um[0].length).trim(); } }
    // "fl oz"
    if (unit === 'floz') rest = rest.replace(/^oz\.?\s*/i, '');
    if (unit === 'floz' && /^fl\b/i.test(um[1])) unit = 'floz';
    const pm = /^\(([^)]*)\)\s*/.exec(rest);
    if (pm) { const a = parseQty(pm[1]); if (a) { const au = /^\s*([a-zA-Z.]+)/.exec(a.rest); const aid = au && UNIT_LOOKUP[au[1].toLowerCase().replace(/\.$/, '')]; if (aid) { alt = { qty: a.qty, unit: aid }; rest = rest.slice(pm[0].length); } } }
    rest = rest.replace(/^of\s+/i, '');
    const parts = rest.split(/,(.*)/s), name = parts[0].trim(), note = (parts[1] || '').trim();
    return { raw, qty: q.qty, qtyMax: q.qtyMax, unit, name, note, alt };
  }

  /** Parse a pasted recipe. Lines without a quantity (headings, steps) are kept as text. */
  function parseRecipe(text) {
    return String(text || '').split(/\r?\n/).map((l) => { const t = l.trim(); if (!t) return { blank: true }; const p = parseLine(t); return p && p.qty !== null ? { ingredient: p } : { text: t }; });
  }

  /* ───────────── formatting ───────────── */
  const FRACS = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'], [1, '']];
  /** Format a number as a kitchen fraction ("1 ½"), to the nearest 1/8 (or 1/4 when `coarse`). */
  function fraction(x, coarse = false) {
    if (x <= 0) return '0';
    const opts = coarse ? FRACS.filter((f) => [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1].some((v) => Math.abs(v - f[0]) < 1e-9)) : FRACS;
    let whole = Math.floor(x + 1e-9), frac = x - whole, best = opts[0];
    for (const f of opts) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
    if (best[0] === 1) { whole += 1; best = opts[0]; }
    if (whole === 0 && best[1] === '') return x < 0.0625 ? 'a pinch' : '⅛';
    return `${whole || ''}${whole && best[1] ? ' ' : ''}${best[1]}`.trim();
  }
  const tidy = (n, step) => Math.round(n / step) * step;
  function metric(n) { // grams / ml, rounded sensibly
    if (n < 10) return String(Math.round(n * 2) / 2);
    if (n < 100) return String(Math.round(n));
    if (n < 1000) return String(tidy(n, 5));
    return String(Math.round(n / 10) / 100).replace(/\.0+$/, '') + ' k';
  }
  function fmtAmount(qty, unit) {
    switch (unit) {
      case 'cup': return `${fraction(qty)} cup${qty > 1.0001 ? 's' : ''}`;
      case 'tbsp': case 'tsp': return `${fraction(qty, qty >= 2)} ${unit}`;
      case 'stick': return `${fraction(qty, true)} stick${qty > 1.0001 ? 's' : ''}`;
      case 'oz': return `${Math.round(qty * 4) / 4} oz`.replace(/\.0+ /, ' ');
      case 'lb': return `${fraction(qty, true)} lb`;
      case 'floz': return `${Math.round(qty * 2) / 2} fl oz`;
      case 'g': case 'ml': return qty >= 1000 ? `${Math.round(qty / 10) / 100} ${unit === 'g' ? 'kg' : 'l'}` : `${metric(qty)} ${unit}`;
      case 'kg': return `${Math.round(qty * 100) / 100} kg`;
      case 'l': return `${Math.round(qty * 100) / 100} l`;
      case 'dl': return `${Math.round(qty * 10) / 10} dl`;
      case 'can': return `${fraction(qty, true)}`;
      default: return `${fraction(qty, true)}${unit ? ' ' + unit : ''}`.trim();
    }
  }

  /** Move small/large US spoon and cup amounts into the friendliest unit. */
  function friendlyUnit(qty, unit) {
    if (unit === 'tsp' && qty >= 3) return { qty: qty / 3, unit: 'tbsp' };
    if (unit === 'tbsp' && qty >= 4) return { qty: qty / 16, unit: 'cup' };
    if (unit === 'cup' && qty < 0.2) return { qty: qty * 16, unit: 'tbsp' };
    if (unit === 'tbsp' && qty < 1) return { qty: qty * 3, unit: 'tsp' };
    if (unit === 'g' && qty >= 1000) return { qty: qty / 1000, unit: 'kg' };
    return { qty, unit };
  }

  const EGG = /\b(eggs?|egg yolks?|egg whites?)\b/i;
  const EGG_G = { 'egg yolk': 18, 'egg white': 33, egg: 50 };

  /**
   * Scale a parsed ingredient. Returns { text, name, note, exact, tip? }.
   * opts.grams: also show grams for cup/spoon amounts of known ingredients.
   */
  function scaleIngredient(ing, factor, opts = {}) {
    let qty = ing.qty * factor, qmax = ing.qtyMax ? ing.qtyMax * factor : null, unit = ing.unit, tip = '';
    const isEgg = !unit && EGG.test(ing.name);
    const parts = [];
    if (isEgg) {
      const nm = (/yolk/i.test(ing.name) ? 'egg yolk' : /white/i.test(ing.name) ? 'egg white' : 'egg');
      const whole = Math.round(qty * 2) / 2, rounded = Math.round(qty);
      let shown = rounded < 1 ? 1 : rounded;
      if (Math.abs(qty - rounded) > 0.2) tip = `Exactly ${Math.round(qty * 100) / 100} ${nm}s: use ${shown} and adjust with ${Math.abs(Math.round((qty - shown) * EGG_G[nm]))} g of beaten egg (or a little milk).`;
      parts.push(`${shown}`);
      return { text: `${shown}`, name: ing.name, note: ing.note, tip, qty: qty, unit: null, exact: qty };
    }
    const before = qty;
    ({ qty, unit } = friendlyUnit(qty, unit));
    if (qmax) qmax *= qty / before;                    // convert the top of a range into the same unit
    let amount = unit ? fmtAmount(qty, unit) : fraction(qty, true);
    if (qmax) { const top = unit ? fmtAmount(qmax, unit) : fraction(qmax, true); amount = amount.replace(/\s+(cups?|tbsp|tsp|sticks?|kg|g|ml|l|dl|lb|oz|fl oz)$/, '') + '–' + top; }
    // original parenthesised alternative, scaled
    if (ing.alt) { const aq = ing.alt.qty * factor; amount += ` (${fmtAmount(aq, ing.alt.unit)})`; }
    else if (opts.grams && (unit === 'cup' || unit === 'tbsp' || unit === 'tsp')) {
      const gpc = gramsPerCup(ing.name);
      if (gpc) { const cups = unit === 'cup' ? qty : unit === 'tbsp' ? qty / 16 : qty / 48; amount += ` (${metric(cups * gpc)} g)`; }
    }
    return { text: amount, name: ing.name, note: ing.note, tip, qty, unit, exact: qty };
  }

  /** Scale a whole recipe text; returns plain lines ready to print or copy. */
  function scaleRecipe(text, factor, opts = {}) {
    const items = parseRecipe(text);
    const lines = items.map((it) => {
      if (it.blank) return { blank: true };
      if (it.text) return { text: it.text };
      const s = scaleIngredient(it.ingredient, factor, opts);
      return { ingredient: s, line: `${s.text} ${s.name}${s.note ? ', ' + s.note : ''}`.replace(/\s+/g, ' ').trim(), tip: s.tip };
    });
    return lines;
  }

  /* ───────────── baking time and temperature ───────────── */
  /**
   * Heuristic oven advice. `depthRatio` is new batter depth ÷ old batter depth
   * (1 when you keep the same depth). Thicker batter needs longer and a slightly lower oven so
   * the edges do not set before the middle; thinner needs less time.
   * Returns { minutes, tempC, tempF, note } for the new pan.
   */
  function bakeAdjust({ minutes, temp, tempUnit = 'C', depthRatio = 1, areaRatio = 1 }) {
    const r = Math.max(0.2, depthRatio);
    let t = minutes * Math.pow(r, 0.8);
    t = Math.max(minutes * 0.5, Math.min(minutes * 2.6, t));
    const down = tempUnit === 'F' ? 25 : 15;
    let temp2 = temp, note = '';
    if (r >= 1.45) { temp2 = temp - down; t *= 1.12; note = `Thick batter: lower the oven by ${tempUnit === 'F' ? '25°F' : '10–15°C'} and tent with foil if the top browns early.`; }
    else if (r >= 1.15) { temp2 = temp - down / 2; note = 'Slightly deeper batter: a touch cooler oven helps the middle catch up.'; }
    else if (r <= 0.7) note = 'Thin layer: start checking early, it can finish much sooner.';
    else if (Math.abs(areaRatio - 1) > 0.15) note = 'Similar depth: time stays about the same. Check with a skewer.';
    const mins = Math.round(t / 5) * 5 || Math.round(t);
    return { minutes: mins, minMinutes: Math.max(1, Math.round(mins * 0.9)), maxMinutes: Math.round(mins * 1.1), temp: Math.round(temp2), tempUnit, note };
  }

  /** One-call convenience: pans in, factor and oven advice out. */
  function plan({ from, to, mode = 'depth', bake }) {
    const factor = panFactor(from, to, mode);
    const aFrom = area(from.pan) * (from.count || 1), aTo = area(to.pan) * (to.count || 1);
    const depthRatio = mode === 'volume' ? (to.pan.depth / from.pan.depth) : 1;
    const out = { factor, areaRatio: aTo / aFrom, depthRatio, from: { area: aFrom, volume: volume(from.pan) * (from.count || 1) }, to: { area: aTo, volume: volume(to.pan) * (to.count || 1) } };
    if (bake && bake.minutes) out.bake = bakeAdjust({ ...bake, depthRatio, areaRatio: out.areaRatio });
    return out;
  }

  /** A short plain-English summary of the change. */
  function describe(factor) {
    if (Math.abs(factor - 1) < 0.03) return 'About the same size: no change needed.';
    const pct = Math.round(Math.abs(factor - 1) * 100);
    return `${pct}% ${factor > 1 ? 'more' : 'less'} batter`;
  }

  return { VERSION, PANS, UNITS, panById, customPan, area, volume, panFactor, parseQty, parseLine, parseRecipe, fraction, fmtAmount, scaleIngredient, scaleRecipe, bakeAdjust, plan, describe, gramsPerCup, friendlyUnit };
});
