import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {fixture,registration,encrypted,password} from './helpers.mjs';
const f=await fixture();let browser;
try{
 const a=await registration(f,'iPhone A <img onerror=alert(1)>'),b=await registration(f,'iPhone B');
 for(const [r,text]of [[a,'Tin riêng A: 123456'],[b,'Tin riêng B: 654321']]){
  await f.store.registerDevice(r.body,f.now);await f.store.put(r.c.channelId,r.c.writeToken,r.c.deviceId,encrypted(r.c,text,f.now),f.now);
 }
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(f.origin);
 await page.locator('#password').fill(password);await page.locator('#login-button').click();await expect(page.locator('#devices button')).toHaveCount(2);await expect(page.locator('#setup')).toBeHidden();
 await page.getByRole('button',{name:/iPhone A/}).click();await expect(page.locator('.code')).toHaveText('123456');await expect(page.locator('#chat-title')).toContainText('iPhone A');
 assert.equal(await page.locator('#devices img').count(),0);await expect(page.locator('.text')).not.toContainText('Tin riêng B');
 await page.getByRole('button',{name:/iPhone B/}).click();await expect(page.locator('.code')).toHaveText('654321');await expect(page.locator('.text')).not.toContainText('Tin riêng A');
 await page.screenshot({path:'test-results/devices-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/devices-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
 await page.locator('#lock').click();await expect(page.locator('#devices button')).toHaveCount(0);await expect(page.locator('.text')).toHaveCount(0);
 await f.restart();await page.reload();await page.locator('#password').fill(password);await page.locator('#login-button').click();await expect(page.locator('#devices button')).toHaveCount(2);
 await page.clock.fastForward(310000);await expect(page.locator('#login')).toBeVisible();await expect(page.locator('#devices button')).toHaveCount(0);await expect(page.locator('.text')).toHaveCount(0);
 assert.deepEqual(errors,[]);console.log('PASS: automatic discovery, isolated device chats, safe names, mobile layout, restart, empty storage and idle-lock cleanup');
}finally{if(browser)await browser.close();await f.close();}
