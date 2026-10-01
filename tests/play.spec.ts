import {test,expect} from '@playwright/test';
import {daily,orientations} from '../src/game';
import {readFile} from 'node:fs/promises';
test('solve daily, save best and download spoiler-free PNG',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await expect(page.getByText('Results stay on this device')).toBeVisible();
 const day=(await page.locator('.date-stamp strong').innerText()).trim(),p=daily(day);
 await expect(page.locator('.scene canvas')).toBeVisible();await expect(page.locator('[data-seal]')).toBeDisabled();
 await page.locator('[data-box="S"]').click();
 for(const w of p.witness){await page.locator(`[data-item="${w.id}"]`).click();const i=p.items.find(i=>i.id===w.id)!;const turns=orientations(i.dims).findIndex(d=>d.every((v,j)=>v===w.dims[j]));for(let n=0;n<turns;n++)await page.locator('[data-rotate]').click();await page.locator(`[data-cell="${w.at[0]},${w.at[1]}"]`).click();await page.locator('[data-place]').click();}
 await page.locator('[data-seal]').click();await expect(page.getByText('Local result saved')).toBeVisible();await page.locator('[data-share]').click();
 const image=page.locator('[data-result-image]');await expect(image).toBeVisible();await expect(image).toHaveJSProperty('naturalWidth',1200);await expect(image).toHaveJSProperty('naturalHeight',800);
 await image.screenshot({path:testInfo.outputPath('result-preview.png')});
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-download]').click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe(`which-box-${day}.png`);const path=testInfo.outputPath('result.png');await download.saveAs(path);const png=await readFile(path);expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');expect(png.readUInt32BE(16)).toBe(1200);expect(png.readUInt32BE(20)).toBe(800);
 await page.reload();await expect(page.getByText('Your saved best: 100.0%')).toBeVisible();expect(errors).toEqual([]);
});
test('small screens and corrupt local data remain playable',async({page})=>{await page.setViewportSize({width:360,height:900});await page.goto('./');await page.evaluate(()=>localStorage.setItem('which-box:daily-practice-v1','[null]'));await page.reload();await expect(page.getByText('Results stay on this device')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('[data-item]').first().click();await expect(page.locator('[data-rotate]')).toBeEnabled();});
