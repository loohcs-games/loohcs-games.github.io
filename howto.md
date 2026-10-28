# 自分のゲームを載せる

GitHub Desktop を使う。git のコマンドは使わない。
最初の1回は先生の画面を見ながら一緒にやる。

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

## 6. 取り込まれるのを待つ

先生が Pull Request を見て、取り込む（Merge）。
数分後に https://loohcs-games.github.io/ に自分のゲームが出る。

直してほしいところがあれば、Pull Request にコメントが付く。同じブランチで直して、もう一度 Commit → **Push origin** すれば、Pull Request に反映される。

## 2回目以降（直すとき）

1. **Current Branch** → **main** に戻る
2. **Fetch origin** → **Pull origin**
3. 新しいブランチを作る（手順2）
4. 直す → 確かめる → Commit → Publish → Pull Request（手順4〜5）

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
| ゲームが真っ白 | ブラウザの開発者ツール（右クリック → 検証 → Console）に赤い文字が出ていないか見る |
| 間違ったファイルを送った | 消してもう一度 Commit → Push。履歴には残るので、個人情報は最初から書かない |
