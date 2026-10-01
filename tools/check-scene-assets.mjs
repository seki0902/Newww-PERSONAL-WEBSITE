import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { validateContent } from './content-server.mjs';

for (const file of ['content/draft/content.json', 'public/content/current/content.json']) {
  validateContent(JSON.parse(await readFile(file, 'utf8')));
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1190, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto('http://localhost:5173/');
  await page.locator('.startup-screen').waitFor();
  await page.clock.runFor(5100);
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  const scenes = JSON.parse(await readFile('public/content/current/content.json', 'utf8')).intro.scenes;
  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index];
    await page.locator('.dialogue-box').waitFor();
    if (await page.locator('.dialogue-box p').innerText() !== scene.text) await page.getByRole('button', { name: '推进对白', exact: true }).click();
    await page.waitForFunction(text => document.querySelector('.dialogue-box p')?.textContent === text, scene.text);
    const character = page.locator('.novel-character');
    if (scene.characterAssetId) {
      await character.evaluate(img => img.decode());
      await page.waitForFunction(() => document.querySelector('.novel-character')?.style.maskImage.startsWith('url('));
      if (!await character.evaluate(img => img.naturalWidth > 0)) throw Error(`Missing HR image: ${scene.id}`);
    }
    if ([0, 2, 4, 26, 28].includes(index)) await page.screenshot({ path: `test-results/scene-assets-${index + 1}.png` });
    if (index < scenes.length - 1) await page.getByRole('button', { name: '推进对白', exact: true }).click();
  }
  await page.getByRole('button', { name: '打开前辈的电脑' }).waitFor();
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Both content bundles valid; 29 scenes traversed; HR images loaded; final computer button present.');
} finally { await browser.close(); }
