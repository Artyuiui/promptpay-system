import {pageAction} from '../content/sheets-adapter.js';
import {targetCell,isSheet,parseAmount} from './core.js';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function clipboard(action,data) {
  if(!(await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length) await chrome.offscreen.createDocument({url:'background/offscreen.html',reasons:['CLIPBOARD'],justification:'Read the exact Sheets cell value and restore the original clipboard.'});
  const result=await chrome.runtime.sendMessage({target:'clipboard',action,data});
  if(!result?.ok) throw new Error(result?.error || 'Clipboard bridge unavailable.');
  return result.data;
}
export async function readSheet(tab,s) {
  if(!isSheet(tab?.url)) throw new Error('Open a Google Sheets spreadsheet in the active tab.');
  const debuggee={tabId:tab.id};
  let attached=false,original,oldClipboard,marker,clipboardChanged=false;
  const command=(method,params={})=>chrome.debugger.sendCommand(debuggee,method,params);
  const page=async(action,value)=>{
    const r=await command('Runtime.evaluate',{expression:`(${pageAction.toString()})(${JSON.stringify(action)},${JSON.stringify(value) ?? 'undefined'})`,returnByValue:true});
    if(r.exceptionDetails) throw new Error(r.result?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const key=async(key,code,virtual,modifiers=0)=>{
    await command('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:virtual,nativeVirtualKeyCode:virtual,modifiers,...(code==='KeyC'?{commands:['copy']}:{})});
    await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual,nativeVirtualKeyCode:virtual,modifiers});
  };
  const navigate=async cell=>{
    await page('navigate',cell); await command('Input.insertText',{text:cell}); await key('Enter','Enter',13);
    for(let i=0;i<20;i++) { await delay(50); const location=await page('location'); if(location.selection.toUpperCase()===cell.toUpperCase() && !location.nameBoxFocused) { await delay(300); return; } }
    throw new Error('Sheets did not navigate to '+cell+'. No payment was sent.');
  };
  let result, failure;
  try {
    try { await chrome.debugger.attach(debuggee,'1.3'); attached=true; }
    catch { throw new Error('Cannot read Sheets: close DevTools or another debugger, then retry. Allow the Chrome debugging banner while reading.'); }
    await command('Emulation.setFocusEmulationEnabled',{enabled:true});
    original=await page('context');
    const target=targetCell(s,original.selection);
    // Fixed mode still requires a restorable A1 selection. Never overwrite an unfinished name-box edit.
    if(!/^(?:[A-Z]+[1-9]\d*(?::[A-Z]+[1-9]\d*)?|[1-9]\d*:[1-9]\d*|[A-Z]+:[A-Z]+)$/i.test(original.selection)) throw new Error('Select a cell before reading the payment.');
    oldClipboard=await clipboard('read');
    marker='promptpay-read-'+crypto.randomUUID();
    await clipboard('write',{'text/plain':marker}); clipboardChanged=true;
    await navigate(target);
    const targetLocation=await page('location');
    if(targetLocation.preview === '') throw new Error(target+' is empty. Check the configured amount column/cell.');
    const {os}=await chrome.runtime.getPlatformInfo();
    await key('c','KeyC',67,os==='mac'?4:2);
    let copied;
    for(let i=0;i<25;i++) {
      await delay(60); const data=await clipboard('read');
      if(data['text/plain']!==marker) { copied=data; break; }
    }
    if(!copied) throw new Error('Sheets could not copy this cell. Ensure the sheet permits copying and is fully loaded.');
    const after=await page('context');
    if(after.spreadsheet!==original.spreadsheet || after.gid!==original.gid || after.selection.toUpperCase()!==target) throw new Error('Selection or sheet changed during reading. Try again.');
    const raw=copied['text/plain'] || '';
    // Exactly one copied cell only. Allow Sheets' trailing line ending.
    const text=raw.replace(/\r?\n$/,'');
    if(/[\t\r\n]/.test(text)) throw new Error('Copied selection contains multiple cells. Select one unmerged cell.');
    const amount=parseAmount(text);
    if(targetLocation.preview != null && !targetLocation.preview.startsWith('=')) {
      if(parseAmount(targetLocation.preview)!==amount) throw new Error('Copied value does not match '+target+'. No payment was sent; retry.');
    }
    result={amount,cell:target,sheet:original.sheet,spreadsheet:original.spreadsheet,gid:original.gid};
  } catch(e) { failure=e; }
  finally {
    if(attached && original) {
      try {
        const current=await page('context');
        if(current.spreadsheet===original.spreadsheet && current.gid===original.gid) await navigate(original.selection);
        else throw new Error('Sheet changed while reading. Select the intended row and retry.');
      } catch { failure ||= new Error('Could not restore the Sheets selection. No payment was sent; select your row and retry.'); }
    }
    if(clipboardChanged) {
      try { await clipboard('write',oldClipboard); }
      catch { failure ||= new Error('Could not restore the clipboard. No payment was sent.'); }
    }
    if(attached) {
      await command('Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});
      await chrome.debugger.detach(debuggee).catch(()=>{});
    }
  }
  if(failure) throw failure;
  return result;
}
