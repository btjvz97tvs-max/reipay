// SQL ファイルの文字列を、1文ずつの配列に分ける。
// 「--」で始まるコメント行を取り除き、「;」で区切る（文字列の中に「;」を書かない前提）。

export function splitSqlStatements(sqlText) {
  return sqlText
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}
