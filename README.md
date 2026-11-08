# LEGEND OF ELDORIA — Prototype 0.2.3

A mobile/desktop browser prototype: isometric Greenvale Village exploration and a separate deck-building battle screen.

## Run locally

The game is static HTML/CSS/JavaScript. Open `index.html` through a local HTTP server (recommended) or deploy the repository root with GitHub Pages.

Example with Python:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

1. Create a GitHub repository.
2. Upload the contents of this package to the repository root. `index.html` must be at the root, alongside `css/`, `js/`, and `assets/`.
3. In Settings → Pages, select Deploy from a branch and choose `main` / root.
4. Wait for the Pages deployment to complete, then open the published URL.

## Save data

Prototype saves are stored in the current browser's local storage. They do not sync between devices or browsers. Clearing website data, private browsing restrictions, or browser storage eviction can remove or prevent saves. Test in the same browser profile before relying on a save.

## Verification

The `verification/` folder contains Node.js tests. Requires Node.js 20 or later:

```bash
cd verification
npm test
npm run regression
npm run mutation
npm run browser
```

The browser test is optional and requires Playwright plus a supported browser installation. A skipped browser test is not evidence of successful real-device testing.

## Current scope

Prototype 0.2.3 preserves the original 0.1 combat values and seeded battle outcomes. Save/Load, world position integration, recovery protection, save lock, pending reward handling, and in-game menu support are included. See `DEPLOY_TO_GITHUB_TH.txt` for the Thai deployment checklist and limitations.
