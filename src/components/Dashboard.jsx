import React from 'react';

// Local YYYY-MM-DD key for a date.
function dayKey(d) {
  const z = new Date(d);
  if (Number.isNaN(z.getTime())) return null;
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(
    z.getDate()
  ).padStart(2, '0')}`;
}

// Parse a YYYY-MM-DD key back into a local midnight Date (avoids UTC drift).
function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const WEEKS = 18; // ~4 months of history in the heatmap

export default function Dashboard({ categories, onOpenCategory }) {
  const stats = React.useMemo(() => {
    const problems = [];
    categories.forEach((c) => {
      (c.problems || []).forEach((p) => {
        problems.push({ ...p, categoryId: c.id, categoryName: c.name });
      });
    });

    // Count problems per day based on createdAt.
    const perDay = new Map();
    problems.forEach((p) => {
      const k = dayKey(p.createdAt);
      if (k) perDay.set(k, (perDay.get(k) || 0) + 1);
    });

    const today = startOfToday();
    const todayKey = dayKey(today);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);

    let problemsToday = perDay.get(todayKey) || 0;
    let problemsThisWeek = 0;
    perDay.forEach((count, k) => {
      const d = parseKey(k);
      if (d >= weekAgo && d <= today) problemsThisWeek += count;
    });

    // Current streak: consecutive days up to today with activity.
    let currentStreak = 0;
    const cursor = new Date(today);
    while (perDay.get(dayKey(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Longest streak across all active days.
    const activeKeys = Array.from(perDay.keys()).sort();
    let longestStreak = 0;
    let run = 0;
    let prev = null;
    activeKeys.forEach((k) => {
      const d = parseKey(k);
      if (prev) {
        const diff = Math.round((d - prev) / 86400000);
        run = diff === 1 ? run + 1 : 1;
      } else {
        run = 1;
      }
      if (run > longestStreak) longestStreak = run;
      prev = d;
    });

    // Build the heatmap grid (columns = weeks, rows = Sun..Sat).
    const end = new Date(today);
    // Move to the end of the current week (Saturday).
    end.setDate(end.getDate() + (6 - end.getDay()));
    const totalDays = WEEKS * 7;
    const start = new Date(end);
    start.setDate(start.getDate() - (totalDays - 1));

    const cells = [];
    let max = 0;
    for (let i = 0; i < totalDays; i += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const k = dayKey(d);
      const count = perDay.get(k) || 0;
      if (count > max) max = count;
      cells.push({ key: k, date: new Date(d), count, future: d > today });
    }
    // Group into week columns.
    const columns = [];
    for (let w = 0; w < WEEKS; w += 1) {
      columns.push(cells.slice(w * 7, w * 7 + 7));
    }

    // Recent activity (latest 8).
    const recent = problems
      .filter((p) => p.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    // Last 14 days bar data.
    const bars = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      bars.push({ date: d, count: perDay.get(dayKey(d)) || 0 });
    }

    return {
      totalCategories: categories.length,
      totalProblems: problems.length,
      problemsToday,
      problemsThisWeek,
      currentStreak,
      longestStreak,
      activeDays: perDay.size,
      columns,
      max,
      recent,
      bars,
      perCategory: categories
        .map((c) => ({ id: c.id, name: c.name, count: (c.problems || []).length }))
        .sort((a, b) => b.count - a.count)
    };
  }, [categories]);

  const level = (count) => {
    if (!count) return 0;
    if (!stats.max) return 1;
    const r = count / stats.max;
    if (r > 0.66) return 4;
    if (r > 0.33) return 3;
    return 2;
  };

  const maxBar = Math.max(1, ...stats.bars.map((b) => b.count));
  const fmt = (d) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <p className="muted small">Your everyday coding progress, synced from GitHub.</p>

      <div className="stat-grid">
        <StatCard label="Total problems" value={stats.totalProblems} />
        <StatCard label="Categories" value={stats.totalCategories} />
        <StatCard label="Added today" value={stats.problemsToday} accent />
        <StatCard label="This week" value={stats.problemsThisWeek} />
        <StatCard label="Current streak" value={`${stats.currentStreak}d`} />
        <StatCard label="Longest streak" value={`${stats.longestStreak}d`} />
      </div>

      <section className="panel">
        <h3>Activity (last 14 days)</h3>
        <div className="bars">
          {stats.bars.map((b) => (
            <div className="bar-col" key={b.date.toISOString()} title={`${fmt(b.date)}: ${b.count}`}>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ height: `${(b.count / maxBar) * 100}%` }}
                />
              </div>
              <span className="bar-label">{b.date.getDate()}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Contribution heatmap</h3>
        <div className="heatmap">
          {stats.columns.map((week, wi) => (
            <div className="heat-col" key={wi}>
              {week.map((cell) => (
                <div
                  key={cell.key}
                  className={`heat-cell lvl-${cell.future ? 'future' : level(cell.count)}`}
                  title={cell.future ? '' : `${cell.key}: ${cell.count} problem(s)`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="heat-legend">
          <span className="muted small">Less</span>
          <span className="heat-cell lvl-0" />
          <span className="heat-cell lvl-1" />
          <span className="heat-cell lvl-2" />
          <span className="heat-cell lvl-3" />
          <span className="heat-cell lvl-4" />
          <span className="muted small">More</span>
        </div>
      </section>

      <div className="panel-row">
        <section className="panel">
          <h3>Recent activity</h3>
          {stats.recent.length === 0 ? (
            <p className="muted small">No problems added yet.</p>
          ) : (
            <ul className="recent-list">
              {stats.recent.map((p) => (
                <li key={p.id} onClick={() => onOpenCategory?.(p.categoryId)}>
                  <span className="recent-title">{p.title}</span>
                  <span className="recent-cat">{p.categoryName}</span>
                  <span className="recent-date">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h3>By category</h3>
          {stats.perCategory.length === 0 ? (
            <p className="muted small">No categories yet.</p>
          ) : (
            <ul className="cat-bars">
              {stats.perCategory.map((c) => {
                const pct = stats.totalProblems
                  ? Math.round((c.count / stats.totalProblems) * 100)
                  : 0;
                return (
                  <li key={c.id} onClick={() => onOpenCategory?.(c.id)}>
                    <div className="cat-bar-head">
                      <span>{c.name}</span>
                      <span className="muted small">{c.count}</span>
                    </div>
                    <div className="cat-bar-track">
                      <div className="cat-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`stat-card ${accent ? 'accent' : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
