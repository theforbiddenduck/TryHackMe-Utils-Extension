# Privacy Policy

Last updated: July 14, 2026

TryHackMe Utilities provides room leaderboard features for people who are already signed in to TryHackMe.

## Data the extension uses

When you open the extension, it may use:

- The URL of the active TryHackMe tab to determine the room code.
- The `thm-ud` TryHackMe cookie to identify your user ID and username for leaderboard highlighting.
- Your existing TryHackMe authentication session when requesting room leaderboard data from TryHackMe over HTTPS.
- The leaderboard response returned by TryHackMe to render the popup.

## How data is handled

- Requests are sent only to `https://tryhackme.com` to provide the leaderboard feature.
- The extension developer does not receive the room code, cookies, account details, or leaderboard data.
- The extension has no analytics, advertising, telemetry, or developer-operated backend service.
- Data is kept only in the popup's memory and is discarded when the popup closes.
- Data is not sold, shared with advertisers, or used for profiling.

## Browser permissions

- `activeTab` reads the active tab after you open the extension so it can detect a TryHackMe room.
- `cookies` reads only the TryHackMe `thm-ud` cookie to highlight your leaderboard entry.
- `scripting` runs the user-requested leaderboard call in the active TryHackMe tab when possible.
- Access to `https://tryhackme.com/*` is required to request the leaderboard using your existing TryHackMe session.

## Contact

Questions about this policy can be opened as an issue in the project's GitHub repository. Do not include cookies, access tokens, or other private account information in an issue.
