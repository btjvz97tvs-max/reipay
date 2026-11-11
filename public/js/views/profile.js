// アイコンの設定画面（写真を選ぶ / アイコンを消す）。

import { deleteMyAvatar, updateMyAvatar } from '../api.js';
import { createAvatarDataUrl } from '../lib/avatar-image.js';
import { confirmAction, renderAvatar, showToast, showView } from '../lib/ui.js';
import { getCurrentUser, setCurrentUser } from '../state.js';

function setError(message) {
  const errorElement = document.getElementById('profile-error');
  errorElement.textContent = message ?? '';
  errorElement.hidden = !message;
}

function setBusy(isBusy) {
  document.getElementById('profile-file').disabled = isBusy;
  document.getElementById('profile-remove-button').disabled = isBusy;
}

function renderProfile(user) {
  renderAvatar(document.getElementById('profile-avatar'), user);
  document.getElementById('profile-name').textContent = user.displayName;
  document.getElementById('profile-remove-button').hidden = !user.avatarUrl;
}

async function updateUser(sendRequest, message) {
  setError(null);
  setBusy(true);
  try {
    const { user } = await sendRequest();
    setCurrentUser(user);
    renderProfile(user);
    showToast(message);
  } catch (error) {
    setError(error.message);
  } finally {
    setBusy(false);
  }
}

async function handleFileChange(event) {
  const input = event.currentTarget;
  const [file] = input.files;
  // 同じ写真をもう一度選んだときも change が起きるよう、選択を空に戻しておく。
  input.value = '';
  if (!file) {
    return;
  }

  await updateUser(async () => {
    const image = await createAvatarDataUrl(file);
    return updateMyAvatar(image);
  }, 'アイコンを変えました');
}

async function handleRemoveClick() {
  const isConfirmed = await confirmAction({
    title: 'アイコンを消しますか？',
    message: '名前の頭文字の表示に戻ります',
    confirmLabel: '消す',
  });
  if (isConfirmed) {
    await updateUser(() => deleteMyAvatar(), 'アイコンを消しました');
  }
}

export function init() {
  document.getElementById('profile-file').addEventListener('change', handleFileChange);
  document.getElementById('profile-remove-button').addEventListener('click', handleRemoveClick);
}

export function show() {
  setError(null);
  renderProfile(getCurrentUser());
  showView('profile');
}

export function hide() {}
