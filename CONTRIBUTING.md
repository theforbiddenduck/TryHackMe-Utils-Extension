# Contributing

## Development setup

Use Node.js 22 or later.

```bash
npm install
npm run validate
```

Keep extension code readable and self-contained. Do not add remote executable code, analytics, tracking, or additional browser permissions without documenting the user-facing need and updating `PRIVACY.md`.

## Pull requests

- Add or update tests for behavior changes.
- Run `npm run validate` before opening a pull request.
- Keep generated `dist/`, `artifacts/`, coverage output, and `node_modules/` out of commits.
- Never commit cookies, tokens, credentials, private room data, or screenshots containing account information.
