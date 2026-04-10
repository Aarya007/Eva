let host = null;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.className = 'toast-host';
  document.body.appendChild(host);
  return host;
}

export function toast(message, type = 'error', timeoutMs = 4000) {
  const root = ensureHost();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  root.appendChild(el);
  window.setTimeout(() => {
    el.remove();
  }, timeoutMs);
}
