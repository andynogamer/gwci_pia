/**
 * Agent-Network — REST client matching CONTRACTS.md §C.
 */
export class ApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  async register(username, password) {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  }

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

  async getScores(limit = 10) {
    const res = await fetch(`${this.baseUrl}/scores?limit=${limit}`);
    return res.json();
  }
}
