import {chromium,expect} from '@playwright/test';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
import {fixture,paired,encrypted,viewerCode,request,password} from './helpers.mjs';
const f=await fixture();let browser;try{
 const c=await paired(f),e=encrypted(c,'Mã đăng nhập thử nghiệm: 654321\n<img src=x onerror=alert(1)>',f.now);
 await request(f,'/api/v2/channels/'+c.channelId+'/messages',{method:'POST',body:e,bearer:c.writeToken,device:c.deviceId});
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Test clipboard without overwriting the user's actual OS clipboard.
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.testClipboard=text;}}});});
 await page.clock.install();await page.goto(f.origin);await expect(page.locator('#login')).toBeVisible();await expect(page.locator('#dashboard')).toBeHidden();
 await page.locator('#password').fill('wrong');await page.locator('#login-button').click();await expect(page.locator('#notice')).toContainText('không đúng');
 await page.locator('#password').fill(password);await page.locator('#login-button').click();await expect(page.locator('#setup')).toBeVisible();
 await page.locator('#connection').fill(JSON.stringify(viewerCode(c)));await page.locator('#connect').click();await expect(page.locator('.code')).toHaveText('654321');
 await expect(page.locator('.text')).toContainText('<img');assert.equal(await page.locator('#messages img').count(),0);
 await page.locator('.code').click();assert.equal(await page.evaluate(()=>window.testClipboard),'654321');
 assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
 assert.equal(await page.locator('#password').inputValue(),'');assert.equal(await page.locator('#connection').inputValue(),'');
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/web-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/web-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#search').fill('no-match');await expect(page.locator('.message')).toHaveCount(0);await page.locator('#search').fill('');await expect(page.locator('.message')).toHaveCount(1);
 await page.locator('#lock').click();await expect(page.locator('#login')).toBeVisible();assert.equal(await page.locator('.text').count(),0);
 await f.restart();await page.reload();await page.locator('#password').fill(password);await page.locator('#login-button').click();await expect(page.locator('.code')).toHaveText('654321');
 await page.locator('#reconnect').click();await expect(page.locator('#replace-connection')).toBeChecked();await page.locator('#password').fill(password);await page.locator('#login-button').click();await expect(page.locator('#setup')).toBeVisible();
 await page.locator('#connection').fill(JSON.stringify(viewerCode(c)));await page.locator('#connect').click();await expect(page.locator('.code')).toHaveText('654321');
 await page.clock.fastForward(310000);await expect(page.locator('#login')).toBeVisible();await expect(page.locator('.text')).toHaveCount(0);await page.clock.resume();
 await page.locator('#replace-connection').uncheck();await page.locator('#password').fill(password);await page.locator('#login-button').click();await expect(page.locator('.code')).toHaveText('654321');
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(page.locator('.text')).toHaveCount(0);assert.deepEqual(errors,[]);
 console.log('PASS: login gate, secure setup, OTP copy, XSS escaping, empty browser storage, responsive layout, lock, database restart, reconnect, 5-minute idle lock, pagehide');
}finally{if(browser)await browser.close();await f.close();}
