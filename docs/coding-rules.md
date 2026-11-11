# コードの書き方のルール

このプロジェクトのコードは、次のルールで統一しています。新しく書くときも同じルールに従います。

## ファイルの置き方

- **HTML は骨組みだけ**。`<style>`、`style="..."`、`onclick="..."` などは HTML に書かない
  - 見た目は `public/css/`、動きは `public/js/` に書く
  - サーバー側の CSP 設定で、HTML の中に書いたスタイルやスクリプトは動かないようにしている
- **1ファイル1役割**。役割が増えたら新しいファイルに分ける
- 繰り返し表示する部品（履歴の1行など）は HTML の `<template>` に置き、JS で複製して中身を入れる
- 画面に出す文字は `textContent` で入れる（`innerHTML` は使わない）

| 場所                  | 置くもの                                                         |
| --------------------- | ---------------------------------------------------------------- |
| `public/js/views/`    | 画面1つにつき1ファイル。`init`・`show`・`hide` の3つを export する |
| `public/js/lib/`      | 画面をまたいで使う部品（表示、カメラ、バーコード、Face ID など） |
| `public/js/shared/`   | 画面とサーバーの両方で使う処理（ブラウザ専用の機能は使わない）   |
| `public/vendor/`      | 他の人が作ったライブラリ。中身は書き換えない                     |
| `server/handlers/`    | API ごとの処理                                                   |
| `server/repositories/` | データベースの読み書き（SQL はここにだけ書く）                  |
| `server/middleware/`  | 処理の前に行う確認（だれのアクセスか）                           |
| `server/lib/`         | サーバーの共通の道具（データベースには触らない）                 |

## 名前の付け方

| 対象                   | 形式                            | 例                              |
| ---------------------- | ------------------------------- | ------------------------------- |
| ファイル名・フォルダ名 | 小文字のハイフン区切り          | `payment-codes.js`              |
| 変数・関数             | camelCase                       | `findUserByHandle`              |
| 定数                   | 大文字のアンダースコア区切り    | `WELCOME_BONUS`                 |
| クラス（JS）           | PascalCase                      | `HttpError`                     |
| CSS クラス             | BEM（block__element--modifier） | `history-item__amount--in`      |
| HTML の id             | 小文字のハイフン区切り          | `send-form`                     |
| データベースの表・列   | snake_case                      | `display_name`, `created_at`    |
| API の JSON のキー     | camelCase                       | `displayName`, `requestId`      |

関数名の始まりは役割で揃える。

- データベース: `find〜`（1件）、`list〜`（複数）、`insert〜`、`delete〜`、`build〜Statement`（まとめて実行する文を作る）
- 入力チェック: `parse〜`（チェックして整えた値を返す）、`isValid〜`（真偽値を返す）
- ランダムな値: `generate〜`（ID・コードを作る）
- 画面: `init`（最初の準備）、`show`（表示）、`hide`（離れるときの片づけ）、`render〜`（中身を描く）
- 通信: `fetch〜`（取得）、それ以外は動詞（`sendTransfer`、`chargePaymentCode`）

## 書き方

- インデントはスペース2つ、文字コードは UTF-8、改行は LF（`.editorconfig`）
- 文字列はシングルクォート、文末にセミコロン（`.prettierrc.json`）
- `npm run format` で全ファイルの形を自動で揃えられる
- `import` はパスのアルファベット順に並べる
- 色・余白・文字サイズは `public/css/base.css` の変数（`--color-primary` など）を使い、他のファイルに直接色を書かない
- 金額は「1000れい」の形（数字と「れい」をくっつける）で表示する
- コメントは日本語で、「なぜそうしているか」を書く

## サーバー側の決まり

- SQL の値は必ず `bind()` で渡す（文字列をつなげて SQL を作らない）
- 残高を動かす処理は `DB.batch()` でまとめて実行し、途中で失敗したら全部取り消されるようにする
- 二重に処理されてはいけない操作には、一意な ID（`request_id`）を付ける
- エラーは `HttpError` で投げ、メッセージは画面にそのまま出せる日本語にする
- 設定値は `server/config.js` に集める

## データベースの表を変えるとき

- `migrations/` に次の番号のファイル（例: `0003_add-something.sql`）を足し、`server/repositories/schema.js` の `MIGRATIONS` に追加する
  - ファイル名だけは Wrangler の決まりに合わせて「番号_名前.sql」にする
- 一度公開したマイグレーションのファイルは書き換えない（すでに実行済みのデータベースには反映されないため）
- アプリが動いたときに自動で実行され、実行済みのものは `schema_migrations` 表に記録される
