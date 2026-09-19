// Runs only in an explicitly attached Google Sheets tab, through CDP Runtime.evaluate.
// No private Sheets model, export endpoint, spreadsheet ID, or Google API credentials.
export function pageAction(action, value) {
  const box = document.querySelector('#t-name-box input, input#t-name-box, .waffle-name-box input, input.waffle-name-box');
  if (!box) throw new Error('Google Sheets name box is unavailable. Open a standard editable spreadsheet and finish loading it.');
  const active = document.activeElement;
  if (action==='context') {
    // Sheets also uses .cell-input for the always-visible formula preview.
    // Only the focused editor can indicate an unfinished edit.
    const rect=active?.getBoundingClientRect?.();
    const onScreen=!rect || (rect.bottom>0 && rect.right>0 && rect.top<innerHeight && rect.left<innerWidth);
    const editing = onScreen && active && active !== box && (active.isContentEditable || /^(INPUT|TEXTAREA)$/.test(active.tagName));
    if (editing && ((active.value || active.textContent || '').trim() || active.closest('#t-formula-bar-input'))) throw new Error('Finish editing the cell (Enter or Escape) before sending a payment.');
    const tab=document.querySelector('.docs-sheet-active-tab .docs-sheet-tab-name, .docs-sheet-active-tab');
    const gid=new URL(location.href).hash.match(/(?:^#|&)gid=(\d+)/)?.[1] || new URL(location.href).searchParams.get('gid') || '0';
    return {selection:box.value, spreadsheet:location.pathname.match(/\/d\/([^/]+)/)?.[1],gid,sheet:tab?.textContent?.trim() || ''};
  }
  if (action==='navigate') {
    box.focus(); box.select();
    // Text is inserted through trusted CDP Input.insertText by the caller.
    return true;
  }
  if (action==='location') {
    const preview=document.querySelector('.cell-input:not(#waffle-rich-text-editor)');
    return {selection:box.value,hash:location.hash,nameBoxFocused:document.activeElement===box,preview:preview ? preview.textContent.trim() : null};
  }
  if (action==='toast') {
    document.getElementById('promptpay-feedback')?.remove();
    const el=document.createElement('div'); el.id='promptpay-feedback'; el.textContent=value;
    Object.assign(el.style,{position:'fixed',right:'24px',bottom:'24px',zIndex:'2147483647',background:'#123d43',color:'white',padding:'18px 24px',borderRadius:'10px',font:'16px system-ui',maxWidth:'460px',boxShadow:'0 4px 20px #0004'});
    document.body.append(el); setTimeout(()=>el.remove(),6500); return true;
  }
  throw new Error('Unknown page action');
}
