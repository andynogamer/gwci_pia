/**
 * REQ-SRV-DB — dedicated Register screen (separate from Login + loadout).
 */
import { savePersistedAuth } from '../auth/session.js';

export class Register {
  /**
   * @param {import('../../core/EventBus.js').EventBus} _bus
   * @param {{ navigate: (screen: string) => void }} router
   * @param {{
   *   register?: (username: string, password: string) => Promise<{ success?: boolean, userId?: string | null }>,
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
    wrap.dataset.screen = 'register';
    wrap.className = 'ui-screen ui-screen--auth';
    wrap.hidden = true;
    wrap.innerHTML = `
      <header class="ui-screen__head">
        <p class="ui-brand__tag">ACCOUNT</p>
        <h2>Create Account</h2>
        <p class="ui-screen__sub">Enlist a new callsign. You will be signed in after.</p>
      </header>

      <p class="ui-status" data-register-status hidden></p>

      <form class="ui-form" data-form="register">
        <label class="ui-field">
          <span>Username</span>
          <input class="ui-input" name="username" type="text" maxlength="32" autocomplete="username" required />
        </label>
        <label class="ui-field">
          <span>Password</span>
          <input class="ui-input" name="password" type="password" minlength="4" autocomplete="new-password" required />
        </label>
        <label class="ui-field">
          <span>Confirm password</span>
          <input class="ui-input" name="passwordConfirm" type="password" minlength="4" autocomplete="new-password" required />
        </label>

        <div class="ui-actions ui-actions--stack">
          <button type="submit" class="ui-btn ui-btn--primary">Create Account</button>
          <button type="button" class="ui-btn" data-action="login">Already have an account?</button>
          <button type="button" class="ui-btn" data-action="back">Back</button>
        </div>
      </form>
    `;

    this.formEl = wrap.querySelector('[data-form="register"]');
    this.statusEl = wrap.querySelector('[data-register-status]');

    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      void this._submit();
    });
    wrap.querySelector('[data-action="login"]').addEventListener('click', () => {
      this.router.navigate('login');
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
      if (this.formEl) this.formEl.reset();
    }
  }

  async _submit() {
    const creds = this._readCreds();
    if (!creds) return;
    if (!this.auth.register) {
      this._setStatus('Auth API not wired.', true);
      return;
    }
    this._setStatus('Registering…');
    try {
      const result = await this.auth.register(creds.username, creds.password);
      if (!result?.success) {
        this._setStatus('Register failed (username taken or invalid).', true);
        return;
      }
      this._setStatus('Registered. Signing in…');
      if (!this.auth.login) {
        this._setStatus('Registered. Sign in from the Login screen.');
        this.router.navigate('login');
        return;
      }
      const loginResult = await this.auth.login(creds.username, creds.password);
      const token = loginResult?.token;
      const name = loginResult?.username || creds.username;
      if (!token) {
        this._setStatus('Account created, but sign-in failed. Try Login.', true);
        this.router.navigate('login');
        return;
      }
      savePersistedAuth({ token, username: name });
      this.auth.onSession?.({ token, username: name });
      this.auth.onAuthChange?.();
      this.router.navigate('menu');
    } catch {
      this._setStatus('Register failed. Is the server running?', true);
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
    const confirm = String(data.get('passwordConfirm') || '');
    if (!username || username.length > 32) {
      this._setStatus('Username required (max 32).', true);
      return null;
    }
    if (password.length < 4) {
      this._setStatus('Password must be at least 4 characters.', true);
      return null;
    }
    if (password !== confirm) {
      this._setStatus('Passwords do not match.', true);
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
