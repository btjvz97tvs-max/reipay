// 管理者メニュー（れいを配る、れいを回収する、みんなの残高を見る）。

import { collectCurrency, fetchAdminUsers, fetchCurrentUser, issueCurrency } from '../api.js';
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

// 「配る」と「回収する」は入力の形も流れも同じなので、違うところだけをここにまとめる。
const ACTIONS = {
  issue: {
    formId: 'issue-form',
    handleField: 'toHandle',
    missingTargetMessage: '配る相手を選んでください',
    confirmTitle: '配る前の確認',
    confirmLabel: '配る',
    buildConfirmMessage: (name, amount) => `${name} さんに\n${formatRei(amount)} を配ります`,
    buildDoneMessage: (name, amount) => `${name} さんに${formatRei(amount)}配りました`,
    send: issueCurrency,
  },
  collect: {
    formId: 'collect-form',
    handleField: 'fromHandle',
    missingTargetMessage: '回収する相手を選んでください',
    confirmTitle: '回収する前の確認',
    confirmLabel: '回収する',
    buildConfirmMessage: (name, amount) => `${name} さんから\n${formatRei(amount)} を回収します`,
    buildDoneMessage: (name, amount) => `${name} さんから${formatRei(amount)}回収しました`,
    send: collectCurrency,
  },
};

const requestIds = { issue: crypto.randomUUID(), collect: crypto.randomUUID() };
let usersByHandle = new Map();

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
  usersByHandle = new Map(users.map((user) => [user.handle, user]));
  document.getElementById('admin-user-list').replaceChildren(...users.map(createUserRow));

  const issueOptions = users.map((user) => ({ value: user.handle, label: formatPersonLabel(user) }));
  fillSelect(document.getElementById('issue-recipient'), issueOptions, '選んでください');

  // 回収では、相手の今の残高も見えるようにする。
  const collectOptions = users.map((user) => ({
    value: user.handle,
    label: `${formatPersonLabel(user)}（${formatRei(user.balance)}）`,
  }));
  fillSelect(document.getElementById('collect-target'), collectOptions, '選んでください');
}

async function finishAction(actionName, form, users) {
  requestIds[actionName] = crypto.randomUUID();
  form.reset();
  renderUsers(users);
  const { user } = await fetchCurrentUser();
  setCurrentUser(user);
}

async function handleActionSubmit(actionName, event) {
  event.preventDefault();
  const action = ACTIONS[actionName];
  const form = event.currentTarget;
  const formData = new FormData(form);
  const handle = formData.get(action.handleField);
  const amount = parseAmountInput(formData.get('amount'));
  const memo = formData.get('memo').trim();

  const validationError = handle ? validateAmount(amount) : action.missingTargetMessage;
  setFormError(form, validationError);
  if (validationError) {
    return;
  }

  const targetName = usersByHandle.get(handle)?.displayName ?? '相手';
  const isConfirmed = await confirmAction({
    title: action.confirmTitle,
    message: action.buildConfirmMessage(targetName, amount),
    confirmLabel: action.confirmLabel,
  });
  if (!isConfirmed) {
    return;
  }

  setFormBusy(form, true);
  try {
    const { users } = await action.send({
      [action.handleField]: handle,
      amount,
      memo,
      requestId: requestIds[actionName],
    });
    await finishAction(actionName, form, users);
    showToast(action.buildDoneMessage(targetName, amount));
  } catch (error) {
    if (error.code === 'duplicate_request') {
      // 通信が途切れて再送したときなど。前の分はもう済んでいるので、一覧を取り直す。
      const { users } = await fetchAdminUsers();
      await finishAction(actionName, form, users);
      showToast(error.message);
      return;
    }
    setFormError(form, error.message);
  } finally {
    setFormBusy(form, false);
  }
}

export function init() {
  for (const [actionName, action] of Object.entries(ACTIONS)) {
    document
      .getElementById(action.formId)
      .addEventListener('submit', (event) => handleActionSubmit(actionName, event));
  }
}

export async function show() {
  for (const { formId } of Object.values(ACTIONS)) {
    const form = document.getElementById(formId);
    form.reset();
    setFormError(form, null);
  }
  showView('admin');

  if (!getCurrentUser().isAdmin) {
    return;
  }
  const { users } = await fetchAdminUsers();
  renderUsers(users);
}

export function hide() {}
