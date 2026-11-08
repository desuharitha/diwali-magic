import {parseGreeting} from './web/journey.js';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';
import {withBrowser} from './browser.mjs';

const [chrome,url,screenshot]=process.argv.slice(2);
await withBrowser(chrome,url,async({send,evaluate})=>{
  await evaluate(`new Promise((resolve,reject)=>{
    const started=Date.now();
    const check=()=>{
      if(document.documentElement.classList.contains('ready'))resolve();
      else if(Date.now()-started>5000)reject(new Error('Greeting did not initialize.'));
      else setTimeout(check,25);
    };check();
  })`);
  const get=id=>evaluate('document.getElementById('+JSON.stringify(id)+').textContent');
  const click=id=>evaluate('document.getElementById('+JSON.stringify(id)+').click()');
  assert.equal(await evaluate('document.querySelector("#from").value'),'Lahari 🌹');
  assert.equal(await evaluate('document.querySelector("#to").value'),'Pallavi');
  assert.equal(await get('chapter'),'01 / 05');
  if(screenshot){
    await send('Emulation.setDeviceMetricsOverride',{width:1220,height:1080,deviceScaleFactor:1,mobile:false});
    await new Promise(resolve=>setTimeout(resolve,1200));
    const shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(screenshot,Buffer.from(shot.data,'base64'));
  }

  await evaluate(`document.querySelector('#to').value='Asha & Noor';
    document.querySelector('#to').dispatchEvent(new Event('input'))`);
  await click('generate');
  const share=await evaluate('document.querySelector("#link").value');
  const link=new URL(share);
  assert.equal(parseGreeting(link.hash,link.pathname,link.search).to,'Asha & Noor');

  await evaluate('document.activeElement.blur()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  assert.equal(await get('chapter'),'02 / 05');
  for(let i=0;i<5;i++)await click('action');
  assert.equal(await get('action'),'Continue to the rangoli');
  await click('action');
  await click('action');
  assert.equal(await get('action'),'Continue to the lanterns');
  await click('action');
  await click('action');
  assert.equal(await get('chapter'),'04 / 05');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'});
  await evaluate(`(()=>{
    window.vibrations=[];navigator.vibrate=pattern=>{if(pattern)window.vibrations.push(pattern);return true};
    window.rockets=[];
    const ellipse=CanvasRenderingContext2D.prototype.ellipse;
    CanvasRenderingContext2D.prototype.ellipse=function(x,y,rx,ry,...args){
      if(this.canvas.id==='art'&&rx===2&&ry===2)window.rockets.push({x,y});
      return ellipse.call(this,x,y,rx,ry,...args);
    };
  })()`);
  await click('next');
  assert.equal(await get('chapter'),'05 / 05');
  assert.equal(await evaluate('document.documentElement.scrollWidth'),390);
  assert.ok(await evaluate(`(()=>{
    const r=document.querySelector('canvas').getBoundingClientRect();
    return Math.abs(r.width/r.height-9/16)<.002;
  })()`));
  const tap=async fraction=>{
    const {x,y}=await evaluate(`(()=>{
      const c=document.querySelector('canvas');c.scrollIntoView({block:'center'});
      const r=c.getBoundingClientRect();return {x:r.left+r.width*${fraction},y:r.top+r.height*.26};
    })()`);
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await tap(.66);
  assert.equal(await get('finale-status'),'Automatic fireworks playing.');
  await sleep(450);
  assert.ok(await evaluate('window.rockets.some(r=>Math.abs(r.x-475)<17)'));
  assert.deepEqual(await evaluate('window.vibrations'),[[44,34,58]]);
  await sleep(350);
  assert.ok(await evaluate('window.rockets.some(r=>Math.abs(r.x-199)<17)'));
  assert.equal(await evaluate('window.vibrations.length'),1);
  await tap(.45);
  await sleep(450);
  assert.ok(await evaluate('window.rockets.some(r=>Math.abs(r.x-324)<17)'));
  assert.equal(await evaluate('window.vibrations.length'),2);
  assert.equal(await get('finale-status'),'Automatic fireworks playing.');
  await sleep(12200);
  assert.match(await get('finale-status'),/still sparkling/);
  assert.equal(await evaluate('window.vibrations.length'),2);
  await click('stop-show');
  assert.equal(await get('finale-status'),'Fireworks stopped.');
  await click('replay-show');
  assert.equal(await get('finale-status'),'Automatic fireworks playing.');

  const viewer=await evaluate(`new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');frame.src=${JSON.stringify(share)};
    frame.onload=()=>{
      const started=Date.now();
      const check=()=>{
        const doc=frame.contentDocument;
        if(doc.documentElement.classList.contains('ready')){
          resolve([doc.body.classList.contains('viewer'),doc.querySelector('#recipient-title').textContent,
            frame.contentWindow.getComputedStyle(doc.querySelector('.intro')).display]);
        }else if(Date.now()-started>5000)reject(new Error('Recipient greeting did not initialize.'));
        else setTimeout(check,30);
      };check();
    };
    document.body.append(frame);
  })`);
  assert.deepEqual(viewer,[true,'Happy Diwali, Asha & Noor!','none']);
  console.log('Passed personalization, link, keyboard, lamp, rangoli, lantern, portrait layout, tap positioning, automatic fireworks, ambient continuation, replay, stop and Android vibration-hook checks.');
});

