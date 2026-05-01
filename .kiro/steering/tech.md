# Tech Stack

## Runtime & Language
- Vanilla JavaScript (ES Modules, no transpilation)
- Browser-native APIs only — no Node.js runtime in production
- `"type": "module"` in package.json; all JS files use `import`/`export`

## Frontend
- Single-page app loaded from `index.html`
- No framework — plain DOM manipulation
- Chart.js 4.4.0 via CDN for pie and line charts
- Google APIs (`gapi`) loaded via CDN for Sheets integration
- CSS: single `css/style.css`, uses CSS custom properties (variables)

## PWA
- `manifest.json` with standalone display, zh-TW locale
- Service worker (`sw.js`) with two caching strategies:
  - Cache First for app shell assets
  - Network First for external API calls (TWSE, CoinGecko)
- Cache versioned via `CACHE_NAME` constant in sw.js

## Data Storage
- localStorage for all persistence (assets, liabilities, exchange rate, snapshots)
- Keys prefixed with `nwt_` (e.g. `nwt_assets`, `nwt_liabilities`)
- No backend server or database

## External APIs
- TWSE (`mis.twse.com.tw`) — Taiwan stock real-time prices
- CoinGecko (`api.coingecko.com`) — cryptocurrency prices
- Google Sheets API v4 — optional data sync

## Testing
- **Vitest** 1.6 as test runner with jsdom environment
- **fast-check** 3.19 for property-based testing
- Coverage via `@vitest/coverage-v8`
- Test files co-located with source: `*.test.js`

## Common Commands
```bash
# Run tests (single run, no watch)
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run coverage
```

## No Build Step
There is no bundler, compiler, or build pipeline. Source files are served directly. Do not introduce Webpack, Vite (as bundler), Rollup, or TypeScript compilation.
