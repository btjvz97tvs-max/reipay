// 「スキャン」画面。相手の支払いコード（バーコード/QR）か、受け取りQRを読み取る。

import { lookupPaymentCode } from '../api.js';
import { parseScannedText } from '../lib/scan-result.js';
import { startScanner } from '../lib/scanner.js';
import { navigate, setFormBusy, setFormError, showView } from '../lib/ui.js';
import { setPendingCharge } from '../state.js';

const RETRY_DELAY_MS = 2500;
const READY_MESSAGE = 'QRコードかバーコードを枠の中に写してください';

let isActive = false;
let isHandlingResult = false;
let stopScanner = null;

function setStatus(message) {
  document.getElementById('scan-status').textContent = message;
}

function stopCamera() {
  if (stopScanner) {
    stopScanner();
    stopScanner = null;
  }
}

function toCameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError') {
    return 'カメラの使用が許可されていません。設定で許可するか、下にコードを入力してください';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
    return 'カメラが見つかりません。下にコードを入力してください';
  }
  return 'カメラを起動できませんでした。下にコードを入力してください';
}

async function handleResult(result) {
  isHandlingResult = true;
  if (result.type === 'receive') {
    navigate(`#/send/${result.handle}`);
    return;
  }

  setStatus('コードを確認しています…');
  try {
    const { payer } = await lookupPaymentCode(result.code);
    setPendingCharge({ code: result.code, payer });
    navigate('#/charge');
  } catch (error) {
    if (!isActive) {
      return;
    }
    isHandlingResult = false;
    setStatus(error.message);
    window.setTimeout(() => {
      if (isActive && !stopScanner) {
        startCamera();
      }
    }, RETRY_DELAY_MS);
  }
}

function handleDetected(text) {
  const result = parseScannedText(text);
  if (!result || !isActive) {
    return false;
  }
  // 読み取れたらカメラは scanner.js 側で止まる。
  stopScanner = null;
  handleResult(result);
  return true;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('このブラウザではカメラを使えません。下にコードを入力してください');
    return;
  }

  setStatus('カメラを準備しています…');
  try {
    const stop = await startScanner({
      video: document.getElementById('scan-video'),
      onDetected: handleDetected,
    });
    // 準備中に画面を離れた、またはもう読み取れていた場合は、このカメラは使わない。
    if (!isActive || isHandlingResult) {
      stop();
      return;
    }
    stopScanner = stop;
    setStatus(READY_MESSAGE);
  } catch (error) {
    setStatus(toCameraErrorMessage(error));
  }
}

async function handleManualSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const result = parseScannedText(new FormData(form).get('code').trim());
  if (!result) {
    setFormError(form, 'コードが正しくありません。数字をもう一度確かめてください');
    return;
  }

  setFormError(form, null);
  setFormBusy(form, true);
  stopCamera();
  try {
    await handleResult(result);
  } finally {
    setFormBusy(form, false);
  }
}

export function init() {
  document.getElementById('scan-manual-form').addEventListener('submit', handleManualSubmit);
}

export async function show() {
  isActive = true;
  isHandlingResult = false;
  const form = document.getElementById('scan-manual-form');
  form.reset();
  setFormError(form, null);
  showView('scan');
  await startCamera();
}

export function hide() {
  isActive = false;
  stopCamera();
}
