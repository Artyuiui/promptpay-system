const $=id=>document.getElementById(id);
async function command(action){const r=await chrome.runtime.sendMessage({type:'command',action});if(!r?.ok) throw new Error(r?.error || 'Extension unavailable');return r.data;}
async function last(){const {lastPayment}=await chrome.storage.local.get('lastPayment');$('last').textContent=lastPayment?`Last sent: ฿${lastPayment.amount.toFixed(2)}`:'Last sent: —';}
last();
chrome.storage.local.get('feedback').then(({feedback})=>{if(feedback){$('feedback').textContent=feedback.text;$('feedback').className=feedback.error?'error':'';}});
command('status').then(s=>{$('online').textContent=`● Online · ${s.mode==='qr'?'showing QR':'video'}`;}).catch(e=>{$('online').textContent=e.message;$('online').className='error';});
for(const action of ['show','hide','resend','preview']) $(action).addEventListener('click',async()=>{
  document.querySelectorAll('button').forEach(b=>b.disabled=true);$('feedback').className='';$('feedback').textContent=action==='preview' || action==='show'?'Reading Sheets… Keep the selection still.':'Sending…';
  try{const data=await command(action);if(data.amount!=null){$('amount').textContent=`฿${Number(data.amount).toFixed(2)}`;$('source').textContent=data.cell?`${data.sheet || 'Current sheet'} · ${data.cell}`:'Amount acknowledged by display';}
  $('feedback').textContent=action==='preview'?'Amount ready. SHOW QR reads the current selection again.':action==='hide'?'QR hidden — video resumed':`✓ Sent ฿${Number(data.amount).toFixed(2)}`;if(action!=='preview')$('online').textContent='● Online';await last();}
  catch(e){$('feedback').textContent=e.message;$('feedback').className='error';}
  finally{document.querySelectorAll('button').forEach(b=>b.disabled=false);}
});
$('settings').addEventListener('click',e=>{e.preventDefault();chrome.runtime.openOptionsPage();});
