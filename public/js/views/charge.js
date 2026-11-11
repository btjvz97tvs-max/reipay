// 「受け取る金額」画面。読み取った相手の支払いコードに、金額を入れて請求する。

import { chargePaymentCode } from '../api.js';
import {
  confirmAction,
  formatRei,
  navigate,
  parseAmountInput,
  renderPerson,
  setFormBusy,
  setFormError,
  showToast,
  showView,
  validateAmount,
} from '../lib/ui.js';
import { getPendingCharge, setCurrentUser, setPendingCharge } from '../state.js';

async function handleChargeSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const pending = getPendingCharge();
  const formData = new FormData(form);
  const amount = parseAmountInput(formData.get('amount'));
  const memo = formData.get('memo').trim();

  const validationError = validateAmount(amount);
  setFormError(form, validationError);
  if (validationError || !pending) {
    return;
  }

  const isConfirmed = await confirmAction({
    title: '受け取りの確認',
    message: `${pending.payer.displayName}さんから\n${formatRei(amount)} を受け取ります`,
    confirmLabel: '受け取る',
  });
  if (!isConfirmed) {
    return;
  }

  setFormBusy(form, true);
  try {
    const { user } = await chargePaymentCode({ code: pending.code, amount, memo });
    setPendingCharge(null);
    setCurrentUser(user);
    form.reset();
    showToast(`${pending.payer.displayName}さんから${formatRei(amount)}受け取りました`);
    navigate('#/');
  } catch (error) {
    setFormError(form, error.message);
  } finally {
    setFormBusy(form, false);
  }
}

export function init() {
  document.getElementById('charge-form').addEventListener('submit', handleChargeSubmit);
}

export function show() {
  const pending = getPendingCharge();
  if (!pending) {
    navigate('#/scan');
    return;
  }

  const form = document.getElementById('charge-form');
  form.reset();
  setFormError(form, null);
  renderPerson(document.getElementById('charge-payer'), pending.payer);
  showView('charge');
}

export function hide() {}
