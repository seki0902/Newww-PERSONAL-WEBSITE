// Read-only product diagnostics: run with node tools/diagnose-animation-audio.mjs.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { readFileSync, existsSync, statSync } from 'node:fs';

const bundle = JSON.parse(readFileSync(new URL('../public/content/current/content.json', import.meta.url), 'utf8'));
const server = await createServer({ server: { host: '127.0.0.1', port: 5175, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--mute-audio'], args: ['--autoplay-policy=document-user-activation-required'] });
const url = 'http://127.0.0.1:5175/';
const results = {};
const output = (name, result) => { results[name] = result; console.log(JSON.stringify({ name, result })); };
const mode = process.argv[2] ?? 'all';
const include = (name) => mode === 'all' || mode === name;

async function open({ stage, reducedMotion = 'no-preference', finalOnly = false, viewport = { width: 1280, height: 860 } } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((stage) => {
    window.__audioEvents = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const id = this.dataset.testid || this.tagName;
      window.__audioEvents.push({ event: 'play-call', id, time: performance.now() });
      return original.call(this).then((value) => { window.__audioEvents.push({ event: 'play-resolved', id }); return value; }, (error) => {
        window.__audioEvents.push({ event: 'play-rejected', id, error: error.name, message: error.message });
        throw error;
      });
    };
    for (const name of ['playing', 'pause', 'error']) document.addEventListener(name, (event) => {
      if (event.target instanceof HTMLMediaElement) window.__audioEvents.push({ event: name, id: event.target.dataset.testid, error: event.target.error?.code });
    }, true);
    if (stage) localStorage.setItem('interactive-portfolio:state:v1', JSON.stringify({ version: 1, stage, completedProjectIds: [], completedTarotIds: [], unlockedProjectIds: [], inventoryItemIds: [], demoStates: {} }));
  }, stage);
  if (finalOnly) {
    const next = structuredClone(bundle);
    next.intro.scenes = [{ ...next.intro.scenes.at(-1), order: 1 }];
    await page.route('**/content/current/content.json', (route) => route.fulfill({ json: next }));
  }
  await page.goto(url);
  return { context, page, errors };
}

async function audioState(page) {
  return page.evaluate(() => [...document.querySelectorAll('audio')].map((audio) => ({ id: audio.dataset.testid, paused: audio.paused, muted: audio.muted, volume: audio.volume, currentTime: audio.currentTime, readyState: audio.readyState, error: audio.error?.code ?? null, loop: audio.loop })));
}

try {
  output('configured-audio-files', bundle.assets.filter((asset) => asset.type === 'audio').map((asset) => {
    const file = new URL('../public/content/current/' + asset.path, import.meta.url);
    return { id: asset.id, path: asset.path, exists: existsSync(file), bytes: existsSync(file) ? statSync(file).size : 0 };
  }));
  output('audio-settings', { intro: bundle.intro.settings, desktop: bundle.desktop.bgmAssetId, ending: bundle.ending.bgmAssetId });

  if (include('journey')) {
  const journey = await open({ finalOnly: true });
  const { page } = journey;
  await page.getByRole('button', { name: '显示人物和对话' }).click();
  await page.waitForFunction(() => { const a = document.querySelector('[data-testid="intro-bgm"]'); return a && !a.paused && a.currentTime > 0.05; });
  output('intro-playing', await audioState(page));
  await page.getByRole('button', { name: '关闭声音', exact: true }).click();
  output('intro-muted', await audioState(page));
  await page.getByRole('button', { name: '推进对白', exact: true }).click();
  const startedAt = Date.now();
  await page.getByTestId('computer-hotspot').click();
  await page.getByRole('main', { name: 'SEKI OS 系统启动中' }).waitFor();
  await page.getByRole('progressbar', { name: '启动进度' }).evaluate((element) => new Promise((resolve) => {
    const observer = new MutationObserver(() => { if (+element.getAttribute('aria-valuenow') >= 64) { observer.disconnect(); resolve(); } });
    if (+element.getAttribute('aria-valuenow') >= 64) resolve(); else observer.observe(element, { attributes: true });
  }));
  await page.screenshot({ path: 'test-results/diagnostic-startup-wide.png' });
  await page.getByTestId('onboarding-overlay').waitFor({ timeout: 12000 });
  output('startup-real-clock', { elapsedMs: Date.now() - startedAt, startupRemaining: await page.locator('.startup-screen').count(), errors: journey.errors });
  await page.waitForFunction(() => { const a = document.querySelector('[data-testid="onboarding-purr-sound"]'); return a && a.readyState >= 2; });
  output('onboarding-after-intro-muted', await audioState(page));
  await page.getByRole('button', { name: '关闭声音', exact: true }).click();
  output('onboarding-muted', await audioState(page));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('onboarding-start').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="onboarding-start"]').disabled);
  await page.getByTestId('onboarding-start').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="onboarding-start"]').disabled);
  await page.getByTestId('onboarding-start').click();
  await page.getByTestId('onboarding-overlay').waitFor({ state: 'detached' });
  await page.waitForFunction(() => { const a = document.querySelector('[data-testid="desktop-bgm"]'); return a && a.readyState >= 2; });
  output('desktop-after-onboarding-muted', await audioState(page));
  output('journey-audio-events', await page.evaluate(() => window.__audioEvents));
  await journey.context.close();
  }

  if (include('autoplay')) {
  for (const stage of ['desktop', 'complete']) {
    const sample = await open({ stage });
    // Playwright page.evaluate grants a user gesture. CDP is used here explicitly
    // without a gesture so the diagnostic cannot unlock the audio it is inspecting.
    const cdp = await sample.context.newCDPSession(sample.page);
    const read = async (expression) => (await cdp.send('Runtime.evaluate', { expression, userGesture: false, returnByValue: true, awaitPromise: true })).result.value;
    const stateExpression = `({ activation: navigator.userActivation.hasBeenActive, audio: [...document.querySelectorAll('audio')].map(a => ({id:a.dataset.testid,paused:a.paused,muted:a.muted,volume:a.volume,currentTime:a.currentTime,readyState:a.readyState,error:a.error?.code??null})) })`;
    let before;
    const deadline = Date.now() + 10000;
    do { before = await read(stateExpression); if (before.audio.length && before.audio.every((a) => a.readyState >= 1)) break; await new Promise((resolve) => setTimeout(resolve, 50)); } while (Date.now() < deadline);
    await new Promise((resolve) => setTimeout(resolve, 500));
    before = await read(stateExpression);
    const beforeGesturePlay = await read(`(async () => { try { await document.querySelector('audio').play(); return 'resolved'; } catch(e) { return e.name; } })()`);
    await sample.page.getByText(stage === 'desktop' ? 'SEKI OS' : '核心项目体验已完成', { exact: true }).click();
    await sample.page.waitForTimeout(500);
    const afterGesture = await read(stateExpression);
    const manualRetry = await read(`(async () => { try { await document.querySelector('audio').play(); return 'resolved'; } catch(e) { return e.name; } })()`);
    output('fresh-' + stage + '-autoplay', { before, beforeGesturePlay, afterGesture, manualRetry, events: await read('window.__audioEvents'), errors: sample.errors });
    await sample.context.close();
  }
  }

  if (include('motion')) {
  const reduced = await open({ reducedMotion: 'reduce', finalOnly: true });
  await reduced.page.getByRole('button', { name: '显示人物和对话' }).click();
  output('reduced-motion-intro', await reduced.page.evaluate(() => ({ text: document.querySelector('.dialogue-box p').textContent, cursorAnimation: getComputedStyle(document.querySelector('.typing-cursor')).animationName })));
  await reduced.page.getByRole('button', { name: '推进对白', exact: true }).click();
  await reduced.page.getByTestId('computer-hotspot').click();
  output('reduced-motion-transition', await reduced.page.locator('.novel-stage').evaluate((element) => ({ animation: getComputedStyle(element).animationName, duration: getComputedStyle(element).animationDuration })));
  await reduced.context.close();

  const narrow = await open({ finalOnly: true, viewport: { width: 375, height: 812 } });
  await narrow.page.getByRole('button', { name: '显示人物和对话' }).click();
  await narrow.page.getByRole('button', { name: '推进对白', exact: true }).click();
  await narrow.page.getByTestId('computer-hotspot').click();
  await narrow.page.getByRole('main', { name: 'SEKI OS 系统启动中' }).waitFor();
  const clouds = [];
  const sampleClouds = () => narrow.page.locator('.startup-cloud').evaluateAll((elements) => elements.map((element) => ({ transform: getComputedStyle(element).transform, left: element.getBoundingClientRect().left, width: element.getBoundingClientRect().width })));
  clouds.push(await sampleClouds());
  await narrow.page.waitForTimeout(2200);
  clouds.push(await sampleClouds());
  await narrow.page.screenshot({ path: 'test-results/diagnostic-startup-narrow.png' });
  await narrow.page.getByTestId('onboarding-overlay').waitFor({ timeout: 12000 });
  output('narrow-startup', { clouds, errors: narrow.errors });
  await narrow.context.close();
  }

  if (include('media')) {
  const media = await open();
  output('decoded-audio', await media.page.evaluate(async (assets) => {
    const context = new AudioContext();
    const decoded = [];
    for (const asset of assets) {
      try {
        const response = await fetch('/content/current/' + asset.path);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        let sum = 0, peak = 0, samples = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) for (const value of buffer.getChannelData(channel)) { sum += value * value; peak = Math.max(peak, Math.abs(value)); samples++; }
        decoded.push({ id: asset.id, status: response.status, duration: buffer.duration, rms: Math.sqrt(sum / samples), peak });
      } catch (error) { decoded.push({ id: asset.id, error: error.message }); }
    }
    await context.close();
    return decoded;
  }, bundle.assets.filter((asset) => asset.type === 'audio')));
  await media.context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
