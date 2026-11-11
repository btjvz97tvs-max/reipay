// 画面表示の共通部品（画面の切り替え、フォーム、確認ダイアログ、トースト、金額と日付の表示）。

const CURRENCY_UNIT = 'れい';
const TOAST_DURATION_MS = 3000;
const FULL_WIDTH_DIGIT_OFFSET = 0xfee0;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// 下のタブバーを出す画面と、上のロゴのヘッダーを出す画面
const TAB_BAR_VIEWS = ['home', 'send', 'receive', 'admin', 'profile'];
const APP_HEADER_VIEWS = ['home'];

const timeFormatter = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' });
const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

let toastTimerId = null;

function updateTabBar(viewName) {
  const tabBar = document.getElementById('tab-bar');
  tabBar.hidden = !TAB_BAR_VIEWS.includes(viewName);
  for (const tab of tabBar.querySelectorAll('[data-tab]')) {
    if (tab.dataset.tab === viewName) {
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.removeAttribute('aria-current');
    }
  }
}

export function showView(viewName) {
  for (const view of document.querySelectorAll('[data-view]')) {
    view.hidden = view.dataset.view !== viewName;
  }
  document.getElementById('app-header').hidden = !APP_HEADER_VIEWS.includes(viewName);
  updateTabBar(viewName);
  window.scrollTo(0, 0);
}

// 同じ画面のまま表示し直したいときも動くよう、#/ が同じなら hashchange を自分で起こす。
export function navigate(hash) {
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function setFormError(form, message) {
  const errorElement = form.querySelector('[data-form-error]');
  errorElement.textContent = message ?? '';
  errorElement.hidden = !message;
}

export function setFormBusy(form, isBusy) {
  for (const element of form.elements) {
    element.disabled = isBusy;
  }
}

export function showToast(message, tone = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('toast--error', tone === 'error');
  toast.hidden = false;

  window.clearTimeout(toastTimerId);
  toastTimerId = window.setTimeout(() => {
    toast.hidden = true;
  }, TOAST_DURATION_MS);
}

export function confirmAction({ title, message, confirmLabel }) {
  const dialog = document.getElementById('confirm-dialog');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-ok').textContent = confirmLabel;

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {
      once: true,
    });
    dialog.returnValue = '';
    dialog.showModal();
  });
}

// 金額の表示は「1000れい」の形にそろえる。
export function formatRei(amount) {
  return `${amount}${CURRENCY_UNIT}`;
}

export function formatTime(isoText) {
  return timeFormatter.format(new Date(isoText));
}

// 同じ日かどうかを比べるための「2026-11-11」の形（端末の時間帯で判断する）
export function toDayKey(isoText) {
  return dayKeyFormatter.format(new Date(isoText));
}

// 履歴の日付の見出し（今日 / 昨日 / 11月9日(月)）
export function formatDayHeading(isoText) {
  const dayKey = toDayKey(isoText);
  if (dayKey === toDayKey(new Date().toISOString())) {
    return '今日';
  }
  if (dayKey === toDayKey(new Date(Date.now() - MILLISECONDS_PER_DAY).toISOString())) {
    return '昨日';
  }
  return dateFormatter.format(new Date(isoText));
}

function toHalfWidthDigit(char) {
  return String.fromCharCode(char.charCodeAt(0) - FULL_WIDTH_DIGIT_OFFSET);
}

// 「１０００」のような全角入力やカンマも受け付け、整数にできなければ NaN を返す。
export function parseAmountInput(text) {
  const normalized = text.replace(/[０-９]/g, toHalfWidthDigit).replace(/[,，\s]/g, '');
  return /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export function validateAmount(amount, { balance } = {}) {
  if (!Number.isInteger(amount) || amount < 1) {
    return '金額は1以上の整数で入力してください';
  }
  if (balance !== undefined && amount > balance) {
    return '残高が足りません';
  }
  return null;
}

export function cloneTemplate(templateId) {
  const template = document.getElementById(templateId);
  return template.content.firstElementChild.cloneNode(true);
}

// 先頭に「選んでください」を置き、フォームをリセットしたときもそこに戻るようにする。
export function fillSelect(select, options, placeholder) {
  const placeholderOption = new Option(placeholder, '', true, true);
  placeholderOption.disabled = true;
  select.replaceChildren(
    placeholderOption,
    ...options.map(({ value, label }) => new Option(label, value)),
  );
}

// 同じ名前の人を見分けられるよう、IDの先頭4文字を添える（例: たろう #k7m2）
export function formatPersonLabel(person) {
  return `${person.displayName} #${person.handle.slice(0, 4)}`;
}

// 丸いアイコンに出す1文字（名前の先頭）
export function getInitial(displayName) {
  return Array.from(displayName)[0] ?? '?';
}

// 丸いアイコンを描く。写真があれば写真、なければ名前の頭文字を出す。
export function renderAvatar(element, person) {
  if (!person.avatarUrl) {
    element.textContent = getInitial(person.displayName);
    return;
  }
  const image = document.createElement('img');
  image.className = 'avatar-image';
  image.src = person.avatarUrl;
  image.alt = '';
  image.decoding = 'async';
  element.replaceChildren(image);
}

export function renderPerson(element, person) {
  renderAvatar(element.querySelector('.person-card__avatar'), person);
  element.querySelector('.person-card__name').textContent = person.displayName;
  element.querySelector('.person-card__handle').textContent = `#${person.handle.slice(0, 4)}`;
}
