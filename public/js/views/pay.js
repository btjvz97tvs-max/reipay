// 「支払う」画面。数分だけ使えるコードをバーコードとQRで見せ、相手が読み取るのを待つ。

import { createPaymentCode, fetchPaymentCodeStatus } from '../api.js';
import { createBarcodeSvg, createQrCodeSvg } from '../lib/code-render.js';
import { formatRei, navigate, showToast, showView } from '../lib/ui.js';
import { formatPaymentCode } from '../shared/payment-code.js';
import { getCurrentUser, setCurrentUser } from '../state.js';

const POLL_INTERVAL_MS = 2000;
const COUNTDOWN_INTERVAL_MS = 1000;
const SECONDS_PER_MINUTE = 60;

let isActive = false;
let codeVersion = 0;
let currentCode = null;
let expiresAt = null;
let pollTimerId = null;
let countdownTimerId = null;

function stopTimers() {
  window.clearTimeout(pollTimerId);
  window.clearInterval(countdownTimerId);
}

function clearCode() {
  currentCode = null;
  document.getElementById('pay-barcode').replaceChildren();
  document.getElementById('pay-qr').replaceChildren();
  document.getElementById('pay-digits').textContent = '';
  document.getElementById('pay-timer').textContent = '';
}

function renderCode(code) {
  document.getElementById('pay-barcode').replaceChildren(createBarcodeSvg(code, '支払い用バーコード'));
  document.getElementById('pay-qr').replaceChildren(
    createQrCodeSvg(code, { mode: 'Numeric', label: '支払い用QRコード' }),
  );
  document.getElementById('pay-digits').textContent = formatPaymentCode(code);
}

function renderCountdown() {
  const remainingSeconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const minutes = Math.floor(remainingSeconds / SECONDS_PER_MINUTE);
  const seconds = String(remainingSeconds % SECONDS_PER_MINUTE).padStart(2, '0');
  document.getElementById('pay-timer').textContent = `あと ${minutes}:${seconds} 使えます`;
  if (remainingSeconds === 0) {
    issueNewCode();
  }
}

async function pollStatus(version) {
  try {
    const result = await fetchPaymentCodeStatus(currentCode);
    if (!isActive || version !== codeVersion) {
      return;
    }
    if (result.status === 'paid') {
      setCurrentUser(result.user);
      const { receiver, amount } = result.payment;
      showToast(`${receiver.displayName}さんに${formatRei(amount)}支払いました`);
      navigate('#/');
      return;
    }
    if (result.status === 'expired') {
      issueNewCode();
      return;
    }
  } catch {
    // 電波が一時的に悪いときなどは、次の確認でやり直す。
  }
  if (isActive && version === codeVersion) {
    pollTimerId = window.setTimeout(() => pollStatus(version), POLL_INTERVAL_MS);
  }
}

async function issueNewCode() {
  stopTimers();
  codeVersion += 1;
  const version = codeVersion;
  clearCode();
  document.getElementById('pay-timer').textContent = 'コードを準備しています…';

  try {
    const result = await createPaymentCode();
    if (!isActive || version !== codeVersion) {
      return;
    }
    currentCode = result.code;
    expiresAt = new Date(result.expiresAt).getTime();
    renderCode(currentCode);
    renderCountdown();
    countdownTimerId = window.setInterval(renderCountdown, COUNTDOWN_INTERVAL_MS);
    pollTimerId = window.setTimeout(() => pollStatus(version), POLL_INTERVAL_MS);
  } catch (error) {
    document.getElementById('pay-timer').textContent = error.message;
  }
}

export function init() {
  document.getElementById('pay-refresh-button').addEventListener('click', issueNewCode);
}

export async function show() {
  isActive = true;
  document.getElementById('pay-balance').textContent = formatRei(getCurrentUser().balance);
  showView('pay');
  await issueNewCode();
}

// 画面を離れたらコードを消し、確認も止める。
export function hide() {
  isActive = false;
  codeVersion += 1;
  stopTimers();
  clearCode();
}
