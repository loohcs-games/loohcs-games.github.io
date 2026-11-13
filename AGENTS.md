# AI 向けの手引き

このリポジトリは、高校生が自分で作ったブラウザゲームを集めて公開するサイト。
公開ページは https://loohcs-games.github.io/ 。リポジトリは `loohcs-games/loohcs-games.github.io`。

頼んでくる人は、git や GitHub に慣れていない。
**「公開して」「載せて」「アップして」「更新して」と言われたら、下の「公開の手順」を最後まで自分でやる。**
途中で「次は Pull Request を作ってください」のように作業を返さない。聞くのは、本人にしか決められないことだけ（ゲームの名前、ひとこと説明）。それも、ゲームの中身から決められるなら案を出して進める。

## 構成

- `index.html`: トップページ。`games.js` の `window.GAMES` を読んでカードを並べる
- `games.js`: ゲーム一覧。`{ id, title, author, description }` の配列。1人1枠
- `games/<id>/index.html`: ゲーム本体。1フォルダに1ゲーム。`<id>` は `^[a-z0-9-]+$`
- `.github/`: 自動公開の仕組み。触らない
- ビルド工程はない。GitHub Pages が `main` をそのまま配信する

## 守ること

1. 頼んだ人のフォルダ（`games/<id>/`）と `games.js` のその人の行だけを直す。他の人のフォルダ、トップの `index.html`、`.github/`、この文書は触らない
2. 本名、メールアドレス、住所、PC のフォルダ名（`/Users/...`）をファイルに書かない。コミットメッセージにも Pull Request にも書かない
3. 外部の画像・音・ライブラリを足すときは、出どころと利用条件を頼んだ人に伝える。ライセンスが分からないものは入れない
4. ゲームは `index.html` を開くだけで動く形を保つ。サーバーや npm を要るようにしない
5. `main` に直接 push しない（拒否される）。ブランチを作って Pull Request を出す
6. ゲームの `<head>` には `<meta name="robots" content="noindex, nofollow">` を入れたままにする。このサイトは検索に出さない
7. 直したら、ブラウザで開いて動くことを確かめてから公開する。確かめられなかったことは「未確認」と伝える

## 公開の手順

Pull Request を出すと、GitHub Actions（`自動公開`）が中身を確かめ、問題がなければ自動で `main` に取り込む（Merge）。数分で公開ページに出る。
自動で取り込まれなかったときは、理由を直すか、手順 6 の「自分で取り込む」で Merge する。**Pull Request を開いたまま終わらせない。** 取り込まれるまでが公開。

### 1. 準備を確かめる

```sh
gh auth status                 # GitHub にログインしているか
gh api user --jq .login        # 頼んだ人の GitHub ユーザー名
```

- ユーザー名を小文字にしたものを、以下 `<id>` と書く（例：`MochiRunner` → `mochi-runner` ではなく `mochirunner`。小文字にするだけ）
- `gh` が無い、またはログインしていないとき：Mac なら `brew install gh`、そのあと `gh auth login`（ブラウザが開く）を本人にやってもらう。入れられないときは、手順 5 の「gh が無いとき」へ
- このリポジトリの中にいないとき：`~/Documents/GitHub/loohcs-games.github.io` があればそこを使う。無ければ `gh repo clone loohcs-games/loohcs-games.github.io ~/Documents/GitHub/loohcs-games.github.io`
- clone や push で権限のエラー（403）が出るとき：先生からの招待を Accept していない。https://github.com/loohcs-games/loohcs-games.github.io/invitations を開いて Accept してもらう

コミットに本当のメールアドレスが入らないようにする（このリポジトリの中だけの設定）：

```sh
git config user.name  "$(gh api user --jq .login)"
git config user.email "$(gh api user --jq '"\(.id)+\(.login)@users.noreply.github.com"')"
```

### 2. 最新の main からブランチを作る

```sh
git checkout main && git pull --ff-only
git checkout -b <id>-<何をするか>      # 例：mochirunner-add-game、mochirunner-fix-jump
```

まだコミットしていない変更が手元にあるときは、消さずに持っていく（`git stash` → 上の2行 → `git stash pop`）。

### 3. ゲームを置く

- 1本目は `games/<id>/`、2本目は `games/<id>-2/`、3本目は `games/<id>-3/`。入口は必ず `index.html`
- ゲームがリポジトリの外（デスクトップなど）にあるときは、必要なファイルを全部このフォルダにコピーする。画像や音も同じフォルダの中に置き、`index.html` からは相対パスで読む
- `<head>` に `<meta name="robots" content="noindex, nofollow">` を入れる
- 画面のどこかに一覧へ戻るリンクを置く：`<a href="../../">← ゲーム一覧にもどる</a>`（遊ぶ邪魔にならない位置に）
- ファイルの中に本名、メールアドレス、`/Users/...` のような PC のフォルダ名が無いか検索して、あれば消す

`games.js` の、その人の枠を直す。枠はこうなっている：

```js
  // ---- <id> ----
  // { id: "<id>", title: "ゲームの名前", author: "<ユーザー名>", description: "ひとこと説明" },
```

- 行の先頭の `// ` を消し、`title` と `description` を書く。`description` は1〜2文。操作や「音あり」を入れると親切
- 2本目からは、同じ枠の中に `{ id: "<id>-2", ... },` の行を足す
- 枠が無いときは、配列の最後（`];` の前）に `// ---- <id> ----` の行と自分の行を足す
- 他の行は1文字も変えない。行末のカンマを消さない
- ゲームを直しただけで、名前も説明も変わらないなら `games.js` は触らない

### 4. 確かめる

- ゲームをブラウザで開いて、始まること、エラーが出ないことを確かめる（`open games/<id>/index.html`）
- トップの `index.html` を開いて、カードが出て、押すとゲームに行けることを確かめる
- `node --check games.js` が通ること（node があれば）
- `git status` と `git diff --stat` で、変えたのが `games/<id>.../` の中と `games.js` だけであること

### 5. 送る

```sh
git add games/<id> games.js          # 直したフォルダと games.js だけ。git add -A は使わない
git commit -m "<ゲームの名前>を追加"    # 直したときは「<ゲームの名前>：<何を直したか>」
git push -u origin HEAD
gh pr create --title "<コミットと同じ1行>" --body-file -   # 本文は下
```

Pull Request の本文は `.github/pull_request_template.md` の形にする。チェック項目は、実際に確かめたものだけ `[x]` にする。

**gh が無いとき：** `git push -u origin HEAD` までやり、
`https://github.com/loohcs-games/loohcs-games.github.io/compare/main...<ブランチ名>?expand=1`
を開いて（`open "<URL>"`）、緑の **Create pull request** を押してもらう。本人の操作はこの1回だけ。

### 6. 自動で取り込まれるのを待つ

30秒〜1分ほどで結果が出る。

```sh
gh pr view --json state,comments --jq '.state, (.comments[-1].body // "")'
```

- `MERGED` になり、「公開しました。」のコメントが付く → 手順 7 へ
- 「自動では公開しませんでした。」のコメントが付く → 書いてある理由を直し、同じブランチでコミットして `git push`。自動でもう一度確かめられる。Pull Request を作り直さない
- 理由が「取り込めませんでした」（他の人とぶつかった）のとき：`git fetch origin && git merge origin/main`。`games.js` がぶつかったら、**両方の人の行を残して**解決し、コミットして `git push`
- 2分待っても何も起きないとき、仕組みが失敗しているとき（`gh run list --workflow auto-publish.yml --limit 3` で見る）→ 下の「自分で取り込む」へ

#### 自分で取り込む

自動で取り込まれなかったときは、頼んだ人の Pull Request を自分で Merge する。頼んだ人には書き込み権限があるので、Merge できる。

1. コメントに理由が書いてあるなら、まずそれを直して送り直す。noindex が無い、PC のフォルダ名が入っている、`games.js` の書き間違い、は直せば自動で通る。直さずに Merge しない
2. 直すものが無いのに開いたままのとき（仕組みが動いていない、失敗している）は、下の「自動公開が通る条件」を自分で1つずつ確かめる。`gh pr diff --name-only` で、変えたファイルが自分のフォルダと `games.js` だけであることも見る
3. 全部満たしていたら Merge する

```sh
gh pr merge --merge --delete-branch
```

4. 他の人のフォルダを直した Pull Request は、その人が「いいよ」と言ったことを頼んだ人に確かめてから Merge する。確かめられないなら Merge せず、開いたままであることと理由を伝える
5. Merge するのは、いま頼まれて自分が出した Pull Request だけ。他の人の Pull Request は Merge しない

`gh` が無いときは、Pull Request のページ（`git push` のあとに開いた URL）で、緑の **Merge pull request** → **Confirm merge** を押してもらう。「このボタンを押すと公開されます」と、押す場所を具体的に伝える。

### 7. 公開ページで確かめて、片づける

公開ページに出るまで数分かかる（長いと10分）。`games.js` に自分の行が出るまで待ってから、URL を本人に伝える。

```sh
curl -s "https://loohcs-games.github.io/games.js?v=$(date +%s)" | grep '"<id>"'
git checkout main && git pull --ff-only
git branch -d <ブランチ名>
```

最後に本人に伝えること：

- 公開された URL（`https://loohcs-games.github.io/games/<id>/`）
- 確かめたこと、確かめられなかったこと（「未確認」と書く）
- 前の版が見えるときは、ブラウザの再読み込み（Mac は ⌘+Shift+R）

## 自動公開が通る条件

次を全部満たす Pull Request だけが自動で取り込まれる。満たさないものは理由がコメントされて止まる。

- 変えたのが `games/<id>/`、`games/<id>-数字/` の中と、`games.js` の自分の行だけ
- `games/<id>/index.html` があり、その `<head>` に noindex の行がある
- HTML・JS・CSS などに `/Users/名前/` のような PC のフォルダ名が入っていない
- `games.js` に書き間違いがない

他の人のゲームを直す Pull Request は自動では取り込まれない。持ち主に声をかけてから、手順 6 の「自分で取り込む」で Merge する。
