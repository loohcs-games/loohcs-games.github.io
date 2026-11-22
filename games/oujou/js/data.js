/* 王城おとし — データ。外部資産もブラウザ依存も持たない。 */
(function (H) {
  'use strict';
  H.VERSION = '1.0.0'; H.DT = 1 / 30;
  H.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  H.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  H.rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const skill = (name, shape, damage, range, radius, delay, cooldown, cost, extra) => Object.assign({ name, shape, damage, range, radius, delay, cooldown, cost }, extra);
  H.heroes = [
    { name: 'ガレス', role: '騎士', color: '#efc86b', hp: 850, attack: 61, range: 4.5, speed: 6.3, armor: 24, interval: .95, passive: '不屈：体力が半分以下なら守りが増す', skills: [
      skill('踏光斬', 'line', 105, 12, 2.5, .3, 8, 28, { dash: 7 }), skill('返光盾', 'self', 60, 0, 7, .6, 12, 30, { guard: 3 }), skill('輪の剣', 'circle', 100, 0, 7, .45, 9, 34), skill('天冠の剣', 'cone', 310, 19, .8, 1.1, 52, 80) ] },
    { name: 'リーネ', role: '弓使い', color: '#a4dc8a', hp: 590, attack: 60, range: 15, speed: 6.46, armor: 8, interval: .85, passive: '風の拍：続けて射るほど攻撃が速くなる', skills: [
      skill('梢抜き', 'line', 110, 25, 1.7, .4, 8, 30), skill('風返し', 'self', 0, 0, 0, 0, 11, 28, { dash: -9 }), skill('葉雨', 'circle', 90, 21, 7, .85, 12, 40, { slow: 3 }), skill('星渡り', 'line', 300, 280, 3, 1.2, 60, 85) ] },
    { name: 'メルヴィ', role: '魔法使い', color: '#bca0ff', hp: 580, attack: 47, range: 13, speed: 6.3, armor: 9, interval: 1.1, passive: '残光：技を当てると気力が3戻る', skills: [
      skill('灯火球', 'circle', 120, 21, 4, .55, 7, 30), skill('刻の陣', 'circle', 150, 23, 8, 1.2, 12, 40), skill('霜の柵', 'wall', 65, 18, 7, .55, 15, 35, { wall: 4, slow: 2 }), skill('宵の隕石', 'circle', 330, 28, 12, 1.65, 58, 90) ] },
    { name: 'ボルグ', role: '重戦士', color: '#e9a276', hp: 990, attack: 57, range: 4.8, speed: 6.1, armor: 32, interval: 1.15, passive: '岩肌：近くの味方も守りが8増す', skills: [
      skill('鐘打ち', 'circle', 105, 6, 6, .55, 9, 30, { stun: .9 }), skill('鉄の招き', 'line', 85, 19, 2.4, .6, 12, 34, { pull: 7 }), skill('岩の庇', 'self', 0, 0, 11, .15, 16, 40, { shield: 180 }), skill('山脈割り', 'line', 280, 28, 4, 1, 56, 85, { stun: 1.3 }) ] },
    { name: 'シェイド', role: '盗賊', color: '#d598ce', hp: 690, attack: 70, range: 4.5, speed: 6.66, armor: 12, interval: .8, passive: '背の刃：敵の背後からの攻撃が強い', skills: [
      skill('月欠け', 'line', 110, 21, 1.8, .3, 7, 25), skill('影越し', 'circle', 85, 13, 4, .2, 11, 34, { blink: true }), skill('薄闇', 'self', 0, 0, 7, .1, 16, 40, { stealth: 3.5 }), skill('夜縫い', 'circle', 230, 9, 5, .6, 50, 80, { execute: true }) ] },
    { name: 'ミア', role: '僧侶', color: '#ffe8ab', hp: 650, attack: 46, range: 13, speed: 6.3, armor: 14, interval: 1, passive: '灯守り：近くの味方を少しずつ癒す', skills: [
      skill('灯の手', 'heal', 145, 17, 9, .3, 8, 28), skill('聖糸', 'line', 110, 23, 2.2, .45, 8, 30, { slow: 2.4 }), skill('旅の祝福', 'self', 0, 0, 13, .1, 14, 36, { haste: 4 }), skill('明けの祈り', 'heal', 340, 0, 24, .8, 62, 95, { immortal: 2.5 }) ] },
    { name: 'ドラン', role: '砲手', color: '#7ed4d4', hp: 690, attack: 100, range: 16, speed: 6.14, armor: 14, interval: 1.1, passive: '火薬職人：建物への通常攻撃が20%増す', skills: [
      skill('一筋砲', 'line', 165, 32, 2, 1.1, 10, 35), skill('ころがる火', 'circle', 130, 22, 7, .85, 11, 36), skill('砲座', 'self', 0, 0, 0, .15, 15, 25, { siege: 6 }), skill('三つの雷', 'line', 140, 32, 3, .8, 60, 85, { repeats: 3 }) ] },
    { name: 'カイラ', role: '竜騎士', color: '#f2967e', hp: 790, attack: 62, range: 6, speed: 6.4, armor: 22, interval: 1, passive: '竜の息：技のあと次の一撃に炎をまとう', skills: [
      skill('穂先の星', 'line', 115, 16, 2.3, .4, 8, 28), skill('空踏み', 'circle', 95, 15, 6, .75, 12, 35, { leap: true }), skill('鱗の輪', 'circle', 95, 0, 8, .4, 10, 32, { slow: 2.5 }), skill('紅翼行', 'line', 270, 25, 4, .65, 55, 85, { dash: 17, carry: 9 }) ] }
  ];
  H.items = [
    { name: '鉄の刃', price: 280, desc: '攻撃 +14', attack: 14 },
    { name: '風紐', price: 280, desc: '攻撃速度 +18%', attackSpeed: .18 },
    { name: '灯石', price: 280, desc: '技の強さ +26', power: 26 },
    { name: '旅の靴', price: 300, desc: '歩く速さ +0.5', speed: .5 },
    { name: '若木の護符', price: 300, desc: '体力 +200', hp: 200 },
    { name: '鎖の衣', price: 350, desc: '守り +22', armor: 22 },
    { name: '朝露の杯', price: 750, desc: '攻撃 +22・吸い取り 14%', attack: 22, leech: .14 },
    { name: '時砂の輪', price: 750, desc: '技の回り +22%・気力 +120', haste: .22, mana: 120 },
    { name: '銀葉の弓', price: 850, desc: '攻撃 +26・攻撃速度 +30%', attack: 26, attackSpeed: .3 },
    { name: '夜明けの杖', price: 850, desc: '技の強さ +95・気力 +100', power: 95, mana: 100 },
    { name: '砦の外套', price: 900, desc: '体力 +440・守り +30', hp: 440, armor: 30 },
    { name: '王冠の剣', price: 1500, desc: '攻撃 +68・技の強さ +30', attack: 68, power: 30 },
    { name: '星巡りの書', price: 1500, desc: '技の強さ +155・技の回り +15%', power: 155, haste: .15 },
    { name: '帰り火の宝珠', price: 1600, desc: '体力 +300・一度だけその場で復帰', hp: 300, revive: true },
    { name: '巨木の心', price: 1550, desc: '体力 +700・守り +40', hp: 700, armor: 40 }
  ];
  H.builds = [[3,0,10,11,6,14],[3,0,8,6,11,13],[3,2,9,7,12,13],[3,4,10,7,14,13],[3,0,6,8,11,13],[3,2,7,9,10,12],[3,0,8,11,6,13],[3,0,10,11,6,13]];
  H.difficulties = [ { name: 'やさしい', react: .8, aim: .25, dodge: .12, skills: .28, retreat: .18 }, { name: 'ふつう', react: .27, aim: .75, dodge: .65, skills: .78, retreat: .3 }, { name: 'むずかしい', react: .1, aim: 1, dodge: .9, skills: 1, retreat: .28 } ];
  H.skillRanks = level => { const r = [0,0,0,0]; for(let i=1;i<=level;i++) r[i%4===0 ? 3 : (i-1)%4]++; return r; };
})(globalThis.HONJIN = globalThis.HONJIN || {});
