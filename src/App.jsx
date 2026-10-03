import React from 'react';
import { GitHubDB, slugify, normalizeRepo } from './github.js';
import { uid, purgeLegacySettings, loadAppSettings } from './storage.js';
import SettingsModal from './components/SettingsModal.jsx';
import ProblemModal from './components/ProblemModal.jsx';
import CodeBlock from './components/CodeBlock.jsx';
import Dashboard from './components/Dashboard.jsx';

// Clean owner/repo (handles full GitHub URLs pasted by mistake).
function normalizeSettings(s) {
  if (!s) return s;
  const { owner, repo } = normalizeRepo(s.owner, s.repo);
  return { ...s, owner, repo };
}

export default function App() {
  const [settings, setSettings] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [categories, setCategories] = React.useState([]);
  const [activeId, setActiveId] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const [showSettings, setShowSettings] = React.useState(false);
  const [problemModal, setProblemModal] = React.useState(null); // { problem } | {} for new
  const [view, setView] = React.useState('dashboard'); // 'dashboard' | 'categories'

  const notify = (msg, kind = 'info') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  };

  // Config is read only from appsettings.json; nothing is persisted in the
  // browser. All app data lives in the GitHub repo.
  React.useEffect(() => {
    purgeLegacySettings();
    let cancelled = false;
    loadAppSettings().then((fromFile) => {
      if (!cancelled && fromFile) {
        setSettings(normalizeSettings(fromFile));
        notify('Loaded GitHub settings from appsettings.json.', 'ok');
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build the DB client whenever settings change.
  React.useEffect(() => {
    if (settings && settings.owner && settings.repo && settings.token) {
      setDb(new GitHubDB(settings));
    } else {
      setDb(null);
    }
  }, [settings]);

  const sync = React.useCallback(
    async (client) => {
      const active = client || db;
      if (!active) return;
      setLoading(true);
      try {
        const cats = await active.loadCategories();
        setCategories(cats);
        setActiveId((prev) => (cats.find((c) => c.id === prev) ? prev : cats[0]?.id ?? null));
        notify('Synced with GitHub.', 'ok');
      } catch (err) {
        notify(err.message, 'err');
      } finally {
        setLoading(false);
      }
    },
    [db]
  );

  // Initial load on connect.
  React.useEffect(() => {
    if (db) sync(db);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const activeCategory = categories.find((c) => c.id === activeId) || null;

  // --- Settings ---------------------------------------------------------------
  const handleVerify = async (candidate) => {
    setVerifying(true);
    try {
      const client = new GitHubDB(candidate);
      await client.verify();
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveSettings = (next) => {
    // Session-only override; persistent config belongs in appsettings.json.
    setSettings(normalizeSettings(next));
    setShowSettings(false);
    notify('Settings applied for this session. Edit appsettings.json to persist.', 'ok');
  };

  const handleDisconnect = () => {
    setSettings(null);
    setDb(null);
    setCategories([]);
    setActiveId(null);
  };

  // --- Categories -------------------------------------------------------------
  const addCategory = async () => {
    const name = window.prompt('New category name (e.g. Mathematics):');
    if (!name || !name.trim()) return;
    const base = slugify(name);
    let id = base;
    let n = 1;
    while (categories.some((c) => c.id === id)) {
      id = `${base}-${n++}`;
    }
    const category = {
      id,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      problems: []
    };
    setLoading(true);
    try {
      const sha = await db.saveCategory(category, `Add category ${category.name}`);
      const stored = { ...category, _sha: sha, _file: `${id}.json` };
      setCategories((prev) => [...prev, stored].sort((a, b) => a.name.localeCompare(b.name)));
      setActiveId(id);
      notify(`Category "${category.name}" created.`, 'ok');
    } catch (err) {
      notify(err.message, 'err');
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete category "${category.name}" and all its problems?`)) return;
    setLoading(true);
    try {
      await db.deleteCategory(category, `Delete category ${category.name}`);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      setActiveId((prev) => (prev === category.id ? null : prev));
      notify(`Category "${category.name}" deleted.`, 'ok');
    } catch (err) {
      notify(err.message, 'err');
    } finally {
      setLoading(false);
    }
  };

  // --- Problems ---------------------------------------------------------------
  const persistCategory = async (updated, message) => {
    setLoading(true);
    try {
      const sha = await db.saveCategory(updated, message);
      const stored = { ...updated, _sha: sha };
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? stored : c)));
      notify('Saved to GitHub.', 'ok');
    } catch (err) {
      notify(err.message, 'err');
      // Re-sync to recover the correct sha on conflict.
      sync();
    } finally {
      setLoading(false);
    }
  };

  const saveProblem = async (data) => {
    if (!activeCategory) return;
    const editing = problemModal?.problem;
    let problems;
    if (editing) {
      problems = activeCategory.problems.map((p) =>
        p.id === editing.id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
      );
    } else {
      problems = [
        ...activeCategory.problems,
        { id: uid(), ...data, createdAt: new Date().toISOString() }
      ];
    }
    const updated = { ...activeCategory, problems };
    setProblemModal(null);
    await persistCategory(
      updated,
      editing ? `Update problem "${data.title}"` : `Add problem "${data.title}"`
    );
  };

  const deleteProblem = async (problem) => {
    if (!activeCategory) return;
    if (!window.confirm(`Delete problem "${problem.title}"?`)) return;
    const updated = {
      ...activeCategory,
      problems: activeCategory.problems.filter((p) => p.id !== problem.id)
    };
    await persistCategory(updated, `Delete problem "${problem.title}"`);
  };

  // --- Render -----------------------------------------------------------------
  const connected = Boolean(db);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">&lt;/&gt;</span>
          <div>
            <h1>Coding Tracker</h1>
            <span className="subtitle">C++ problem vault · GitHub-synced</span>
          </div>
        </div>
        <div className="topbar-actions">
          {connected && (
            <div className="view-switch">
              <button
                className={view === 'dashboard' ? 'active' : ''}
                onClick={() => setView('dashboard')}
              >
                Dashboard
              </button>
              <button
                className={view === 'categories' ? 'active' : ''}
                onClick={() => setView('categories')}
              >
                Categories
              </button>
            </div>
          )}
          {connected && (
            <span className="repo-chip" title="Connected repository">
              {settings.owner}/{settings.repo}
            </span>
          )}
          {connected && (
            <button className="btn" onClick={() => sync()} disabled={loading}>
              {loading ? 'Syncing…' : '↻ Sync'}
            </button>
          )}
          <button className="btn ghost" onClick={() => setShowSettings(true)}>
            ⚙ Settings
          </button>
        </div>
      </header>

      {!connected ? (
        <div className="empty-hero">
          <h2>Connect your GitHub database</h2>
          <p>
            This app stores every category and C++ solution as JSON files in a folder of your GitHub
            repo, and keeps them in sync. Add your repository details to get started.
          </p>
          <button className="btn primary big" onClick={() => setShowSettings(true)}>
            Connect GitHub
          </button>
        </div>
      ) : view === 'dashboard' ? (
        <main className="content dashboard-view">
          <Dashboard
            categories={categories}
            onOpenCategory={(id) => {
              setActiveId(id);
              setView('categories');
            }}
          />
        </main>
      ) : (
        <div className="layout">
          <aside className="sidebar">
            <div className="sidebar-head">
              <h3>Categories</h3>
              <button className="icon-btn" title="Add category" onClick={addCategory}>
                +
              </button>
            </div>
            {categories.length === 0 && (
              <p className="muted small pad">No categories yet. Click + to add one.</p>
            )}
            <ul className="cat-list">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className={c.id === activeId ? 'active' : ''}
                  onClick={() => setActiveId(c.id)}
                >
                  <span className="cat-name">{c.name}</span>
                  <span className="cat-count">{c.problems.length}</span>
                  <button
                    className="del-btn"
                    title="Delete category"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCategory(c);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <main className="content">
            {!activeCategory ? (
              <div className="placeholder">
                <p>Select or create a category to begin.</p>
              </div>
            ) : (
              <>
                <div className="content-head">
                  <div>
                    <h2>{activeCategory.name}</h2>
                    <span className="muted small">
                      {activeCategory.problems.length} problem
                      {activeCategory.problems.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <button className="btn primary" onClick={() => setProblemModal({})}>
                    + Add problem
                  </button>
                </div>

                {activeCategory.problems.length === 0 ? (
                  <div className="placeholder">
                    <p>No problems in this category yet.</p>
                  </div>
                ) : (
                  <div className="problems">
                    {activeCategory.problems.map((p, i) => (
                      <article className="problem-card" key={p.id}>
                        <div className="problem-head">
                          <h3>
                            <span className="idx">{i + 1}.</span> {p.title}
                          </h3>
                          <div className="problem-actions">
                            <button
                              className="btn tiny"
                              onClick={() => setProblemModal({ problem: p })}
                            >
                              Edit
                            </button>
                            <button className="btn tiny danger" onClick={() => deleteProblem(p)}>
                              Delete
                            </button>
                          </div>
                        </div>
                        {p.statement && <p className="statement">{p.statement}</p>}
                        <CodeBlock code={p.code} />
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          initial={settings}
          verifying={verifying}
          onVerify={handleVerify}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {problemModal && (
        <ProblemModal
          initial={problemModal.problem}
          onSave={saveProblem}
          onClose={() => setProblemModal(null)}
        />
      )}

      {connected && (
        <footer className="footbar">
          <button className="link-btn" onClick={handleDisconnect}>
            Disconnect
          </button>
        </footer>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
