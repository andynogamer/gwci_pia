/**
 * Agent-UI — in-game HUD (armor, ammo, power-up timer, radar). DOM only.
 * Fed by EventBus numbers later; scaffold shell for WI-002.
 */
export class Hud {
  constructor() {
    /** @type {HTMLElement | null} */
    this.el = null;
  }

  /**
   * @param {HTMLElement} root
   */
  mount(root) {
    const wrap = document.createElement('div');
    wrap.dataset.hud = 'true';
    wrap.className = 'ui-hud';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="ui-hud__bar" data-armor>
        <span class="ui-hud__label">Armor</span>
        <div class="ui-hud__meter"><i style="width:100%"></i></div>
      </div>
      <div class="ui-hud__chip" data-ammo>Ammo —</div>
      <div class="ui-hud__chip" data-powerup>Power-up —</div>
      <div class="ui-hud__radar" data-radar aria-label="Radar minimap"></div>
    `;
    this.el = wrap;
    root.appendChild(wrap);
  }
}
