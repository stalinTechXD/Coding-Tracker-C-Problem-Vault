// GitHub Contents API client — uses a folder inside a repo as a lightweight database.
//
// Data layout in the repo:
//   <dbFolder>/<category-slug>.json
//
// Each category file looks like:
// {
//   "id": "mathematics",
//   "name": "Mathematics",
//   "createdAt": "2026-01-01T00:00:00.000Z",
//   "problems": [
//     { "id": "...", "title": "Prime Numbers", "statement": "...", "code": "...", "createdAt": "..." }
//   ]
// }

// Requests use the token from appsettings.json. In dev they go through the
// Vite "/gh" proxy (same-origin); in production they hit the GitHub API
// directly, which supports CORS.
const API_ROOT = import.meta.env.DEV ? '/gh' : 'https://api.github.com';

// --- UTF-8 safe base64 helpers -------------------------------------------------
export function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function decodeBase64(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function slugify(name) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  );
}

// Accepts owner/repo that may accidentally be a full GitHub URL
// (e.g. "https://github.com/user/repo.git") and extracts clean values.
export function normalizeRepo(owner, repo) {
  let o = (owner || '').trim();
  let r = (repo || '').trim();

  const extract = (value) => {
    const m = value.match(/github\.com[/:]+([^/]+)\/([^/#?]+)/i);
    if (m) return { owner: m[1], repo: m[2] };
    return null;
  };

  const fromRepo = extract(r);
  if (fromRepo) {
    o = fromRepo.owner;
    r = fromRepo.repo;
  } else {
    const fromOwner = extract(o);
    if (fromOwner) {
      o = fromOwner.owner;
      if (!r) r = fromOwner.repo;
    }
  }

  // Strip any stray scheme/host left in the owner and a trailing .git.
  o = o.replace(/^https?:\/\/[^/]+\//i, '').replace(/\/+$/g, '');
  r = r.replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');

  return { owner: o, repo: r };
}

export class GitHubDB {
  constructor({ owner, repo, token, branch = 'main', dbFolder = 'database' }) {
    const clean = normalizeRepo(owner, repo);
    this.owner = clean.owner;
    this.repo = clean.repo;
    this.token = (token || '').trim();
    this.branch = (branch || 'main').trim();
    this.dbFolder = (dbFolder || 'database').trim().replace(/^\/+|\/+$/g, '');
  }

  get configured() {
    // Token is injected by the proxy, so owner + repo are enough to connect.
    return Boolean(this.owner && this.repo);
  }

  headers() {
    const h = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    // Optional: only used for local dev without a proxy token.
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  async request(path, options = {}) {
    const res = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers: { ...this.headers(), ...(options.headers || {}) }
    });
    if (res.status === 404) return { notFound: true };
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const message = data.message || res.statusText;
      throw new Error(`GitHub API ${res.status}: ${message}`);
    }
    return data;
  }

  contentPath(file) {
    const folder = this.dbFolder ? `${this.dbFolder}/` : '';
    return `/repos/${this.owner}/${this.repo}/contents/${folder}${file}`;
  }

  // Verify that the repo is reachable and the token works.
  async verify() {
    const data = await this.request(`/repos/${this.owner}/${this.repo}`);
    if (data.notFound) {
      throw new Error('Repository not found. Check owner/repo and token scope.');
    }
    return data;
  }

  // Read all category files from the db folder.
  async loadCategories() {
    const folder = this.dbFolder;
    const listing = await this.request(
      `/repos/${this.owner}/${this.repo}/contents/${folder}?ref=${encodeURIComponent(this.branch)}`
    );
    if (listing.notFound || !Array.isArray(listing)) return [];

    const jsonFiles = listing.filter((f) => f.type === 'file' && f.name.endsWith('.json'));
    const categories = await Promise.all(
      jsonFiles.map(async (f) => {
        const fileData = await this.request(
          `/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(folder)}/${encodeURIComponent(
            f.name
          )}?ref=${encodeURIComponent(this.branch)}`
        );
        const parsed = JSON.parse(decodeBase64(fileData.content));
        return { ...parsed, _sha: fileData.sha, _file: f.name };
      })
    );
    categories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return categories;
  }

  // Create or update a single category file. Returns the new sha.
  async saveCategory(category, message) {
    const file = `${category.id}.json`;
    const { _sha, _file, ...clean } = category;
    const body = {
      message: message || `Update ${category.name}`,
      content: encodeBase64(JSON.stringify(clean, null, 2)),
      branch: this.branch
    };
    if (_sha) body.sha = _sha;

    const data = await this.request(this.contentPath(file), {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    return data.content.sha;
  }

  async deleteCategory(category, message) {
    if (!category._sha) return;
    const file = `${category.id}.json`;
    await this.request(this.contentPath(file), {
      method: 'DELETE',
      body: JSON.stringify({
        message: message || `Delete ${category.name}`,
        sha: category._sha,
        branch: this.branch
      })
    });
  }
}
