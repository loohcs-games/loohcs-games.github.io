// ゲームの一覧。
// 自分の名前の枠（// ---- 名前 ---- の下の1行）だけを直す。他の人の枠は触らない。
// 行の先頭の「// 」を消して、title と description を書く。
// id は games/ の中のフォルダ名と同じ。author は GitHub のユーザー名（本名は書かない）。
window.GAMES = [
  { id: "hakoniwa", title: "箱庭", author: "loohcskshirasaki", description: "歩く・掘る・置く。第2回で1プロンプトから出した箱庭" },
  { id: "bouka-roulette", title: "防火防災管理者ルーレット", author: "loohcskshirasaki", description: "じゃんけんではなく運命で決める。なるべく派手に。音あり" },
  { id: "toshocard-chusen", title: "図書カード抽選会", author: "loohcskshirasaki", description: "アンケートのお礼。2〜88 の番号から3人を抽選する。音あり" },
  { id: "ike", title: "池", author: "loohcskshirasaki", description: "錦鯉の池を真上から眺める。水面にふれると餌が落ち、なぞると逃げる。時刻で光が変わり、ときどき雨が通る" },
  { id: "haku", title: "拍", author: "loohcskshirasaki", description: "輪が丸に重なる瞬間に、丸を押す音ゲー。長い丸は押したまま玉を追う。約1分、難しさ3段階。クリック・タッチ・Z/X/W キー。音あり" },
  { id: "bou", title: "棒人間バトル", author: "loohcskshirasaki", description: "左右から来る棒人間を、殴る・蹴る。パンチは3発つながる。全5波、最後に親玉。音あり" },
  { id: "keybeat", title: "キーボードビート", author: "loohcskshirasaki", description: "落ちてくる音を、線の上で D F J K を押して鳴らす音ゲー。押した音がそのまま曲になる。約1分、難しさ3段階、最後に転調。音あり" },
  { id: "sensuikan", title: "潜水艦バトル", author: "loohcskshirasaki", description: "海の上の船から爆雷を落として、潜水艦を沈める。レーダーつき、全4海域、最後に巨大潜水艦。昔の「Super Depth」の海の面が手本。音あり" },
  // ---- yuuuuuuuuuuhh ----
  { id: "yuuuuuuuuuuhh", title: "モチモチグランプリ", author: "yuuuuuuuuuuhh", description: "おもちのモチが食べものレーサーと走る3Dカートレース。1人・2人・オンライン対戦" },
  { id: "yuuuuuuuuuuhh-2", title: "てっぺん", author: "yuuuuuuuuuuhh", description: "街の上空に積み上がったガラクタを、ひたすら上へ。落ちたら、落ちたところから" },
  { id: "yuuuuuuuuuuhh-3", title: "ころころゴルフ", author: "yuuuuuuuuuuhh", description: "引っぱって打つ2Dゴルフ。全9ホール" },
  { id: "yuuuuuuuuuuhh-4", title: "グリーンヒルズ ゴルフ 3D", author: "yuuuuuuuuuuhh", description: "風とクラブを読んで打つ3Dゴルフ" },

  // ---- ishiritsu0-web ----
  { id: "ishiritsu0-web", title: "ミサイル乱射シミュレーター", author: "ishiritsu0-web", description: "夜の街でミサイルを撃ち合う。戦闘機も飛ばせる2Dシミュレーション" },
  { id: "ishiritsu0-web-2", title: "もちもちアーチェリー", author: "ishiritsu0-web", description: "押しっぱなしで弓をひいて、はなして撃つ。風を読んで的の真ん中をねらう。全10本、100点満点。音あり" },
  // ---- masatotaniguchi ----
  { id: "masatotaniguchi", title: "乱世の領主", author: "MasatoTaniguchi", description: "応仁の乱から明応九年まで、山城の国衆として家臣を使い、名分を整えて領国を育てる戦国箱庭。スマホ向け" },
  
  // ---- komasauna ----
  // { id: "komasauna", title: "ゲームの名前", author: "komasauna", description: "ひとこと説明" },

  // ---- stevenfridley42-tech ----
  { id: "stevenfridley42-tech", title: "僕の夏休み ― 永遠オリーブ地獄編 ―", author: "stevenfridley42-tech", description: "小豆島のオリーブ農園で夏休みを過ごす一人称3D。バスで島をめぐり、観光スタンプを集める。PC版 Chrome / Edge 向け。音あり" },
  { id: "stevenfridley42-tech-2", title: "VEGGIE SLASH", author: "stevenfridley42-tech", description: "飛び出す野菜をスワイプで切りまくる60秒のアーケードゲーム。1回で何個も切るとコンボ倍率。金のトマトと虹のキャベツも出る。スマホ・PC 両対応。音あり" },
  { id: "stevenfridley42-tech-3", title: "ナスっとドーナツ！🍆🍩", author: "stevenfridley42-tech", description: "左右に動くドーナツの穴をねらって、ナスを飛ばすタイミングゲーム。入るとハートがポンと出る。3回続けて入るとパーフェクト。スマホ・PC 両対応。音あり" },
  { id: "stevenfridley42-tech-4", title: "SWISH!", author: "stevenfridley42-tech", description: "手前のボールを上にスワイプして、リングに入れる一人称3Dバスケ。3回ミスで終わり。3回続けて入るとコンボで得点2倍、10点からリングが動く。スマホ・PC 両対応。音あり" },

  // ---- mineiyuki ----
  // { id: "mineiyuki", title: "ゲームの名前", author: "mineiyuki", description: "ひとこと説明" },

];
