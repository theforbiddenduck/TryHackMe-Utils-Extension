# TryHackMe Browser Extension (Utilities)

A small Manifest V3 browser extension for extra TryHackMe room utilities.

## Current Feature

- Full room leaderboard popup for TryHackMe rooms.
- Detects the room code from the active `https://tryhackme.com/room/<roomCode>` tab.
- Fetches all leaderboard pages from `/api/v2/rooms/scoreboard`.
- Uses the browser's existing TryHackMe session cookies through normal extension requests.
- Highlights the signed-in user when the extension can identify them from the `thm-ud` cookie.

## Local Install

1. Open Chrome or another Chromium-based browser.
2. Go to `chrome://extensions`.
3. Enable developer mode.
4. Choose "Load unpacked".
5. Select this project directory.

Then open a TryHackMe room page and click the extension icon.

## Notes

- Do not paste or store TryHackMe session cookies in this repository.
- The extension needs access to `https://tryhackme.com/*` so the popup can call TryHackMe APIs with the logged-in browser session.
