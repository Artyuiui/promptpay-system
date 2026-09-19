import {defaults,settings,parseAmount,isSheet} from './core.js';
import {readSheet} from './sheets.js';
let busy=false;
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
async function config(){ return settings((await chrome.storage.local.get('settings')).settings || defaults); }
async function activeTab(){ return (await chrome.tabs.query({active:true,currentWindow:true}))[0]; }
async function request(s,path,body) {
  if(!(await chrome.permissions.contains({origins:[`http://${s.host}/*`]}))) throw new Error('Open Settings and Save to grant access to the Android IP.');
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),4500);
  try {
    const response=await fetch(`http://${s.host}:${s.port}${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${s.token}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,cache:'no-store',redirect:'error',credentials:'omit'});
    if(response.status===401) throw new Error('API token rejected. Match the token in Android Settings.');
    const data=await response.json().catch(()=>{throw new Error('Display returned an invalid response.');});
    if(!response.ok) throw new Error(data.error || `Display HTTP ${response.status}`);
    if(data.online!==true || !['video','qr'].includes(data.mode)) throw new Error('This address is not a PromptPay display.');
    return data;
  } catch(e) {
    if(e.name==='AbortError' || e instanceof TypeError) throw new Error(`Display Offline — ${s.host}:${s.port}. Check Wi-Fi, IP and local-network permission. The request may have arrived; check the display before retrying.`);
    throw e;
  } finally { clearTimeout(timer); }
}
async function feedback(text,error=false) {
  await chrome.action.setBadgeText({text:error?'!':'OK'});
  await chrome.action.setBadgeBackgroundColor({color:error?'#ad3030':'#176758'});
  await chrome.action.setTitle({title:text});
  await chrome.storage.local.set({feedback:{text,error,at:Date.now()}});
  await chrome.notifications.create('promptpay-result',{type:'basic',iconUrl:'icons/icon128.png',title:'PromptPay Display',message:text,priority:error?1:0}).catch(()=>{});
}
async function run(action){
  if(action==='status') return request(await config(),'/status');
  if(busy) throw new Error('A command is already in progress. Try again in a moment.');
  busy=true;
  try {
    const s=await config();
    if(action==='hide') { const status=await request(s,'/hide',{}); await feedback('QR hidden — video resumed'); return status; }
    let amount,source;
    if(action==='resend') {
      const last=(await chrome.storage.local.get('lastPayment')).lastPayment;
      if(!last) throw new Error('No successfully sent payment to resend.');
      amount=parseAmount(last.amount);
    } else if(action==='show' || action==='preview') {
      source=await readSheet(await activeTab(),s); amount=source.amount;
      if(action==='preview') return source;
    } else throw new Error('Unknown command.');
    const status=await request(s,'/show',{amount,timeout:s.timeout});
    if(status.mode!=='qr' || Number(status.amount)!==amount) throw new Error('Display did not acknowledge the requested payment.');
    await chrome.storage.local.set({lastPayment:{amount,at:Date.now(),source}});
    await feedback(`✓ Sent ฿${amount.toFixed(2)}${source ? ' from '+source.cell : ' (resend)'}`);
    return {amount,...status};
  } finally { busy=false; }
}
chrome.commands.onCommand.addListener(command=>{run(command).catch(e=>feedback(e.message,true));});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message.target==='clipboard') return;
  if(sender.id!==chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  if(message.type==='test') {
    Promise.resolve().then(()=>request(settings(message.settings),'/status')).then(data=>reply({ok:true,data})).catch(e=>reply({ok:false,error:e.message})); return true;
  }
  if(message.type==='command') {
    run(message.action).then(data=>reply({ok:true,data})).catch(async e=>{if(message.action!=='status' && message.action!=='preview') await feedback(e.message,true);reply({ok:false,error:e.message});}); return true;
  }
});
chrome.runtime.onInstalled.addListener(async details=>{
  if(details.reason==='install') {await chrome.storage.local.set({settings:defaults});await chrome.runtime.openOptionsPage();}
});
