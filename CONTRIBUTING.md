# Contributing to Cakecalc

Thanks for helping! Cakecalc is small on purpose: one dependency-free engine (`public/engine.js`) and one page (`public/index.html`).

```bash
git clone https://github.com/mskraban/cakecalc.git
cd cakecalc
npm install
npm test
npm run dev      # http://localhost:3000
```

## Good first contributions

- More pans (regional sizes, silicone moulds, springform).
- More ingredients for the grams display (`DENSITY` in `public/engine.js`).
- Translations of the page and of the unit words the parser understands.
- Better oven advice, backed by your own test bakes.

## Rules

- New behaviour comes with a test in `test/engine.test.js`.
- Keep it dependency-free and offline-first.
- Run `npm test` before opening a pull request; CI runs it too.
- Include a screenshot of what changed.

## Code of conduct

Be kind and assume good intent. Harassment and personal attacks are not tolerated.
