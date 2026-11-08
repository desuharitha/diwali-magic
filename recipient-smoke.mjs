import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {withBrowser} from './browser.mjs';

const [chrome,base,folder]=process.argv.slice(2);
const url=new URL(base);
url.hash=new URLSearchParams({from:'Lahari 🌹',to:'Pallavi'});
if(folder)await mkdir(folder,{recursive:true});

await withBrowser(chrome,url.href,async({send,evaluate})=>{
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  for(let i=0;i<100&&!(await evaluate("document.documentElement.classList.contains('ready')"));i++)await sleep(50);
  const opening=await evaluate(`(()=>{
    const art=document.querySelector('#art'),r=art.getBoundingClientRect(),b=document.querySelector('#begin').getBoundingClientRect();
    return {title:document.querySelector('h1#recipient-title').textContent,x:b.x+b.width/2,y:b.y+b.height/2,
      ratio:r.width/r.height,position:[r.x,r.y,r.width,r.height],creator:getComputedStyle(document.querySelector('.intro')).display};
  })()`);
  assert.equal(opening.title,'Happy Diwali, Pallavi!');
  assert.equal(opening.creator,'none');
  assert.ok(Math.abs(opening.ratio-9/16)<.003,JSON.stringify(opening));
  await evaluate(`(()=>{
    window.screenRequests=0;window.screenReleases=0;
    Object.defineProperty(navigator,'wakeLock',{value:{request:async type=>{
      if(type!=='screen')throw new Error('Unexpected wake lock');
      window.screenRequests++;
      const lock=new EventTarget();
      lock.release=async()=>{window.screenReleases++;lock.dispatchEvent(new Event('release'));};
      return lock;
    }}});
    const proto=CanvasRenderingContext2D.prototype;
    const clear=proto.clearRect, text=proto.fillText, ellipse=proto.ellipse;
    window.recipientProbe={texts:[],lamps:0,lanterns:0,rockets:0};
    proto.clearRect=function(...args){
      if(this.canvas.id==='art')Object.assign(window.recipientProbe,{texts:[],lamps:0,lanterns:0,rockets:0});
      return clear.apply(this,args);
    };
    proto.fillText=function(value,...args){
      if(this.canvas.id==='art'&&this.globalAlpha>.4)window.recipientProbe.texts.push(value);
      return text.call(this,value,...args);
    };
    proto.ellipse=function(x,y,rx,ry,...args){
      if(this.canvas.id==='art'){
        if(rx===3.5&&ry===6)window.recipientProbe.lamps++;
        if(rx===15&&ry===3)window.recipientProbe.lanterns++;
        if(rx===2&&ry===2)window.recipientProbe.rockets++;
      }
      return ellipse.call(this,x,y,rx,ry,...args);
    };
    const connect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(destination,...args){
      if(this instanceof GainNode&&destination===this.context.destination&&!window.journeyRecorder){
        const tap=this.context.createMediaStreamDestination();
        connect.call(this,tap);
        const chunks=[];
        const recorder=new MediaRecorder(tap.stream);
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        recorder.start();
        window.journeyRecorder={recorder,chunks,context:this.context};
      }
      return connect.call(this,destination,...args);
    };
  })()`);
  const fps=12, intro=1.25, duration=58;
  const started=performance.now();
  let frame=0, tapped=false, sampled=-1, lastJpeg, sawLamp=false, sawWish=false, sawLantern=false;
  let sawRocket=false,sawClosing=false,sawAmbient=false;
  const position=JSON.stringify(opening.position);
  while(performance.now()-started<duration*1000){
    const elapsed=(performance.now()-started)/1000;
    if(!tapped&&elapsed>=intro){
      const {x,y}=opening;
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      tapped=true;
    }
    if(tapped&&Math.floor(elapsed*5)!==sampled){
      sampled=Math.floor(elapsed*5);
      const probe=await evaluate(`(()=>{
        const r=document.querySelector('#art').getBoundingClientRect();
        return {...window.recipientProbe,position:[r.x,r.y,r.width,r.height],
          audio:window.journeyRecorder?.context.state,
          manual:getComputedStyle(document.querySelector('.controls')).display};
      })()`);
      const t=elapsed-intro;
      assert.equal(JSON.stringify(probe.position),position,'Canvas shifted during playback');
      assert.equal(probe.manual,'none');
      if(t>1)assert.equal(probe.audio,'running');
      if(t>10&&t<17&&probe.lamps>0)sawLamp=true;
      if(t>20&&t<26&&probe.texts.includes('Happy Diwali, Pallavi!'))sawWish=true;
      if(t>27&&t<35&&probe.lanterns>0)sawLantern=true;
      if(t>36&&t<49&&probe.rockets>0)sawRocket=true;
      if(t>52&&probe.texts.includes('With love, Lahari 🌹'))sawClosing=true;
      if(t>50&&probe.rockets>0)sawAmbient=true;
    }
    if(folder){
      const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:85});
      const jpeg=Buffer.from(shot.data,'base64');
      const target=Math.min(duration*fps-1,Math.floor(elapsed*fps));
      while(frame<=target){
        await writeFile(join(folder,String(frame).padStart(4,'0')+'.jpg'),frame===target?jpeg:lastJpeg??jpeg);
        frame++;
      }
      lastJpeg=jpeg;
    }
    await sleep(folder?12:65);
  }
  assert.ok(sawLamp&&sawWish&&sawLantern&&sawRocket&&sawClosing&&sawAmbient,
    JSON.stringify({sawLamp,sawWish,sawLantern,sawRocket,sawClosing,sawAmbient}));
  if(folder){
    while(frame<duration*fps)await writeFile(join(folder,String(frame++).padStart(4,'0')+'.jpg'),lastJpeg);
    const audio=await evaluate(`(async()=>{
      const {recorder,chunks,context}=window.journeyRecorder;
      await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});
      const clip=await context.decodeAudioData(await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer());
      const data=new ArrayBuffer(44+clip.length*2), wav=new DataView(data);
      const tag=(offset,word)=>[...word].forEach((letter,i)=>wav.setUint8(offset+i,letter.charCodeAt(0)));
      tag(0,'RIFF');wav.setUint32(4,data.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');
      wav.setUint32(16,16,true);wav.setUint16(20,1,true);wav.setUint16(22,1,true);
      wav.setUint32(24,clip.sampleRate,true);wav.setUint32(28,clip.sampleRate*2,true);
      wav.setUint16(32,2,true);wav.setUint16(34,16,true);tag(36,'data');wav.setUint32(40,clip.length*2,true);
      const samples=clip.getChannelData(0);
      for(let i=0;i<samples.length;i++)wav.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);
      return await new Promise(resolve=>{
        const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(new Blob([data],{type:'audio/wav'}));
      });
    })()`);
    await writeFile(join(folder,'audio.wav'),Buffer.from(audio,'base64'));
  }
  assert.deepEqual(await evaluate('[window.screenRequests,window.screenReleases]'),[1,1]);
  const click=id=>evaluate('document.getElementById('+JSON.stringify(id)+').click()');
  await click('cinema-pause');
  assert.equal(await evaluate("document.querySelector('#cinema-pause').textContent"),'Resume');
  const stable=await evaluate(`(async()=>{
    const art=document.querySelector('#art');
    await new Promise(resolve=>setTimeout(resolve,140));
    const first=art.toDataURL();
    await new Promise(resolve=>setTimeout(resolve,220));
    return first===art.toDataURL();
  })()`);
  assert.ok(stable,'Playback continued while paused.');
  await click('cinema-pause');
  await click('cinema-replay');
  await sleep(150);
  assert.equal(await evaluate('window.recipientProbe.lamps'),0);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const [left,top,width,height]=opening.position;
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:left+width/2,y:top+height*887/1280}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(160);
  assert.equal(await evaluate('window.recipientProbe.lamps'),1,'A tap should light a diya ahead of its cue.');
  await click('cinema-exit');
  assert.equal(await evaluate("document.querySelector('#invitation').hidden"),false);
  console.log('Verified one tap, five continuous acts, automatic and ambient fireworks, closing names, stable portrait layout, active audio, pause, replay, early diya lighting, screen lock lifecycle and exit.');
});

