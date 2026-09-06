/**
 * Client auth session persistence (mta.*). Do not store or log passwords.
 * Keys: mta.authToken, mta.username
 */

/** @type {const} */
export const AUTH_KEYS = {
  token: 'mta.authToken',
  username: 'mta.username',
};

/**
 * @returns {{ token: string | null, username: string | null }}
 */
export function loadPersistedAuth() {
  const token = localStorage.getItem(AUTH_KEYS.token);
  const username = localStorage.getItem(AUTH_KEYS.username);
  return {
    token: token && token.trim() ? token : null,
    username: username && username.trim() ? username : null,
  };
}

/**
 * @param {{ token: string, username: string }} session
 */
export function savePersistedAuth(session) {
  localStorage.setItem(AUTH_KEYS.token, session.token);
  localStorage.setItem(AUTH_KEYS.username, session.username);
}

export function clearPersistedAuth() {
  localStorage.removeItem(AUTH_KEYS.token);
  localStorage.removeItem(AUTH_KEYS.username);
}
