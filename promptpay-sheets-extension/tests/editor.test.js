import test from 'node:test';
import assert from 'node:assert/strict';
import {pageAction} from '../content/sheets-adapter.js';
function fixture(active){
 const box={value:'A1'};
 globalThis.document={activeElement:active,querySelector(selector){if(selector.includes('name-box'))return box;if(selector==='.cell-input')return {textContent:'1000',getClientRects:()=>[{}]};return null;}};
 globalThis.location={href:'https://docs.google.com/spreadsheets/d/test/edit#gid=0',pathname:'/spreadsheets/d/test/edit'};
}
test('formula preview is not an unfinished edit',()=>{
 fixture({tagName:'DIV',isContentEditable:true,textContent:'\n\n',closest:()=>null});
 assert.equal(pageAction('context').selection,'A1');
});
test('focused editor with an unfinished value still blocks reading',()=>{
 fixture({tagName:'DIV',isContentEditable:true,textContent:'123',closest:()=>null});
 assert.throws(()=>pageAction('context'),/Finish editing/);
});
test('offscreen Sheets keyboard buffer is not an active cell edit',()=>{
 globalThis.innerHeight=900;globalThis.innerWidth=1200;
 fixture({tagName:'DIV',isContentEditable:true,textContent:'A1',closest:()=>null,getBoundingClientRect:()=>({top:-9998,bottom:-9983,left:4,right:20})});
 assert.equal(pageAction('context').selection,'A1');
});
