// データベースの制約違反を見分ける。D1 は SQLite のエラーメッセージをそのまま返す。

function getMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function isCheckViolation(error) {
  return getMessage(error).includes('CHECK constraint failed');
}

export function isUniqueViolation(error, columnName) {
  const message = getMessage(error);
  if (!message.includes('UNIQUE constraint failed')) {
    return false;
  }
  return columnName === undefined || message.includes(columnName);
}

export function isForeignKeyViolation(error) {
  return getMessage(error).includes('FOREIGN KEY constraint failed');
}
