/**
 * REQ-UI — Highscores table. Renders arrays supplied by Agent-Network.
 */
export class Highscores {
  /**
   * @param {import('../../core/EventBus.js').EventBus} _bus
   */
  constructor(_bus) {}

  /**
   * @param {HTMLElement} root
   */
  mount(root) {
    const wrap = document.createElement('section');
    wrap.dataset.screen = 'highscores';
    wrap.hidden = true;
    wrap.innerHTML = `
      <h2>Highscores</h2>
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Score</th>
            <th>Mode</th>
            <th>Difficulty</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    root.appendChild(wrap);
  }
}
