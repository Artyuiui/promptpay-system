import test from 'node:test';
import assert from 'node:assert/strict';
import {readSheet} from '../background/sheets.js';
import {defaults} from '../background/core.js';
const tab={id:1,url:'https://docs.google.com/spreadsheets/d/example/edit#gid=7'};
function fixture({copy='฿1,259.00\n',detach=false,changeSheet=false,restoreFails=false}={}) {
 let current='A22', clip={'text/plain':'original notes','text/html':'<b>original notes</b>'},pending, reads=0, attached=false, selected=[];
 const original={...clip};
 globalThis.chrome={runtime:{id:'test',getContexts:async()=>[{}],getPlatformInfo:async()=>({os:'mac'}),sendMessage:async m=>{
  if(m.action==='read')return {ok:true,data:{...clip}};
  clip={...m.data};return {ok:true};
 }},debugger:{attach:async()=>{attached=true;},detach:async()=>{attached=false;},sendCommand:async(_target,method,params)=>{
  if(method==='Runtime.evaluate') {
   const match=params.expression.match(/\}\)\("(context|navigate|location)",(.*)\)$/s);
   assert.ok(match,'page adapter dispatch is recognized');const action=match[1],value=match[2]==='undefined'?undefined:JSON.parse(match[2]);
   if(action==='context')return {result:{value:{selection:current,spreadsheet:'example',gid:changeSheet&&reads>0?'8':'7',sheet:'Sales'}}};
   if(action==='navigate'){if(restoreFails && value==='A22')throw new Error('lost tab');pending=value;return {result:{value:true}};}
   return {result:{value:{selection:current,hash:'#gid=7'}}};
  }
  if(method==='Input.dispatchKeyEvent' && params.type==='rawKeyDown') {
   if(params.code==='Enter'){current=pending;selected.push(current);}
   if(params.code==='KeyC'){if(detach)throw new Error('Debugger detached');clip={'text/plain':copy};reads++;}
  }
  return {};
 }}};
 return {original,get clip(){return clip},get attached(){return attached},selected};
}
test('current row reads computed formatted amount; restores rich clipboard and selection',async()=>{
 const f=fixture();const r=await readSheet(tab,defaults);assert.equal(r.amount,1259);assert.equal(r.cell,'G22');assert.equal(r.gid,'7');assert.deepEqual(f.selected,['G22','A22']);assert.deepEqual(f.clip,f.original);assert.equal(f.attached,false);
});
test('fixed and selected modes use their own targets',async()=>{
 for(const [mode,expected] of [['fixed','D10'],['selected','A22']]){const f=fixture({copy:'120'});const r=await readSheet(tab,{...defaults,mode});assert.equal(r.cell,expected);assert.equal(r.amount,120);assert.deepEqual(f.clip,f.original);}
});
test('invalid and multi-cell copies fail, restore clipboard, detach',async()=>{
 for(const copy of ['', '0','-1','hello','120\t240\n','120\n240']){const f=fixture({copy});await assert.rejects(readSheet(tab,defaults));assert.deepEqual(f.clip,f.original);assert.equal(f.attached,false);assert.equal(f.selected.at(-1),'A22');}
});
test('debugger disconnect cannot return an amount',async()=>{const f=fixture({detach:true});await assert.rejects(readSheet(tab,defaults));assert.deepEqual(f.clip,f.original);assert.equal(f.attached,false);});
test('changing sheets rejects the copied amount',async()=>{const f=fixture({changeSheet:true});await assert.rejects(readSheet(tab,defaults),/changed/);assert.deepEqual(f.clip,f.original);assert.equal(f.attached,false);});
test('failed restoration prevents a successful read',async()=>{const f=fixture({restoreFails:true});await assert.rejects(readSheet(tab,defaults),/restore/);assert.deepEqual(f.clip,f.original);assert.equal(f.attached,false);});
test('non-Sheets tabs never attach',async()=>{const f=fixture();await assert.rejects(readSheet({...tab,url:'https://example.com'},defaults));assert.equal(f.attached,false);});
