/**
 * REQ-UI — Highscores table. Renders arrays supplied later (WI-014 / ApiClient).
 */

export class Highscores {
  /**
   * @param {import('../../core/EventBus.js').EventBus} _bus
   * @param {{ navigate: (screen: string) => void }} router
   */
  constructor(_bus, router) {
    this.router = router;
    /** @type {HTMLElement | null} */
    this.el = null;
    /** @type {HTMLTableSectionElement | null} */
    this.tbody = null;
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
        <p class="ui-screen__sub">Top deployments on this machine / server.</p>
      </header>

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
        <button type="button" class="ui-btn ui-btn--primary" data-action="back">Back</button>
      </div>
    `;

    this.tbody = wrap.querySelector('[data-scores-body]');
    wrap.querySelector('[data-action="back"]').addEventListener('click', () => {
      this.router.navigate('menu');
    });

    this.el = wrap;
    root.appendChild(wrap);
  }

  /**
   * Replace table rows from a REST-shaped score array.
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
