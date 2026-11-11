// 画面に返すユーザー情報の形。必要な項目だけを返し、内部の id などは出さない。

// アイコンの URL。更新日時を付けておくと、変えたときにブラウザが新しい画像を読み込む。
export function buildAvatarUrl(user) {
  if (!user.avatarVersion) {
    return null;
  }
  const params = new URLSearchParams({ handle: user.handle, v: user.avatarVersion });
  return `/api/avatars?${params}`;
}

export function toPublicUser(user, { hasPasskey }) {
  return {
    handle: user.handle,
    displayName: user.displayName,
    avatarUrl: buildAvatarUrl(user),
    balance: user.balance,
    isAdmin: user.isAdmin,
    hasPasskey,
  };
}

export function toUserSummary(user) {
  return { handle: user.handle, displayName: user.displayName, avatarUrl: buildAvatarUrl(user) };
}

export function toAdminUserView(user) {
  return {
    handle: user.handle,
    displayName: user.displayName,
    avatarUrl: buildAvatarUrl(user),
    balance: user.balance,
    isAdmin: user.isAdmin,
  };
}

export function toTransactionView(transaction) {
  return {
    ...transaction,
    counterparty: transaction.counterparty ? toUserSummary(transaction.counterparty) : null,
  };
}
