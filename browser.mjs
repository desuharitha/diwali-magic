import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';

async function waitFor(check, timeout=20000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    const result=await check();
    if(result)return result;
    await sleep(100);
  }
  throw new Error('Timed out waiting for the browser.');
}
export async function withBrowser(chrome, url, run){
  const profile=await mkdtemp(join(tmpdir(),'diwali-chrome-'));
  const proc=spawn(chrome,['--headless=new','--disable-extensions','--disable-background-networking',
    '--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],
    {stdio:'ignore',windowsHide:true});
  let launchError, socket;
  const closed=once(proc,'close').catch(()=>{});
  proc.on('error',e=>launchError=e);
  try{
    const port=await waitFor(async()=>{
      if(launchError)throw launchError;
      if(proc.exitCode!==null)throw new Error('Chrome closed before startup.');
      try{return (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0];}
      catch(e){if(e.code!=='ENOENT')throw e;}
    });
    const host='http://127.0.0.1:'+port;
    const pages=await (await fetch(host+'/json/list')).json();
    socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{
      socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});
    });
    let id=0;
    const pending=new Map(), listeners=new Map();
    socket.addEventListener('message',({data})=>{
      const reply=JSON.parse(data);
      if(reply.id&&pending.has(reply.id)){
        const {resolve,reject}=pending.get(reply.id);pending.delete(reply.id);
        if(reply.error)reject(new Error(reply.error.message));else resolve(reply.result);
      }
      if(reply.method)listeners.get(reply.method)?.(reply.params);
    });
    socket.addEventListener('close',()=>{
      for(const {reject} of pending.values())reject(new Error('The browser connection closed.'));
      pending.clear();
    });
    const send=(method,params={})=>new Promise((resolve,reject)=>{
      pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
    });
    const evaluate=async(expression)=>{
      const {result,exceptionDetails}=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if(exceptionDetails)throw new Error(result.description||exceptionDetails.text);
      return result.value;
    };
    await send('Page.enable');
    const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));
    const navigation=await send('Page.navigate',{url});
    if(navigation.errorText)throw new Error(navigation.errorText);
    await loaded;
    return await run({send,evaluate});
  }finally{
    socket?.close();
    proc.kill();
    await Promise.race([closed,sleep(2500,undefined,{ref:false})]);
    await rm(profile,{recursive:true,force:true,maxRetries:6,retryDelay:200}).catch(()=>{});
  }
}
