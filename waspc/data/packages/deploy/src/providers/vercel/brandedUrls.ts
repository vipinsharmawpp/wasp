/**
 * Deterministic Vercel project names and production URLs derived from the
 * Wasp app name. Knowing both URLs before either deploy runs is what solves
 * the client<->server chicken-and-egg problem (the client bundle needs the
 * server URL at build time, the server needs the client origin for CORS) -
 * same trick as the Railway provider.
 *
 * A project may also serve a CUSTOM DOMAIN, which the project name cannot express. Set
 * WASP_VERCEL_SERVER_URL / WASP_VERCEL_CLIENT_URL to a full origin to say so. Unset,
 * the derived .vercel.app name is used, so this changes nothing for a deployment that
 * has not asked for it — and the determinism above is kept either way, because the
 * deployment states the URL rather than anything looking it up.
 */
const SERVER_URL_OVERRIDE = "WASP_VERCEL_SERVER_URL";
const CLIENT_URL_OVERRIDE = "WASP_VERCEL_CLIENT_URL";

// Vercel project names: lowercase alphanumerics plus ".", "_", "-", up to
// 100 chars. We reserve room for the longest suffix we append ("-server").
const VALID_APP_NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_APP_NAME_LENGTH = 90;

export function getServerProjectName(appName: string): string {
  return `${appName}-server`;
}

export function getClientProjectName(appName: string): string {
  return `${appName}-client`;
}

function readUrlOverride(envVarName: string): string | undefined {
  const raw = process.env[envVarName]?.trim();
  if (!raw) {
    return undefined;
  }
  // Rejected loudly rather than passed through: this value is baked into the client
  // bundle and written to WASP_SERVER_URL, so a trailing slash or a stray path reaches
  // the browser as a broken API base and is found only once requests start failing.
  if (!/^https:\/\/[^\s/]+$/.test(raw)) {
    throw new Error(
      `${envVarName} must be a bare https origin, with no trailing slash and no path — ` +
        `for example "https://api.example.com". Got: "${raw}"`,
    );
  }
  return raw;
}

export function getServerAppUrl(appName: string): string {
  return (
    readUrlOverride(SERVER_URL_OVERRIDE) ??
    `https://${getServerProjectName(appName)}.vercel.app`
  );
}

export function getClientAppUrl(appName: string): string {
  return (
    readUrlOverride(CLIENT_URL_OVERRIDE) ??
    `https://${getClientProjectName(appName)}.vercel.app`
  );
}

export function assertVercelAppNameIsValid(appName: string): void {
  if (!VALID_APP_NAME_RE.test(appName)) {
    throw new Error(
      [
        `Invalid app name: "${appName}".`,
        "Vercel project names must start with a lowercase letter or digit and",
        'may only contain lowercase letters, digits, ".", "_" and "-".',
      ].join(" "),
    );
  }
  if (appName.length > MAX_APP_NAME_LENGTH) {
    throw new Error(
      `App name too long: must be at most ${MAX_APP_NAME_LENGTH} characters ` +
        `(so the "-server"/"-client" suffixes fit Vercel's limit).`,
    );
  }
}
