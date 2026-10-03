import React from 'react';

const STARTER_CPP = `#include <bits/stdc++.h>
using namespace std;

int main() {
    // your solution here
    return 0;
}`;

export default function ProblemModal({ initial, onSave, onClose }) {
  const [title, setTitle] = React.useState(initial?.title || '');
  const [statement, setStatement] = React.useState(initial?.statement || '');
  const [code, setCode] = React.useState(initial?.code || STARTER_CPP);

  const canSave = title.trim() && code.trim();

  const submit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({ title: title.trim(), statement: statement.trim(), code });
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal problem-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>{initial ? 'Edit problem' : 'New coding problem'}</h2>

        <label>
          Title
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sieve of Eratosthenes"
          />
        </label>

        <label>
          Problem statement
          <textarea
            className="statement-input"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="Describe the problem..."
            rows={5}
          />
        </label>

        <label>
          C++ solution
          <textarea
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            rows={14}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!canSave}>
            {initial ? 'Save changes' : 'Add problem'}
          </button>
        </div>
      </form>
    </div>
  );
}
