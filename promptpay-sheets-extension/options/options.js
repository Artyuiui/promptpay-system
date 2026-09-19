import {defaults,settings} from '../background/core.js';
const form=document.getElementById('settings'), status=document.getElementById('status');
const saved=(await chrome.storage.local.get('settings')).settings || defaults;
for(const [key,value] of Object.entries({...defaults,...saved})) if(form.elements[key]) form.elements[key].value=value;
function visibility(){ document.getElementById('column-field').hidden=form.elements.mode.value!=='row'; document.getElementById('cell-field').hidden=form.elements.mode.value!=='fixed'; }
form.elements.mode.addEventListener('change',visibility);visibility();
function report(text,error=false){status.textContent=text;status.className=error?'error':'';}
async function save(test){
  try {
    const s=settings(Object.fromEntries(new FormData(form)));
    // permissions.request must be initiated by this direct button gesture.
    if(!await chrome.permissions.request({origins:[`http://${s.host}/*`]})) throw new Error('Allow access to the Android IP to connect.');
    await chrome.storage.local.set({settings:s});
    if(test){ report('Connecting…');const r=await chrome.runtime.sendMessage({type:'test',settings:s}); if(!r.ok) throw new Error(r.error);report(`Connected — ${r.data.mode==='qr'?'showing QR':'playing video'}`); }
    else report('Settings saved. Select a Sheets row and press Alt/Option + Q.');
  }catch(e){report(e.message,true);}
}
form.addEventListener('submit',e=>{e.preventDefault();save(false);});
document.getElementById('test').addEventListener('click',()=>save(true));
document.getElementById('shortcuts').addEventListener('click',e=>{e.preventDefault();chrome.tabs.create({url:'chrome://extensions/shortcuts'});});
