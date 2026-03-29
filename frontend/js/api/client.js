const API = "";

export async function fetchOnboardingStatus() {
  const res = await fetch(`${API}/onboarding/status`);
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}

export async function postOnboardingStep(body) {
  const res = await fetch(`${API}/onboarding/step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function postOnboard(body) {
  const res = await fetch(`${API}/onboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function postGenerateDiet(body) {
  const res = await fetch(`${API}/generate-diet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

export async function postFeedback(body) {
  const res = await fetch(`${API}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`);
  }
  return data;
}
