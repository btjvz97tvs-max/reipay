// 「受け取る」画面。自分あての受け取りQRを見せる（相手が読み取ると、自分に支払える）。

import { createQrCodeSvg } from '../lib/code-render.js';
import { buildReceiveUrl } from '../lib/scan-result.js';
import { formatPersonLabel, showView } from '../lib/ui.js';
import { getCurrentUser } from '../state.js';

export function init() {}

export function show() {
  const user = getCurrentUser();
  document
    .getElementById('receive-qr')
    .replaceChildren(createQrCodeSvg(buildReceiveUrl(user.handle), { label: '受け取り用QRコード' }));
  document.getElementById('receive-owner').textContent = formatPersonLabel(user);
  showView('receive');
}

export function hide() {}
