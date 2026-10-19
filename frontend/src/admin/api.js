// Talks to /api/admin/... The login is a cookie the browser keeps, so there is no token to handle here.
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api/admin' + path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Closa-Admin': '1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const adminApi = {
  session: () => call('/session'),
  login: (password) => call('/login', { method: 'POST', body: { password } }),
  logout: () => call('/logout', { method: 'POST' }),
  stats: (from, to) => call('/stats?from=' + from + '&to=' + to),
  unlock: (password) => call('/contacts/unlock', { method: 'POST', body: { password } }),
  lock: () => call('/contacts/lock', { method: 'POST' }),
  contacts: (optin, q) => call('/contacts?optin=' + (optin ? 1 : 0) + '&q=' + encodeURIComponent(q || '')),
  deleteContact: (id) => call('/contacts/' + id, { method: 'DELETE' }),
};
