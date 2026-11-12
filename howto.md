# 自分のゲームを載せる

やり方は2つ。どちらでも、Pull Request を出すと自動で確かめられて、問題がなければそのまま公開される。

## AI に頼む（いちばん簡単）

このリポジトリのフォルダを AI（コードを書いてくれる AI）で開いて、こう言う。

> このゲームを公開して

直したあとも同じ。「直したので公開して」と言う。
AI は `AGENTS.md` を読んで、置き場所、一覧への登録、送信、公開されたかの確認までを自分でやる。
終わると、公開された URL を教えてくれる。

- AI が `AGENTS.md` を読んでいないようなら、「AGENTS.md を読んでから作業して」と伝える
- AI が「Pull Request を出しました」で終わったら、「取り込まれるまでやって」と伝える。紫の **Merged** になるまでが公開
- 最初の1回だけ、GitHub へのログイン（`gh auth login`）を頼まれることがある。ブラウザが開くので、自分のアカウントでログインする
- AI に任せても、送る前に自分で一度遊ぶ。公開されるのは自分の名前（ユーザー名）のゲーム

## 自分の手でやる（GitHub Desktop）

git のコマンドは使わない。最初の1回は先生の画面を見ながら一緒にやる。

## 0. 準備（最初の1回だけ）

1. GitHub のアカウントがあり、先生から招待されて Accept してある
2. GitHub Desktop にログインしてある
3. GitHub Desktop で **File → Clone Repository** → **URL** タブに `loohcs-games/loohcs-games.github.io` と入れて **Clone**
   - Local Path はそのままでよい（書類フォルダの中の GitHub フォルダになる）

## 1. 最新を取る

GitHub Desktop の上のボタン **Fetch origin** を押す。**Pull origin** に変わったらもう一度押す。
これをやらないと、他の人の変更とぶつかる。

## 2. ブランチを作る

上の **Current Branch** → **New Branch** → 名前を入れて **Create Branch**。
名前は `自分のid-何をするか`。例：`mochi-runner-add-game`

ブランチは「自分の作業机」。main（みんなの完成品）を汚さずに作業できる。

## 3. ゲームを置く

1. Finder で clone したフォルダを開く（GitHub Desktop の **Repository → Show in Finder**）
2. `games/` の中に、自分の GitHub ユーザー名のフォルダを作る。例：`games/mochi-runner/`
3. その中に、ゲームの HTML を `index.html` という名前で置く。ファイルが複数あるなら全部このフォルダの中に
   - ゲームの画面のどこかに、一覧に戻るリンクを付ける：`<a href="../../">← ゲーム一覧にもどる</a>`
   - `<head>` の中に、検索に出さないための1行を入れる：`<meta name="robots" content="noindex, nofollow">`
4. `games.js` を開く。自分の名前の枠がある

```js
  // ---- mochi-runner ----
  // { id: "mochi-runner", title: "ゲームの名前", author: "mochi-runner", description: "ひとこと説明" },
```

   下の行の先頭の `// ` を消して、`title` と `description` を書き換える。他の人の枠は触らない

```js
  // ---- mochi-runner ----
  { id: "mochi-runner", title: "もちランナー", author: "mochi-runner", description: "もちが走る。スペースでジャンプ" },
```

   - `id` と `author` はそのまま（フォルダ名と同じ）
   - 行の最後のカンマ（,）と、引用符（"）を消さない

## 4. 手元で確かめる

ブラウザで clone したフォルダの `index.html` を開く。自分のカードが出て、押すと遊べることを確かめる。

## 5. 送る

1. GitHub Desktop の左に変えたファイルが並ぶ。全部にチェックが入っていることを確かめる
2. 左下の **Summary** に、何をしたかを1行で書く。例：`もちランナーを追加`
3. **Commit to <ブランチ名>** を押す
4. 上の **Publish branch** を押す
5. **Preview Pull Request** → **Create Pull Request**。ブラウザが開く
6. 説明の欄にあるチェック項目を確認して、**Create pull request** を押す

## 6. 自動で取り込まれるのを待つ

1. Pull Request の画面をそのまま1分ほど見ている。紫の **Merged** に変わり、「公開しました。」というコメントが付く
2. 数分後に https://loohcs-games.github.io/ を開き直す。自分のゲームが出る（長いと10分かかる）

「自動では公開しませんでした。」というコメントが付いたときは、理由が書いてある。
直して、同じブランチのまま Commit → **Push origin** を押すと、もう一度確かめられる。Pull Request は作り直さない。

**Pull Request は、取り込まれる（Merge される）までが公開。開いたままにしない。**
2分待っても何も起きないときは、自分で取り込む。

1. Pull Request の画面を下にスクロールして、緑の **Merge pull request** → **Confirm merge** を押す
2. **Delete branch** が出たら押す（作業机を片づける）

Merge ボタンが灰色で押せないときは、`games.js` で他の人とぶつかっている。先生に見せる。

自動で取り込まれるのは、自分のフォルダ（`games/自分のid/`）と `games.js` の自分の行だけを変えたとき。
他の人のゲームを直したときは自動では取り込まれない。持ち主に声をかけて、「いいよ」と言われてから自分で Merge する。

他の人の Pull Request は、本人に頼まれたとき以外は Merge しない。

## 2回目以降（直すとき）

1. **Current Branch** → **main** に戻る
2. **Fetch origin** → **Pull origin**
3. 新しいブランチを作る（手順2）
4. 直す → 確かめる → Commit → Publish → Pull Request（手順4〜6）。取り込みは自動

## GitHub Desktop が入れられないとき（ブラウザだけでやる）

1. https://github.com/loohcs-games/loohcs-games.github.io を開く
2. **Add file → Upload files**。自分のゲームのフォルダごとドラッグして入れる（フォルダ名は自分のユーザー名）
3. 下の **Commit changes** で、**Create a new branch for this commit and start a pull request** を選んで **Propose changes**
4. 次の画面で **Create pull request**
5. そのブランチのまま `games.js` を開き、鉛筆マークで自分の枠を直して **Commit changes**（同じブランチに入る）

## 困ったとき

| 起きたこと | どうする |
|---|---|
| Pull origin でエラーが出る | 先生に見せる。たいてい `games.js` の同じ行を2人が直したとき |
| カードが出ない | `games.js` の行の先頭の `// ` を消したか、カンマ、引用符（"）を見る |
| トップに「games.js に書き間違いがあります」と出る | 全員のカードが消えている。最後に取り込まれた人の枠を直して、もう一度 Pull Request を出す |
| Pull Request に「自動では公開しませんでした」と付いた | 書いてある理由を直して、同じブランチでもう一度送る。分からなければ先生に見せる |
| Pull Request が開いたまま（緑の Open）で、公開されない | 手順6のとおり、自分で **Merge pull request** を押す |
| ゲームが真っ白 | ブラウザの開発者ツール（右クリック → 検証 → Console）に赤い文字が出ていないか見る |
| 間違ったファイルを送った | 消してもう一度 Commit → Push。履歴には残るので、個人情報は最初から書かない |
