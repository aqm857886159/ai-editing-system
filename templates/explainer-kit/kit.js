// 讲解画面组件库（explainer kit）。设计系统 + 组件，任何一片都从这里取，保证质感一致。
// 规则：画面只由时间 t（秒）决定，可任意跳帧渲染；组件只收内容和时间，不收样式。
// 用法见 README.md；预览：gallery.html#组件名（加 &guides 显示字幕带和人物小窗的位置）。

// ---------- 基础工具 ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, x) => a + (b - a) * x;
const eo3 = x => 1 - Math.pow(1 - clamp(x), 3);
const eio3 = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
function spring(t, k = 120, c = 22) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k), z = c / (2 * Math.sqrt(k));
  if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function css(el, o) { if (el) for (const k in o) el.style[k] = o[k]; }
// 入场：上移 + 0.97→1 + 淡入；可选离场
function enter(el, t, t0, { dy = 24, out = Infinity, outDur = .45 } = {}) {
  const p = spring(t - t0), o = clamp((t - t0) / .35) * (isFinite(out) ? 1 - seg(t, out, out + outDur) : 1);
  css(el, { opacity: o, transform: `translateY(${(1 - p) * dy}px) scale(${.97 + .03 * p})` });
  return p;
}
// 某个时间点之后最近一次生效的值：at([[t, v], ...], t)
const at = (list, t, dflt) => { let v = dflt; for (const [ti, x] of list) if (t >= ti) v = x; return v; };
const since = (list, t) => { let s = -Infinity; for (const [ti] of list) if (t >= ti) s = ti; return t - s; };

// ---------- 设计系统 ----------
const TOKENS = {
  color: {
    bg: '#0b0b0e', fg: '#f5f5f7', fg2: 'rgba(245,245,247,.62)', fg3: 'rgba(245,245,247,.30)',
    accent: '#0A84FF',   // 结构、亮起、正在讲
    signal: '#FFC24A',   // 此刻最该记住的一个东西（关键数字、关键词、“你”）。一屏最多一处
    bad: '#FF453A', good: '#30D158',
  },
  // 字号层级：最大与最小约 9 倍。小英文只做质感，不承担信息
  type: { display: 200, hero: 136, h1: 96, h2: 76, h3: 52, body: 40, label: 30, micro: 18 },
  // 机位：全景带明显倾斜；推近时保留一点倾斜；亮起的元素浮起
  camera: { wide: { s: .95, x: 10, y: 34, rx: 9, ry: -14 }, pushScale: 1.4, pushTilt: { rx: 4, ry: -6 }, lift: 46 },
  // 版面安全区（1920×1080）：字幕带之下不放文字；人物小窗默认右下
  safe: { captionTop: 880, pip: { x: 1630, y: 790, d: 250 }, panel: { x: 100, y: 60, w: 1720, h: 800 } },
};

const KIT_CSS = `
:root{--bg:${TOKENS.color.bg};--fg:${TOKENS.color.fg};--fg2:${TOKENS.color.fg2};--fg3:${TOKENS.color.fg3};--accent:${TOKENS.color.accent};--signal:${TOKENS.color.signal};--bad:${TOKENS.color.bad};--good:${TOKENS.color.good}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden;background:var(--bg);color:var(--fg);font-family:"PingFang SC","SF Pro Display","Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased}
html:has(body.alpha),body.alpha{background:transparent}
body{perspective:2000px}
.abs{position:absolute}
.glow{position:absolute;border-radius:50%;filter:blur(120px)}
.grid{position:absolute;inset:-200px;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:80px 80px;-webkit-mask-image:radial-gradient(1100px 700px at 50% 50%,#000,transparent)}
.shard{position:absolute;border-radius:60px;border:1px solid rgba(255,255,255,.10)}
.grain{position:absolute;inset:0;width:1920px;height:1080px;opacity:.07;mix-blend-mode:overlay;pointer-events:none}
#cam{position:absolute;inset:0;transform-origin:960px 540px;transform-style:preserve-3d}
.panel{position:absolute;left:100px;top:60px;width:1720px;height:800px;border-radius:48px;transform-style:preserve-3d;background:linear-gradient(160deg,rgba(36,38,50,.94),rgba(16,16,22,.94) 60%);border:1px solid rgba(255,255,255,.10);box-shadow:0 60px 160px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.08)}
.panel::before{content:'';position:absolute;inset:0;border-radius:inherit;background:#050507;transform:translateZ(-34px)}
.panel::after{content:'';position:absolute;left:48px;right:48px;top:0;height:2px;background:linear-gradient(90deg,transparent,rgba(130,185,255,.6),transparent)}
.kicker{font-size:${TOKENS.type.label}px;font-weight:600;letter-spacing:.08em;color:var(--fg2)}
.en{font-size:${TOKENS.type.micro}px;letter-spacing:.32em;color:var(--fg3);font-weight:600;text-transform:uppercase}
.h1{font-size:${TOKENS.type.h1}px;font-weight:800;letter-spacing:-.01em;line-height:1.1}
.h2{font-size:${TOKENS.type.h2}px;font-weight:800;line-height:1.1}
.h3{font-size:${TOKENS.type.h3}px;font-weight:800;line-height:1.2}
.body{font-size:${TOKENS.type.body}px;font-weight:600;line-height:1.5}
.num{font-family:"SF Pro Display","PingFang SC";font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1}
.signal{color:var(--signal)} .accent{color:var(--accent)} .bad{color:var(--bad)} .dim{color:var(--fg2)}
.pill{display:inline-block;padding:8px 20px;border-radius:999px;font-size:24px;font-weight:600;color:var(--fg3);border:1px solid rgba(255,255,255,.10)}
.pill.on{color:#fff;background:var(--accent);border-color:transparent}
.tile{position:relative;}
.abs.tile{position:absolute}
.tile{border-radius:40px;border:2px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);overflow:hidden}
.tile.on{background:linear-gradient(160deg,rgba(10,132,255,.62),rgba(10,132,255,.14) 70%);border-color:rgba(130,185,255,.85);box-shadow:0 0 80px rgba(10,132,255,.38)}
.tile.sig{background:linear-gradient(160deg,rgba(255,194,74,.55),rgba(255,194,74,.12) 70%);border-color:rgba(255,214,140,.9);box-shadow:0 0 80px rgba(255,194,74,.35)}
.tile.off{filter:saturate(0)} .tile.off .lb{color:rgba(255,255,255,.16)}
.tile.wait{border-style:dashed;border-color:rgba(255,255,255,.35);background:transparent}
.icon{object-fit:cover;clip-path:inset(13% round 22%)}
.guide{position:absolute;border:3px dashed rgba(255,60,60,.8);pointer-events:none;z-index:99}
.guide span{position:absolute;left:12px;top:6px;font-size:22px;color:rgba(255,90,90,.95)}
`;

// ---------- 画框：背景层 + 机位 + 颗粒 ----------
// 所有组件共用：网格、碎片、光晕在后，#cam 里放内容，颗粒在最上。overlay 组件不画背景（透明出 ProRes）。
function frame(inner, { overlay = false, glows = true } = {}) {
  if (overlay) return `<div id="cam">${inner}</div>`;
  return `${glows ? `<div class="glow" style="left:-200px;top:-260px;width:1100px;height:900px;background:rgba(10,132,255,.20)"></div>
    <div class="glow" style="right:-300px;bottom:-300px;width:1000px;height:900px;background:rgba(120,90,255,.13)"></div>` : ''}
    <div class="grid" id="kgr"></div>
    <div id="kshards"><div class="shard" style="left:-140px;top:640px;width:620px;height:520px;background:rgba(10,132,255,.10);transform:rotate(-18deg)"></div>
    <div class="shard" style="left:1480px;top:-160px;width:560px;height:460px;background:rgba(120,90,255,.09);transform:rotate(24deg)"></div>
    <div class="shard" style="left:1320px;top:820px;width:420px;height:340px;background:rgba(48,209,88,.06);transform:rotate(-30deg)"></div></div>
    <div id="cam">${inner}</div>
    <canvas class="grain" id="kgn" width="960" height="540"></canvas>`;
}
// 机位关键帧：[[t, {s,x,y,rx,ry}], ...]，相邻帧之间用 eio3 过渡
function camAt(keys, t) {
  let i = keys.findIndex(k => k[0] > t);
  if (i < 0) return keys[keys.length - 1][1]; if (i === 0) return keys[0][1];
  const [ta, a] = keys[i - 1], [tb, b] = keys[i], x = eio3((t - ta) / (tb - ta)), o = {};
  for (const k in a) o[k] = lerp(a[k], b[k] ?? a[k], x); return o;
}
// 推到画面上的某一点（以 1920×1080 为坐标）
function push(p, s = TOKENS.camera.pushScale) {
  return { s, x: -s * (p.x - 960), y: -s * (p.y - 540), ...TOKENS.camera.pushTilt };
}
const WIDE = TOKENS.camera.wide;
// 进场默认机位：从远处、更斜的位置落到全景，之后极慢地漂移，画面一直在动
function introKeys(t0 = 0, dur = 10) {
  return [[t0, { ...WIDE, s: .78, rx: 14, ry: -20 }], [t0 + .9, WIDE], [t0 + dur, { ...WIDE, s: WIDE.s + .03, ry: WIDE.ry + 4 }]];
}
function frameRender(t, keys) {
  const c = camAt(keys, t);
  css($('#cam'), { transform: `translate(${c.x}px,${c.y}px) scale(${c.s}) rotateX(${c.rx}deg) rotateY(${c.ry}deg)` });
  if ($('#kgr')) css($('#kgr'), { transform: `translate(${c.x * -.05 + c.ry * 4}px,${c.y * -.05 - c.rx * 3}px)` });
  if ($('#kshards')) css($('#kshards'), { transform: `translate(${c.x * -.12 + c.ry * 9}px,${c.y * -.12 - c.rx * 6}px)` });
  const gn = $('#kgn');
  if (gn) {
    const g = gn.getContext('2d'), img = g.createImageData(960, 540);
    let seed = Math.floor(t * 30) * 9301 + 49297;
    for (let k = 0; k < img.data.length; k += 4) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; img.data[k] = img.data[k + 1] = img.data[k + 2] = seed >> 23; img.data[k + 3] = 255; }
    g.putImageData(img, 0, 0);
  }
}
// 状态变化时的反馈：亮起=弹一下+一闪；熄灭=闪两下再暗
function stateFx(state, d) {
  if (state === 'off') return { pop: 1, flash: d < .35 ? (Math.floor(d * 20) % 2 ? .4 : 1.6) : 1, z: 0 };
  const lit = state === 'on' || state === 'sig';
  return { pop: lit ? 1 + .06 * Math.exp(-6 * d) * Math.sin(Math.min(d, .5) * 12) : 1, flash: lit ? 1 + .7 * Math.exp(-5 * d) : 1, z: lit ? TOKENS.camera.lift * eo3(d / .5) : 0 };
}

// ---------- 组件 ----------
const KIT = {};

// 情境开场：全屏画面 + 大标题。frames 为逐帧图片目录（001.jpg…），或 image 为一张图
KIT.interlude = p => ({
  dur: p.dur || 2.8,
  html: `<div class="abs" style="inset:0;overflow:hidden">
      ${p.frames || p.image ? `<img id="ib" class="abs" style="inset:0;width:1920px;height:1080px;object-fit:cover" src="${p.image || p.frames + '/001.jpg'}">` : ''}
      <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(0,0,0,.84),rgba(0,0,0,.35) 70%,rgba(0,0,0,.2))"></div>
      <div class="abs" style="left:150px;top:380px"><div class="kicker" id="ik">${p.kicker || ''}</div>
      <div style="font-size:168px;font-weight:800;line-height:1.1;margin-top:10px" id="ih">${p.title}</div>
      <div class="h3" style="margin-top:18px;font-size:44px" id="is">${p.sub || ''}</div></div></div>
      <canvas class="grain" id="kgn" width="960" height="540"></canvas>`,
  render: t => {
    if (p.frames) $('#ib').src = `${p.frames}/${String(Math.min(p.frameCount || 84, Math.max(1, Math.floor(t * 30) + 1))).padStart(3, '0')}.jpg`;
    if ($('#ib')) css($('#ib'), { transform: `scale(${1.04 + .04 * clamp(t / 2.8)})` });
    enter($('#ik'), t, .15); enter($('#ih'), t, .3, { dy: 40 }); enter($('#is'), t, .6);
    frameRender(t, [[0, { s: 1, x: 0, y: 0, rx: 0, ry: 0 }]]);
  }
});

// 片尾预告：系列下一集讲什么。标题下放一张真实截图，裁到证据那一块（crop，原图像素）并画住一格（ring）；
// 下面一行把那一格翻译成一句话（tag），底部是合集名和集数，下一集亮起（next 是序号）
KIT.nextUp = p => {
  const W = 1460, sc = W / p.crop[2], H = Math.round(p.crop[3] * sc), top = p.cardTop || 280, r = p.ring, rt = p.ringT ?? 1.5, tg = p.tag || {};
  return {
    dur: p.dur || 5,
    html: frame(`<div class="panel">
      <div class="abs" style="left:80px;top:64px" id="nk"><span class="pill on" style="font-size:28px">${p.kicker || '下一集'}</span></div>
      <div class="abs h1" style="left:80px;top:128px;white-space:nowrap" id="nt">${p.title}</div>
      <div class="abs" id="nc" style="left:130px;top:${top}px;width:${W}px;height:${H}px;border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 40px 120px rgba(0,0,0,.55)">
        <img class="abs" src="${p.image}" style="left:${-p.crop[0] * sc}px;top:${-p.crop[1] * sc}px;width:${p.iw * sc}px;height:${p.ih * sc}px;max-width:none">
        <div class="abs" id="nr" style="left:${(r[0] - p.crop[0]) * sc}px;top:${(r[1] - p.crop[1]) * sc}px;width:${r[2] * sc}px;height:${r[3] * sc}px;border-radius:14px;border:5px solid var(--signal)"></div></div>
      <div class="abs" id="ns" style="right:130px;top:${top + H + 14}px;font-size:22px;font-weight:600;color:var(--fg2)">${p.source || ''}</div>
      <div class="abs" id="nx" style="left:130px;top:${top + H + 40}px;display:flex;align-items:baseline;gap:18px;white-space:nowrap">
        <span class="num signal" style="font-size:96px">${tg.value || ''}</span><span class="h3">${tg.unit || ''}</span>
        <span class="h3" style="margin-left:22px">${tg.label || ''}</span><span style="font-size:30px;font-weight:600;color:var(--fg2);margin-left:12px">${tg.note || ''}</span></div>
      ${p.eps ? `<div class="abs" id="nf" style="left:80px;bottom:56px;display:flex;align-items:center;gap:16px"><span class="kicker" style="margin-right:10px">${p.series || ''}</span>
        ${p.eps.map((e, i) => `<span class="pill${i === p.next ? ' on' : ''}" style="font-size:28px;${i === p.next ? '' : 'color:var(--fg2)'}">${e}</span>`).join('')}</div>` : ''}
    </div>`),
    render: t => {
      enter($('#nk'), t, .1); enter($('#nt'), t, .25, { dy: 30 }); enter($('#nc'), t, .55, { dy: 40 }); enter($('#ns'), t, .8);
      const k = eo3(seg(t, rt, rt + .4));
      css($('#nr'), { opacity: k, transform: `scale(${1.12 - .12 * k})`, boxShadow: `0 0 0 3000px rgba(0,0,0,${.42 * k})` });
      enter($('#nx'), t, rt + .3); if ($('#nf')) enter($('#nf'), t, p.footT ?? rt + .8);
      frameRender(t, introKeys(0, p.dur || 5));
    }
  };
};

// 定义卡：本片对一个概念的定义；读到关键词时加信号色下划线
KIT.definition = p => {
  const words = p.text.split(/(\[[^\]]+\])/).filter(Boolean);
  let mi = 0;
  const html = words.map(w => w.startsWith('[') ? `<span class="mk" id="mk${mi++}" style="position:relative;white-space:nowrap">${w.slice(1, -1)}<i style="position:absolute;left:0;bottom:-8px;height:8px;border-radius:4px;background:var(--signal);width:0"></i></span>` : w).join('');
  return {
    dur: p.dur || 9,
    html: frame(`<div class="panel">
      <div class="abs" style="left:80px;top:70px"><span class="pill on">${p.kicker || '本片的定义'}</span></div>
      <div class="abs h1" style="left:80px;top:150px" id="dt">${p.term}</div>
      <div class="abs en" style="left:84px;top:270px" id="de">${p.en || ''}</div>
      <div class="abs" style="left:80px;top:330px;width:6px;height:300px;border-radius:3px;background:var(--accent)" id="db"></div>
      <div class="abs" style="left:120px;top:340px;width:1500px;font-size:64px;font-weight:700;line-height:1.75" id="dx">${html}</div>
      ${p.note ? `<div class="abs dim" style="left:120px;top:690px;font-size:28px" id="dn">${p.note}</div>` : ''}
    </div>`),
    render: t => {
      enter($('#dt'), t, .5); enter($('#de'), t, .7); enter($('#dx'), t, 1.1);
      css($('#db'), { transform: `scaleY(${eo3(seg(t, .9, 1.6))})`, transformOrigin: 'top' });
      (p.marks || []).forEach((m, i) => css($(`#mk${i} i`), { width: `${100 * eo3(seg(t, m, m + .45))}%` }));
      if ($('#dn')) enter($('#dn'), t, p.noteT || 3);
      frameRender(t, introKeys(0, p.dur || 9));
    }
  };
};

// 提问卡：请观众停下来代入自己。blank 是要填的空，hint 是“可以先暂停”
KIT.question = p => ({
  dur: p.dur || 7,
  html: frame(`<div class="panel">
    <div class="abs" style="left:0;right:0;top:90px;text-align:center"><span class="pill on" id="qk">${p.kicker || '想一想'}</span></div>
    <div class="abs h1" style="left:120px;right:120px;top:180px;text-align:center" id="qq">${p.question}</div>
    <div class="abs" style="left:560px;width:600px;top:400px;height:200px;border-radius:40px;border:3px dashed rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;gap:20px" id="qb">
      <span class="num" style="font-size:120px" id="qv">${p.blank || '?'}</span></div>
    <div class="abs" style="left:0;right:0;top:660px;text-align:center" id="qh"><span style="display:inline-flex;align-items:center;gap:16px;padding:16px 34px;border-radius:999px;background:rgba(255,255,255,.08);font-size:36px;font-weight:600">
      <i style="display:inline-flex;gap:6px"><b style="width:8px;height:28px;background:var(--signal);border-radius:2px"></b><b style="width:8px;height:28px;background:var(--signal);border-radius:2px"></b></i>${p.hint || '可以先暂停，想一想你的答案'}</span></div>
  </div>`),
  render: t => {
    enter($('#qk'), t, .3); enter($('#qq'), t, .6); enter($('#qb'), t, 1.2); enter($('#qh'), t, p.hintT || 2.4);
    css($('#qv'), { opacity: .45 + .55 * (0.5 + 0.5 * Math.sin(t * 4)), color: 'var(--signal)' });
    frameRender(t, introKeys(0, p.dur || 7));
  }
});

// 大数字：一个数据第一次出现。数字从 from 数到 value；单位、口径和来源放旁边
KIT.bigNumber = p => ({
  dur: p.dur || 6,
  html: `${p.image ? `<img class="abs" id="bi" style="inset:0;width:1920px;height:1080px;object-fit:cover;filter:brightness(.32) blur(2px)" src="${p.image}">` : frame('', {})}
    <div class="abs" style="left:0;right:0;top:250px;text-align:center" id="bl"><span class="kicker" style="font-size:40px">${p.label}</span></div>
    <div class="abs" style="left:0;right:0;top:330px;text-align:center;white-space:nowrap" id="bn">
      <span class="num dim" style="font-size:90px;vertical-align:top">${p.prefix || ''}</span><span class="num" id="bv" style="font-size:${TOKENS.type.display + 60}px">0</span><span class="num dim" style="font-size:80px">${p.unit || ''}</span></div>
    <div class="abs" style="left:0;right:0;top:650px;text-align:center" id="bs"><span class="pill" style="font-size:26px">${p.note || ''}</span></div>
    ${p.image ? '<canvas class="grain" id="kgn" width="960" height="540"></canvas>' : ''}`,
  render: t => {
    enter($('#bl'), t, .2); enter($('#bn'), t, .4, { dy: 40 }); enter($('#bs'), t, 1.4);
    const v = lerp(p.from || 0, p.value, eo3(seg(t, .4, 1.6)));
    $('#bv').textContent = (p.decimals ? v.toFixed(p.decimals) : Math.round(v).toLocaleString('en-US'));
    if ($('#bi')) css($('#bi'), { transform: `scale(${1.05 + .05 * clamp(t / 6)})` });
    frameRender(t, [[0, { s: 1, x: 0, y: 0, rx: 0, ry: 0 }]]);
  }
});

// 对比：两到三个数字或选项并排；正在讲的那一个亮起（signal），其余压暗。每项可带 image：数字出处的截图，做成角上的小图
KIT.compare = p => {
  const n = p.items.length, w = n === 2 ? 640 : 460, gap = 60, left = (1720 - (n * w + (n - 1) * gap)) / 2;
  const cx = i => 100 + left + i * (w + gap) + w / 2;
  return {
    dur: p.dur || 10,
    html: frame(`<div class="panel">
      <div class="abs" style="left:80px;top:60px"><div class="kicker" id="ck">${p.kicker || ''}</div><div class="h2" style="margin-top:8px" id="ct">${p.title}</div></div>
      ${p.items.map((it, i) => `<div class="tile abs" id="cc${i}" style="left:${left + i * (w + gap)}px;top:250px;width:${w}px;height:410px;padding:40px">
        ${it.image ? `<img src="${it.image}" style="position:absolute;right:28px;top:26px;width:${n === 2 ? 150 : 110}px;height:${n === 2 ? 110 : 84}px;object-fit:cover;object-position:top;border-radius:6px;transform:rotate(4deg);box-shadow:0 14px 34px rgba(0,0,0,.5)">` : ''}
        <div class="kicker">${it.label}</div><div class="en" style="margin-top:6px">${it.en || ''}</div>
        <div style="margin-top:50px;white-space:nowrap"><span class="num" style="font-size:${n === 2 ? 170 : 140}px">${it.value}</span><span class="num dim" style="font-size:60px;margin-left:8px">${it.unit || ''}</span></div>
        <div class="dim" style="position:absolute;left:40px;bottom:40px;font-size:26px">${it.note || ''}</div></div>`).join('')}
      ${p.verdict ? `<div class="abs h3" style="left:80px;top:690px" id="cv">${p.verdict}</div>` : ''}
    </div>`),
    render: t => {
      enter($('#ck'), t, .3); enter($('#ct'), t, .5);
      const focus = at(p.focus || [], t, -1), fd = since(p.focus || [], t);
      p.items.forEach((it, i) => {
        const el = $('#cc' + i), e = spring(t - it.t), on = focus === i;
        el.className = 'tile abs' + (on ? ' sig' : '');
        const fx = on ? stateFx('sig', fd) : { pop: 1, flash: focus >= 0 ? .55 : 1, z: 0 };
        css(el, { opacity: clamp((t - it.t) / .3), transform: `translateZ(${fx.z}px) translateY(${(1 - e) * 40}px) scale(${(.94 + .06 * e) * fx.pop})`, filter: `brightness(${fx.flash})` });
      });
      if ($('#cv')) enter($('#cv'), t, p.verdictT || 6);
      const keys = introKeys(0, p.dur || 10);
      (p.focus || []).forEach(([tf, i]) => { if (p.pushFocus) keys.push([tf, keys[keys.length - 1][1]], [tf + .6, push({ x: 960 + (cx(i) - 960) * .45, y: 520 }, 1.1)]); });
      keys.sort((a, b) => a[0] - b[0]);
      frameRender(t, keys);
    }
  };
};

// 结论条：全屏人物画面下方的一句判断（叠加层，透明背景，用 render.js alpha 模式导出）
KIT.verdict = p => ({
  dur: p.dur || 5, overlay: true,
  html: frame(`<div class="abs" style="left:50%;top:${p.top || 640}px;transform:translateX(-50%)" id="vw">
    ${p.tag ? `<div style="display:inline-block;padding:6px 18px;border-radius:10px;background:var(--signal);color:#1a1200;font-size:24px;font-weight:800;margin-bottom:12px" id="vt">${p.tag}</div>` : ''}
    <div style="padding:26px 48px;border-radius:30px;background:rgba(14,14,18,.86);border:1px solid rgba(255,255,255,.14);display:flex;gap:14px;align-items:center;white-space:nowrap;box-shadow:0 30px 80px rgba(0,0,0,.5)">
      ${p.parts.map((x, i) => `<span id="vp${i}" style="font-size:62px;font-weight:800;${x.key ? 'padding:4px 16px;border-radius:12px;background:var(--accent);' : ''}">${x.text}</span>`).join('')}</div>
    ${p.en ? `<div class="en" style="margin-top:12px;text-align:center;letter-spacing:.18em">${p.en}</div>` : ''}</div>`, { overlay: true }),
  render: t => {
    const e = enter($('#vw'), t, .1, { dy: 30, out: (p.dur || 5) - .5 });
    p.parts.forEach((x, i) => { if (x.key) css($('#vp' + i), { background: `rgba(10,132,255,${eo3(seg(t, .5 + i * .15, .9 + i * .15))})` }); });
    css($('#vw'), { transform: `translateX(-50%) translateY(${(1 - e) * 30}px)` });
  }
});

// 分类导航：几个并列部分，当前项亮起放大，其余变灰；每进入新的一项就回到这里
// 每项给 image 时改成一排画面卡（2–4 项）：上面是这一项的画面，下面是标签，讲之前先把几种情况一起亮出来
KIT.categoryNav = p => {
  const pics = p.items.some(it => it.image), n = p.items.length;
  const cols = pics ? n : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), gx = 40, gy = 40;
  const w = pics ? (1560 - (n - 1) * gx) / n : cols === 2 ? 700 : 480, h = pics ? 540 : rows === 2 ? 260 : 220;
  const left = (1720 - (cols * w + (cols - 1) * gx)) / 2, top = pics ? 190 : 170;
  const pos = i => ({ x: left + (i % cols) * (w + gx), y: top + Math.floor(i / cols) * (h + gy) });
  return {
    dur: p.dur || 6,
    html: frame(`<div class="panel">
      <div class="abs" style="left:80px;top:60px"><div class="kicker" id="nk">${p.title}</div></div>
      ${p.items.map((it, i) => pics ? `<div class="tile abs" id="nc${i}" style="left:${pos(i).x}px;top:${pos(i).y}px;width:${w}px;height:${h}px;padding:0;border-radius:32px">
        <img src="${it.image}" style="position:absolute;left:0;top:0;width:100%;height:${h - 150}px;object-fit:cover;object-position:${it.pos || 'center'}">
        <div class="abs" style="left:0;right:0;bottom:0;height:150px;padding:26px 32px">
          <div class="kicker" style="color:var(--accent)">${it.kicker || ''}</div><div class="lb" style="font-size:${n > 3 ? 40 : 48}px;font-weight:800;margin-top:6px;white-space:nowrap">${it.label}</div></div></div>`
        : `<div class="tile abs" id="nc${i}" style="left:${pos(i).x}px;top:${pos(i).y}px;width:${w}px;height:${h}px;padding:36px 40px;display:flex;align-items:center;gap:30px">
        ${it.icon ? `<img class="icon" src="${it.icon}" style="width:${h - 90}px;height:${h - 90}px">` : ''}
        <div><div class="lb h2">${it.label}</div><div class="en" style="margin-top:10px">${it.en || ''}</div></div></div>`).join('')}
    </div>`),
    render: t => {
      enter($('#nk'), t, .2);
      const active = at(p.active || [], t, -1), ad = since(p.active || [], t);
      p.items.forEach((it, i) => {
        const el = $('#nc' + i), e = spring(t - .4 - i * .12), on = active === i;
        el.className = 'tile abs' + (on ? ' sig' : active >= 0 ? ' off' : '');
        const fx = on ? stateFx('sig', ad) : { pop: 1, flash: 1, z: 0 };
        css(el, { opacity: clamp((t - .4 - i * .12) / .3) * (active >= 0 && !on ? .55 : 1), transform: `translateZ(${fx.z}px) translateY(${(1 - e) * 40}px) scale(${(.94 + .06 * e) * fx.pop * (on ? 1.04 : 1)})`, filter: `brightness(${fx.flash})` });
      });
      const keys = introKeys(0, p.dur || 6);
      const pk = pics ? .15 : .4, ps = pics ? 1 : 1.08;
      (p.active || []).forEach(([ta, i]) => { const q = pos(i); keys.push([ta + .1, keys[keys.length - 1][1]], [ta + .8, push({ x: 960 + (100 + q.x + w / 2 - 960) * pk, y: 470 + (60 + q.y + h / 2 - 470) * pk }, ps)]); });
      keys.sort((a, b) => a[0] - b[0]);
      frameRender(t, keys);
    }
  };
};

// 链路图：有先后顺序的流程，按口播一层层出现，当前层发光
KIT.chain = p => {
  const n = p.steps.length, H = n > 4 ? 112 : 130, gap = n > 4 ? 28 : 34, top0 = 460 - (n * H + (n - 1) * gap) / 2;
  return {
    dur: p.dur || 12,
    html: frame(`<div class="panel"></div><div class="abs" style="left:180px;top:130px"><div class="kicker" id="hk">${p.kicker || ''}</div><div class="h1" style="margin-top:8px" id="ht">${p.title}</div></div>
      <div class="abs" style="left:800px;top:0;width:1000px;height:1080px;transform-style:preserve-3d;transform:translateZ(160px) rotateX(12deg) rotateY(-10deg)">
      ${p.steps.map((s, i) => `<div class="tile abs" id="hs${i}" style="left:0;top:${top0 + i * (H + gap)}px;width:960px;height:${H}px;padding:0 44px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:baseline;gap:22px"><span class="num dim" style="font-size:40px">${String(i + 1).padStart(2, '0')}</span><span class="h3" style="font-size:56px">${s.label}</span></div><span class="en">${s.en || ''}</span></div>
        ${i < n - 1 ? `<div class="abs" id="hl${i}" style="left:440px;top:${top0 + i * (H + gap) + H}px;width:4px;height:${gap}px;background:var(--accent)"></div>` : ''}`).join('')}
      </div>
      ${p.steps.map((s, i) => s.sub ? `<div class="abs body dim" id="hd${i}" style="left:180px;top:380px;width:560px">${s.sub}</div>` : '').join('')}`),
    render: t => {
      enter($('#hk'), t, .2); enter($('#ht'), t, .4);
      const cur = p.steps.reduce((c, s, i) => (t >= s.t ? i : c), -1);
      p.steps.forEach((s, i) => {
        const el = $('#hs' + i), d = t - s.t, e = spring(d), fx = stateFx(i === cur ? 'on' : 'none', d);
        el.className = 'tile abs' + (i === cur ? ' on' : '');
        css(el, { opacity: clamp(d / .3) * (i < cur ? .6 : 1), transform: `translateZ(${fx.z}px) translateY(${(1 - e) * -60}px)`, filter: `brightness(${fx.flash})` });
        if ($('#hl' + i)) css($('#hl' + i), { transform: `scaleY(${eo3(seg(t, p.steps[i + 1].t - .3, p.steps[i + 1].t))})`, transformOrigin: 'top' });
        if ($('#hd' + i)) css($('#hd' + i), { opacity: i === cur ? clamp(d / .3) : 0 });
      });
      frameRender(t, introKeys(0, p.dur || 12));
    }
  };
};

// 原文证据：先给来源封面，再推近到原文那一行，用高亮条扫过关键数字
KIT.evidence = p => ({
  dur: p.dur || 9,
  html: frame(`<div class="abs" id="ec" style="left:560px;top:120px;width:620px;height:840px;border-radius:10px;background:#f4f4f2;color:#1b1b1f;padding:80px 60px;box-shadow:0 40px 120px rgba(0,0,0,.6);transform:rotate(-3deg)">
      <div style="font-size:30px;color:#555">${p.cover.org || ''}</div><div style="font-size:72px;font-weight:800;margin-top:140px;line-height:1.25">${p.cover.title}</div>
      <div style="font-size:30px;color:#777;margin-top:30px">${p.cover.sub || ''}</div></div>
    <div class="abs" id="ep" style="left:160px;top:140px;width:1600px;height:800px;border-radius:10px;background:#f4f4f2;color:#1b1b1f;padding:70px 90px;font-family:'Songti SC',serif;font-size:46px;line-height:1.9">
      ${p.lines.map((l, i) => `<div style="position:relative;white-space:nowrap">${i === p.hl.line ? `${l.slice(0, p.hl.from)}<span style="position:relative">${l.slice(p.hl.from, p.hl.to)}<i id="eh" style="position:absolute;left:-6px;top:6px;bottom:6px;width:0;background:rgba(10,132,255,.32);border-radius:6px"></i></span>${l.slice(p.hl.to)}` : l}</div>`).join('')}</div>
    <div class="abs" style="left:160px;top:66px"><span class="pill" id="es" style="font-size:26px;color:var(--fg2)">来源：${p.source}</span></div>`),
  render: t => {
    const sw = p.swapT || 2.6;
    css($('#ec'), { opacity: clamp(t / .4) * (1 - seg(t, sw, sw + .4)), transform: `rotate(-3deg) scale(${.94 + .06 * eo3(t / 1)})` });
    css($('#ep'), { opacity: seg(t, sw, sw + .4) });
    css($('#eh'), { width: `calc(${100 * eo3(seg(t, p.hl.t, p.hl.t + .7))}% + 12px)` });
    enter($('#es'), t, .6);
    const hy = 140 + 70 + (p.hl.line + .5) * 46 * 1.9;
    frameRender(t, [[0, { ...WIDE, s: .9 }], [1, WIDE], [sw, WIDE], [sw + .3, { s: 1, x: 0, y: 0, rx: 3, ry: -4 }], [p.hl.t - .2, { s: 1, x: 0, y: 0, rx: 3, ry: -4 }], [p.hl.t + .8, push({ x: 960, y: 440 + (hy - 440) * .5 }, 1.14)]]);
  }
});

// 图表：一条趋势线随时间画出，关键结论直接写在曲线上
KIT.chart = p => {
  const W = 1380, H = 410, n = p.values.length, max = p.yMax ?? Math.max(...p.values), min = p.yMin ?? Math.min(0, ...p.values);
  const pt = i => [i / (n - 1) * W, H - (p.values[i] - min) / (max - min) * H];
  const d = p.values.map((v, i) => (i ? 'L' : 'M') + pt(i).map(x => x.toFixed(1)).join(' ')).join('');
  return {
    dur: p.dur || 9,
    html: frame(`<div class="panel">
      <div class="abs" style="left:80px;top:60px"><div class="kicker" id="gk">${p.kicker || ''}</div><div class="h2" style="margin-top:8px" id="gt">${p.title}</div></div>
      <svg class="abs" style="left:130px;top:230px;overflow:visible" width="${W}" height="${H}">
        <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(10,132,255,.45)"/><stop offset="1" stop-color="rgba(10,132,255,0)"/></linearGradient>
        <clipPath id="gc"><rect id="gr" x="0" y="-40" width="0" height="${H + 80}"/></clipPath></defs>
        <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="rgba(255,255,255,.2)" stroke-width="2"/>
        <g clip-path="url(#gc)"><path d="${d} L${W} ${H} L0 ${H}Z" fill="url(#ga)"/><path d="${d}" fill="none" stroke="#4da3ff" stroke-width="6" stroke-linejoin="round"/></g>
        <circle id="gd" r="12" fill="#fff"/>
        ${(p.xLabels || []).map((l, i) => `<text x="${i / ((p.xLabels.length - 1) || 1) * W}" y="${H + 48}" fill="rgba(245,245,247,.5)" font-size="26" text-anchor="middle">${l}</text>`).join('')}
      </svg>
      ${p.annotate ? (p.annotate.at != null
        ? `<div class="abs" id="ga2" style="left:${130 + pt(p.annotate.at)[0]}px;top:${230 + pt(p.annotate.at)[1]}px;transform-origin:right bottom"><div style="position:absolute;right:28px;bottom:22px;white-space:nowrap;text-align:right"><span class="num signal" style="font-size:${p.annotate.size || 120}px">${p.annotate.text}</span>${p.annotate.sub ? `<div class="kicker" style="margin-top:6px">${p.annotate.sub}</div>` : ''}</div></div>`
        : `<div class="abs" id="ga2" style="left:${130 + W * .55}px;top:${230 + H * .38}px;transform:rotate(-14deg)"><span class="num signal" style="font-size:96px">${p.annotate.text}</span></div>`) : ''}
      ${p.yNote ? `<div class="abs dim" style="left:80px;top:${230 + H + 60}px;font-size:24px">${p.yNote}</div>` : ''}
      <div class="abs dim" style="right:80px;top:76px;font-size:24px" id="gs">${p.source ? '来源：' + p.source : ''}</div>
    </div>`),
    render: t => {
      enter($('#gk'), t, .3); enter($('#gt'), t, .5); enter($('#gs'), t, 1);
      const x = eio3(seg(t, p.drawStart ?? 1, p.drawEnd || 5)), i = x * (n - 1), i0 = Math.floor(i), f = i - i0, a = pt(i0), b = pt(Math.min(n - 1, i0 + 1));
      $('#gr').setAttribute('width', x * W);
      $('#gd').setAttribute('cx', lerp(a[0], b[0], f)); $('#gd').setAttribute('cy', lerp(a[1], b[1], f));
      if ($('#ga2')) { const e = spring(t - p.annotate.t); css($('#ga2'), { opacity: clamp((t - p.annotate.t) / .3), transform: `${p.annotate.at != null ? '' : 'rotate(-14deg) '}scale(${.6 + .4 * e})` }); }
      frameRender(t, introKeys(0, p.dur || 9));
    }
  };
};

// 主线公式：全片反复回来的对象。格子的状态随讲解变化：on 亮 / off 灭 / wait 待定 / sig 只能靠你
// p = { eq, slots:[{label,en,icon}], changes:[[[t,state,who],...] 每格], header:[[t,{title,big,bigLabel,sum}]], keys? }
KIT.formula = p => {
  const n = p.slots.length, w = Math.min(360, (1600 - (n - 1) * 66) / n), cx = i => 160 + i * (w + 66) + w / 2;
  return {
    dur: p.dur || 12,
    html: frame(`<div class="panel">
      <div class="abs h1" style="left:60px;top:90px;white-space:nowrap" id="fh"></div>
      <div class="abs" style="right:60px;top:40px;text-align:right"><div class="num" style="font-size:${TOKENS.type.hero}px" id="fb"></div><div class="kicker" style="margin-top:10px" id="fbl"></div></div>
      <svg class="abs" style="left:0;top:0;overflow:visible" width="1720" height="300"><path d="M60 236 Q60 222 76 222 L1644 222 Q1660 222 1660 236" fill="none" stroke="rgba(255,255,255,.26)" stroke-width="3"/>
        ${p.slots.map((s, i) => `<g id="far${i}"><line x1="${cx(i) - 100}" y1="222" x2="${cx(i) - 100}" y2="256" stroke-width="6" stroke-dasharray="10 8"/><path d="M${cx(i) - 113} 250 L${cx(i) - 100} 266 L${cx(i) - 87} 250" fill="none" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`).join('')}</svg>
      <div class="abs" style="left:860px;top:202px;transform:translateX(-50%);padding:6px 22px;border-radius:999px;background:#1b1d26;border:1px solid rgba(255,255,255,.14);font-size:26px;font-weight:700;color:var(--fg2);white-space:nowrap">${p.eq}</div>
      <div class="abs" style="left:60px;top:270px;display:flex;align-items:center;transform-style:preserve-3d">
        ${p.slots.map((s, i) => `${i ? `<div style="width:66px;display:flex;justify-content:center"><b id="fp${i}" style="width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:500;color:var(--fg3);background:#16171d;border:1px solid rgba(255,255,255,.12)">+</b></div>` : ''}
        <div class="tile" id="ft${i}" style="width:${w}px;height:400px;padding:34px 32px">
          ${s.icon ? `<img class="icon" src="${s.icon}" style="width:150px;height:150px;margin:-14px 0 0 -16px;display:block">` : ''}
          <div class="lb h2" style="margin-top:6px">${s.label}</div><div class="en" style="margin-top:8px">${s.en || ''}</div>
          <div id="fw${i}" style="position:absolute;left:32px;right:28px;bottom:34px;font-size:34px;font-weight:700;white-space:nowrap"></div>
          <div id="fk${i}" style="position:absolute;left:28px;bottom:54px;height:4px;border-radius:2px;background:var(--bad)"></div></div>`).join('')}</div>
      <div class="abs h3" style="left:60px;top:712px;font-size:46px;white-space:nowrap" id="fs"></div>
    </div>`),
    render: t => {
      const hd = at(p.header || [], t, {}), hs = since(p.header || [], t);
      $('#fh').textContent = hd.title || ''; $('#fb').textContent = hd.big || ''; $('#fbl').textContent = hd.bigLabel || ''; $('#fs').textContent = hd.sum || '';
      enter($('#fh'), hs, .2); enter($('#fb'), hs, .5, { dy: 20 }); enter($('#fbl'), hs, .7); enter($('#fs'), hs, hd.sumAt || 3);
      const states = p.changes.map(ch => (ch.filter(c => t >= c[0]).pop() || [0, 'none'])[1]);
      const lit = s => s === 'on' || s === 'sig';
      p.changes.forEach((ch, i) => {
        const el = $('#ft' + i), cur = ch.filter(c => t >= c[0]).pop(), first = ch[0][0], e = spring(t - first);
        if (!cur) { css(el, { opacity: 0 }); return; }
        const [s0, state, who] = cur, d = t - s0, fx = stateFx(state, d);
        el.className = 'tile ' + state;
        $('#fw' + i).textContent = who; css($('#fw' + i), { opacity: clamp(d / .3), color: state === 'off' ? 'rgba(255,255,255,.28)' : state === 'sig' ? '#ffd88a' : '' });
        css($('#fk' + i), { width: state === 'off' ? `${$('#fw' + i).offsetWidth * eo3(seg(d, .15, .55))}px` : '0px' });
        css(el, { opacity: clamp((t - first) / .3), transform: `translateZ(${fx.z}px) translateY(${(1 - e) * 40}px) scale(${(.94 + .06 * e) * fx.pop})`, filter: `brightness(${fx.flash})` });
        const col = state === 'on' ? '#4da3ff' : state === 'sig' ? '#FFC24A' : state === 'wait' ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.12)';
        $$(`#far${i} line, #far${i} path`).forEach(x => x.setAttribute('stroke', col));
        css($(`#far${i} line`), { strokeDashoffset: lit(state) ? -t * 40 : 0 });
        if (i) { const on = lit(state) && lit(states[i - 1]); css($('#fp' + i), { background: on ? 'var(--accent)' : '#16171d', color: on ? '#fff' : '', boxShadow: on ? '0 0 30px rgba(10,132,255,.6)' : 'none' }); }
      });
      // 默认机位：每次有格子变化，就推到那一格，1.2 秒后拉回全景
      const keys = p.keys || (() => {
        const k = introKeys(0, p.dur || 12), ev = [];
        p.changes.forEach((ch, i) => ch.slice(1).forEach(c => ev.push([c[0], i])));
        // 总结句出现后不再推镜头，免得它被推出画面或压进字幕带
        const sums = (p.header || []).filter(h => h[1].sum).map(h => h[0] + (h[1].sumAt || 3)), quiet = Math.min(Infinity, ...sums);
        ev.filter(([te]) => te + 1.7 < quiet).sort((a, b) => a[0] - b[0]).forEach(([te, i]) => k.push([te - .5, WIDE], [te - .1, push({ x: 960 + (100 + cx(i) - 960) * .4, y: 520 }, 1.1)], [te + 1.1, push({ x: 960 + (100 + cx(i) - 960) * .4, y: 520 }, 1.1)], [te + 1.7, WIDE]));
        return k.sort((a, b) => a[0] - b[0]);
      })();
      frameRender(t, keys);
    }
  };
};

// 层级图：N 层或 N 项从下往上（或从上往下）编号排开，按口播推进；当前项亮，其余暗。
// overview 时间点后回到全景；compare 在每行右侧加两列对比标记（good / bad / 空）
KIT.layerStack = p => {
  const n = p.items.length, gap = n > 8 ? 10 : 16, H = Math.min(108, (660 - gap * (n - 1)) / n), top0 = 450 - (n * H + (n - 1) * gap) / 2;
  const order = i => (p.bottomUp ? n - 1 - i : i), y = i => top0 + order(i) * (H + gap), X = 760, W = p.compare ? 760 : 960;
  return {
    dur: p.dur || 12,
    html: frame(`<div class="panel"></div>
      <div class="abs" style="left:180px;top:150px;width:520px"><div class="kicker" id="lk">${p.kicker || ''}</div><div class="h1" style="margin-top:8px" id="lt">${p.title}</div></div>
      ${p.items.map((it, i) => `<div class="abs h3" id="ls${i}" style="left:180px;top:420px;width:520px;font-size:60px;line-height:1.25">${it.label}<div class="body dim" style="margin-top:20px">${it.sub || ''}</div></div>`).join('')}
      ${p.items.map((it, i) => `<div class="abs" id="ln${i}" style="left:${X - 70}px;top:${y(i)}px;width:56px;height:${H}px;display:flex;align-items:center;justify-content:flex-end"><span class="num" style="font-size:${Math.min(44, H * .45)}px">${i + 1}</span></div>
        <div class="tile abs" id="lr${i}" style="left:${X}px;top:${y(i)}px;width:${W}px;height:${H}px;border-radius:${Math.min(28, H / 3)}px;padding:0 30px;display:flex;align-items:center;gap:22px">
        ${it.icon ? `<img class="icon" src="${it.icon}" style="width:${H * .72}px;height:${H * .72}px">` : ''}
        <span class="lb" style="font-size:${Math.min(46, H * .42)}px;font-weight:800;white-space:nowrap">${it.label}</span><span class="en" style="margin-left:auto">${it.en || ''}</span></div>
        ${p.compare ? p.compare.cols.map((c, k) => `<div class="abs" id="lm${i}_${k}" style="left:${X + W + 40 + k * 110}px;top:${y(i) + H / 2 - 20}px;width:40px;height:40px;border-radius:50%"></div>`).join('') : ''}`).join('')}
      ${p.stamp ? `<div class="abs" id="lst" style="left:${X + W / 2}px;top:450px;transform:translate(-50%,-50%) rotate(-10deg);padding:18px 48px;border:8px solid var(--bad);border-radius:24px;color:var(--bad);font-size:120px;font-weight:900;letter-spacing:.08em;white-space:nowrap;background:rgba(20,6,6,.55);box-shadow:0 0 60px rgba(255,69,58,.35)">${p.stamp.text}</div>` : ''}
      ${p.compare ? p.compare.cols.map((c, k) => `<div class="abs kicker" id="lh${k}" style="left:${X + W + 20 + k * 110}px;top:${top0 - 56}px;width:80px;text-align:center">${c}</div>`).join('') : ''}`),
    render: t => {
      enter($('#lk'), t, .2); enter($('#lt'), t, .4);
      const act = at(p.active || [], t, -1), ad = since(p.active || [], t), ov = p.overview != null && t >= p.overview;
      p.items.forEach((it, i) => {
        const t0 = it.t ?? (.5 + i * .08), e = spring(t - t0), on = !ov && act === i, el = $('#lr' + i), fx = on ? stateFx('on', ad) : { pop: 1, flash: 1, z: 0 };
        el.className = 'tile abs' + (on ? ' on' : '');
        const dim = !ov && act >= 0 && !on ? .38 : 1;
        css(el, { opacity: clamp((t - t0) / .3) * dim, transform: `translateZ(${fx.z}px) translateX(${(1 - e) * 60}px) scale(${on ? 1 + .035 * eo3(ad / .4) : 1})`, transformOrigin: 'left center', filter: `brightness(${fx.flash})` });
        css($('#ln' + i), { opacity: clamp((t - t0) / .3) * (on ? 1 : .45), color: on ? 'var(--accent)' : '' });
        css($('#ls' + i), { opacity: on ? clamp(ad / .35) : 0, transform: `translateY(${on ? (1 - eo3(ad / .5)) * 20 : 0}px)` });
        if (p.compare) p.compare.cols.forEach((c, k) => {
          const m = (p.compare.marks[i] || [])[k], tm = p.compare.t + i * .06, el2 = $(`#lm${i}_${k}`);
          css(el2, { opacity: clamp((t - tm) / .2), transform: `scale(${spring(t - tm)})`, background: m === 'good' ? 'var(--good)' : m === 'bad' ? 'rgba(255,69,58,.35)' : 'rgba(255,255,255,.08)', boxShadow: m === 'good' ? '0 0 24px rgba(48,209,88,.5)' : 'none' });
        });
      });
      if (p.compare) p.compare.cols.forEach((c, k) => css($('#lh' + k), { opacity: clamp((t - p.compare.t + .3) / .3) }));
      if (p.stamp) { const d = t - p.stamp.t; css($('#lst'), { opacity: clamp(d / .06), transform: `translate(-50%,-50%) rotate(-10deg) scale(${d < 0 ? 1.6 : lerp(1.6, 1, eo3(d / .18))})` }); }
      const keys = introKeys(0, p.dur || 12);
      (p.active || []).forEach(([ta, i]) => keys.push([ta + .05, keys[keys.length - 1][1]], [ta + .7, push({ x: 960 + (X + W / 2 - 960) * .35, y: 540 + (y(i) + H / 2 - 540) * .45 }, 1.1)]));
      if (p.overview != null) keys.push([p.overview, keys[keys.length - 1][1]], [p.overview + .8, WIDE]);
      frameRender(t, keys.sort((a, b) => a[0] - b[0]));
    }
  };
};

// 比例对比：两个量级差很多，用面积说话。小的那个缩成点时，用引线把数字拉出来
KIT.scaleCompare = p => {
  const [a, b] = [p.a, p.b], D = 560, db = D, da = Math.max(10, D * Math.sqrt(a.value / b.value));
  return {
    dur: p.dur || 7,
    html: frame(`<div class="panel">
      <div class="abs" style="left:80px;top:60px"><div class="kicker" id="sk">${p.kicker || ''}</div><div class="h2" style="margin-top:8px" id="st">${p.title}</div></div>
      <div class="abs" id="sa" style="left:${460 - da / 2}px;top:${470 - da / 2}px;width:${da}px;height:${da}px;border-radius:50%;background:var(--fg)"></div>
      <div class="abs" id="sal" style="left:260px;top:${da > 120 ? 470 + da / 2 + 30 : 610}px;width:400px;text-align:center"><div class="kicker">${a.label}</div><div class="num" style="font-size:56px;margin-top:10px">${a.display || a.value}</div></div>
      ${da <= 120 ? `<div class="abs" id="sline" style="left:459px;top:${470 + da / 2 + 6}px;width:2px;height:${130 - da / 2}px;background:var(--fg3)"></div>` : ''}
      <div class="abs" id="sb" style="left:${1180 - db / 2}px;top:${470 - db / 2 + 10}px;width:${db}px;height:${db}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#7cc0ff,var(--accent) 55%,#0a3a80);box-shadow:0 0 120px rgba(10,132,255,.45)"></div>
      <div class="abs" id="sbl" style="left:${1180 - 300}px;top:${470 - 70}px;width:600px;text-align:center;color:#fff"><div class="kicker" style="color:rgba(255,255,255,.85)">${b.label}</div><div class="num" style="font-size:72px;margin-top:10px">${b.display || b.value}</div></div>
      ${p.ratio ? `<div class="abs" id="sr" style="left:80px;top:700px"><span class="num signal" style="font-size:64px">${p.ratio}</span></div>` : ''}
      ${p.source ? `<div class="abs dim" style="right:80px;top:76px;font-size:24px">来源：${p.source}</div>` : ''}
    </div>`),
    render: t => {
      enter($('#sk'), t, .2); enter($('#st'), t, .4);
      css($('#sa'), { transform: `scale(${spring(t - .8)})` }); enter($('#sal'), t, 1.1);
      if ($('#sline')) css($('#sline'), { transform: `scaleY(${eo3(seg(t, 1, 1.4))})`, transformOrigin: 'top' });
      const tb = p.t || 2.4; css($('#sb'), { transform: `scale(${eo3(seg(t, tb, tb + 1.4))})` }); enter($('#sbl'), t, tb + 1.2);
      if ($('#sr')) enter($('#sr'), t, tb + 2);
      frameRender(t, introKeys(0, p.dur || 7));
    }
  };
};

// 表格高亮：一张表只看一行（可再圈一格）。其余行压暗，来源写在下面
KIT.tableHighlight = p => {
  const nc = p.cols.length, rh = Math.min(110, 460 / p.rows.length), cw = p.widths || p.cols.map(() => 1520 / nc);
  const cx = k => 100 + cw.slice(0, k).reduce((a, b) => a + b, 0);
  return {
    dur: p.dur || 8,
    html: frame(`<div class="panel">
      <div class="abs" style="left:80px;top:60px"><div class="kicker" id="tk">${p.kicker || ''}</div><div class="h2" style="margin-top:8px" id="tt">${p.title}</div></div>
      <div class="abs" id="tb" style="left:0;top:250px;width:1720px">
        <div style="position:relative;height:60px">${p.cols.map((c, k) => `<span class="kicker" style="position:absolute;left:${cx(k)}px;top:10px">${c}</span>`).join('')}</div>
        <div style="margin:0 80px;height:2px;background:rgba(255,255,255,.18)"></div>
        ${p.rows.map((r, i) => `<div id="tr${i}" style="position:relative;height:${rh}px;margin:0 80px;border-bottom:1px solid rgba(255,255,255,.06);border-radius:16px">${r.map((v, k) => `<span id="tc${i}_${k}" class="${k ? 'num' : ''}" style="position:absolute;left:${cx(k) - 80}px;top:50%;transform:translateY(-50%);font-size:${Math.min(50, rh * .46)}px;font-weight:700;white-space:nowrap;padding:4px 10px;border-radius:12px">${v}</span>`).join('')}</div>`).join('')}
      </div>
      ${p.source ? `<div class="abs dim" style="left:80px;top:750px;font-size:24px" id="ts">来源：${p.source}</div>` : ''}
    </div>`),
    render: t => {
      enter($('#tk'), t, .2); enter($('#tt'), t, .4); if ($('#ts')) enter($('#ts'), t, 1);
      const h = p.hl, d = t - h.t, on = d >= 0;
      p.rows.forEach((r, i) => {
        const t0 = .6 + i * .07, row = $('#tr' + i), me = i === h.row;
        css(row, { opacity: clamp((t - t0) / .3) * (on && !me ? lerp(1, .3, eo3(d / .4)) : 1), transform: `translateY(${(1 - spring(t - t0)) * 20}px) scale(${me && on ? 1 + .02 * eo3(d / .4) : 1})`,
          background: me && on ? `rgba(10,132,255,${.32 * eo3(d / .4)})` : 'transparent', boxShadow: me && on ? `0 0 60px rgba(10,132,255,${.3 * eo3(d / .4)})` : 'none' });
        if (me && h.col != null) css($(`#tc${i}_${h.col}`), { boxShadow: `0 0 0 ${on ? 4 * eo3(seg(d, .3, .7)) : 0}px var(--signal)`, color: on && d > .3 ? 'var(--signal)' : '' });
      });
      frameRender(t, introKeys(0, p.dur || 8));
    }
  };
};

// 标签：叠在实拍或录屏上，指出某处叫什么。点 + 脉冲圈 + 引线 + 标签（透明叠加层）
KIT.callout = p => ({
  dur: p.dur || 5, overlay: true,
  html: frame(p.items.map((it, i) => {
    const L = it.len || 160, left = it.side === 'left';
    return `<div class="abs" id="co${i}" style="left:${it.x}px;top:${it.y}px">
      <i class="abs" id="cr${i}" style="left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;border:3px solid var(--signal)"></i>
      <i class="abs" style="left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;background:var(--signal);box-shadow:0 0 20px rgba(255,194,74,.8)"></i>
      <i class="abs" id="cl${i}" style="${left ? 'right' : 'left'}:0;top:-1.5px;width:${L}px;height:3px;background:var(--signal);transform-origin:${left ? 'right' : 'left'}"></i>
      <div class="abs" id="cp${i}" style="${left ? `right:${L + 10}px` : `left:${L + 10}px`};top:-34px;padding:12px 26px;border-radius:18px;background:rgba(14,14,18,.88);border:1px solid rgba(255,255,255,.16);white-space:nowrap;box-shadow:0 20px 50px rgba(0,0,0,.45)">
        <span style="font-size:${it.size || 40}px;font-weight:800">${it.label}</span>${it.en ? `<span class="en" style="margin-left:14px">${it.en}</span>` : ''}</div></div>`;
  }).join(''), { overlay: true }),
  render: t => p.items.forEach((it, i) => {
    const t0 = it.t ?? (.3 + i * .35), d = t - t0, out = (p.dur || 5) - .4;
    css($('#co' + i), { opacity: clamp(d / .15) * (1 - seg(t, out, out + .3)) });
    css($('#cr' + i), { transform: `scale(${1 + .5 * ((d * 1.2) % 1)})`, opacity: d > 0 ? 1 - ((d * 1.2) % 1) : 0 });
    css($('#cl' + i), { transform: `scaleX(${eo3(seg(d, .1, .45))})` });
    const e = spring(d - .35); css($('#cp' + i), { opacity: clamp((d - .35) / .2), transform: `translateX(${(1 - e) * (it.side === 'left' ? 20 : -20)}px)` });
  })
});

// A/B 对比：两张同尺寸、同裁切的画面并排，上方标签，下方一句结论；winner 亮起
KIT.abCompare = p => ({
  dur: p.dur || 7,
  html: frame(`<div class="abs" style="left:110px;top:70px"><div class="kicker" id="ak">${p.kicker || ''}</div><div class="h2" style="margin-top:8px" id="at">${p.title || ''}</div></div>
    ${[p.a, p.b].map((x, i) => `<div class="abs" id="ab${i}" style="left:${110 + i * 870}px;top:${p.title ? 260 : 150}px;width:830px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px"><span class="pill${i === p.winner ? ' on' : ''}" id="ap${i}" style="font-size:28px;color:var(--fg)">${x.label}</span><span class="en">${x.en || ''}</span></div>
      <div class="tile" id="af${i}" style="width:830px;height:${p.title ? 425 : 520}px;border-radius:28px;padding:0"><img src="${x.image}" style="width:100%;height:100%;object-fit:cover;object-position:${x.pos || 'center'}">
      ${x.note ? `<div class="abs" style="left:0;right:0;bottom:0;padding:60px 30px 22px;background:linear-gradient(transparent,rgba(0,0,0,.72));font-size:34px;font-weight:700">${x.note}</div>` : ''}</div></div>`).join('')}
    ${p.verdict ? `<div class="abs h3" id="av" style="left:0;right:0;top:${p.title ? 782 : 770}px;text-align:center;font-size:52px">${p.verdict}</div>` : ''}`),
  render: t => {
    enter($('#ak'), t, .2); enter($('#at'), t, .35);
    [0, 1].forEach(i => { enter($('#ab' + i), t, .5 + i * .25, { dy: 40 }); });
    if (p.winner != null) { const d = t - (p.winnerT || 3), el = $('#af' + p.winner); el.className = 'tile' + (d >= 0 ? ' on' : ''); css($('#af' + (1 - p.winner)), { filter: `brightness(${d >= 0 ? lerp(1, .55, eo3(d / .5)) : 1})` }); }
    if ($('#av')) enter($('#av'), t, p.verdictT || 4);
    frameRender(t, [[0, { s: 1.03, x: 0, y: 0, rx: 2, ry: -3 }], [p.dur || 7, { s: 1, x: 0, y: 0, rx: 0, ry: 0 }]]);
  }
});

// 报告引用：叠在实拍或录屏上，不切走画面。左下角书名号标题 + 一两行数据，停在字幕带之上（透明叠加层）
KIT.citationOverlay = p => ({
  dur: p.dur || 5, overlay: true,
  html: frame(`<div class="abs" id="qo" style="left:${p.x || 110}px;bottom:${1080 - TOKENS.safe.captionTop + 30}px;max-width:1300px;padding:26px 34px 26px 40px;border-left:6px solid var(--accent);background:linear-gradient(90deg,rgba(10,10,14,.82),rgba(10,10,14,.45) 80%,transparent);border-radius:0 20px 20px 0">
    <div style="font-size:44px;font-weight:800">《${p.title}》</div>
    ${(p.lines || []).map((l, i) => `<div id="ql${i}" style="font-size:32px;font-weight:600;color:var(--fg2);margin-top:12px">${l}</div>`).join('')}</div>`, { overlay: true }),
  render: t => {
    const out = (p.dur || 5) - .45; enter($('#qo'), t, .1, { dy: 0, out });
    css($('#qo'), { transform: `translateX(${(1 - spring(t - .1)) * -40}px)` });
    (p.lines || []).forEach((l, i) => css($('#ql' + i), { opacity: clamp((t - .5 - i * .3) / .3) }));
  }
});

// 真实截图：整页一眼 → 镜头推到口播说到的那一行 → 高亮扫过、其余压暗、圈出数字 → 旁边贴中文翻译标签；讲下一行就移过去再画一次。
// 坐标都是截图原图像素。steps[{t, box:[x,y,w,h], cell?, focus?, s?, hold?, label, en, value, unit, sub, note, tone, tagX?, tagY?}]
// 图表这类高的框，标签默认位置会出画，用 tagX / tagY（屏幕像素）把标签放到空处；p.win 控制窗口上下留多少，
// 某一步的 win:[x,y,w,h] 直接指定窗口（图表、目录要整张露出，只靠高亮压暗突出那一处）
// label 写中文名，en 写原文名，note 写观众可能看不懂的地方（括号是负数、单位、口径、这一行是什么意思）
// col 是钉在目标格上方的列名（表头推出画面后观众仍知道是哪一列，如“2026 年 1–6 月”）
// hold：和上一步同一个机位，只换高亮；startStep：不露整页，直接从这一步的机位开场（接在另一段后面时用）
// 推近后只留目标行上下 win 像素（默认 220，约 7 行）的窗口，其余压成深色背景，像一张卡片
KIT.docZoom = p => {
  const st = p.steps, dur = p.dur || 10, A = { x: 960, y: p.anchorY || 450 };
  const V = i => {
    if (i < 0) return { s: p.fit || 1000 / p.ih, cx: p.iw / 2, cy: p.ih / 2, ay: 540, r: -2.5 };
    const f = st[i].focus || st[i].box;
    return { s: st[i].s || p.s || 1.32, cx: f[0] + f[2] / 2, cy: f[1] + f[3] / 2, ay: A.y, r: 0 };
  };
  const keys = [];
  if (p.startStep != null) keys.push([0, { ...V(p.startStep), s: V(p.startStep).s * .9 }]);
  else keys.push([0, { ...V(-1), s: V(-1).s * .94 }], [p.pageT || .9, V(-1)]);
  let last = keys[keys.length - 1][1];
  st.forEach((s, i) => {
    if (s.hold && i) return;
    const v = V(i), t0 = Math.max(keys[keys.length - 1][0] + .01, s.t - .75);
    keys.push([t0, last], [Math.max(t0 + .3, s.t - .05), v]);
    const nx = st.slice(i + 1).find(x => !x.hold), tEnd = nx ? nx.t - .75 : dur;
    last = { ...v, s: v.s * (1 + Math.min(.02, .004 * (tEnd - s.t))) };
    keys.push([tEnd, last]);
  });
  const tone = s => s.tone === 'accent' ? ['var(--accent)', 'rgba(10,132,255,.30)'] : s.tone === 'bad' ? ['var(--bad)', 'rgba(255,69,58,.26)'] : ['var(--signal)', 'rgba(255,194,74,.34)'];
  return {
    dur,
    html: frame(`<div class="abs" id="dz" style="left:0;top:0;width:${p.iw}px;height:${p.ih}px;transform-origin:0 0">
        <img src="${p.image}" style="position:absolute;inset:0;width:${p.iw}px;height:${p.ih}px;border-radius:8px;box-shadow:0 50px 140px rgba(0,0,0,.65)">
        <div class="abs" id="dwin" style="left:0;top:0;width:10px;height:10px;border-radius:18px;opacity:0;box-shadow:0 0 0 6000px #0c0c10,0 0 0 6002px rgba(255,255,255,.14),0 40px 120px 6000px rgba(0,0,0,.5)"></div>
        ${st.map((s, i) => { const [x, y, w, h] = s.box, c = tone(s); return `<div class="abs" id="db${i}" style="left:${x - 10}px;top:${y - 6}px;width:${w + 20}px;height:${h + 12}px;border-radius:8px">
          <i class="abs" id="dbs${i}" style="left:0;top:0;bottom:0;width:0;border-radius:8px;background:${c[1]}"></i>
          <i class="abs" id="dbo${i}" style="inset:0;border-radius:8px;border:3px solid ${c[0]};opacity:0"></i></div>
          ${s.cell ? `<i class="abs" id="dc${i}" style="left:${s.cell[0] - 8}px;top:${s.cell[1] - 8}px;width:${s.cell[2] + 16}px;height:${s.cell[3] + 16}px;border-radius:12px;border:4px solid ${c[0]};box-shadow:0 0 24px ${c[1]};opacity:0"></i>` : ''}`; }).join('')}
      </div>
      ${st.map((s, i) => s.col ? `<div class="abs" id="dk${i}" style="left:0;top:0;padding:3px 12px;border-radius:10px;background:${tone(s)[0]};color:#111;font-size:24px;font-weight:800;box-shadow:0 6px 18px rgba(0,0,0,.45);white-space:nowrap;opacity:0">${s.col}</div>` : '').join('')}
      ${st.map((s, i) => s.label ? `<div class="abs" id="dt${i}" style="left:0;top:0;padding:22px 32px 24px;border-radius:26px;background:#141418;border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 80px rgba(0,0,0,.6);white-space:nowrap;opacity:0">
        <div style="display:flex;align-items:baseline;gap:18px"><span class="h3">${s.label}</span>${s.en ? `<span style="font-size:${TOKENS.type.label}px;font-weight:600;color:var(--fg2)">${s.en}</span>` : ''}</div>
        ${s.value ? `<div style="margin-top:12px;display:flex;align-items:baseline;gap:12px"><span class="num" style="font-size:${TOKENS.type.h1}px;color:${tone(s)[0]}">${s.value}</span><span class="h3">${s.unit || ''}</span><span style="font-size:${TOKENS.type.label}px;font-weight:600;color:var(--fg2);margin-left:10px">${s.sub || ''}</span></div>` : ''}
        ${s.note ? `<div style="margin-top:12px;font-size:${TOKENS.type.label}px;font-weight:600;color:var(--fg);white-space:normal;max-width:${s.noteW || 980}px;line-height:1.45">${s.note}</div>` : ''}</div>` : '').join('')}
      <div class="abs" style="left:110px;top:44px"><span class="pill" id="dsrc" style="font-size:26px;color:var(--fg2);background:rgba(10,10,14,.7)">来源：${p.source}</span></div>`),
    render: t => {
      const c = camAt(keys, t);
      css($('#dz'), { transform: `translate(${A.x}px,${c.ay}px) rotate(${c.r}deg) scale(${c.s}) translate(${-c.cx}px,${-c.cy}px)` });
      let cur = -1; st.forEach((s, i) => { if (t >= s.t) cur = i; });
      const pad = p.win ?? 220, W = i => { const b = st[i].box; return st[i].win || [b[0] - 34, b[1] - pad, b[2] + 68, b[3] + 2 * pad]; };
      let wi = -1; st.forEach((s, i) => { if (t >= s.t - .75) wi = i; });
      if (p.startStep != null && wi < 0) wi = p.startStep;
      if (wi >= 0) {
        const from = wi > 0 ? W(wi - 1) : W(wi), k = wi > 0 ? eio3(seg(t, st[wi].t - .75, st[wi].t - .05)) : 1, r = W(wi).map((v, j) => lerp(from[j], v, k));
        const s0 = V(-1).s, s1 = V(0).s, show = p.startStep != null ? 1 : eo3(clamp((c.s - s0) / (s1 - s0) * 1.25 - .25));
        css($('#dwin'), { left: `${r[0]}px`, top: `${r[1]}px`, width: `${r[2]}px`, height: `${r[3]}px`, opacity: show });
      }
      st.forEach((s, i) => {
        const d = t - s.t, on = i === cur, k = eo3(seg(d, 0, .45)), same = cur >= 0 && st[cur].box === s.box;
        css($('#dbs' + i), { width: `${100 * k}%`, opacity: on ? 1 : d >= 0 && same ? .35 : 0 });
        css($('#dbo' + i), { opacity: on ? eo3(seg(d, .35, .6)) : 0 });
        css($('#db' + i), { boxShadow: on ? `0 0 0 4000px rgba(6,6,10,${.5 * (i > 0 ? 1 : eo3(seg(d, 0, .4)))})` : 'none' });
        if ($('#dc' + i)) css($('#dc' + i), { opacity: on ? seg(d, .35, .5) : 0, transform: `scale(${on ? 1.25 - .25 * eo3(seg(d, .35, .7)) : 1})` });
        const pin = $('#dk' + i);
        if (pin) {
          const cl = s.cell || s.box, nx2 = st[i + 1], o2 = clamp((d - .2) / .25) * (nx2 && !nx2.hold ? 1 - seg(t, nx2.t - .35, nx2.t - .1) : nx2 ? 1 - seg(t, nx2.t - .1, nx2.t) : 1);
          css(pin, { opacity: o2, left: `${Math.min(1800 - pin.offsetWidth, A.x + c.s * (cl[0] + cl[2] / 2 - c.cx) - pin.offsetWidth / 2)}px`, top: `${c.ay + c.s * (cl[1] - c.cy) - pin.offsetHeight - 8}px` });
        }
        const tg = $('#dt' + i);
        if (tg) {
          const [x, y, w, h] = s.box, sx = A.x + c.s * (x - c.cx), sy = c.ay + c.s * (y + h - c.cy);
          const nx = st[i + 1], out = nx ? (nx.hold ? nx.t - .1 : nx.t - .55) : dur - .3;
          const o = clamp((d - .4) / .3) * (1 - seg(t, out - .25, out)), e = spring(d - .4);
          const above = s.above || sy + 30 + tg.offsetHeight > TOKENS.safe.captionTop - 20;
          const ty = s.tagY ?? (above ? c.ay + c.s * (y - c.cy) - 30 - tg.offsetHeight : sy + 30);
          css(tg, { opacity: o, left: `${clamp(s.tagX ?? sx, 110, 1810 - tg.offsetWidth)}px`, top: `${ty}px`, transform: `translateY(${(1 - e) * (above ? -18 : 18)}px)` });
        }
      });
      enter($('#dsrc'), t, .3);
      frameRender(t, [[0, { s: .98, x: 0, y: 0, rx: 4, ry: -5 }], [dur, { s: 1, x: 0, y: 0, rx: 2, ry: -3 }]]);
    }
  };
};

// 拆分条：一个总数拆成几块，哪块大一眼看出。可当一章的主线反复回来。parts 按条上从左到右的顺序
// parts[{label,value,display,sub,tone:'sig'|'accent'|'dim',t,inside}]；focus[[t,i]] 让某块亮、其余暗；thumb 放一张原表小图做证据角标
// notes[[t,'一句话']]：标题下的一行，回到拆分条时说清“刚讲完的是哪块、意味着什么”，后一句替换前一句
KIT.splitBar = p => {
  const W = 1480, L = 120, Y = 350, H = 140, tot = p.parts.reduce((a, x) => a + x.value, 0);
  let acc = 0; const geo = p.parts.map(x => { const w = Math.max(10, W * x.value / tot), g = { x: L + acc, w }; acc += w; return g; });
  const col = x => x.tone === 'sig' ? 'linear-gradient(180deg,#ffd27a,#e9a62c)' : x.tone === 'accent' ? 'linear-gradient(180deg,#4da3ff,#0a6fd6)' : 'rgba(255,255,255,.16)';
  return {
    dur: p.dur || 8,
    html: frame(`<div class="panel">
      <div class="abs" style="left:80px;top:60px"><div class="kicker" id="pk">${p.kicker || ''}</div><div class="h2" style="margin-top:8px" id="ph">${p.title}</div></div>
      ${(p.notes || []).map(([, x], k) => `<div class="abs" id="pn${k}" style="left:80px;top:196px;max-width:1300px;font-size:36px;font-weight:700;color:var(--signal);white-space:nowrap;opacity:0">${x}</div>`).join('')}
      ${p.thumb ? `<div class="abs" id="pth" style="right:80px;top:28px;width:176px;transform:rotate(3deg)"><img src="${p.thumb}" style="width:176px;border-radius:8px;box-shadow:0 20px 50px rgba(0,0,0,.5)"><div class="dim" style="font-size:24px;margin-top:10px;text-align:center;white-space:nowrap">${p.thumbLabel || ''}</div></div>` : ''}
      <div class="abs" id="ptl" style="left:${L}px;top:${Y - 70}px;white-space:nowrap"><span class="kicker">${p.total.label}</span><span class="num" style="font-size:${TOKENS.type.h3}px;margin-left:16px">${p.total.display}</span></div>
      <div class="abs" id="pfr" style="left:${L - 6}px;top:${Y - 6}px;width:${W + 12}px;height:${H + 12}px;border-radius:30px;border:2px dashed rgba(255,255,255,.28)"></div>
      ${p.parts.map((x, i) => `<div class="abs" id="pp${i}" style="left:${geo[i].x}px;top:${Y}px;width:${geo[i].w}px;height:${H}px;background:${col(x)};border-radius:${i === 0 ? '24px 0 0 24px' : i === p.parts.length - 1 ? '0 24px 24px 0' : '0'};transform-origin:left;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${x.inside ? `<span class="num" style="font-size:${TOKENS.type.h2}px;color:#1a1200">${x.inside}</span>` : ''}</div>
        <div class="abs" id="pln${i}" style="left:${geo[i].x + geo[i].w / 2 - 1}px;top:${Y + H + 8}px;width:2px;height:${x.lead || 46}px;background:rgba(255,255,255,.4);transform-origin:top"></div>
        <div class="abs" id="pl${i}" style="left:${x.labelX ?? geo[i].x + geo[i].w / 2}px;top:${Y + H + 12 + (x.lead || 46)}px;transform:translateX(${x.align === 'left' ? '0' : x.align === 'right' ? '-100%' : '-50%'});text-align:${x.align || 'center'};white-space:nowrap">
          <div class="kicker">${x.label}</div><div class="num" style="font-size:${TOKENS.type.h2}px;margin-top:8px;color:${x.tone === 'sig' ? 'var(--signal)' : 'var(--fg)'}">${x.display}</div>
          ${x.sub ? `<div style="font-size:${TOKENS.type.label}px;font-weight:600;color:var(--fg2);margin-top:8px">${x.sub}</div>` : ''}</div>`).join('')}
      ${p.source ? `<div class="abs dim" style="left:80px;top:730px;font-size:24px" id="psrc">来源：${p.source}</div>` : ''}
    </div>`),
    render: t => {
      enter($('#pk'), t, .2); enter($('#ph'), t, .35); enter($('#ptl'), t, .6); if ($('#pth')) enter($('#pth'), t, .8); if ($('#psrc')) enter($('#psrc'), t, 1);
      css($('#pfr'), { opacity: clamp((t - .5) / .3) });
      (p.notes || []).forEach(([tn], k) => { const nx = (p.notes[k + 1] || [Infinity])[0]; enter($('#pn' + k), t, tn, { dy: 16, out: nx - .3, outDur: .3 }); });
      const f = at(p.focus || [], t, -1), fd = since(p.focus || [], t);
      p.parts.forEach((x, i) => {
        const d = t - x.t, on = f === i, dim = f >= 0 && !on;
        css($('#pp' + i), { transform: `scaleX(${eo3(seg(d, 0, .7))}) scaleY(${on ? 1 + .08 * eo3(fd / .4) : 1})`, opacity: dim ? .4 : 1, boxShadow: on ? '0 0 80px rgba(255,194,74,.45)' : 'none' });
        css($('#pln' + i), { transform: `scaleY(${eo3(seg(d, .5, .8))})`, opacity: dim ? .3 : 1 });
        const e = spring(d - .6); css($('#pl' + i), { opacity: clamp((d - .6) / .3) * (dim ? .45 : 1) });
        $('#pl' + i).style.marginTop = `${(1 - e) * 20}px`;
      });
      frameRender(t, introKeys(0, p.dur || 8));
    }
  };
};

// 侧边导航（叠加层）：几个并列项竖排在人物一侧，讲到哪项亮哪项并展开一句解释；可整组划掉；show 控制出现的时段
// items[{label,en,sub,note,noteT}]，active[[t,i]] 或 [t,i,'sig']，off[[t,[i...],'为什么划掉']]（offEnd 时收起理由），show[[a,b],...]
KIT.sideNav = p => ({
  dur: p.dur || 10, overlay: true,
  html: frame(`<div class="abs" id="sv" style="left:${p.x ?? 80}px;top:${p.y ?? 100}px;width:${p.w || 640}px;padding:30px 26px 22px;border-radius:34px;background:rgba(12,12,16,.82);border:1px solid rgba(255,255,255,.10);box-shadow:0 30px 90px rgba(0,0,0,.45)">
    <div class="kicker" style="padding-left:12px">${p.title}</div>
    ${p.head ? `<div style="padding:8px 12px 0;font-size:48px;font-weight:800;line-height:1.25">${p.head}</div>` : ''}
    ${p.items.map((it, i) => `<div id="si${i}" style="position:relative;margin-top:${i ? 8 : 16}px;padding:14px 22px;border-radius:22px;border:2px solid transparent">
      <div style="display:flex;align-items:baseline;gap:16px;white-space:nowrap"><span class="num" id="sn${i}" style="font-size:30px;color:var(--fg3)">${i + 1}</span>
        <span id="sl${i}" style="font-size:44px;font-weight:800">${it.label}</span><span class="num" id="se${i}" style="font-size:36px;color:var(--fg2);margin-left:auto">${it.en || ''}</span></div>
      <div id="sd${i}" style="overflow:hidden;height:0"><div style="padding:12px 0 2px 46px">
        ${it.sub ? `<div style="font-size:34px;font-weight:700">${it.sub}</div>` : ''}${it.note ? `<div id="snw${i}" style="overflow:hidden;height:0"><div id="snt${i}" style="font-size:${TOKENS.type.label}px;font-weight:600;color:var(--fg2);padding-top:8px;white-space:normal">${it.note}</div></div>` : ''}</div></div>
      <i id="sx${i}" style="position:absolute;left:14px;right:14px;top:37px;height:4px;border-radius:2px;background:var(--bad);transform-origin:left;transform:scaleX(0)"></i></div>`).join('')}
    ${(p.off || []).map((o, k) => o[2] ? `<div id="so${k}" style="overflow:hidden;height:0"><div style="padding:14px 22px 4px;font-size:${TOKENS.type.label}px;font-weight:700;color:var(--fg);line-height:1.45">${o[2]}</div></div>` : '').join('')}
  </div>`, { overlay: true }),
  render: t => {
    const vis = Math.max(0, ...(p.show || [[0, p.dur || 10]]).map(([a, b]) => clamp((t - a) / .35) * (1 - seg(t, b - .35, b))));
    css($('#sv'), { opacity: vis, transform: `translateX(${(1 - eo3(vis)) * -40}px)` });
    const act = (p.active || []).filter(a => t >= a[0]).pop(), cur = act ? act[1] : -1, ad = act ? t - act[0] : 0, sig = act && act[2] === 'sig';
    const offs = (p.off || []).filter(o => t >= o[0]);
    (p.off || []).forEach((o, k) => { const el = $('#so' + k); if (el) { const pend = p.offEnd ?? 1e9, kk = eo3((t - o[0] - .5) / .45) * (1 - seg(t, pend, pend + .4)); css(el, { height: `${el.firstElementChild.offsetHeight * kk}px`, opacity: kk }); } });
    p.items.forEach((it, i) => {
      const on = i === cur, el = $('#si' + i), k = on ? eo3(ad / .4) : 0, c = sig ? '255,194,74' : '10,132,255';
      css(el, { background: on ? `linear-gradient(160deg,rgba(${c},${.55 * k}),rgba(${c},${.12 * k}) 70%)` : 'transparent', borderColor: on ? `rgba(${sig ? '255,214,140' : '130,185,255'},${.85 * k})` : 'transparent', boxShadow: on ? `0 0 60px rgba(${c},${.3 * k})` : 'none' });
      const struck = offs.find(o => o[1].includes(i)), sd = struck ? t - struck[0] - struck[1].indexOf(i) * .12 : -1;
      css($('#sx' + i), { transform: `scaleX(${eo3(seg(sd, 0, .35))})` });
      css(el, { opacity: struck && !on ? lerp(1, .42, eo3(seg(sd, .2, .6))) : 1 });
      css($('#sn' + i), { color: on ? '#fff' : 'var(--fg3)' }); css($('#se' + i), { color: on ? '#fff' : 'var(--fg2)' });
      if ($('#snt' + i)) { const k = eo3((t - (it.noteT ?? -1)) / .45); css($('#snw' + i), { height: `${$('#snt' + i).offsetHeight * k}px` }); css($('#snt' + i), { opacity: k }); }
      const inner = $('#sd' + i).firstElementChild; css($('#sd' + i), { height: `${on ? inner.offsetHeight * eo3(ad / .45) : 0}px`, opacity: on ? 1 : 0 });
    });
  }
});

// 名牌：第三方第一次出现时，标身份和名字；细线先画出来再出字（透明叠加层）
KIT.lowerThird = p => ({
  dur: p.dur || 4, overlay: true,
  html: frame(`<div class="abs" id="lo" style="left:${p.x ?? 1240}px;top:${p.y ?? 560}px;text-shadow:0 4px 28px rgba(0,0,0,.75),0 1px 3px rgba(0,0,0,.6)">
    <div id="lrole" style="font-size:34px;font-weight:700;color:var(--fg)">${p.role}</div>
    <div id="lline" style="height:3px;width:${p.w || 360}px;background:var(--fg);box-shadow:0 2px 12px rgba(0,0,0,.6);margin:14px 0;transform-origin:left"></div>
    <div id="lname" style="font-size:84px;font-weight:900;letter-spacing:.04em;line-height:1">${p.name}</div>
    ${p.sub ? `<div class="en" style="margin-top:12px" id="lsub">${p.sub}</div>` : ''}</div>`, { overlay: true }),
  render: t => {
    const out = (p.dur || 4) - .4, o = 1 - seg(t, out, out + .3);
    css($('#lline'), { transform: `scaleX(${eo3(seg(t, .1, .5))})`, opacity: o });
    css($('#lrole'), { opacity: clamp((t - .35) / .25) * o, transform: `translateY(${(1 - spring(t - .35)) * 16}px)` });
    css($('#lname'), { opacity: clamp((t - .45) / .25) * o, transform: `translateY(${(1 - spring(t - .45)) * -16}px)` });
    if ($('#lsub')) css($('#lsub'), { opacity: clamp((t - .7) / .3) * o });
  }
});

// 词墙：口播快速列举一串词时，每个词先在中间砸出来，下一个词出现时退到墙上的位置；
// 列完后墙压暗，收束成一个大标题。terms[{text,t}]，title/kicker/titleT 可选
KIT.wordWall = p => {
  const n = p.terms.length, cols = p.cols || (n > 8 ? 4 : 3), rows = Math.ceil(n / cols), cw = 1500 / cols, rh = Math.min(110, 330 / rows), CY = 640;
  const slot = i => ({ x: 210 + (i % cols) * cw + cw / 2, y: 150 + Math.floor(i / cols) * rh + rh / 2 });
  return {
    dur: p.dur || 10,
    html: frame(`<div class="panel"></div>
      ${p.terms.map((w, i) => `<div class="abs" id="ww${i}" style="left:${slot(i).x}px;top:${slot(i).y}px;transform:translate(-50%,-50%)"><span id="wt${i}" style="display:inline-block;font-size:64px;font-weight:800;white-space:nowrap">${w.text}</span></div>`).join('')}
      ${p.spreadT != null ? Array.from({ length: 36 }, (_, j) => { const r = k => (Math.sin(j * 12.9898 + k * 78.233) * 43758.5453) % 1, x = 180 + Math.abs(r(1)) * 1500, y = 150 + Math.ceil(n / cols) * rh + 40 + Math.abs(r(2)) * (580 - Math.ceil(n / cols) * rh); return `<span class="abs ws" style="left:${x}px;top:${y}px;font-size:${28 + Math.abs(r(3)) * 26}px;font-weight:700;white-space:nowrap;opacity:0;transform:translate(-50%,-50%) rotate(${(r(4) * 16).toFixed(1)}deg)">${p.terms[j % n].text}</span>`; }).join('') : ''}
      ${p.title ? `<div class="abs" id="wk" style="left:0;right:0;top:300px;text-align:center"><span class="kicker" style="font-size:44px">${p.kicker || ''}</span></div>
      <div class="abs" id="wh" style="left:0;right:0;top:380px;text-align:center;font-size:${TOKENS.type.display}px;font-weight:900;letter-spacing:.02em;line-height:1">${p.title}</div>` : ''}`),
    render: t => {
      const tt = p.titleT ?? Infinity, out = seg(t, tt - .2, tt + .5);
      p.terms.forEach((w, i) => {
        const nx = i < n - 1 ? p.terms[i + 1].t : w.t + .9, d = t - w.t, s0 = slot(i);
        const k = eio3(seg(t, Math.min(nx, w.t + .9) - .02, Math.min(nx, w.t + .9) + .22)), pop = spring(d - .1, 260, 18);
        const cur = d >= .1 && k < 1, sc = lerp(2.3, 1, k) * (cur ? .7 + .3 * pop : 1);
        // 上一个词先让开 0.1 秒，再出现下一个，中间不重叠
        css($('#ww' + i), { opacity: clamp((d - .1) / .08) * lerp(1, .15, out), transform: `translate(-50%,-50%) translate(${(960 - s0.x) * (1 - k)}px,${(CY - s0.y) * (1 - k)}px) scale(${sc})`, zIndex: cur ? 5 : 1, filter: out > 0 ? `blur(${out * 3}px)` : 'none' });
        css($('#wt' + i), { color: cur ? 'var(--signal)' : k >= 1 ? 'var(--fg2)' : 'var(--fg)' });
      });
      $$('.ws').forEach((el, j) => { const d = t - p.spreadT - j * .12; css(el, { opacity: clamp(d / .2) * .26 * (1 - out * .8), color: j % 7 ? 'var(--fg2)' : 'var(--signal)' }); });
      if (p.title) { enter($('#wk'), t, tt); const e = enter($('#wh'), t, tt + .15, { dy: 50 }); css($('#wh'), { transform: `translateY(${(1 - e) * 50}px) scale(${.9 + .1 * e})` }); }
      frameRender(t, introKeys(0, p.dur || 10));
    }
  };
};

// ---------- 从影视飓风拆解补的组件（2026-10-28） ----------
const ICON = {
  source: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>`,
  replay: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v5h5"/></svg>`,
  person: `<svg viewBox="0 0 100 100" width="100%" height="100%"><defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf2ff"/><stop offset="1" stop-color="#6fa8ff"/></linearGradient></defs>
    <circle cx="50" cy="34" r="17" fill="url(#pg)" opacity=".95"/><path d="M18 88c2-20 15-31 32-31s30 11 32 31z" fill="url(#pg)" opacity=".85"/></svg>`,
};
// 外来素材的角标：放大镜 + 出处（《片名》、“新闻素材 · 路透社”、“招股书 S-1”）
const sourceTag = (text, sub) => `<div class="abs" id="sft" style="display:flex;align-items:center;gap:12px;padding:10px 24px 10px 16px;border-radius:14px;background:rgba(14,14,18,.9);border:1px solid rgba(255,255,255,.16);box-shadow:0 14px 40px rgba(0,0,0,.5);white-space:nowrap">
  <span style="color:var(--accent);display:flex">${ICON.source}</span><span style="font-size:30px;font-weight:800">${text}</span>${sub ? `<span style="font-size:24px;font-weight:600;color:var(--fg2)">${sub}</span>` : ''}</div>`;

// 外来素材框：别处来的视频或照片缩进一个窗口，四周压暗，左上角挂出处，和自己的录屏一眼分开。
// 视频：不给 image，输出透明叠加层（窗口处挖空），在 ChatCut 里把片段缩放到 win 的位置放在它下面；
//   backdrop 可给一张片段截图做四周的模糊底。窗口位置写在 window.WIN。previewClip 只在 gallery 预览时给，代替片段垫在窗口里
// 照片 / 截图：给 image，输出整屏 mp4，四周是同一张图的模糊底，窗口里慢慢推近。要指某一行时改用 docZoom。
KIT.sourceFrame = p => {
  const [x, y, w, h] = p.win || [256, 58, 1408, 792], r = 18, video = !p.image;
  const hole = `M0 0H1920V1080H0Z M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  const back = p.image || p.backdrop;
  return {
    dur: p.dur || 6, overlay: video, win: [x, y, w, h],
    html: `<div class="abs" style="inset:0;${video ? `clip-path:path(evenodd,'${hole}');` : ''}background:#0b0b0e;overflow:hidden">
        ${back ? `<img class="abs" src="${back}" style="inset:-60px;width:2040px;height:1200px;object-fit:cover;filter:blur(36px) brightness(.38) saturate(.8)">` : `<div class="grid" style="opacity:.8"></div>`}
        <div class="abs" style="inset:0;background:radial-gradient(1200px 760px at 50% 48%,transparent 40%,rgba(0,0,0,.55))"></div></div>
      ${p.previewClip ? `<img class="abs" src="${p.previewClip}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;object-fit:cover;z-index:-1">` : ''}
      ${video ? '' : `<div class="abs" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${r}px;overflow:hidden"><img id="sfi" src="${p.image}" style="width:100%;height:100%;object-fit:${p.fit || 'cover'};object-position:${p.pos || 'center'};transform-origin:${p.origin || 'center'}"></div>`}
      <div class="abs" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${r}px;border:2px solid rgba(255,255,255,.22);box-shadow:0 30px 90px rgba(0,0,0,.6)"></div>
      <div class="abs" style="left:${x - 14}px;top:${y - 24}px">${sourceTag(p.source, p.sub)}</div>`,
    render: t => {
      const e = spring(t - .15);
      css($('#sft'), { opacity: clamp((t - .15) / .2), transform: `translateX(${(1 - e) * -24}px)` });
      if ($('#sfi')) css($('#sfi'), { transform: `scale(${1 + (p.push ?? .05) * eio3(t / (p.dur || 6))})` });
    }
  };
};

// 回放标签：录屏或实拍里关键的那一下先按原速放完，再重放时挂上（透明叠加层）。
// 左上角“回放 · 0.5×”，顶部一条进度线，四角取景框提示“现在是回放”；pip 给一个白边小窗，放自己看回放的反应（小窗里的画面在 ChatCut 里放）。
KIT.replayTag = p => {
  const pip = p.pip === true ? { x: 1440, y: 590, w: 420, h: 236 } : p.pip, B = 54, L = 70;
  const corner = (cx, cy, sx, sy) => `<path d="M${cx} ${cy + sy * L}V${cy}H${cx + sx * L}" />`;
  return {
    dur: p.dur || 5, overlay: true, pip,
    html: frame(`<svg class="abs" id="rbk" width="1920" height="1080" style="left:0;top:0;filter:drop-shadow(0 0 6px rgba(0,0,0,.7))" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round">
        ${corner(B, B, 1, 1)}${corner(1920 - B, B, -1, 1)}${corner(B, TOKENS.safe.captionTop - 20, 1, -1)}${corner(1920 - B, TOKENS.safe.captionTop - 20, -1, -1)}</svg>
      <div class="abs" id="rtg" style="left:${B + 30}px;top:${B + 22}px;display:flex;align-items:center;gap:12px;padding:10px 26px 10px 18px;border-radius:14px;background:rgba(14,14,18,.88);border:1px solid rgba(255,255,255,.16);white-space:nowrap">
        <span style="color:var(--accent);display:flex" id="rti">${ICON.replay}</span><span style="font-size:34px;font-weight:800">${p.label || '回放'}</span>
        ${p.speed ? `<span class="num" style="font-size:34px;color:var(--accent)">${p.speed}</span>` : ''}<span class="en" style="margin-left:6px">${p.en || 'Replay'}</span></div>
      <div class="abs" style="left:${B + 30}px;top:${B + 96}px;width:${p.barW || 360}px;height:5px;border-radius:3px;background:rgba(255,255,255,.18)"><i class="abs" id="rbar" style="left:0;top:0;bottom:0;border-radius:3px;background:var(--accent);width:0"></i></div>
      ${pip ? `<div class="abs" id="rpip" style="left:${pip.x}px;top:${pip.y}px;width:${pip.w}px;height:${pip.h}px;border-radius:16px;border:6px solid #fff;box-shadow:0 20px 60px rgba(0,0,0,.55)">
        ${p.pipLabel ? `<div class="abs" style="left:-6px;bottom:${pip.h + 4}px;padding:6px 16px;border-radius:10px;background:#fff;color:#111;font-size:26px;font-weight:800;white-space:nowrap">${p.pipLabel}</div>` : ''}</div>` : ''}`, { overlay: true }),
    render: t => {
      const D = p.dur || 5, out = D - .3, o = 1 - seg(t, out, out + .25);
      css($('#rbk'), { opacity: clamp(t / .15) * o, transform: `scale(${1.03 - .03 * eo3(seg(t, 0, .35))})`, transformOrigin: '960px 470px' });
      const e = spring(t - .1); css($('#rtg'), { opacity: clamp((t - .1) / .2) * o, transform: `translateX(${(1 - e) * -24}px)` });
      css($('#rti'), { transform: `rotate(${-360 * eo3(seg(t, .1, .9))}deg)` });
      css($('#rbar'), { width: `${100 * clamp(t / D)}%`, opacity: o });
      if ($('#rpip')) { const ep = spring(t - .3); css($('#rpip'), { opacity: clamp((t - .3) / .2) * o, transform: `scale(${.9 + .1 * ep})` }); }
    }
  };
};

// 段落标签：整段挂在画面上，告诉观众现在是第几种情况、第几把剑（透明叠加层）。
// kicker 是编号（“情景一”“第 2 把剑”），text 是这一段讲什么；step:[当前, 总数] 时右边画进度点
KIT.sectionTag = p => {
  const [cur, n] = p.step || [];
  return {
    dur: p.dur || 12, overlay: true,
    html: frame(`<div class="abs" id="stg" style="${p.center ? 'left:50%;' : `left:${p.x ?? 80}px;`}top:${p.y ?? 64}px;display:flex;align-items:center;gap:18px;padding:12px 30px 12px 12px;border-radius:20px;background:rgba(14,14,18,.72);border:1px solid rgba(255,255,255,.16);box-shadow:0 16px 50px rgba(0,0,0,.4);white-space:nowrap">
      <span id="stk" style="padding:8px 18px;border-radius:12px;background:var(--accent);font-size:30px;font-weight:800">${p.kicker}</span>
      <span style="font-size:36px;font-weight:800">${p.text}</span>
      ${n ? `<span style="display:flex;gap:8px;margin-left:8px">${Array.from({ length: n }, (_, i) => `<i style="width:12px;height:12px;border-radius:50%;background:${i === cur - 1 ? 'var(--accent)' : i < cur - 1 ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.18)'}"></i>`).join('')}</span>` : ''}</div>`, { overlay: true }),
    render: t => {
      const out = (p.dur || 12) - .4, e = spring(t - .1), o = clamp((t - .1) / .25) * (1 - seg(t, out, out + .3));
      css($('#stg'), { opacity: o, transform: `${p.center ? 'translateX(-50%) ' : ''}translateX(${(1 - e) * -30}px)` });
      css($('#stk'), { filter: `brightness(${1 + .6 * Math.exp(-5 * Math.max(0, t - .3))})` });
    }
  };
};

// 人后大字：本章关键词第一次出现时，大字放在人物身后（透明叠加层）。一章最多一次。
// ChatCut 里三层：A-roll → 本层 → 同一段 A-roll 加“AI Portrait Cutout”，人就挡在字前面。
// words 一到两个词，gap 是两词之间留给人物的宽度；key 是用信号色的那个词。preview 里的 fg 只在 gallery 预览时给
KIT.backText = p => {
  const ws = p.words, size = p.size || 250, gap = p.gap ?? 300, cx = p.cx ?? 960, y = p.y ?? 300;
  return {
    dur: p.dur || 3.5, overlay: true,
    html: frame(`<div class="abs" style="left:${cx}px;top:${y}px;transform:translateX(-50%);display:flex;gap:${gap}px;white-space:nowrap">
        ${ws.map((w, i) => `<span id="bt${i}" style="display:inline-block;font-size:${size}px;font-weight:900;letter-spacing:.02em;line-height:1;color:${i === p.key ? 'var(--signal)' : '#fff'};text-shadow:0 18px 60px rgba(0,0,0,.45)">${w}</span>`).join('')}</div>
      ${p.fg ? `<img class="abs" src="${p.fg}" style="inset:0;width:1920px;height:1080px">` : ''}`, { overlay: true }),
    render: t => {
      const out = (p.dur || 3.5) - .35;
      ws.forEach((w, i) => {
        const t0 = .05 + i * .14, e = spring(t - t0, 200, 22), drift = (i ? 1 : -1) * 16 * eio3(t / (p.dur || 3.5));
        css($('#bt' + i), { opacity: clamp((t - t0) / .12) * (1 - seg(t, out, out + .3)), transform: `translateX(${drift}px) scale(${1.25 - .25 * e})` });
      });
    }
  };
};

// 角色卡：讲“这一方是谁、想要什么”，几方之间谁给谁什么。roles 1–3 个，每个配一两句对话气泡（它的诉求）；
// links 画相邻两方之间的箭头和一句关系；active 让正在讲的那一方亮起。
// 卡里放真实画面：photo 是真人或现场照片（铺满卡片），image 是 logo（居中）；都没有才用人形占位，成片里不该出现占位
KIT.roleCard = p => {
  const n = p.roles.length, S = n === 1 ? 480 : n === 2 ? 380 : 330, gapX = n === 1 ? 0 : n === 2 ? 440 : 260;
  const total = n * S + (n - 1) * gapX, x0 = 960 - total / 2, top = n === 1 ? 260 : 430;
  const cx = i => x0 + i * (S + gapX) + S / 2;
  const bubblePos = (i, k) => n === 1
    ? [[cx(i) - S / 2 - 40, top + 40, 'right'], [cx(i) + S / 2 + 40, top + S - 130, 'left'], [cx(i) + S / 2 + 40, top + 20, 'left']][k]
    : [cx(i), top - 128 - k * 84, 'down'];
  return {
    dur: p.dur || 8,
    html: frame(`${p.title ? `<div class="abs" style="left:110px;top:70px"><div class="kicker" id="rk">${p.kicker || ''}</div><div class="h2" style="margin-top:8px" id="rh">${p.title}</div></div>` : ''}
      ${(p.links || []).map((l, j) => { const a = Math.min(l.from, l.to), xa = cx(a) + S / 2 + 24, xb = cx(a + 1) - S / 2 - 24, rev = l.from > l.to;
        return `<div class="abs" id="rl${j}" style="left:${xa}px;top:${top + S / 2 - 3}px;width:${xb - xa}px;height:6px">
          <i class="abs" id="rll${j}" style="left:0;right:0;top:0;height:6px;border-radius:3px;background:linear-gradient(90deg,rgba(10,132,255,.25),var(--accent));${rev ? 'transform-origin:right;' : 'transform-origin:left;'}"></i>
          <i class="abs" style="${rev ? 'left:-6px;transform:rotate(180deg)' : 'right:-6px'};top:-11px;width:0;height:0;border-left:22px solid var(--accent);border-top:14px solid transparent;border-bottom:14px solid transparent" id="rla${j}"></i>
          ${l.label ? `<div class="abs" id="rlt${j}" style="left:50%;bottom:22px;transform:translateX(-50%);font-size:30px;font-weight:700;white-space:nowrap;color:var(--fg)">${l.label}</div>` : ''}</div>`; }).join('')}
      ${p.roles.map((r, i) => `<div class="tile abs on" id="rc${i}" style="left:${cx(i) - S / 2}px;top:${top}px;width:${S}px;height:${S}px;border-radius:${S * .2}px;overflow:visible;display:flex;align-items:center;justify-content:center">
          ${r.photo ? `<div class="abs" style="inset:0;border-radius:inherit;overflow:hidden"><img src="${r.photo}" style="width:100%;height:100%;object-fit:cover;object-position:${r.pos || 'center'}"><i class="abs" style="inset:0;background:linear-gradient(180deg,rgba(10,20,40,.35),transparent 35%)"></i></div>`
            : `<div style="width:${S * .58}px;height:${S * .58}px;display:flex;align-items:center;justify-content:center">${r.image ? `<img src="${r.image}" style="max-width:100%;max-height:100%;object-fit:contain">` : ICON.person}</div>`}
          <div class="abs" style="left:${-S * .08}px;top:${-36}px;padding:10px 30px;border-radius:18px;background:linear-gradient(180deg,#3b8cff,#0a5fd6);box-shadow:0 10px 30px rgba(10,132,255,.45);font-size:${n === 1 ? 52 : 44}px;font-weight:900;letter-spacing:.06em;white-space:nowrap">${r.label}</div>
          ${r.en ? `<div class="en abs" style="left:0;right:0;bottom:-48px;text-align:center">${r.en}</div>` : ''}</div>
        ${(r.says || []).map((s, k) => { const [bx, by, side] = bubblePos(i, k);
          const anchor = side === 'right' ? `right:${1920 - bx}px;top:${by}px` : side === 'left' ? `left:${bx}px;top:${by}px` : `left:${bx}px;top:${by}px;transform:translateX(-50%)`;
          return `<div class="abs" style="${anchor}"><div id="rb${i}_${k}" style="position:relative;padding:16px 30px;border-radius:24px;background:#f5f7fb;color:#12151c;font-size:${n === 1 ? 38 : 32}px;font-weight:800;white-space:nowrap;box-shadow:0 18px 50px rgba(0,0,0,.45)">${s.text}
            <i style="position:absolute;width:22px;height:22px;background:#f5f7fb;${side === 'right' ? 'right:-8px;top:50%;margin-top:-11px' : side === 'left' ? 'left:-8px;top:50%;margin-top:-11px' : 'left:50%;margin-left:-11px;bottom:-8px'};transform:rotate(45deg);border-radius:4px"></i></div></div>`; }).join('')}`).join('')}`),
    render: t => {
      if ($('#rk')) { enter($('#rk'), t, .2); enter($('#rh'), t, .35); }
      const act = at(p.active || [], t, -1), ad = since(p.active || [], t);
      p.roles.forEach((r, i) => {
        const t0 = r.t ?? (.4 + i * .25), e = spring(t - t0), on = act === i, el = $('#rc' + i);
        el.className = 'tile abs ' + (on ? 'sig' : 'on');
        const fx = on ? stateFx('sig', ad) : { pop: 1, flash: 1, z: 0 };
        css(el, { opacity: clamp((t - t0) / .3) * (act >= 0 && !on ? .45 : 1), transform: `translateZ(${fx.z}px) translateY(${(1 - e) * 40}px) scale(${(.92 + .08 * e) * fx.pop})`, filter: `brightness(${fx.flash})` });
        (r.says || []).forEach((s, k) => {
          const d = t - (s.t ?? t0 + .6 + k * .5), b = spring(d, 260, 16);
          css($(`#rb${i}_${k}`), { opacity: clamp(d / .12) * (act >= 0 && !on ? .4 : 1), transform: `scale(${clamp(b, 0, 1.2)}) translateY(${Math.sin(t * 1.6 + i + k) * 4}px)` });
        });
      });
      (p.links || []).forEach((l, j) => {
        const d = t - (l.t ?? 1.5), k = eo3(seg(d, 0, .5));
        css($('#rll' + j), { transform: `scaleX(${k})` }); css($('#rla' + j), { opacity: clamp((d - .4) / .15) });
        if ($('#rlt' + j)) css($('#rlt' + j), { opacity: clamp((d - .3) / .25) });
      });
      frameRender(t, introKeys(0, p.dur || 8));
    }
  };
};

// 路线图：长片的总地图。几站连成一条线，“现在在这”跟着讲解往前走，走过的站变实心。
// 每讲完一站回到它，观众始终知道讲到哪、还剩几站。stops[{label,en,sub,me}]：sub 一行小字写这站包含什么，me 写“我”在这站做的事
// here[[t,i]] 标记移到第 i 站；不给 here 时只画路线
KIT.routeMap = p => {
  const n = p.stops.length, L = 300, R = 1620, Y = 470, gap = (R - L) / (n - 1), X = i => L + i * gap;
  return {
    dur: p.dur || 6,
    html: frame(`<div class="panel"></div>
      <div class="abs" style="left:180px;top:120px"><div class="kicker" id="rk">${p.kicker || ''}</div><div class="h2" style="margin-top:8px" id="rt">${p.title}</div></div>
      <div class="abs" style="left:${L}px;top:${Y - 4}px;width:${R - L}px;height:8px;border-radius:4px;background:rgba(255,255,255,.12)" id="rl"></div>
      <div class="abs" style="left:${L}px;top:${Y - 4}px;width:0;height:8px;border-radius:4px;background:var(--accent);box-shadow:0 0 24px rgba(10,132,255,.6)" id="rf"></div>
      ${p.stops.map((s, i) => `<div class="abs" id="rs${i}" style="left:${X(i) - 30}px;top:${Y - 30}px;width:60px;height:60px;border-radius:50%;border:6px solid rgba(255,255,255,.35);background:#15161c"></div>
        <div class="abs" id="rx${i}" style="left:${X(i) - gap / 2}px;top:${Y + 60}px;width:${gap}px;text-align:center">
          <div class="num dim" style="font-size:30px">${String(i + 1).padStart(2, '0')}</div>
          <div class="h3" style="font-size:46px;margin-top:10px;white-space:nowrap">${s.label}</div>
          ${s.sub ? `<div style="margin:14px auto 0;width:${gap - 40}px;font-size:28px;font-weight:600;line-height:1.4;color:var(--fg2)">${s.sub}</div>` : ''}
          ${s.me ? `<div style="margin-top:16px"><span class="pill" style="font-size:26px;color:#fff;border-color:rgba(130,185,255,.7)">我：${s.me}</span></div>` : ''}</div>`).join('')}
      <div class="abs" id="rh" style="left:0;top:${Y - 150}px;opacity:0"><div style="transform:translateX(-50%);display:flex;flex-direction:column;align-items:center">
        <span style="padding:12px 26px;border-radius:16px;background:var(--signal);color:#111;font-size:32px;font-weight:800;white-space:nowrap">现在在这</span>
        <i style="width:0;height:0;border-left:16px solid transparent;border-right:16px solid transparent;border-top:20px solid var(--signal)"></i></div></div>`),
    render: t => {
      enter($('#rk'), t, .2); enter($('#rt'), t, .35);
      css($('#rl'), { transform: `scaleX(${eo3(seg(t, .3, 1.3))})`, transformOrigin: 'left' });
      const hs = p.here || [], cur = at(hs, t, -1), d = since(hs, t);
      const prev = hs.filter(([ti]) => ti <= t).slice(-2, -1).map(h => h[1])[0] ?? cur;
      const pos = cur < 0 ? -1 : lerp(prev, cur, eio3(d / .7));
      css($('#rf'), { width: `${pos < 0 ? 0 : pos * gap}px` });
      p.stops.forEach((s, i) => {
        const t0 = .5 + i * .14, e = spring(t - t0), here = i === cur, past = cur >= 0 && i < pos + .01 && !here;
        const fx = here ? stateFx('sig', d - .5) : { pop: 1, flash: 1 };
        css($('#rs' + i), { opacity: clamp((t - t0) / .25), transform: `scale(${(.6 + .4 * e) * fx.pop * (here ? 1.2 : 1)})`, background: here ? 'var(--signal)' : past ? 'var(--accent)' : '#15161c', borderColor: here ? 'rgba(255,224,160,.95)' : past ? 'rgba(130,185,255,.9)' : 'rgba(255,255,255,.35)', boxShadow: here ? `0 0 ${40 * fx.flash}px rgba(255,194,74,.6)` : 'none' });
        css($('#rx' + i), { opacity: clamp((t - t0 - .1) / .3) * (cur >= 0 && !here ? .5 : 1), transform: `translateY(${(1 - e) * 24}px)` });
      });
      const h = $('#rh');
      css(h, { opacity: cur < 0 ? 0 : clamp(d / .3), left: `${L + Math.max(0, pos) * gap}px`, transform: `translateY(${Math.sin(t * 3) * 6}px)` });
      frameRender(t, introKeys(0, p.dur || 6));
    }
  };
};

// 决策图：一个问题分出几条路，每条路一个条件、一个做法，做法卡上放一个真实例子。讲到哪条亮哪条，其余压暗。
// root 是那个问题；branches[{cond,result,sub,en,t,images:[{src,tag,pos}],ph}]：cond 是条件，result 是做法；
// images 放一到两张真实例子（tag 写出处或“AI 生成 · 示意”），没有图时 ph 写一句占位（如“拍不到”）；t 是这条路出现的时刻，不给就跟着依次出现
// active[[t,i]] 亮第 i 条；foot 是底部一行小字（口径、补充），footT 出现时刻
KIT.decisionTree = p => {
  const n = p.branches.length, gx = 36, W = (1600 - (n - 1) * gx) / n, left = 160, pics = p.branches.some(b => b.images || b.ph);
  const X = i => left + i * (W + gx), RY = 170, CY = 320, KY = 410, KH = pics ? 360 : 250, IH = 180;
  const tB = i => p.branches[i].t ?? (.9 + i * .18);
  return {
    dur: p.dur || 8,
    html: frame(`<div class="panel"></div>
      <div class="abs" style="left:0;right:0;top:${RY - 100}px;text-align:center"><div class="kicker" id="dk">${p.kicker || ''}</div></div>
      <div class="abs" id="dr" style="left:50%;top:${RY - 50}px;transform:translateX(-50%)"><div class="tile on" style="padding:18px 52px 22px;border-radius:32px;white-space:nowrap"><span class="h2">${p.root}</span></div></div>
      <svg class="abs" style="left:0;top:0;overflow:visible" width="1920" height="1080">${p.branches.map((b, i) => { const x = X(i) + W / 2; return `<path id="dl${i}" d="M960 ${RY + 74} C960 ${RY + 120} ${x} ${CY - 80} ${x} ${CY - 6}" fill="none" stroke="rgba(130,185,255,.75)" stroke-width="4" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
        <path id="dm${i}" d="M${x} ${CY + 70} L${x} ${KY - 6}" fill="none" stroke="rgba(130,185,255,.75)" stroke-width="4" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`; }).join('')}</svg>
      ${p.branches.map((b, i) => `<div class="abs" id="dc${i}" style="left:${X(i)}px;top:${CY}px;width:${W}px;height:70px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(20,22,30,.9);border:2px solid rgba(255,255,255,.18);font-size:32px;font-weight:700;white-space:nowrap">${b.cond}</div>
        <div class="tile abs" id="dt${i}" style="left:${X(i)}px;top:${KY}px;width:${W}px;height:${KH}px;padding:0;border-radius:30px">
          ${pics ? `<div class="abs" style="left:0;top:0;right:0;height:${IH}px;display:flex;gap:4px;background:rgba(255,255,255,.03)">${(b.images || []).map(im => `<div style="position:relative;flex:1;overflow:hidden"><img src="${im.src}" style="width:100%;height:100%;object-fit:${im.fit || 'cover'};object-position:${im.pos || 'center'}">${im.tag ? `<span style="position:absolute;left:10px;bottom:10px;padding:5px 14px;border-radius:10px;background:rgba(8,8,12,.8);font-size:26px;font-weight:700;color:var(--fg);white-space:nowrap">${im.tag}</span>` : ''}</div>`).join('') || `<div style="flex:1;display:flex;align-items:center;justify-content:center;border-bottom:2px dashed rgba(255,255,255,.18);font-size:30px;font-weight:700;color:var(--fg3)">${b.ph || ''}</div>`}</div>` : ''}
          <div class="abs" style="left:28px;right:24px;top:${pics ? IH + 22 : 30}px"><div class="lb" style="font-size:52px;font-weight:800;white-space:nowrap">${b.result}</div>
          ${b.sub ? `<div style="margin-top:12px;font-size:28px;font-weight:600;line-height:1.4;color:var(--fg2)">${b.sub}</div>` : ''}</div></div>`).join('')}
      ${p.foot ? `<div class="abs dim" id="df" style="left:0;right:0;top:${KY + KH + 14}px;text-align:center;font-size:28px;font-weight:600">${p.foot}</div>` : ''}`),
    render: t => {
      enter($('#dk'), t, .2);
      css($('#dr'), { opacity: clamp((t - .35) / .3), transform: `translateX(-50%) scale(${.9 + .1 * spring(t - .35)})` });
      const act = at(p.active || [], t, -1), ad = since(p.active || [], t);
      p.branches.forEach((b, i) => {
        const t0 = tB(i), on = act === i, dim = act >= 0 && !on, e = spring(t - t0 - .45);
        css($('#dl' + i), { strokeDashoffset: 1 - eo3(seg(t, t0, t0 + .45)), stroke: on ? 'var(--signal)' : 'rgba(130,185,255,.75)', opacity: dim ? .3 : 1 });
        css($('#dm' + i), { strokeDashoffset: 1 - eo3(seg(t, t0 + .35, t0 + .6)), stroke: on ? 'var(--signal)' : 'rgba(130,185,255,.75)', opacity: dim ? .3 : 1 });
        css($('#dc' + i), { opacity: clamp((t - t0 - .25) / .25) * (dim ? .4 : 1), transform: `scale(${.9 + .1 * spring(t - t0 - .25)})`, borderColor: on ? 'rgba(255,214,140,.95)' : 'rgba(255,255,255,.18)', color: on ? 'var(--signal)' : 'var(--fg)' });
        const el = $('#dt' + i), fx = on ? stateFx('sig', ad) : { pop: 1, flash: 1, z: 0 };
        el.className = 'tile abs' + (on ? ' sig' : '');
        css(el, { opacity: clamp((t - t0 - .45) / .3) * (dim ? .4 : 1), transform: `translateZ(${fx.z}px) translateY(${(1 - e) * 40}px) scale(${(.95 + .05 * e) * fx.pop})`, filter: `brightness(${fx.flash}) saturate(${dim ? .4 : 1})` });
      });
      if ($('#df')) css($('#df'), { opacity: clamp((t - (p.footT ?? tB(n - 1) + 1)) / .4) });
      const keys = introKeys(0, p.dur || 8);
      (p.active || []).forEach(([ta, i]) => keys.push([ta + .1, keys[keys.length - 1][1]], [ta + .8, push({ x: 960 + (X(i) + W / 2 - 960) * .12, y: 520 }, 1)]));
      keys.sort((a, b) => a[0] - b[0]);
      frameRender(t, keys);
    }
  };
};

// ---------- 启动 ----------
function bootKit(comp, { guides = false, backdrop = '' } = {}) {
  const st = document.createElement('style'); st.textContent = KIT_CSS; document.head.appendChild(st);
  if (comp.overlay) document.body.classList.add('alpha');
  document.body.innerHTML = (backdrop && comp.overlay ? `<img class="abs" src="${backdrop}" style="inset:0;width:1920px;height:1080px;object-fit:cover">` : '') + comp.html + (guides ? `<div class="guide" style="left:0;right:0;top:${TOKENS.safe.captionTop}px;bottom:0"><span>字幕带</span></div>
    <div class="guide" style="left:${TOKENS.safe.pip.x}px;top:${TOKENS.safe.pip.y}px;width:${TOKENS.safe.pip.d}px;height:${TOKENS.safe.pip.d}px;border-radius:50%"><span>人物</span></div>` : '');
  window.render = t => comp.render(t);
  window.DURATION = comp.dur;
  window.ALPHA = !!comp.overlay;
  document.fonts.ready.then(() => { comp.render(0); window.ok = true; });
}
