const SETTINGS_KEY = 'coding-tracker:settings';

export function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

// Remove any config left in the browser by older versions — config now lives
// only in appsettings.json and data lives only in GitHub.
export function purgeLegacySettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    /* ignore */
  }
}

// Load config from public/appsettings.json. Returns null if the file is
// missing or has no usable GitHub config.
export async function loadAppSettings() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}appsettings.json`, {
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const json = await res.json();
    const gh = json.github || json.GitHub || {};
    const settings = {
      owner: (gh.owner || '').trim(),
      repo: (gh.repo || '').trim(),
      branch: (gh.branch || 'main').trim() || 'main',
      dbFolder: (gh.dbFolder || 'database').trim() || 'database',
      token: (gh.token || '').trim()
    };
    // Token is optional — it's injected server-side by the proxy/function.
    if (!settings.owner || !settings.repo) return null;
    return settings;
  } catch {
    return null;
  }
}
