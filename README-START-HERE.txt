LOADING BUSINESS LEDGER v1.0.7 — COMPLETE GITHUB PAGES UPLOAD
===========================================================

FILES (all 11 required app files are included; use exactly these names):
  index.html
  sw.js
  manifest.webmanifest
  offline-icon-192.png
  offline-icon-512.png
  favicon.svg
  apple-touch-icon.png
  rico-logo.png
  globe-logo.svg
  smart-logo.svg
  gcash-logo.svg

IMPORTANT: There are 11 app files, plus this README. Upload the 11 app files
TOGETHER to the SAME PUBLISHED folder. Do NOT upload just the ZIP or a nested
folder. Keep the website URL and repository Pages settings unchanged.

HOW TO DEPLOY
1. First, open the existing app on your iPhone and use Backup to save a JSON copy.
   Keep another copy outside the phone.
2. On GitHub, remove the old app files from the published folder. Do NOT delete
   the repository itself or its Pages settings. If you have a custom domain,
   retain its CNAME file.
3. Unzip this archive. Upload the 11 app files directly (no containing folder)
   into the SAME folder that previously contained index.html. Commit changes.
4. Wait for GitHub Pages deployment to finish. Open the normal website URL in
   Safari with internet, then refresh. Open the Home Screen app while ONLINE.
5. Wait for "Offline ready · works without internet".
6. Turn on Airplane Mode, fully close the Home Screen app and reopen it.
7. Check balances and records. If anything looks wrong, stop and use your JSON
   backup rather than entering duplicate records.

IF YOU SEE "OFFLINE WORKER NOT READY":
  Check the published URL /sw.js in Safari. The text near the top should say:
  const VERSION = '1.0.7';
  In a subpath deployment, add /sw.js to the SUBPATH URL, not the domain root.
  If you still see an older version, ensure GitHub has committed the NEW file,
  Pages deployment has completed, and open Safari to refresh.

DATA SAFETY
  Business records live in localStorage key "loading-business-ledger" on the
  device/browser. Neither offline worker nor update logic touches this key.
  Avoid deleting the Home Screen app, clearing website data, or changing URLs.
  A GitHub Pages site cannot open offline the very FIRST time on a device that
  has never loaded/installed it. An initial online install is required.
  The local rule-based AI works offline; optional browser generative AI requires
  a supported browser/model installed in advance.

Preserved from v1.0.6: wallets, transaction math, customers, AI page, interest,
Backup/Restore, History, and local data schema. CSV buttons remain removed.
