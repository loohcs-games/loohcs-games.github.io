// 絵は生成原画のまま置く。元の寸法・色・透過を保持する。
// 時刻別の同じ構図は夜／朝の原画を使い、夜の深さだけ表示側で調整する。
(() => {
  const path = name => 'img/' + name + '.webp';
  const phases = (night, dawn) => ({
    evening: path(night),
    midnight: { src: path(night), exposure: 0.78 },
    late: { src: path(night), exposure: 0.62 },
    dawn: path(dawn),
  });
  const gallery = {};
  const groups = [
    ['memoriesone', ['candle','bag','seven','well','bottles','shoes']],
    ['memoriestwo', ['notice','oria','rope','pew','stone','flower']],
    ['memoriesthree', ['lords','portrait','cookbook','diary',null,'marks']],
    ['memoriesfour', ['lime','cloth','level','claw','stud','names']],
  ];
  for (const [sheet, keys] of groups) keys.forEach((key, i) => {
    if (!key) return;
    // 原画を切り抜いて保存せず、SVGの表示範囲で一枚ずつ見せる。
    gallery[key] = { src: path(sheet), sheet: { col: i % 3, row: Math.floor(i / 3), cols: 3, rows: 2 } };
  });
  Object.assign(gallery, {
    cat: path('catneutral'), corpse: path('catempty'), girl: path('girlneutral'),
    man: path('mantalk'), wolf: path('wolfimpassive'),
  });
  gallery.marks = { src: path('pinebark'), detail: 'knifeMarks' };
  gallery.lime = path('limestonesoil');
  const bg = {
    heya: phases('roomnightbed','roomdawnbed'),
    hiroba: phases('squarewide','squarewidedawn'),
    kyokai: phases('kyokainight','dawnchurch'),
    bochi: phases('bochinight','dawngraves'),
    yakata: phases('yakatanight','dawnmanor'),
    mori: phases('foreststanding','forestdistantdawn'),
    kawa: phases('kawanight','dawnriver'),
    mon: phases('boundarynight','boundarydawn'),
  };
  bg.heya.midnight = path('roommidnightbed');
  bg.heya.late = { src: path('roommidnightbed'), exposure: 0.68 };
  bg.heya.unlit = path('roomunlitbed');
  bg.kyokai.late = path('churchlateone');
  // 腰と座面、長椅子の前後関係を一枚で保つ。立ち絵を重ねない。
  bg.kyokai.seated = {
    midnight: { src: path('churchside'), exposure: 0.78 },
    late: path('churchsideone'),
  };
  // 本文で一番奥の松が倒れるのは二時（T13）。それまでは立木だけ。
  bg.mori.fallen = { src: path('forestfallen'), exposure: 0.78 };
  bg.mori.late = { src: path('forestfallen'), exposure: 0.62 };
  const scene = {
    'death-ritual-yakata': path('feedingsober'),
    'climax-1': path('feedingsober'),
    'climax-call': path('feedingsober'),
    'climax-offer-1': path('feedingsober'),
    'climax-watch': path('afternamedwatch'),
    'climax-burst': { src: path('manoropened'), figure: true },
    'climax-after': path('manoropened'),
    'climax-after-again': path('manoropened'),
    'end-1': path('morningnamed'),
    'end-2': path('nightboundplain'),
    'end-3': path('endingmorningfinal'),
    'end-3-free': path('endingmorningfinal'),
    'end-3-taken': path('endingmorningfinal'),
    'end-5': path('endingsleep'),
  };
  window.OOKAMI_ART = {
    girl: { neutral: path('girlneutral'), sad: path('girlsad'), close: path('girlnamed'), smile: path('girlsmile'), seated: path('girlseated'), power: path('girlpoweraligned') },
    cat: { neutral: path('catneutral'), aloof: path('cataloof'), run: path('catrun'), corpse: path('catempty') },
    man: { neutral: path('mantalk'), talk: path('mantalk'), angry: path('manangry') },
    sleep: { neutral: path('mansleep') },
    // 狼の死でも表情や威嚇を足さず、同じ無関心な姿を見せる。
    wolf: { neutral: path('wolfimpassive'), attack: path('wolfimpassive') },
    bg, scene, gallery, scale: 3,
  };
})();
