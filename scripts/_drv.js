const http=require('http'),{spawn}=require('child_process'),path=require('path');
const CHROME='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',PORT=9335,USER=path.join(process.env.TEMP,'cdp-d-'+Date.now());
const get=u=>new Promise((res,rej)=>{http.get(u,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pend=new Map();
const send=(m,p)=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p||{}}));});
async function evalJs(e){const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
 if(r.result&&r.result.exceptionDetails)return{__error:r.result.exceptionDetails.text};return r.result&&r.result.result?r.result.result.value:null;}
(async()=>{
 const chrome=spawn(CHROME,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port='+PORT,'--user-data-dir='+USER,'--window-size=1440,900','about:blank'],{stdio:'ignore'});
 let tabs=null;
 for(let i=0;i<80;i++){try{tabs=JSON.parse(await get('http://127.0.0.1:'+PORT+'/json/list'));if(tabs.length)break;}catch(e){}await sleep(250);}
 if(!tabs){console.log(JSON.stringify({fatal:'no chrome'}));process.exit(1);}
 const t=tabs.find(x=>x.type==='page');ws=new WebSocket(t.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);p(m);}};
 await send('Page.enable');await send('Runtime.enable');
 const s=require(path.resolve(process.argv[2]));
 const out=await s({send,evalJs,sleep});
 console.log(JSON.stringify(out,null,1));
 try{ws.close();}catch(e){}chrome.kill();process.exit(0);
})().catch(e=>{console.log(JSON.stringify({fatal:String(e&&e.stack||e)}));process.exit(1);});