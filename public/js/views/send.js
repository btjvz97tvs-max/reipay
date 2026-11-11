// 「送る」画面。一覧から相手を選ぶか、受け取りQRを読み取って相手を決めて送る。

import { fetchCurrentUser, fetchRecipients, sendTransfer } from '../api.js';
import {
  confirmAction,
  fillSelect,
  formatPersonLabel,
  formatRei,
  navigate,
  parseAmountInput,
  setFormBusy,
  setFormError,
  showToast,
  showView,
  validateAmount,
} from '../lib/ui.js';
import { getCurrentUser, setCurrentUser } from '../state.js';

let sendRequestId = crypto.randomUUID();

function finishSend(form, user, message) {
  sendRequestId = crypto.randomUUID();
  form.reset();
  setCurrentUser(user);
  showToast(message);
  navigate('#/');
}

async function handleSendSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const input = {
    toHandle: formData.get('toHandle'),
    amount: parseAmountInput(formData.get('amount')),
    memo: formData.get('memo').trim(),
  };

  const validationError = input.toHandle
    ? validateAmount(input.amount, { balance: getCurrentUser().balance })
    : '送り先を選んでください';
  setFormError(form, validationError);
  if (validationError) {
    return;
  }

  const recipientLabel = form.elements.toHandle.selectedOptions[0].textContent;
  const isConfirmed = await confirmAction({
    title: '支払いの確認',
    message: `${recipientLabel} さんに\n${formatRei(input.amount)} を送ります`,
    confirmLabel: '送る',
  });
  if (!isConfirmed) {
    return;
  }

  setFormBusy(form, true);
  try {
    const { user } = await sendTransfer({ ...input, requestId: sendRequestId });
    finishSend(form, user, `${recipientLabel} さんに${formatRei(input.amount)}送りました`);
  } catch (error) {
    if (error.code === 'duplicate_request') {
      // 通信が途切れて再送したときなど。前の送金はもう届いているので、最新の残高を取り直す。
      const { user } = await fetchCurrentUser();
      finishSend(form, user, error.message);
      return;
    }
    setFormError(form, error.message);
  } finally {
    setFormBusy(form, false);
  }
}

export function init() {
  document.getElementById('send-form').addEventListener('submit', handleSendSubmit);
}

// handle があれば（受け取りQRを読み取ったとき）、その人を送り先に選んでおく。
export async function show({ handle } = {}) {
  const form = document.getElementById('send-form');
  const user = getCurrentUser();
  form.reset();
  setFormError(form, null);
  document.getElementById('send-balance').textContent = formatRei(user.balance);
  showView('send');

  const { recipients } = await fetchRecipients();
  const options = recipients.map((recipient) => ({
    value: recipient.handle,
    label: formatPersonLabel(recipient),
  }));
  fillSelect(form.elements.toHandle, options, '選んでください');

  if (!handle) {
    return;
  }
  if (handle === user.handle) {
    setFormError(form, '自分の受け取りQRです。自分には送れません');
  } else if (recipients.some((recipient) => recipient.handle === handle)) {
    form.elements.toHandle.value = handle;
    form.elements.amount.focus();
  } else {
    setFormError(form, 'このQRコードの相手が見つかりません');
  }
}

export function hide() {}
