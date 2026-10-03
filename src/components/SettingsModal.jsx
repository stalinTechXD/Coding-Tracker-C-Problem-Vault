import React from 'react';

export default function SettingsModal({ initial, onSave, onClose, onVerify, verifying }) {
  const [owner, setOwner] = React.useState(initial?.owner || '');
  const [repo, setRepo] = React.useState(initial?.repo || '');
  const [branch, setBranch] = React.useState(initial?.branch || 'main');
  const [dbFolder, setDbFolder] = React.useState(initial?.dbFolder || 'database');
  const [token, setToken] = React.useState(initial?.token || '');
  const [status, setStatus] = React.useState(null);

  const settings = () => ({
    owner: owner.trim(),
    repo: repo.trim(),
    branch: branch.trim() || 'main',
    dbFolder: dbFolder.trim() || 'database',
    token: token.trim()
  });

  const canSave = owner.trim() && repo.trim() && token.trim();

  const test = async () => {
    setStatus(null);
    try {
      await onVerify(settings());
      setStatus({ ok: true, msg: 'Connected! Repository is reachable.' });
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>GitHub database settings</h2>
        <p className="muted">
          Data is stored as JSON files inside a folder in your GitHub repo and synced via the
          GitHub Contents API.
        </p>

        <div className="grid-2">
          <label>
            Owner (user / org)
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="octocat" />
          </label>
          <label>
            Repository
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="my-coding-db" />
          </label>
          <label>
            Branch
            <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
          </label>
          <label>
            DB folder
            <input value={dbFolder} onChange={(e) => setDbFolder(e.target.value)} placeholder="database" />
          </label>
        </div>

        <label>
          Personal access token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_… (needs 'repo' / Contents read-write scope)"
          />
        </label>
        <p className="muted small">
          Create a fine-grained token with <strong>Contents: Read and write</strong> access to this
          repo. The token is stored only in your browser's local storage.
        </p>

        {status && (
          <div className={`status ${status.ok ? 'ok' : 'err'}`}>{status.msg}</div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={test} disabled={!canSave || verifying}>
            {verifying ? 'Testing…' : 'Test connection'}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => onSave(settings())}
            disabled={!canSave}
          >
            Save &amp; connect
          </button>
        </div>
      </div>
    </div>
  );
}
