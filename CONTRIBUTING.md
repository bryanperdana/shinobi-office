# Contributing

1. `npm ci`, then `npx playwright install chromium` if you want to run the browser QA.
2. Keep the simulation and live model **pure**: no three.js or SDK imports in `brain.js`, `grid.js`,
   `world.js`, `talk.js` or `live/*`. Add unit tests in `test/` for behaviour changes.
3. Run `npm test`, `npm run build`, `npm run check`, and ideally `npm run qa:plugin` and `npm run qa:3d`.
4. Follow the privacy principles in [docs/PRIVACY.md](docs/PRIVACY.md). New UI must never show message
   content, tool arguments or task bodies.
5. All art must be original and procedural (code-generated). Do not add copyrighted assets or character
   likenesses.
6. Never commit personal configuration. `src/config.local.js` is git-ignored for that reason.
