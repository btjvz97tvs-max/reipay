// アプリの起動と画面の切り替え（URL の #/ 部分で表示する画面を決める）。
// views/ の各画面は init（最初の準備）・show（表示）・hide（離れるとき）の3つを持つ。

import { fetchCurrentUser, UNAUTHORIZED_EVENT } from './api.js';
import { navigate, showToast } from './lib/ui.js';
import { getCurrentUser, setCurrentUser } from './state.js';
import * as adminView from './views/admin.js';
import * as chargeView from './views/charge.js';
import * as homeView from './views/home.js';
import * as payView from './views/pay.js';
import * as profileView from './views/profile.js';
import * as receiveView from './views/receive.js';
import * as scanView from './views/scan.js';
import * as sendView from './views/send.js';
import * as welcomeView from './views/welcome.js';

const HOME_HASH = '#/';
const ALL_VIEWS = [
  adminView,
  chargeView,
  homeView,
  payView,
  profileView,
  receiveView,
  scanView,
  sendView,
  welcomeView,
];
const ROUTES = [
  { pattern: /^#?\/?$/, view: homeView },
  { pattern: /^#\/pay$/, view: payView },
  { pattern: /^#\/scan$/, view: scanView },
  { pattern: /^#\/receive$/, view: receiveView },
  { pattern: /^#\/send(?:\/([23456789a-hjkmnp-z]{8}))?$/, view: sendView, paramNames: ['handle'] },
  { pattern: /^#\/charge$/, view: chargeView },
  { pattern: /^#\/profile$/, view: profileView },
  { pattern: /^#\/admin$/, view: adminView, isAdminOnly: true },
];

let activeView = null;

function toParams(route, match) {
  const names = route.paramNames ?? [];
  return Object.fromEntries(names.map((name, index) => [name, match[index + 1]]));
}

// 前の画面を片づけてから、次の画面を出す（カメラやタイマーを止めるため）。
async function activateView(view, params = {}) {
  if (activeView) {
    activeView.hide();
  }
  activeView = view;
  await view.show(params);
}

async function renderRoute() {
  const user = getCurrentUser();
  try {
    if (!user) {
      await activateView(welcomeView);
      return;
    }

    for (const route of ROUTES) {
      const match = route.pattern.exec(window.location.hash);
      if (!match) {
        continue;
      }
      if (route.isAdminOnly && !user.isAdmin) {
        navigate(HOME_HASH);
        return;
      }
      await activateView(route.view, toParams(route, match));
      return;
    }
    navigate(HOME_HASH);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleUnauthorized() {
  setCurrentUser(null);
  renderRoute();
}

async function start() {
  for (const view of ALL_VIEWS) {
    view.init();
  }
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);

  try {
    const { user } = await fetchCurrentUser();
    setCurrentUser(user);
  } catch (error) {
    if (error.code !== 'unauthorized') {
      showToast(error.message, 'error');
    }
  }
  await renderRoute();
}

start();
