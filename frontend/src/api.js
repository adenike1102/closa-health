// Small wrapper around the PHP API. All routes live under /api.

async function request(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = new Error('Request failed: ' + res.status);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// Saves answers against the email and emails the plan link. Returns { token }.
export const savePlan = (body) => request('/plans', { method: 'POST', body: JSON.stringify(body) });

// Loads a saved plan from the link in the email.
export const loadPlan = (token) => request('/plans/' + encodeURIComponent(token));

export const deletePlan = (token) => request('/plans/' + encodeURIComponent(token), { method: 'DELETE' });

export const getProviders = (city, cat) =>
  request('/providers?city=' + encodeURIComponent(city) + '&cat=' + encodeURIComponent(cat));
