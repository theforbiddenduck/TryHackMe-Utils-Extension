# Privacy Policy

Last updated: August 4, 2026

TryHackMe Utilities provides additional room leaderboard information.

## Data the extension uses

When you open the extension, it may use:

- The URL of the active TryHackMe tab to determine the room code.
- The `thm-ud` TryHackMe cookie to identify your user ID and username for leaderboard highlighting.
- The leaderboard response returned by TryHackMe to render the popup.

## How data is handled

- Requests are sent only to `https://tryhackme.com` to provide the leaderboard feature.
- The browser may attach existing TryHackMe session and security cookies to same-origin leaderboard requests. Those cookies are sent only to TryHackMe and are never sent to the extension developer or another third party.
- The extension developer does not receive the room code, cookies, account details, or leaderboard data.
- The extension has no analytics, advertising, telemetry, or developer-operated backend service.
- Data is kept only in the popup's memory and is discarded when the popup closes.
- Data is not sold, shared with advertisers, or used for profiling.

## Browser permissions

- `activeTab` reads the active tab after you open the extension so it can detect a TryHackMe room.
- `cookies` reads only the TryHackMe `thm-ud` cookie to highlight your leaderboard entry.
- `scripting` runs the user-requested, same-origin leaderboard call in the active TryHackMe tab when possible.
- Access to `https://tryhackme.com/*` is required to request leaderboard data directly from TryHackMe.

## Chrome Web Store Limited Use

The use of information received from browser APIs is limited to providing the leaderboard feature and complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

Questions about this policy can be opened as an issue in the project's GitHub repository. Do not include cookies, access tokens, or other private account information in an issue.
