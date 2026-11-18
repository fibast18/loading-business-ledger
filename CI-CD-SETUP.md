# Loading Business Ledger — Git-based CI/CD

The existing v1.0.10 static website, offline PWA, local browser records,
and Ask Rico interface are preserved.

## One-time GitHub setting (IMPORTANT)
1. Open https://github.com/fibast18/loading-business-ledger/settings/pages
2. Under "Build and deployment", set **Source = GitHub Actions**.
3. Keep the existing repository and custom domain (if any).
4. Open https://github.com/fibast18/loading-business-ledger/actions and select
   **Loading Business Ledger CI/CD** to inspect the first run.
5. If no run appears yet, choose **Run workflow** on the **main** branch.

The workflow runs automatically on every push to main. Pull requests are
validated but not deployed. You do not need to manually upload ZIP files.

## Future app updates
You can edit files directly in GitHub's web editor (https://github.dev/fibast18/loading-business-ledger)
and **Commit & Push** to main, or push changes using Git on your MacBook Pro.

A typical local Git update:
```bash
git clone https://github.com/fibast18/loading-business-ledger.git
cd loading-business-ledger
# Make your app changes, then:
git add -A
git commit -m "Update Loading Business Ledger"
git push origin main
```

If this repository is already cloned on your Mac, use `git pull --ff-only`
before editing, rather than cloning it again.

## What happens automatically
1. A push to main starts the GitHub Actions workflow.
2. Node.js checks JavaScript syntax, required website files, Ask Rico,
   the PWA manifest, and service-worker cache dependencies.
3. The workflow builds a clean `dist/` containing ONLY the 13 website assets.
   This avoids accidentally publishing source scripts, configuration, or secrets.
4. The published copies of `index.html` and `sw.js` receive the same
   short Git commit revision for a new offline cache on each deployment.
   The human-readable app version stays v1.0.10 until you intentionally change it.
5. The verified files deploy to GitHub Pages. If validation fails, no new
   deployment happens.

Your existing localStorage key `loading-business-ledger` is not modified.
Still keep a current JSON Backup before major app changes. Online devices may
need to reopen or refresh the app once to fetch an updated service worker;
an offline device stays on the last installed version until it reconnects.

## Ask Rico backend
The GitHub Actions workflow publishes only the browser website.
The **Cloudflare Worker** (and its D1 database and OpenAI API secret)
are SEPARATE and are NOT deployed or modified by this workflow.
When the Worker source is moved to its own private Git repository, you can
add a separate CI/CD workflow with a narrowly scoped Cloudflare API token.
Never put the OpenAI API key or access codes into public GitHub files.

## Troubleshooting
- Workflow status: https://github.com/fibast18/loading-business-ledger/actions
- Check that **Settings → Pages → Source** is **GitHub Actions**.
- A red validation result means a missing asset or JavaScript error.
- A deployment permissions error means the Pages source or GitHub Actions
  permissions/environment settings need checking.
- If the website updates but the Home Screen app looks old, reopen the app
  online to allow the service worker to update; do not clear website data or
  delete your Home Screen app without a JSON data backup.
