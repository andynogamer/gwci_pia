/**
 * Agent-UI — in-game HUD (armor, ammo, power-up timer, radar). DOM only.
 */
export class Hud {
  /**
   * @param {HTMLElement} root
   */
  mount(root) {
    const wrap = document.createElement('div');
    wrap.dataset.hud = 'true';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div data-armor></div>
      <div data-ammo></div>
      <div data-powerup></div>
      <div data-radar></div>
    `;
    root.appendChild(wrap);
  }
}
