// CI validation and build for the existing single-file Loading Business Ledger PWA.
// No npm install, paid API call, or access to customer records is needed.
import { readFileSync, existsSync, statSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ASSETS = [
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'ask-rico.js',
  'ask-rico.css',
  'offline-icon-192.png',
  'offline-icon-512.png',
  'apple-touch-icon.png',
  'favicon.svg',
  'rico-logo.png',
  'globe-logo.svg',
  'smart-logo.svg',
  'gcash-logo.svg'
];

function fail(message) {
  console.error('CI check failed: ' + message);
  process.exit(1);
}

for (const file of ASSETS) {
  const path = join(ROOT, file);
  if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size === 0) {
    fail('Missing or empty required file: ' + file);
  }
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const ai = readFileSync(join(ROOT, 'ask-rico.js'), 'utf8');
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));

if (!html.includes('loading-business-ledger')) fail('Business ledger app is missing from index.html');
if (!html.includes('./ask-rico.js') || !html.includes('./ask-rico.css')) fail('Ask Rico assets are not linked');
if (!html.includes('./manifest.webmanifest')) fail('PWA manifest is not linked');
if (!html.includes('serviceWorker')) fail('Offline service-worker registration is missing');
if (!ai.includes('ask-rico-root')) fail('Ask Rico entry point is missing');
if (manifest.start_url !== './index.html' || manifest.scope !== './') {
  fail('PWA manifest must use relative start_url/scope for GitHub Pages');
}
for (const asset of ASSETS.filter(name => name !== 'sw.js')) {
  if (!sw.includes("'" + asset + "'") && !sw.includes('"' + asset + '"')) {
    fail('Offline service worker does not list required asset: ' + asset);
  }
}

// Guard against accidentally committing a real OpenAI secret in public frontend files.
for (const file of ['index.html', 'ask-rico.js', 'ask-rico.css', 'sw.js']) {
  const body = readFileSync(join(ROOT, file), 'utf8');
  if (/sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/.test(body)) {
    fail('Possible OpenAI API key found in public file: ' + file);
  }
}

if (process.argv.includes('--build')) {
  const dist = join(ROOT, 'dist');
  mkdirSync(dist, { recursive: true });
  for (const file of ASSETS) copyFileSync(join(ROOT, file), join(dist, file));
  if (existsSync(join(ROOT, 'CNAME'))) copyFileSync(join(ROOT, 'CNAME'), join(dist, 'CNAME'));
  // Stamp only the published copy, not the source, so existing PWA installs pick up
  // every successful Git deployment without manually bumping app/business versions.
  const shortSha = (process.env.GITHUB_SHA || '').slice(0, 8);
  if (shortSha) {
    const outputHtml = join(dist, 'index.html');
    const outputWorker = join(dist, 'sw.js');
    const htmlText = readFileSync(outputHtml, 'utf8');
    const workerText = readFileSync(outputWorker, 'utf8');
    const installerPattern = /var VERSION='([^']+)', CACHE='loading-business-ledger-shell-v'\+VERSION/;
    const workerPattern = /const VERSION = '([^']+)';/;
    const htmlVersion = htmlText.match(installerPattern)?.[1];
    const workerVersion = workerText.match(workerPattern)?.[1];
    if (!htmlVersion || htmlVersion !== workerVersion) {
      fail('Offline installer and service-worker versions must match before publishing');
    }
    const deployedVersion = htmlVersion + '-git.' + shortSha;
    writeFileSync(outputHtml, htmlText.replace(installerPattern,
      "var VERSION='" + deployedVersion + "', CACHE='loading-business-ledger-shell-v'+VERSION"));
    writeFileSync(outputWorker, workerText.replace(workerPattern,
      "const VERSION = '" + deployedVersion + "';"));
    console.log('Offline update revision: ' + deployedVersion);
  }
  writeFileSync(join(dist, '.nojekyll'), '');
  console.log('Created dist/ with ' + ASSETS.length + ' application files.');
}
console.log('PASS: all ' + ASSETS.length + ' application files, Ask Rico, PWA, offline caching, and basic secret checks.');
