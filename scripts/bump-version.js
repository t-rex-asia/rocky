import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION_FILE = join(__dirname, '..', 'version.json');

function getTodayTag() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return `${yyyy}.${mm}.${dd}`;
}

function bumpVersion() {
  const todayTag = getTodayTag();
  let buildNumber = 1;
  let versionCode = 1;

  try {
    const raw = readFileSync(VERSION_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const parts = String(data.appVersion).split('.');
    const currentTag = `${parts[0]}.${parts[1]}.${parts[2]}`;

    if (currentTag === todayTag) {
      buildNumber = (parseInt(parts[3], 10) || 0) + 1;
    }
    versionCode = (parseInt(data.versionCode, 10) || 0) + 1;
  } catch {
    buildNumber = 1;
    versionCode = 1;
  }

  const appVersion = `${todayTag}.${buildNumber}`;
  const newContent = JSON.stringify({ appVersion, versionCode }, null, 2) + '\n';

  writeFileSync(VERSION_FILE, newContent, 'utf-8');

  console.log(`[bump-version] App version bumped to: ${appVersion}, versionCode: ${versionCode}`);
}

bumpVersion();
