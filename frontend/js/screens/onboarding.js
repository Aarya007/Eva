import { mountWizard } from '../onboarding/wizard.js';
import { go } from '../nav.js';
import { toast } from '../ui/toast.js';

function $(id) {
  return document.getElementById(id);
}

let _mounted = false;
let _wizard = null;

export function initOnboarding() {
  const panelBody = document.querySelector('#screen-onboarding .panel-body');
  if (!panelBody) return;

  if (_mounted && _wizard) {
    void _wizard.refresh?.();
    return;
  }

  panelBody.innerHTML = '';
  _wizard = mountWizard(panelBody, {
    onComplete: async () => {
      toast('Onboarding complete', 'success');
      console.log('Onboarding submitted');
      await go('dashboard');
    },
  });
  _mounted = true;
}
