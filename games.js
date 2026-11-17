// ゲームの一覧。
// 自分の名前の枠（// ---- 名前 ---- の下の1行）だけを直す。他の人の枠は触らない。
// 行の先頭の「// 」を消して、title と description を書く。
// id は games/ の中のフォルダ名と同じ。author は GitHub のユーザー名（本名は書かない）。
window.GAMES = [
  { id: "hakoniwa", title: "箱庭", author: "loohcskshirasaki", date: "2026-10-29 08:29", description: "歩く・掘る・置く。第2回で1プロンプトから出した箱庭" },
  { id: "bouka-roulette", title: "防火防災管理者ルーレット", author: "loohcskshirasaki", date: "2026-10-29 15:38", description: "じゃんけんではなく運命で決める。なるべく派手に。音あり" },
  { id: "toshocard-chusen", title: "図書カード抽選会", author: "loohcskshirasaki", date: "2026-11-05 13:34", description: "アンケートのお礼。2〜88 の番号から3人を抽選する。音あり" },
  { id: "ike", title: "池", author: "loohcskshirasaki", date: "2026-11-06 01:30", description: "錦鯉の池を真上から眺める。水面にふれると餌が落ち、なぞると逃げる。時刻で光が変わり、ときどき雨が通る" },
  { id: "haku", title: "拍", author: "loohcskshirasaki", date: "2026-11-06 01:52", description: "輪が丸に重なる瞬間に、丸を押す音ゲー。長い丸は押したまま玉を追う。約1分、難しさ3段階。クリック・タッチ・Z/X/W キー。音あり" },
  { id: "bou", title: "棒人間バトル", author: "loohcskshirasaki", date: "2026-11-06 01:52", description: "左右から来る棒人間を、殴る・蹴る。パンチは3発つながる。全5波、最後に親玉。音あり" },
  { id: "keybeat", title: "キーボードビート", author: "loohcskshirasaki", date: "2026-11-06 03:10", description: "落ちてくる音を、線の上で D F J K を押して鳴らす音ゲー。押した音がそのまま曲になる。約1分、難しさ3段階、最後に転調。音あり" },
  { id: "sensuikan", title: "潜水艦バトル", author: "loohcskshirasaki", date: "2026-11-06 03:10", description: "海の上の船から爆雷を落として、潜水艦を沈める。レーダーつき、全4海域、最後に巨大潜水艦。昔の「Super Depth」の海の面が手本。音あり" },
  { id: "tamatsuki", title: "夜のビリヤード", author: "loohcskshirasaki", date: "2026-11-12 15:54", description: "閉店まぎわの撞球場で、ナインボールを三番勝負。← → でねらい、↑ ↓ で強さ、Space で撞く。キーボードだけで遊べる。最後の相手は奥の間に。小さな音あり" },
  { id: "danmaku", title: "月夜の弾幕", author: "loohcskshirasaki", description: "弾のすき間を、まん中の白い点だけでくぐる縦画面の弾幕シューティング。Z で撃つ、Shift でゆっくり、X で月光（ボム）。道中・中ボスのあと、月を食む大蛾と五つの術。難しさ3段階。キーボードだけで遊べる。音あり" },
  { id: "akikan", title: "空き缶撃ち", author: "loohcskshirasaki", date: "2026-11-15 09:35", description: "夕方の空き地で、柵の上の空き缶を撃つ FPS。マウスでも、キーボードだけでもねらえる。空中の缶を撃つとまた浮く。全5面、最後に跳ねて近づく大缶。音あり" },
  { id: "gyaku-invader", title: "逆インベーダー", author: "loohcskshirasaki", date: "2026-11-15 14:05", description: "こんどは自分が UFO。空から弾を落として、街のビルを1ブロックずつ削って更地にする。必殺レーザーで軒並み。更地にすると地面が割れて都市要塞が出てくる。キーボードだけで遊べる。音あり" },
  { id: "ookami", title: "狼のいる夜", author: "loohcskshirasaki", date: "2026-11-15 15:26", description: "20:00 から翌朝 6:00 までの 20 コマを、狼に見つからずに生き延びる選択肢ゲーム。謎解き（生存）、戦い（吸血鬼）、恋愛（白猫）、世界観への引き込み、読み物、の5つの軸で面白さを組む。最初はコミカルに、何度か死ぬうちに、思っていたより深い夜に入っていく。キーボードだけで遊べる。音あり" },
  { id: "chika10", title: "地下十階", author: "loohcskshirasaki", date: "2026-11-18 03:20", description: "町の外れの穴に潜る、不思議のダンジョン風のローグライク。地形は毎回ちがう。お宝を持ち帰って道具屋で売り、武器屋で強い武器と盾を買って、また潜る。十階の地底の王は、何度か往復しないと倒せない。進みは自動で記憶される。キーボードだけで遊べる。音あり" },
  // ---- yuuuuuuuuuuhh ----
  { id: "yuuuuuuuuuuhh", title: "モチモチグランプリ", author: "yuuuuuuuuuuhh", date: "2026-10-29 14:40", description: "おもちのモチが食べものレーサーと走る3Dカートレース。1人・2人・オンライン対戦" },
  { id: "yuuuuuuuuuuhh-2", title: "てっぺん", author: "yuuuuuuuuuuhh", date: "2026-10-29 16:05", description: "街の上空に積み上がったガラクタを、ひたすら上へ。落ちたら、落ちたところから" },
  { id: "yuuuuuuuuuuhh-3", title: "ころころゴルフ", author: "yuuuuuuuuuuhh", date: "2026-10-29 16:05", description: "引っぱって打つ2Dゴルフ。全9ホール" },
  { id: "yuuuuuuuuuuhh-4", title: "グリーンヒルズ ゴルフ 3D", author: "yuuuuuuuuuuhh", date: "2026-10-29 16:05", description: "風とクラブを読んで打つ3Dゴルフ" },

  // ---- ishiritsu0-web ----
  { id: "ishiritsu0-web", title: "ミサイル乱射シミュレーター", author: "ishiritsu0-web", date: "2026-10-29 15:01", description: "夜の街でミサイルを撃ち合う。戦闘機も飛ばせる2Dシミュレーション" },
  { id: "mochi-bowling", title: "モチモチボーリング", author: "ishiritsu0-web", date: "2026-11-14 02:51", description: "もちもちのボールを指ではじいて10フレーム。1人・2人で交代、カーブもできる3Dボーリング" },
  { id: "ishiritsu0-web-2", title: "もちもちアーチェリー", author: "ishiritsu0-web", date: "2026-11-12 15:15", description: "押しっぱなしで弓をひいて、はなして撃つ。風を読んで的の真ん中をねらう。全10本、100点満点。音あり" },
  // ---- masatotaniguchi ----
  { id: "masatotaniguchi", title: "乱世の領主", author: "MasatoTaniguchi", date: "2026-10-29 16:41", description: "応仁の乱から明応九年まで、山城の国衆として家臣を使い、名分を整えて領国を育てる戦国箱庭。スマホ向け" },
  
  // ---- komasauna ----
  // { id: "komasauna", title: "ゲームの名前", author: "komasauna", description: "ひとこと説明" },

  // ---- stevenfridley42-tech ----
  { id: "stevenfridley42-tech", title: "僕の夏休み ― 永遠オリーブ地獄編 ―", author: "stevenfridley42-tech", date: "2026-11-12 14:53", description: "小豆島のオリーブ農園で夏休みを過ごす一人称3D。バスで島をめぐり、観光スタンプを集める。PC版 Chrome / Edge 向け。音あり" },
  { id: "stevenfridley42-tech-2", title: "VEGGIE SLASH", author: "stevenfridley42-tech", date: "2026-11-12 15:14", description: "飛び出す野菜をスワイプで切りまくる60秒のアーケードゲーム。1回で何個も切るとコンボ倍率。金のトマトと虹のキャベツも出る。スマホ・PC 両対応。音あり" },
  { id: "stevenfridley42-tech-3", title: "ナスっとドーナツ！🍆🍩", author: "stevenfridley42-tech", date: "2026-11-12 15:15", description: "左右に動くドーナツの穴をねらって、ナスを飛ばすタイミングゲーム。入るとハートがポンと出る。3回続けて入るとパーフェクト。スマホ・PC 両対応。音あり" },
  { id: "stevenfridley42-tech-4", title: "SWISH!", author: "stevenfridley42-tech", date: "2026-11-12 15:25", description: "手前のボールを上にスワイプして、リングに入れる一人称3Dバスケ。3回ミスで終わり。3回続けて入るとコンボで得点2倍、10点からリングが動く。スマホ・PC 両対応。音あり" },
  { id: "stevenfridley42-tech-5", title: "パブ・ダーツ", author: "stevenfridley42-tech", date: "2026-11-12 19:42", description: "押して集中、はなして投げる本格ダーツ。501・クリケット・カウントアップ、CPU対戦（3段階）、TON 80 などのアワード演出つき。スマホ・PC 両対応。音あり" },
  { id: "stevenfridley42-tech-6", title: "CROWD DASH 3D", author: "stevenfridley42-tech", date: "2026-11-12 20:05", description: "青い仲間の群れを左右に動かして、+50 や ×2 のゲートで人数を増やし、赤い敵の群れとボスを倒す3Dランゲーム。ステージは無限に続く。スマホ・PC 両対応" },
  { id: "stevenfridley42-tech-7", title: "SKY TAXI", author: "stevenfridley42-tech", date: "2026-11-12 20:26", description: "島々の空で空賊の戦闘機と戦う3Dドッグファイト。宙返り・Uターン・回避ロールで敵の後ろをとる。撃墜でコインを集めて新しい飛行機を買い、ノルマ達成で航空自衛隊の階級が上がる。スマホ・PC 両対応" },
  { id: "stevenfridley42-tech-8", title: "始祖の大地", author: "stevenfridley42-tech", date: "2026-11-12 21:15", description: "1000万年前のアフリカで、類人猿の一族を率いる。地図も目印もない土地を嗅いで・聞いて・確かめ、試行錯誤で神経（スキル）を芽生えさせ、世代を重ねてホモ・ハビリスへ進化する。セーブあり。PC のキーボード向け（スマホはタッチ操作）" },
  { id: "stevenfridley42-tech-9", title: "カラーポップ", author: "stevenfridley42-tech", date: "2026-11-13 01:39", description: "隣り合うブロックを入れ替えて、同じ色を3つ以上そろえて消す60秒のパズル。連鎖でコンボボーナス。ハイスコア保存・一時停止つき。スマホ・PC 両対応。音あり" },
  { id: "stevenfridley42-tech-10", title: "PROJECT ORBIT", author: "stevenfridley42-tech", date: "2026-11-13 13:07", description: "ロケットを組み立てて、地球周回・月・火星をめざす3D宇宙開発シミュレーション。軌道マップ、ドッキング、宇宙ステーション・基地、資金と研究で進めるキャリアモード、チュートリアルつき。セーブあり。PC のキーボード・マウス向け" },
  { id: "stevenfridley42-tech-11", title: "コンコの雪山", author: "stevenfridley42-tech", date: "2026-11-14 04:43", description: "キツネのコンコがジャンプで頭上の氷を割り、雪山の頂上をめざすファミコン風アクション。全30の山とエンドレス、ランクと金のベリーでやり込める。← → で移動、Z でジャンプ、X でハンマー。スマホ・PC 両対応。音あり" },
  { id: "stevenfridley42-tech-12", title: "STRATO LANCER", author: "stevenfridley42-tech", date: "2026-11-14 04:46", description: "南洋の島々の上を飛ぶ、ドット絵の縦スクロール・シューティング。宙返りで弾をかわし、編隊を全滅させてパワーアップ。勲章・撃墜率ボーナス・2周目・実績でやり込める。矢印で移動、Z でショット、X で宙返り。スマホ・PC 両対応。音あり" },
  { id: "stevenfridley42-tech-13", title: "アメフト（開発中）", author: "stevenfridley42-tech", date: "2026-11-14 04:56", description: "NFL全32チーム・実在選手で遊ぶアメリカンフットボール。チーム対戦、1人の選手を操作する個人モード、オリジナル選手で殿堂入りをめざすキャリアモード、オンライン対戦。PC のキーボード・マウス向け。音あり" },
  { id: "stevenfridley42-tech-14", title: "ラスベガス・ポーカー", author: "stevenfridley42-tech", date: "2026-11-14 21:08", description: "テキサスホールデムとファイブカードドローを、AIや友達と遊ぶノーリミット・ポーカー。部屋を作って6桁の番号を伝えれば、友達も自分のスマホやPCから参加できる（部屋は作った人のブラウザで動く）。ルールブックつき。スマホ・PC 両対応。音あり" },
  { id: "stevenfridley42-tech-15", title: "渋谷3D探索", author: "stevenfridley42-tech", date: "2026-11-15 01:29", description: "国交省の3D都市モデル「PLATEAU」で再現した渋谷駅周辺1.5km四方を、一人称で歩いて・飛んで自由に探索する。昼と夜の切り替え、ミニマップつき。WASD で移動、マウスで視点、F で飛行。PC のキーボード・マウス向け（初回の読み込み約40MB）" },
  { id: "stevenfridley42-tech-16", title: "遍照の道 〜空海伝〜", author: "stevenfridley42-tech", date: "2026-11-17 16:03", description: "空海になって、讃岐の少年時代から唐への留学、高野山の開創、入定までの生涯を生きるドット絵の歴史RPG。読経・瞑想・書・儀式などの修行、建物の中での暮らし、昼と夜、伽藍づくり。セーブあり。PC のキーボード・マウス向け。音あり" },

  // ---- mineiyuki ----
  // { id: "mineiyuki", title: "ゲームの名前", author: "mineiyuki", description: "ひとこと説明" },

];
