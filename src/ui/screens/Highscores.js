/**
 * REQ-UI / WI-014 — Highscores table from GET /api/scores (via ApiClient facade).
 */

export class Highscores {
  /**
   * @param {import('../../core/EventBus.js').EventBus} _bus
   * @param {{ navigate: (screen: string) => void }} router
   * @param {{ getScores?: (limit?: number) => Promise<unknown> }} [api]
   */
  constructor(_bus, router, api = {}) {
    this.router = router;
    this.getScores = api.getScores;
    /** @type {HTMLElement | null} */
    this.el = null;
    /** @type {HTMLTableSectionElement | null} */
    this.tbody = null;
    /** @type {HTMLElement | null} */
    this.statusEl = null;
    /** @type {number} */
    this._loadGen = 0;
  }

  /**
   * @param {HTMLElement} root
   */
  mount(root) {
    const wrap = document.createElement('section');
    wrap.dataset.screen = 'highscores';
    wrap.className = 'ui-screen ui-screen--highscores';
    wrap.hidden = true;
    wrap.innerHTML = `
      <header class="ui-screen__head">
        <h2>Highscores</h2>
        <p class="ui-screen__sub">Top scores from the arena server.</p>
      </header>

      <p class="ui-status" data-scores-status hidden></p>

      <div class="ui-table-wrap">
        <table class="ui-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Username</th>
              <th>Score</th>
              <th>Mode</th>
              <th>Difficulty</th>
            </tr>
          </thead>
          <tbody data-scores-body>
            <tr class="ui-table__empty">
              <td colspan="5">No scores yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="ui-actions">
        <button type="button" class="ui-btn" data-action="refresh">Refresh</button>
        <button type="button" class="ui-btn ui-btn--primary" data-action="back">Back</button>
      </div>
    `;

    this.tbody = wrap.querySelector('[data-scores-body]');
    this.statusEl = wrap.querySelector('[data-scores-status]');

    wrap.querySelector('[data-action="back"]').addEventListener('click', () => {
      this.router.navigate('menu');
    });
    wrap.querySelector('[data-action="refresh"]').addEventListener('click', () => {
      void this.refresh();
    });

    this.el = wrap;
    root.appendChild(wrap);
  }

  /** Fetch leaderboard via injected ApiClient facade. */
  async refresh() {
    const gen = ++this._loadGen;
    if (!this.getScores) {
      this._setStatus('Scores API not wired.');
      this.setScores([]);
      return;
    }

    this._setStatus('Loading…');
    try {
      const data = await this.getScores(10);
      if (gen !== this._loadGen) return;
      if (!Array.isArray(data)) {
        this._setStatus('Unexpected response from server.');
        this.setScores([]);
        return;
      }
      this._setStatus(data.length === 0 ? 'No scores yet.' : '');
      this.setScores(data);
    } catch {
      if (gen !== this._loadGen) return;
      this._setStatus('Could not reach scores API. Is the server running?');
      this.setScores([]);
    }
  }

  /**
   * Replace table rows from a REST-shaped score array (CONTRACTS.md §C).
   * @param {Array<{ username?: string, score?: number, mode?: string, difficulty?: string }>} rows
   */
  setScores(rows) {
    if (!this.tbody) return;
    this.tbody.replaceChildren();

    if (!Array.isArray(rows) || rows.length === 0) {
      const empty = document.createElement('tr');
      empty.className = 'ui-table__empty';
      empty.innerHTML = `<td colspan="5">No scores yet.</td>`;
      this.tbody.appendChild(empty);
      return;
    }

    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeHtml(row.username ?? '—')}</td>
        <td>${Number(row.score) || 0}</td>
        <td>${escapeHtml(row.mode ?? '—')}</td>
        <td>${escapeHtml(row.difficulty ?? '—')}</td>
      `;
      this.tbody.appendChild(tr);
    });
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    if (this.el) this.el.hidden = !visible;
    if (visible) void this.refresh();
  }

  /** @param {string} message */
  _setStatus(message) {
    if (!this.statusEl) return;
    const text = String(message || '').trim();
    this.statusEl.hidden = !text;
    this.statusEl.textContent = text;
  }
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
