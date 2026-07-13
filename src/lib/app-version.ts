/**
 * App version — single source of truth from version.json
 *
 * During dev the value comes directly from version.json.
 * At build time the bump-version script updates version.json first.
 */
import versionData from '../../version.json';

export const APP_VERSION = versionData.appVersion;
