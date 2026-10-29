// 讲解画面体检：按时间点渲染页面，检查文字位置、字号层级、图形覆盖率和有没有真实画面。
// node lint.js 'gallery.html#组件' [t1 t2 ...]        不给时间点就取 DURATION 的 25% / 50% / 75% / 95%
// node lint.js 'gallery.html#组件' --no-pip            本片不放人物小窗时，不检查小窗区域
// 退出码：有 P0（文字进字幕带或小窗、文字太小）时为 1。标准见 docs/video-scorecard.md
const { chromium } = require('playwright-core');
const path = require('path'), url = require('url'), os = require('os');
const EXE = process.env.CHROME_EXE || path.join(os.homedir(),
  'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell');

(async () => {
  const args = process.argv.slice(2), scene = args[0], pip = !args.includes('--no-pip');
  let times = args.slice(1).filter(a => !a.startsWith('--')).map(Number);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const [file, hash] = scene.split('#');
  await page.goto(url.pathToFileURL(path.resolve(file)).href + (hash ? '#' + hash : ''));
  await page.waitForFunction(() => window.ok === true, null, { timeout: 60000 });
  const meta = await page.evaluate(() => ({ dur: window.DURATION, alpha: !!window.ALPHA, safe: typeof TOKENS !== 'undefined' ? TOKENS.safe : null }));
  if (!times.length) times = [.25, .5, .75, .95].map(f => +(meta.dur * f).toFixed(2));
  const safe = meta.safe || { captionTop: 880, pip: { x: 1630, y: 790, d: 250 } };
  let p0 = 0, anyMedia = false;
  for (const t of times) {
    const r = await page.evaluate(({ t, safe, pip, alpha }) => {
      window.render(t);
      const opacity = el => { let o = 1; for (let e = el; e && e !== document.body; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
      const texts = [];
      document.querySelectorAll('body *').forEach(el => {
        if (el.closest('.guide') || el.closest('.cap')) return; // 字幕层（.cap）本来就在字幕带里
        const nodes = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()), own = nodes.map(n => n.textContent.trim()).join('');
        if (!own) return;
        // 用文字本身的范围，而不是块元素的宽度（整行宽的 div 会误报压到小窗）
        const rg = document.createRange(), rs = nodes.flatMap(n => { rg.selectNodeContents(n); return [...rg.getClientRects()]; });
        const b = rs.length ? { left: Math.min(...rs.map(r => r.left)), top: Math.min(...rs.map(r => r.top)), right: Math.max(...rs.map(r => r.right)), bottom: Math.max(...rs.map(r => r.bottom)), width: Math.max(...rs.map(r => r.right)) - Math.min(...rs.map(r => r.left)), height: Math.max(...rs.map(r => r.bottom)) - Math.min(...rs.map(r => r.top)) } : el.getBoundingClientRect(), o = opacity(el);
        if (o < .15 || b.width < 2 || b.right < 0 || b.left > 1920 || b.bottom < 0 || b.top > 1080) return;
        const eb = el.getBoundingClientRect(), size = parseFloat(getComputedStyle(el).fontSize) * (el.offsetHeight ? eb.height / el.offsetHeight : 1);
        // .en 是只做质感的小英文，不承担信息，不查字号
        texts.push({ text: own.slice(0, 24), size: Math.round(size), o: +o.toFixed(2), deco: !!el.closest('.en'), box: [b.left, b.top, b.right, b.bottom].map(Math.round) });
      });
      // 图形覆盖率：在 48×27 的网格上取点，落在背景层（网格、光晕、碎片、颗粒、空白）以外的点算作有内容
      const bg = el => !el || el === document.body || el === document.documentElement || ['kgr', 'kshards', 'kgn', 'cam'].includes(el.id) || el.closest('#kshards') || el.classList.contains('glow') || el.classList.contains('guide');
      let hit = 0, n = 0;
      for (let y = 10; y < safe.captionTop; y += 40) for (let x = 20; x < 1920; x += 40) { n++; if (!bg(document.elementFromPoint(x, y))) hit++; }
      const cx = safe.pip.x + safe.pip.d / 2, cy = safe.pip.y + safe.pip.d / 2, R = safe.pip.d / 2;
      const issues = [];
      for (const tx of texts) {
        const [l, tp, rr, bt] = tx.box;
        if (bt > safe.captionTop + 4) issues.push(['P0', `文字进入字幕带：“${tx.text}” 底边 ${bt}`]);
        const dx = Math.max(l - cx, 0, cx - rr), dy = Math.max(tp - cy, 0, cy - bt);
        if (pip && dx * dx + dy * dy < R * R) issues.push(['P0', `文字压到人物小窗：“${tx.text}”`]);
        if (!tx.deco && tx.size < 22 && tx.o > .4) issues.push(['P0', `字太小（${tx.size}px，手机上看不清）：“${tx.text}”`]);
      }
      const sizes = texts.filter(x => x.o > .4 && !x.deco).map(x => x.size);
      const ratio = sizes.length ? Math.max(...sizes) / Math.min(...sizes) : 0;
      if (!alpha && sizes.length > 1 && ratio < 2.5) issues.push(['P1', `字号层级太平：最大/最小只有 ${ratio.toFixed(1)} 倍（讲解卡参考 4 倍以上；资料原文页可以例外）`]);
      const cover = hit / n;
      if (!alpha && cover < .45) issues.push(['P1', `图形覆盖率 ${(cover * 100).toFixed(0)}%，画面偏空（参考 70% 以上）`]);
      // 真实画面：画面里有没有照片、截图或视频（图标不算），面积至少约 2% 画面
      const media = [...document.querySelectorAll('img,video')].filter(el => {
        if (el.classList.contains('icon')) return false;
        const b = el.getBoundingClientRect(), vis = Math.max(0, Math.min(b.right, 1920) - Math.max(b.left, 0)) * Math.max(0, Math.min(b.bottom, 1080) - Math.max(b.top, 0));
        return vis > 40000 && opacity(el) > .3;
      }).length;
      return { media, texts: texts.length, maxSize: Math.max(0, ...sizes), minSize: sizes.length ? Math.min(...sizes) : 0, ratio: +ratio.toFixed(1), cover: +(cover * 100).toFixed(0), issues };
    }, { t, safe, pip, alpha: meta.alpha });
    anyMedia = anyMedia || r.media > 0;
    console.log(`t=${t}s  真实画面 ${r.media} 处  文字 ${r.texts} 处  字号 ${r.minSize}–${r.maxSize}px（${r.ratio} 倍）` + (meta.alpha ? '' : `  图形覆盖 ${r.cover}%`));
    for (const [lv, msg] of r.issues) { console.log(`  ${lv} ${msg}`); if (lv === 'P0') p0++; }
  }
  if (!meta.alpha && !anyMedia) console.log('  P1 整段没有真实画面（照片、截图或视频）；讲解动画也要有真实画面锚点，纯数据图至少出现一次来源页');
  await browser.close();
  process.exit(p0 ? 1 : 0);
})();
