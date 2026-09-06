/**
 * REQ-SRV-DB — dedicated Login screen (separate from Register + loadout).
 */
import {
  loadPersistedAuth,
  savePersistedAuth,
} from '../auth/session.js';

export class Login {
  /**
   * @param {import('../../core/EventBus.js').EventBus} _bus
   * @param {{ navigate: (screen: string) => void }} router
   * @param {{
   *   login?: (username: string, password: string) => Promise<{ token?: string | null, username?: string | null }>,
   *   onSession?: (session: { token: string | null, username: string | null }) => void,
   *   onAuthChange?: () => void,
   * }} [auth]
   */
  constructor(_bus, router, auth = {}) {
    this.router = router;
    this.auth = auth;
    /** @type {HTMLElement | null} */
    this.el = null;
    /** @type {HTMLFormElement | null} */
    this.formEl = null;
    /** @type {HTMLElement | null} */
    this.statusEl = null;
  }

  /**
   * @param {HTMLElement} root
   */
  mount(root) {
    const wrap = document.createElement('section');
    wrap.dataset.screen = 'login';
    wrap.className = 'ui-screen ui-screen--auth';
    wrap.hidden = true;
    wrap.innerHTML = `
      <header class="ui-screen__head">
        <p class="ui-brand__tag">ACCOUNT</p>
        <h2>Sign In</h2>
        <p class="ui-screen__sub">Use your arena credentials to save scores.</p>
      </header>

      <p class="ui-status" data-login-status hidden></p>

      <form class="ui-form" data-form="login">
        <label class="ui-field">
          <span>Username</span>
          <input class="ui-input" name="username" type="text" maxlength="32" autocomplete="username" required />
        </label>
        <label class="ui-field">
          <span>Password</span>
          <input class="ui-input" name="password" type="password" minlength="4" autocomplete="current-password" required />
        </label>

        <div class="ui-actions ui-actions--stack">
          <button type="submit" class="ui-btn ui-btn--primary">Sign In</button>
          <button type="button" class="ui-btn" data-action="register">Create account</button>
          <button type="button" class="ui-btn" data-action="back">Back</button>
        </div>
      </form>
    `;

    this.formEl = wrap.querySelector('[data-form="login"]');
    this.statusEl = wrap.querySelector('[data-login-status]');

    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      void this._submit();
    });
    wrap.querySelector('[data-action="register"]').addEventListener('click', () => {
      this.router.navigate('register');
    });
    wrap.querySelector('[data-action="back"]').addEventListener('click', () => {
      this.router.navigate('menu');
    });

    this.el = wrap;
    root.appendChild(wrap);
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    if (this.el) this.el.hidden = !visible;
    if (visible) {
      this._setStatus('');
      const session = loadPersistedAuth();
      const userInput = this.formEl?.querySelector('input[name="username"]');
      if (userInput instanceof HTMLInputElement && session.username) {
        userInput.value = session.username;
      }
      const passInput = this.formEl?.querySelector('input[name="password"]');
      if (passInput instanceof HTMLInputElement) passInput.value = '';
    }
  }

  async _submit() {
    const creds = this._readCreds();
    if (!creds) return;
    if (!this.auth.login) {
      this._setStatus('Auth API not wired.', true);
      return;
    }
    this._setStatus('Signing in…');
    try {
      const result = await this.auth.login(creds.username, creds.password);
      const token = result?.token;
      const name = result?.username || creds.username;
      if (!token) {
        this._setStatus('Login failed (check username / password).', true);
        return;
      }
      savePersistedAuth({ token, username: name });
      this.auth.onSession?.({ token, username: name });
      this.auth.onAuthChange?.();
      this._setStatus('Signed in.');
      this.router.navigate('menu');
    } catch {
      this._setStatus('Login failed. Is the server running?', true);
    }
  }

  /**
   * @returns {{ username: string, password: string } | null}
   */
  _readCreds() {
    if (!this.formEl) return null;
    const data = new FormData(this.formEl);
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');
    if (!username || username.length > 32) {
      this._setStatus('Username required (max 32).', true);
      return null;
    }
    if (password.length < 4) {
      this._setStatus('Password must be at least 4 characters.', true);
      return null;
    }
    return { username, password };
  }

  /**
   * @param {string} message
   * @param {boolean} [isError]
   */
  _setStatus(message, isError = false) {
    if (!this.statusEl) return;
    const text = String(message || '').trim();
    this.statusEl.hidden = !text;
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('ui-status--error', Boolean(isError && text));
  }
}
