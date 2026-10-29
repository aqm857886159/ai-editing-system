// node render.js 'gallery.html#组件' stills <outdir> t1 t2 ...
// node render.js 'gallery.html#组件' video  <out.mp4|out.mov> [duration] [fps]   叠加层组件（window.ALPHA）自动透明，输出 ProRes 4444 .mov
// 每个场景页面暴露 window.render(t) 和 window.DURATION；画面只由 t 决定
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path'), url = require('url'), os = require('os');
const { execFileSync } = require('child_process');
const EXE = process.env.CHROME_EXE || path.join(os.homedir(),
  'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell');

(async () => {
  const [scene, mode, out, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('[console]', m.text()); });
  const [file, hash] = scene.split('#');
  await page.goto(url.pathToFileURL(path.resolve(file)).href + (hash ? '#' + hash : ''));
  await page.waitForFunction(() => window.ok === true, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const t of rest) {
      await page.evaluate(t => window.render(t), +t);
      await page.evaluate(() => Promise.all([...document.images].filter(im => !im.complete).map(im => new Promise(r => { im.onload = im.onerror = r; }))));
      await page.screenshot({ path: path.join(out, `${path.basename(file, '.html')}${hash ? '-' + hash : ''}-t${(+t).toFixed(2)}.jpg`), type: 'jpeg', quality: 90 });
    }
  } else {
    const alpha = await page.evaluate(() => !!window.ALPHA);
    let [dur, fps = 30] = rest.map(Number); if (!dur) dur = await page.evaluate(() => window.DURATION);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-'));
    const n = Math.round(dur * fps), t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => window.render(t), i / fps);
      await page.evaluate(() => Promise.all([...document.images].filter(im => !im.complete).map(im => new Promise(r => { im.onload = im.onerror = r; }))));
      await page.screenshot(alpha ? { path: path.join(tmp, `f${String(i).padStart(5, '0')}.png`), omitBackground: true } : { path: path.join(tmp, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
      if (i % 300 === 0) console.log('frame', i, '/', n, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(tmp, alpha ? 'f%05d.png' : 'f%05d.jpg'),
      ...(alpha ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le'] : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow']), out]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('video ->', out, n, 'frames');
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
