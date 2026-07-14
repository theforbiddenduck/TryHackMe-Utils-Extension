# Publishing

The project produces separate Chrome and Firefox ZIP files from one shared source tree.

## Before the first store submission

1. Add production icons to the manifest and prepare store screenshots and listing copy.
2. Confirm that the privacy policy and each permission justification match the extension's behavior.
3. Run `npm run validate` and manually test both generated builds.
4. Keep the first store submissions manual. Add store-upload credentials to GitHub only after both listings have been approved.

## Build packages

```bash
npm ci
npm run validate
```

The uploadable files are written to `artifacts/` with a `SHA256SUMS.txt` file.

## Chrome Web Store

1. Register a Chrome Web Store developer account, complete the one-time registration fee, and enable two-step verification.
2. Create a new item in the developer dashboard and upload the Chrome ZIP.
3. Complete the listing, distribution, and privacy tabs.
4. Describe the single purpose as displaying complete TryHackMe room leaderboards.
5. Disclose the handling of the active room URL, TryHackMe authentication session, `thm-ud` cookie, and leaderboard response.
6. Link the hosted copy of `PRIVACY.md` and submit for review.

## Firefox Add-ons (AMO)

1. Sign in to the Firefox Add-on Developer Hub.
2. Submit the Firefox ZIP as a new listed add-on.
3. The generated Firefox manifest uses a stable add-on ID, requires Firefox 142 or later, and declares authentication and browsing-activity data use through Firefox's built-in consent system.
4. Provide clear testing instructions. A reviewer may need a TryHackMe account and access to a room with a leaderboard.
5. If Mozilla requests source code, provide the repository source archive and the reproducible commands `npm ci` and `npm run package`.

## GitHub release process

Update both package and manifest versions together:

```bash
npm run version:set -- 0.2.0
npm run validate
git add -A
git commit -m "Release 0.2.0"
git tag v0.2.0
git push origin main --tags
```

Pushing a matching `v<version>` tag runs the release workflow, verifies the version, rebuilds both ZIPs, and attaches them and their checksums to a GitHub Release.

## Later: store upload automation

After the initial listings are approved, the release workflow can be extended with protected GitHub environments:

- Chrome Web Store API credentials for uploading and publishing the Chrome ZIP.
- Mozilla Add-ons API credentials for `web-ext sign` and AMO submission.

Use environment approval gates, least-privilege credentials, and repository secrets. Store credentials must never be committed to the repository or embedded in an extension package.
