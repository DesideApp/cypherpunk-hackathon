// src/utils/appInfo.js
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export function loadAppInfo() {
  let version = process.env.APP_VERSION || process.env.npm_package_version || 'unknown';
  let commit  = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.SOURCE_VERSION || null;

  if (version === 'unknown') {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname  = path.dirname(__filename);
      const pkgPath    = path.resolve(__dirname, '../../package.json');
      const pkg        = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg?.version) version = pkg.version;
    } catch {}
  }
  return { version, commit };
}
