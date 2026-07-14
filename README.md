# TryHackMe Utilities Extension

A small Manifest V3 browser extension for extra TryHackMe room utilities. It uses one shared codebase for Chrome, Chromium-based browsers, and Firefox.

## Current Feature

- Full room leaderboard popup for TryHackMe rooms.
- Detects the room code from the active `https://tryhackme.com/room/<roomCode>` tab.
- Fetches all leaderboard pages from `/api/v2/rooms/scoreboard`.
- Uses the browser's existing TryHackMe session through normal HTTPS requests to TryHackMe.
- Highlights the signed-in user when the extension can identify them from the `thm-ud` cookie.

## Local Install (Chrome)

1. Open Chrome or another Chromium-based browser.
2. Go to `chrome://extensions`.
3. Enable developer mode.
4. Choose "Load unpacked".
5. Select this project directory.

Then open a TryHackMe room page and click the extension icon.

## Local Install (Firefox)

1. Run `npm install` and `npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on**.
4. Select `dist/firefox/manifest.json`.

Temporary Firefox installations are removed when Firefox restarts.

## Development

Requires Node.js 22 or later.

```bash
npm install
npm run validate
```

`npm run validate` runs JavaScript syntax checks, ESLint, Prettier checks, unit tests, Chrome and Firefox packaging, and Mozilla's `web-ext` validator.

## Build and Release Artifacts

```bash
npm run package
```

This creates separate Chrome and Firefox ZIP files plus SHA-256 checksums in `artifacts/`. Tagged releases matching `v<version>` are validated and published as GitHub Releases by GitHub Actions.

See [Publishing](docs/PUBLISHING.md) for the store submission checklist and [Privacy](PRIVACY.md) for the data-handling policy.

## Notes

- Do not paste or store TryHackMe session cookies in this repository.
- The extension needs access to `https://tryhackme.com/*` so the popup can call TryHackMe APIs with the logged-in browser session.
- This project is not affiliated with or endorsed by TryHackMe.

## License

Licensed under the [MIT License](LICENSE).
