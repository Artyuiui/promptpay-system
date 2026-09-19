// The offscreen CLIPBOARD reason supports execCommand even without a focused window.
// Preserve every string MIME flavor (including Sheets' rich HTML), never just plain text.
const area=document.getElementById('clipboard');
function read() {
  let result=null;
  const listener=e=>{
    e.preventDefault();
    if (e.clipboardData.files.length) { result={error:'Clipboard contains a file or image. Copy some text before reading a Sheets payment.'}; return; }
    const data={}; for(const type of e.clipboardData.types) data[type]=e.clipboardData.getData(type);
    result={data};
  };
  area.focus(); area.addEventListener('paste',listener,{once:true});
  document.execCommand('paste'); area.removeEventListener('paste',listener);
  if(!result) throw new Error('Chrome could not read the clipboard. Check clipboard permissions.');
  if(result.error) throw new Error(result.error);
  return result.data;
}
function write(data) {
  let handled=false;
  const listener=e=>{ e.preventDefault(); for(const [type,value] of Object.entries(data)) e.clipboardData.setData(type,value); handled=true; };
  area.focus(); area.value=' '; area.select(); area.addEventListener('copy',listener,{once:true});
  const ok=document.execCommand('copy'); area.removeEventListener('copy',listener);
  if(!ok || !handled) throw new Error('Chrome could not write the clipboard.');
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg.target!=='clipboard' || sender.id!==chrome.runtime.id) return;
  try { reply({ok:true,data:msg.action==='read'?read():write(msg.data)}); }
  catch(e) { reply({ok:false,error:e.message}); }
});
