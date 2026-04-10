import { generateFullPlan, getPlans, getProfile } from '../api/client.js';
import { go } from '../nav.js';
import { toast } from '../ui/toast.js';

function $(id) {
  return document.getElementById(id);
}

const STATUS_STEPS = [
  'Analysing your profile...',
  'Computing TDEE & macros...',
  'Designing workout split...',
  'Calibrating meal timing...',
  'Optimising recovery windows...',
  'Finalising your plan...',
];

async function handleGenerate(btn, modal, status) {
  modal.style.display = 'flex';
  btn.classList.add('btn--loading');
  let i = 0;
  const timer = window.setInterval(() => {
    status.textContent = STATUS_STEPS[i % STATUS_STEPS.length];
    i += 1;
  }, 1800);
  try {
    const profileResp = await getProfile();
    const profile = profileResp?.profile || profileResp || {};
    console.log('Generating with profile:', profile);

    const generated = await generateFullPlan(profile);
    console.log('Generated:', generated);
    await getPlans().catch(() => null);

    toast('Plan generated successfully', 'success');
    await go('plans');
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('400') && msg.toLowerCase().includes('complete onboarding first')) {
      toast('Complete onboarding first', 'error');
      await go('onboarding');
    } else {
      console.error('Generate failed:', e);
      toast(`Generate failed: ${msg}`, 'error');
    }
  } finally {
    window.clearInterval(timer);
    modal.style.display = 'none';
    btn.classList.remove('btn--loading');
  }
}

export function initGenerate() {
  const btn = $('btn-generate-now');
  const modal = $('gen-modal');
  const status = $('gen-status');
  if (!btn || !modal || !status) return;

  void getProfile()
    .then((resp) => {
      const p = resp?.profile || resp || {};
      if ($('gen-snap-height')) $('gen-snap-height').textContent = `${p.height || '—'} cm`;
      if ($('gen-snap-weight')) $('gen-snap-weight').textContent = `${p.weight || '—'} kg`;
      if ($('gen-snap-goal')) $('gen-snap-goal').textContent = p.goal || '—';
    })
    .catch(() => {});

  if (btn.dataset.bound === 'true') return;
  btn.dataset.bound = 'true';
  btn.addEventListener('click', async () => {
    await handleGenerate(btn, modal, status);
  });
}
