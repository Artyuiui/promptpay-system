import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {networkInterfaces} from 'node:os';
import {timingSafeEqual} from 'node:crypto';
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
const port=Number(process.env.PORT||8080), token=process.env.API_TOKEN||'promptpay-local-demo-token';
let payment=null, revision=0;
const now=()=>performance.now();
function status(){if(payment&&now()>=payment.deadline){payment=null;revision++;}return payment?{online:true,mode:'qr',amount:payment.amount,remaining:Math.ceil((payment.deadline-now())/1000),qr:payment.qr,revision}:{online:true,mode:'video',amount:null,revision};}
function authorized(value){const a=Buffer.from(value||''),b=Buffer.from('Bearer '+token);return a.length===b.length&&timingSafeEqual(a,b);}
const assets={'/':'index.html','/display':'display.html','/app.js':'app.js','/style.css':'style.css','/video.mp4':'video.mp4'};
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Private-Network':'true'});res.end(code===204?'':JSON.stringify(data));};
 try{
 if(['/status','/show','/hide'].includes(path)){
 if(req.method==='OPTIONS')return send(204,{});
 if(!authorized(req.headers.authorization))return send(401,{error:'API token ไม่ถูกต้อง'});
 if(path==='/status'&&req.method==='GET')return send(200,status());
 if(req.method!=='POST'||path==='/status')return send(405,{error:'Method not allowed'});
 if(path==='/hide'){payment=null;revision++;return send(200,status());}
 if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'Use application/json'});
 let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1024)return send(400,{error:'Body too large'});}
 const body=JSON.parse(raw),amount=body.amount,timeout=body.timeout??60;
 if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||amount>9999999.99||Math.abs(amount*100-Math.round(amount*100))>0.000001)return send(400,{error:'จำนวนเงินต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง'});
 if(!Number.isInteger(timeout)||timeout<1||timeout>3600)return send(400,{error:'เวลา 1–3600 วินาที'});
 const qr=await QRCode.toDataURL(generatePayload('0812345678',{amount}),{width:480,margin:4});
 payment={amount,qr,deadline:now()+timeout*1000};revision++;return send(200,status());
 }
 if(path==='/network')return send(200,{port,addresses:Object.values(networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>x.address)});
 if(req.method!=='GET'||!assets[path])return send(404,{error:'Not found'});
 const file=assets[path],data=await readFile(new URL('public/'+file,import.meta.url));
 const mime=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'video/mp4';
 res.writeHead(200,{'Content-Type':mime,'Content-Length':data.length,'Cache-Control':'no-store'});res.end(data);
 }catch(e){if(!res.headersSent)send(400,{error:'Invalid request'});else res.end();}
});
server.requestTimeout=5000;server.headersTimeout=5000;
server.listen(port,'0.0.0.0',()=>console.log(`Web display test: http://localhost:${port}`));
