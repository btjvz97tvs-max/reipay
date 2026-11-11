// はじめて開いたときの画面（名前を入れて始める / Face ID で復元する）。

import {
  authenticateWithPasskey,
  fetchPasskeyAuthenticationOptions,
  startAccount,
} from '../api.js';
import { getPasskeyAssertion, isPasskeySupported } from '../lib/passkey.js';
import { formatRei, navigate, setFormBusy, setFormError, showToast, showView } from '../lib/ui.js';
import { setCurrentUser } from '../state.js';

// 受け取りQRから開いた場合などは、その画面のまま続ける。
function continueToApp(user, message) {
  setCurrentUser(user);
  showToast(message);
  navigate(window.location.hash || '#/');
}

async function handleStartSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  setFormError(form, null);
  setFormBusy(form, true);
  try {
    const { user } = await startAccount({ displayName: formData.get('displayName').trim() });
    form.reset();
    continueToApp(user, `${formatRei(user.balance)}もらいました！`);
  } catch (error) {
    setFormError(form, error.message);
  } finally {
    setFormBusy(form, false);
  }
}

function setRestoreError(message) {
  const errorElement = document.getElementById('restore-error');
  errorElement.textContent = message ?? '';
  errorElement.hidden = !message;
}

async function handleRestoreClick(event) {
  const button = event.currentTarget;
  setRestoreError(null);
  if (!isPasskeySupported()) {
    setRestoreError('このブラウザでは Face ID を使えません');
    return;
  }

  button.disabled = true;
  try {
    const { options } = await fetchPasskeyAuthenticationOptions();
    const credential = await getPasskeyAssertion(options);
    const { user } = await authenticateWithPasskey(credential);
    continueToApp(user, `${user.displayName}さんのデータを元に戻しました`);
  } catch (error) {
    setRestoreError(error.message);
  } finally {
    button.disabled = false;
  }
}

export function init() {
  document.getElementById('start-form').addEventListener('submit', handleStartSubmit);
  document.getElementById('restore-button').addEventListener('click', handleRestoreClick);
}

export function show() {
  showView('welcome');
}

export function hide() {}
