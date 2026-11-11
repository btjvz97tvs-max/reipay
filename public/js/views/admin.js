// 管理者メニュー（招待コードを作る、れいを配る、みんなの残高を見る）。

import {
  createInviteCode,
  fetchAdminUsers,
  fetchCurrentUser,
  fetchInviteCodes,
  issueCurrency,
} from '../api.js';
import {
  cloneTemplate,
  confirmAction,
  fillSelect,
  formatPersonLabel,
  formatRei,
  getInitial,
  parseAmountInput,
  setFormBusy,
  setFormError,
  showToast,
  showView,
  validateAmount,
} from '../lib/ui.js';
import { getCurrentUser, setCurrentUser } from '../state.js';

let issueRequestId = crypto.randomUUID();

// 招待コード ------------------------------------------------------------

async function copyInviteCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showToast(`${code} をコピーしました`);
  } catch {
    showToast('コピーできませんでした。コードを長押ししてコピーしてください', 'error');
  }
}

function createInviteRow(inviteCode) {
  const row = cloneTemplate('invite-row-template');
  const copyButton = row.querySelector('.invite-row__copy');
  row.querySelector('.invite-row__code').textContent = inviteCode.code;

  if (inviteCode.usedBy) {
    row.classList.add('invite-row--used');
    row.querySelector('.invite-row__status').textContent = `${inviteCode.usedBy.displayName}さんが使用`;
    copyButton.hidden = true;
  } else {
    row.querySelector('.invite-row__status').textContent = '未使用';
    copyButton.addEventListener('click', () => copyInviteCode(inviteCode.code));
  }
  return row;
}

function renderInviteCodes(inviteCodes) {
  document.getElementById('invite-list').replaceChildren(...inviteCodes.map(createInviteRow));
}

async function handleInviteCreateClick(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const { inviteCode } = await createInviteCode();
    const { inviteCodes } = await fetchInviteCodes();
    renderInviteCodes(inviteCodes);
    showToast(`招待コード ${inviteCode.code} を作りました`);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

// れいを配る・残高一覧 --------------------------------------------------

function createUserRow(user) {
  const row = cloneTemplate('admin-user-template');
  const adminMark = user.isAdmin ? '（管理者）' : '';
  row.querySelector('.user-row__avatar').textContent = getInitial(user.displayName);
  row.querySelector('.user-row__display-name').textContent = `${user.displayName}${adminMark}`;
  row.querySelector('.user-row__handle').textContent = `#${user.handle.slice(0, 4)}`;
  row.querySelector('.user-row__balance').textContent = formatRei(user.balance);
  return row;
}

function renderUsers(users) {
  document.getElementById('admin-user-list').replaceChildren(...users.map(createUserRow));
  const options = users.map((user) => ({ value: user.handle, label: formatPersonLabel(user) }));
  fillSelect(document.getElementById('issue-recipient'), options, '選んでください');
}

async function finishIssue(form, users) {
  issueRequestId = crypto.randomUUID();
  form.reset();
  renderUsers(users);
  const { user } = await fetchCurrentUser();
  setCurrentUser(user);
}

async function handleIssueSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const input = {
    toHandle: formData.get('toHandle'),
    amount: parseAmountInput(formData.get('amount')),
    memo: formData.get('memo').trim(),
  };

  const validationError = input.toHandle ? validateAmount(input.amount) : '配る相手を選んでください';
  setFormError(form, validationError);
  if (validationError) {
    return;
  }

  const recipientLabel = form.elements.toHandle.selectedOptions[0].textContent;
  const isConfirmed = await confirmAction({
    title: '配る前の確認',
    message: `${recipientLabel} さんに\n${formatRei(input.amount)} を配ります`,
    confirmLabel: '配る',
  });
  if (!isConfirmed) {
    return;
  }

  setFormBusy(form, true);
  try {
    const { users } = await issueCurrency({ ...input, requestId: issueRequestId });
    await finishIssue(form, users);
    showToast(`${recipientLabel} さんに${formatRei(input.amount)}配りました`);
  } catch (error) {
    if (error.code === 'duplicate_request') {
      // 通信が途切れて再送したときなど。前の分はもう配れているので、一覧を取り直す。
      const { users } = await fetchAdminUsers();
      await finishIssue(form, users);
      showToast(error.message);
      return;
    }
    setFormError(form, error.message);
  } finally {
    setFormBusy(form, false);
  }
}

export function init() {
  document
    .getElementById('invite-create-button')
    .addEventListener('click', handleInviteCreateClick);
  document.getElementById('issue-form').addEventListener('submit', handleIssueSubmit);
}

export async function show() {
  const form = document.getElementById('issue-form');
  form.reset();
  setFormError(form, null);
  showView('admin');

  if (!getCurrentUser().isAdmin) {
    return;
  }
  const [{ users }, { inviteCodes }] = await Promise.all([fetchAdminUsers(), fetchInviteCodes()]);
  renderUsers(users);
  renderInviteCodes(inviteCodes);
}

export function hide() {}
