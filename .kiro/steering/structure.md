# Project Structure

```
net-worth-tracker/
├── index.html              # Single-page app entry point
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (caching strategies)
├── package.json            # Dev dependencies & test scripts only
├── vitest.config.js        # Test configuration (jsdom env)
├── css/
│   └── style.css           # All styles, uses CSS custom properties
├── js/
│   ├── app.js              # App entry — init, navigation, FAB, SW registration
│   ├── state.js            # Global state (Observer pattern), CRUD for assets/liabilities
│   ├── storage.js          # localStorage read/write wrapper (nwt_* keys)
│   ├── calculator.js       # Net worth math, totals, growth rates, loan amortization, validation
│   ├── calculator.test.js  # Unit + property tests for calculator
│   ├── priceFetcher.js     # TWSE & CoinGecko price fetching with exponential backoff
│   ├── searchService.js    # Stock/crypto search and detail lookup
│   ├── snapshotManager.js  # Daily net worth snapshots (create, filter, auto-snapshot)
│   ├── services/
│   │   └── googleSheetsService.js  # Google Sheets sync (class-based singleton)
│   └── ui/
│       ├── dashboard.js    # Dashboard page: stats cards, pie chart
│       ├── assetList.js    # Asset/liability list rendering and interactions
│       ├── trendChart.js   # Net worth trend line chart
│       ├── modal.js        # Add/edit modals for assets and liabilities
│       ├── settings.js     # Settings page (exchange rate, export/import, cache)
│       └── googleIntegration.js  # Google Sheets UI integration
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Architecture Patterns

- **State management**: Centralized in `state.js` using an Observer pattern. All mutations go through `setState()` / `addAsset()` / etc., which auto-persist to localStorage and notify subscribers.
- **Storage layer**: `storage.js` wraps localStorage with JSON serialization. State and storage are separate concerns.
- **UI modules**: Each file in `js/ui/` owns a page or component. They subscribe to state changes and re-render their DOM section.
- **No circular imports**: `snapshotManager.js` deliberately avoids importing `state.js`. It receives data as function arguments instead.
- **Price fetching**: `priceFetcher.js` handles API calls with exponential backoff. Results are batched and deduplicated by symbol.

## Conventions
- Test files live next to their source file (`calculator.test.js` beside `calculator.js`)
- Code comments and JSDoc are written in Traditional Chinese
- HTML string building in UI modules uses manual string concatenation (no template engine)
- XSS protection via a local `esc()` helper that escapes HTML entities
- UUIDs generated via `crypto.randomUUID()` with a Math.random fallback
