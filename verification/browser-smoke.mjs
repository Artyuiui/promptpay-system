// Local fixture only: intercepts the Sheets URL; never accesses a real document.
// Extra Sheets host permission is added to the disposable test copy to emulate activeTab
// grants, because this harness invokes messages without a real toolbar/shortcut gesture.
import puppeteer from 'puppeteer';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {cpSync,readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
const path=fileURLToPath(new URL('../promptpay-sheets-extension/',import.meta.url));
const fixtureExtension=mkdtempSync('/tmp/promptpay-fixture-extension-');cpSync(path,fixtureExtension,{recursive:true});
const manifest=JSON.parse(readFileSync(fixtureExtension+'/manifest.json','utf8'));manifest.host_permissions=['https://docs.google.com/*'];writeFileSync(fixtureExtension+'/manifest.json',JSON.stringify(manifest));
const browser=await puppeteer.launch({headless:true,pipe:true,enableExtensions:[fixtureExtension]});
try {
 const target=await browser.waitForTarget(t=>t.type()==='service_worker');const worker=await target.worker();
 const page=await browser.newPage();await page.setRequestInterception(true);
 page.on('request',request=>request.respond({status:200,contentType:'text/html; charset=utf-8',body:`<!doctype html><html><head><meta charset="utf-8"></head><body tabindex="0"><input id="t-name-box" value="A22"><div class="docs-sheet-active-tab"><span class="docs-sheet-tab-name">Sales</span></div><div id="grid">Sheet fixture</div><script>
 const box=document.querySelector('input');
 box.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.body.focus();}});
 document.addEventListener('copy',e=>{e.preventDefault();const value=box.value==='D10'?'250.00':box.value==='A22'?'120':'฿1,259.00';e.clipboardData.setData('text/plain',value+'\\n');e.clipboardData.setData('text/html','<table><tr><td>'+value+'</td></tr></table>');});
 document.body.focus();
 </script></body></html>`}));
 await page.goto('https://docs.google.com/spreadsheets/d/promptpay-fixture/edit#gid=7');await page.bringToFront();
 const options=await browser.newPage();await options.goto(target.url().replace('background/service-worker.js','options/options.html'));
 await options.evaluate(()=>chrome.storage.local.set({settings:{host:'192.168.1.50',port:8080,token:'browser-test-token',mode:'row',column:'G',cell:'D10',timeout:60}}));
 await page.bringToFront();
 const reply=await options.evaluate(()=>chrome.runtime.sendMessage({type:'command',action:'preview'}));
 assert.equal(reply?.ok,true,JSON.stringify(reply)); const result=reply.data;
 assert.equal(result.amount,1259);assert.equal(result.cell,'G22');
 assert.equal(await page.$eval('input',el=>el.value),'A22');
 const before=(await options.evaluate(()=>chrome.runtime.sendMessage({target:'clipboard',action:'read'}))).data;
 for(const [mode,cell,amount] of [['fixed','D10',250],['selected','A22',120]]) {
   await options.evaluate(async mode=>{const {settings}=await chrome.storage.local.get('settings');await chrome.storage.local.set({settings:{...settings,mode}});},mode);
   await page.bringToFront();
   const response=await options.evaluate(()=>chrome.runtime.sendMessage({type:'command',action:'preview'}));
   assert.equal(response.ok,true,JSON.stringify(response));assert.equal(response.data.cell,cell);assert.equal(response.data.amount,amount);
   assert.equal(await page.$eval('input',el=>el.value),'A22');
   const after=(await options.evaluate(()=>chrome.runtime.sendMessage({target:'clipboard',action:'read'}))).data;
   assert.deepEqual(after,before);
 }

 console.log('PASS real Chrome: MV3 loads, service worker imports, debugger navigation, native copy, offscreen clipboard, all three modes, clipboard/selection restoration',result);
}finally{await browser.close();rmSync(fixtureExtension,{recursive:true,force:true});}
