/**
 * Agent-Network — REST client matching CONTRACTS.md §C.
 * Does not write DOM. Never logs passwords.
 */
export class ApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    /** @type {string | null} */
    this.token = null;
  }

  /**
   * @param {string | null} token
   */
  setToken(token) {
    this.token = token && String(token).trim() ? String(token) : null;
  }

  getToken() {
    return this.token;
  }

  /**
   * @param {string} username
   * @param {string} password
   */
  async register(username, password) {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  }

  /**
   * @param {string} username
   * @param {string} password
   */
  async login(username, password) {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    this.token = data.token ?? null;
    return data;
  }

  /**
   * POST /api/scores — CONTRACTS.md §C body only.
   * @param {{ score: number, mode: string, difficulty: string }} body
   */
  async submitScore({ score, mode, difficulty }) {
    const res = await fetch(`${this.baseUrl}/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ score, mode, difficulty }),
    });
    return res.json();
  }

  /**
   * @param {number} [limit]
   */
  async getScores(limit = 10) {
    const res = await fetch(`${this.baseUrl}/scores?limit=${limit}`);
    return res.json();
  }
}
