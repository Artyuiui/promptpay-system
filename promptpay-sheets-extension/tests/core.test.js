import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAmount,settings,defaults,targetCell,isSheet} from '../background/core.js';
for(const [input,value] of [['฿259',259],['259',259],['259.00',259],['1,259.00',1259],['฿1,259.00',1259],[' ฿ 0.01 ',.01],['9,999,999.99',9999999.99]]) test('amount '+input,()=>assert.equal(parseAmount(input),value));
for(const input of ['',null,undefined,'text','-1','0','NaN','Infinity','1,25','1.001','1e3','10000000','259 THB','1\t2','1\n2']) test('reject '+input,()=>assert.throws(()=>parseAmount(input)));
test('target modes',()=>{
 assert.equal(targetCell({...defaults,mode:'row'},'A22'),'G22');
 assert.equal(targetCell({...defaults,mode:'row'},'22:22'),'G22');
 assert.equal(targetCell({...defaults,mode:'row'},'A22:H22'),'G22');
 assert.equal(targetCell({...defaults,mode:'fixed'},'A99'),'D10');
 assert.equal(targetCell({...defaults,mode:'selected'},'$B$10'),'B10');
 for(const x of ['A22:B23','22:23','A:A','Named Range']) assert.throws(()=>targetCell(defaults,x));
 assert.throws(()=>targetCell({...defaults,mode:'selected'},'A1:B1'));
});
test('settings only permit bounded LAN configuration',()=>{
 const valid={...defaults,token:'test-token-12345678'};
 assert.equal(settings(valid).port,8080);
 for(const host of ['8.8.8.8','localhost.evil.example','127.1','http://localhost:8080','localhost:8080','192.168.1.50/path','192.168.1.999','192.168.01.2','172.32.1.1','0.0.0.0'])assert.throws(()=>settings({...valid,host}));
 for(const host of ['localhost','127.0.0.1','10.0.0.2','172.16.0.1','192.168.1.50','169.254.1.2'])assert.equal(settings({...valid,host}).host,host);
 for(const patch of [{port:0},{port:65536},{timeout:0},{timeout:1.5},{token:'x'},{token:'hello\r\ninjected-token'},{column:'A1'},{cell:'A0'},{mode:'guess'}])assert.throws(()=>settings({...valid,...patch}));
});
test('only real Google Sheets editor URLs',()=>{
 assert.ok(isSheet('https://docs.google.com/spreadsheets/d/abc-123/edit#gid=12'));
 assert.ok(!isSheet('https://docs.google.com.evil.example/spreadsheets/d/abc/edit'));
 assert.ok(!isSheet('https://docs.google.com/spreadsheets/'));
});

test('normalizes localhost for the local web demo',()=>assert.equal(settings({...defaults,token:'test-token-12345678',host:' LOCALHOST '}).host,'localhost'));
