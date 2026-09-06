/**
 * REQ-UI / WI-024 — Game Over overlay. Shows GAME_OVER { winner, score }.
 */

export class GameOver {
  /**
   * @param {import('../../core/EventBus.js').EventBus} _bus
   * @param {{ toMenu: () => void }} router
   */
  constructor(_bus, router) {
    this.router = router;
    /** @type {HTMLElement | null} */
    this.el = null;
    /** @type {HTMLElement | null} */
    this.winnerEl = null;
    /** @type {HTMLElement | null} */
    this.scoreEl = null;
    /** @type {HTMLElement | null} */
    this.subEl = null;
  }

  /**
   * @param {HTMLElement} root
   */
  mount(root) {
    const wrap = document.createElement('section');
    wrap.dataset.screen = 'game-over';
    wrap.className = 'ui-screen ui-screen--game-over';
    wrap.hidden = true;
    wrap.innerHTML = `
      <header class="ui-screen__head">
        <p class="ui-brand__tag">MISSION REPORT</p>
        <h2 data-go-title>Game Over</h2>
        <p class="ui-screen__sub" data-go-sub></p>
      </header>

      <dl class="ui-result">
        <div>
          <dt>Winner</dt>
          <dd data-go-winner>—</dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd data-go-score>0</dd>
        </div>
      </dl>

      <div class="ui-actions ui-actions--stack">
        <button type="button" class="ui-btn ui-btn--primary" data-action="menu">Main Menu</button>
      </div>
    `;

    this.winnerEl = wrap.querySelector('[data-go-winner]');
    this.scoreEl = wrap.querySelector('[data-go-score]');
    this.subEl = wrap.querySelector('[data-go-sub]');
    this.titleEl = wrap.querySelector('[data-go-title]');

    wrap.querySelector('[data-action="menu"]').addEventListener('click', () => {
      this.router.toMenu();
    });

    this.el = wrap;
    root.appendChild(wrap);
  }

  /**
   * @param {{ winner?: string, score?: number }} payload
   */
  show(payload) {
    const winner = String(payload?.winner ?? '');
    const score = Number(payload?.score) || 0;
    const { title, sub, label } = describeResult(winner);

    if (this.titleEl) this.titleEl.textContent = title;
    if (this.subEl) this.subEl.textContent = sub;
    if (this.winnerEl) this.winnerEl.textContent = label;
    if (this.scoreEl) this.scoreEl.textContent = String(score);
    this.setVisible(true);
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    if (this.el) this.el.hidden = !visible;
  }
}

/**
 * @param {string} winner
 * @returns {{ title: string, sub: string, label: string }}
 */
function describeResult(winner) {
  if (winner === 'player') {
    return {
      title: 'Victory',
      sub: 'You held the arena.',
      label: 'Player',
    };
  }
  if (winner === 'arena') {
    return {
      title: 'Defeat',
      sub: 'The horde broke your armor.',
      label: 'Arena',
    };
  }
  if (!winner) {
    return {
      title: 'Match Ended',
      sub: 'Deploy aborted. Score retained from this run.',
      label: '—',
    };
  }
  return {
    title: 'Game Over',
    sub: 'Match complete.',
    label: winner,
  };
}
