// ホーム（スキャン・支払う、残高、Face ID 登録のすすめ、日付ごとの取引履歴）。

import {
  fetchCurrentUser,
  fetchPasskeyRegistrationOptions,
  fetchTransactions,
  registerPasskey,
} from '../api.js';
import { createPasskeyCredential, isPasskeySupported } from '../lib/passkey.js';
import {
  cloneTemplate,
  formatDayHeading,
  formatPersonLabel,
  formatRei,
  formatTime,
  renderAvatar,
  showToast,
  showView,
  toDayKey,
} from '../lib/ui.js';
import { getCurrentUser, setCurrentUser } from '../state.js';

const BONUS_AVATAR_LABEL = 'れ';

// 履歴1行の見た目。管理者からのプレゼントや回収は「れ」のアイコン、ほかは相手のアイコンを出す。
function describeTransaction(transaction) {
  const action = transaction.direction === 'in' ? '受け取り' : '支払い';
  if (transaction.kind === 'grant') {
    return { person: null, title: 'はじめのプレゼント', action };
  }
  if (transaction.kind === 'issue') {
    return { person: null, title: '管理者', action };
  }
  if (transaction.kind === 'collect') {
    return { person: null, title: '管理者', action: '回収' };
  }
  const person = transaction.counterparty ?? { displayName: '不明なユーザー', avatarUrl: null };
  return { person, title: person.displayName, action };
}

function createHistoryItem(transaction) {
  const item = cloneTemplate('history-item-template');
  const { person, title, action } = describeTransaction(transaction);
  const memo = transaction.kind === 'grant' ? '' : transaction.memo;
  const sign = transaction.direction === 'in' ? '+' : '-';

  const avatarElement = item.querySelector('.history-item__avatar');
  if (person) {
    renderAvatar(avatarElement, person);
  } else {
    avatarElement.textContent = BONUS_AVATAR_LABEL;
    avatarElement.classList.add('history-item__avatar--bonus');
  }

  item.querySelector('.history-item__title').textContent = title;
  item.querySelector('.history-item__meta').textContent = [action, memo].filter(Boolean).join('・');
  item.querySelector('.history-item__time').textContent = formatTime(transaction.createdAt);

  const amount = item.querySelector('.history-item__amount');
  amount.textContent = `${sign}${formatRei(transaction.amount)}`;
  amount.classList.add(`history-item__amount--${transaction.direction}`);
  return item;
}

function createDateHeading(isoText) {
  const heading = cloneTemplate('history-date-template');
  heading.textContent = formatDayHeading(isoText);
  return heading;
}

// 新しい順に並んだ履歴の、日付が変わるところに見出しをはさむ。
function createHistoryRows(transactions) {
  const rows = [];
  let previousDayKey = null;
  for (const transaction of transactions) {
    const dayKey = toDayKey(transaction.createdAt);
    if (dayKey !== previousDayKey) {
      rows.push(createDateHeading(transaction.createdAt));
      previousDayKey = dayKey;
    }
    rows.push(createHistoryItem(transaction));
  }
  return rows;
}

function renderUser(user) {
  document.getElementById('balance-value').textContent = String(user.balance);
  document.getElementById('balance-owner').textContent = formatPersonLabel(user);
  renderAvatar(document.getElementById('header-avatar'), user);
  document.getElementById('admin-link').hidden = !user.isAdmin;
  document.getElementById('passkey-banner').hidden = user.hasPasskey || !isPasskeySupported();
}

async function loadHistory() {
  const list = document.getElementById('history-list');
  const emptyMessage = document.getElementById('history-empty');
  const { transactions } = await fetchTransactions();
  list.replaceChildren(...createHistoryRows(transactions));
  list.hidden = transactions.length === 0;
  emptyMessage.hidden = transactions.length > 0;
}

function setPasskeyError(message) {
  const errorElement = document.getElementById('passkey-error');
  errorElement.textContent = message ?? '';
  errorElement.hidden = !message;
}

async function handlePasskeyRegisterClick(event) {
  const button = event.currentTarget;
  setPasskeyError(null);
  button.disabled = true;
  try {
    const { options } = await fetchPasskeyRegistrationOptions();
    const credential = await createPasskeyCredential(options);
    const { user } = await registerPasskey(credential);
    setCurrentUser(user);
    renderUser(user);
    showToast('Face ID を登録しました');
  } catch (error) {
    setPasskeyError(error.message);
  } finally {
    button.disabled = false;
  }
}

export function init() {
  document.getElementById('passkey-banner').addEventListener('click', handlePasskeyRegisterClick);
}

export async function show() {
  renderUser(getCurrentUser());
  showView('home');

  // 友達から支払われた分などを反映するため、開くたびに最新の残高を取り直す。
  const { user } = await fetchCurrentUser();
  setCurrentUser(user);
  renderUser(user);
  await loadHistory();
}

export function hide() {
  setPasskeyError(null);
}
