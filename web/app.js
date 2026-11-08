import {WIDTH, HEIGHT, FPS, DURATION, SCENES, draw, timeline, lamps, rand, clamp, showCues, SHOW_LENGTH, FLIGHT, FIREWORK_LIFE, cameraAt} from './art.js';

const $=id=>document.getElementById(id);
const canvas=$('art'), ctx=canvas.getContext('2d',{alpha:false});
const from=$('from'), to=$('to');
const nameLimit=40;
const params=new URLSearchParams(location.hash.slice(1));
const readName=(value,fallback)=>Array.from(value?.trim()||'').slice(0,nameLimit).join('')||fallback;
const defaults={from:'Lahari 🌹',to:'Pallavi'};
const cleanNames=(sender,recipient)=>({from:readName(sender,defaults.from),to:readName(recipient,defaults.to)});
let names=cleanNames(params.get('from'),params.get('to'));
from.value=names.from;to.value=names.to;
if(params.has('from')&&params.has('to')){
  document.body.classList.add('viewer');
  $('recipient-title').textContent='Happy Diwali, '+names.to+'!';
  $('recipient-from').textContent='With love, '+names.from;
  document.title='Happy Diwali, '+names.to+'!';
}
document.documentElement.classList.add('ready');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let scene=0,start=performance.now(),lit=[],litAt=[],revealed=false,lanterns=[],bursts=[],sparks=[],seed=0;
let audio, volume, music, muted=false, lastTrail=0, lastChime=0, lastFrame=0;
let low=matchMedia('(pointer: coarse)').matches, frames=0, slowFrames=0;
const effects=new Set();
const finaleStatus=$('finale-status');
let showStart=null, nextCue=0, ambientAt=Infinity, ambientIndex=0, showRunning=false, lastUserBurst=-Infinity, lastVibration=-Infinity;
const time=()=> (performance.now()-start)/1000;
const melody=[261.63,329.63,392,440,392,329.63,293.66,261.63,220,261.63,329.63,392,349.23,329.63,293.66,220];

function tone(hz,level,duration,offset=0,type='sine') {
  if(!audio||audio.state==='closed'||muted)return;
  const at=audio.currentTime+offset, osc=audio.createOscillator(), gain=audio.createGain();
  osc.type=type;osc.frequency.value=hz;
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(level,at+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  osc.connect(gain).connect(volume);osc.start(at);osc.stop(at+duration+.015);
}
function enableSound(){
  if(muted)return;
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return;
  try{
    if(!audio){audio=new Audio();volume=audio.createGain();volume.gain.value=.72;volume.connect(audio.destination);}
    audio.resume().catch(()=>{});
    if(!music){
      let beat=0;
      music=setInterval(()=>{
        if(document.hidden||muted||audio.state!=='running')return;
        const note=melody[beat%melody.length];
        tone(note,.036,1.05);tone(note*2,.008,.52);
        if(beat%4===0)tone(note/2,.037,2.1);
        beat++;
      },560);
    }
  }catch{/* Silent fallback. */}
}
function chime(strength=.023){
  const n=seed++;
  tone(870+rand(n)*440,strength,.21);
  tone(1580+rand(n+1)*470,strength*.38,.31,.015);
}
$('sound').onclick=()=>{
  muted=!muted;$('sound').textContent=muted?'Sound off':'Sound on';
  $('sound').setAttribute('aria-pressed',String(!muted));
  if(volume)volume.gain.setTargetAtTime(muted?0:.72,audio.currentTime,.02);
  if(!muted)enableSound();
};
const stepButtons=SCENES.map(([label],i)=>{
  const button=document.createElement('button');
  button.textContent=String(i+1).padStart(2,'0');button.title=label;
  button.setAttribute('aria-label',label);
  button.onclick=()=>{enableSound();go(i);};
  $('steps').append(button);return button;
});
function refresh(){
  const [title,hint,label]=SCENES[scene];
  $('chapter').textContent=String(scene+1).padStart(2,'0')+' / 05';
  $('scene').textContent=title;$('hint').textContent=hint;
  $('action').textContent=scene===1&&lit.length===5?'Continue to the rangoli':
    scene===2&&revealed?'Continue to the lanterns':label;
  $('finale-controls').hidden=scene!==4;
  refreshFinale();
  $('previous').disabled=scene===0;$('next').disabled=scene===4;
  stepButtons.forEach((button,i)=>i===scene?button.setAttribute('aria-current','step'):button.removeAttribute('aria-current'));
}
function go(i,restart=false){
  if(restart){lit=[];revealed=false;}
  scene=clamp(i,0,4);start=performance.now();litAt=[];lanterns=[];bursts=[];sparks=[];
  resetFireworks('');
  lastVibration=-Infinity;
  refresh();
}
function trail(x,y,n){
  const t=time();
  sparks=sparks.filter(s=>t-s.time<.64).slice(-100);
  for(let i=0;i<n;i++){
    const k=seed++;
    sparks.push({x,y,time:t,vx:(rand(k)-.5)*110,vy:(rand(k+2)-.65)*100,size:1.5+rand(k+8)*3});
  }
}
function interact(point){
  enableSound();
  const t=time();
  const [x,y]=point||[WIDTH/2,HEIGHT*.68];
  if(!reduced.matches)trail(x,y,9);
  if(scene===0){if(!point)go(1);chime();return;}
  if(scene===1){
    if(lit.length===5){if(!point)go(2);return;}
    const remaining=lamps.map((_,i)=>i).filter(i=>!lit.includes(i));
    const [scale,cx,cy]=cameraAt(scene,t,reduced.matches);
    const distance=i=>Math.hypot(lamps[i][0]-cx-(x-WIDTH/2)/scale,
      lamps[i][1]-cy-(y-HEIGHT/2)/scale);
    const lamp=point?remaining.reduce((a,b)=>distance(a)<distance(b)?a:b):remaining[0];
    lit.push(lamp);litAt[lamp]=t;chime(.047);refresh();return;
  }
  if(scene===2){
    if(revealed){if(!point)go(3);return;}
    revealed=true;chime(.052);refresh();return;
  }
  if(scene===3){
    lanterns=lanterns.filter(l=>t-l.time<8).slice(-5);
    lanterns.push({x:clamp(x,64,WIDTH-64),time:t});tone(523.25,.06,.95);chime();return;
  }
  if(t-lastUserBurst<.18)return;
  lastUserBurst=t;
  const k=seed++;
  const active=bursts.filter(b=>b.major&&t-b.time<FIREWORK_LIFE);
  if(active.length>=(low?3:5))bursts.splice(bursts.indexOf(active[0]),1);
  launchFirework({x:point?clamp(x,0,WIDTH):125+rand(k)*(WIDTH-250),
    y:point?clamp(y,0,HEIGHT):210+rand(k+9)*240,time:t,seed:k,
    depth:'near',palette:k%5,scale:1.22,major:true},t);
  if(showStart===null)startShow(t);
}
function refreshFinale(){
  if(scene!==4)return;
  $('action').textContent=showStart===null?'Start fireworks':'Launch a firework';
  $('stop-show').disabled=!showRunning&&!bursts.length;
}
function resetFireworks(status){
  effects.forEach(clearTimeout);effects.clear();navigator.vibrate?.(0);
  bursts=[];showStart=null;nextCue=0;ambientAt=Infinity;ambientIndex=0;showRunning=false;lastUserBurst=-Infinity;
  finaleStatus.textContent=status;
  refreshFinale();
}
function startShow(t){
  showStart=t;nextCue=0;ambientAt=t+SHOW_LENGTH+.8;showRunning=true;
  finaleStatus.textContent='Automatic fireworks playing.';
  refreshFinale();
}
function launchFirework(burst,now){
  bursts.push(burst);
  const remaining=burst.time+FLIGHT-now;
  if(remaining<=0)return;
  const level=burst.major?1:burst.depth==='far'?.34:.56;
  tone(620+burst.palette*45,.03*level,.24);
  const id=setTimeout(()=>{
    effects.delete(id);
    if(document.hidden)return;
    tone(63+burst.palette*7,.087*level,.35,0,'triangle');
    chime(.042*level);
    if(burst.major&&!reduced.matches&&/Android/i.test(navigator.userAgent)&&time()-lastVibration>=.65){
      lastVibration=time();
      navigator.vibrate?.([44,34,58]);
    }
  },remaining*1000);
  refreshFinale();
}
function advanceShow(t){
  const hadBursts=bursts.length>0;
  bursts=bursts.filter(b=>t-b.time<FIREWORK_LIFE);
  if(hadBursts&&!bursts.length)refreshFinale();
  if(!showRunning)return;
  while(nextCue<showCues.length&&t>=showStart+showCues[nextCue].time){
    const cue=showCues[nextCue++];
    const cueTime=showStart+cue.time;
    if(t-cueTime<FIREWORK_LIFE)launchFirework({...cue,time:cueTime},t);
  }
  if(t>=ambientAt){
    const n=ambientIndex++;
    if(n===0)finaleStatus.textContent='Fireworks still sparkling. Replay or stop whenever you like.';
    launchFirework({time:t,x:105+rand(n+90)*(WIDTH-210),y:190+rand(n+210)*285,
      seed:n+175,depth:'far',palette:n%5,scale:.65+rand(n+40)*.28},t);
    ambientAt=t+2.8+rand(n+320)*2.5;
  }
}
$('stop-show').onclick=()=>resetFireworks('Fireworks stopped.');
$('replay-show').onclick=()=>{
  enableSound();
  resetFireworks('');
  startShow(time());
};
function stagePoint(e){
  const r=canvas.getBoundingClientRect();
  return [(e.clientX-r.left)*WIDTH/r.width,(e.clientY-r.top)*HEIGHT/r.height];
}
canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'&&!e.buttons)return;
  const now=performance.now();
  if(reduced.matches||now-lastTrail<30)return;
  lastTrail=now;trail(...stagePoint(e),low?2:4);
  if(now-lastChime>125){lastChime=now;chime(.012);}
});
canvas.addEventListener('pointerdown',e=>{
  if(e.isPrimary&&e.button===0){canvas.setPointerCapture(e.pointerId);interact(stagePoint(e));}
});
$('previous').onclick=()=>{enableSound();go(scene-1);};
$('next').onclick=()=>{enableSound();go(scene+1);};
$('action').onclick=()=>interact();
window.addEventListener('keydown',e=>{
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.target.closest?.('input,select,textarea'))return;
  if((e.key===' '||e.key==='Enter')&&e.target.closest?.('button,a'))return;
  if(['ArrowLeft','ArrowRight',' ','Enter'].includes(e.key)){
    e.preventDefault();enableSound();
    if(e.key==='ArrowLeft')go(scene-1);
    else if(e.key==='ArrowRight')go(scene+1);
    else interact();
  }
});
$('names').onsubmit=e=>{
  e.preventDefault();enableSound();names=cleanNames(from.value,to.value);go(0,true);
  $('action').focus({preventScroll:true});canvas.scrollIntoView({block:'nearest'});
};
const updateNames=()=>{
  names=cleanNames(from.value,to.value);
  if(!$('link').hidden)$('link').value=greetingUrl().href;
};
from.addEventListener('input',updateNames);to.addEventListener('input',updateNames);
function greetingUrl(){
  const url=new URL(location.href);
  url.hash=new URLSearchParams(names).toString();
  return url;
}
function showLink(){
  const url=greetingUrl(), link=$('link');
  link.hidden=false;link.value=url.href;
  return url;
}
const localNote=()=>['localhost','127.0.0.1'].includes(location.hostname)?
  ' This preview link opens on this computer. Use the public site to share with friends.':'';
$('generate').onclick=()=>{
  showLink();
  $('status').textContent='Your greeting link is ready.'+localNote();
};
$('preview').onclick=()=>window.open(showLink().href,'_blank','noopener');
async function copyLink(){
  const url=showLink();
  try{
    await navigator.clipboard.writeText(url.href);
    $('status').textContent='Greeting link copied.'+localNote();
  }catch{
    $('link').focus();$('link').select();
    $('status').textContent='Select and copy the greeting link.'+localNote();
  }
}
$('copy').onclick=copyLink;
$('share').onclick=async()=>{
  const url=showLink();
  if(!navigator.share||localNote())return copyLink();
  try{await navigator.share({title:'Happy Diwali, '+names.to+'!',url:url.href});}
  catch(e){if(e.name!=='AbortError')await copyLink();}
};
$('restart').onclick=()=>{enableSound();go(0,true);canvas.scrollIntoView({block:'nearest'});};

function animate(now){
  requestAnimationFrame(animate);
  if(document.hidden||now-lastFrame<31)return;
  const t=time();
  if(scene===4)advanceShow(t);
  if(exporting)return;
  if(lastFrame&&now-lastFrame>46)slowFrames++;
  if(++frames===75){if(slowFrames>16)low=true;frames=0;slowFrames=0;}
  lastFrame=now;
  const width=low?450:720;
  if(canvas.width!==width){canvas.width=width;canvas.height=width*16/9;}
  draw(ctx,{scene,t,names,lit,litAt,revealed,lanterns,bursts,sparks,low,reduceMotion:reduced.matches});
}
let exporting=false;
const filename=({from,to})=>{
  const clean=s=>s.normalize('NFC').replace(/[^\p{L}\p{M}\p{N}_-]+/gu,'_').replace(/^_+|_+$/g,'')||'Name';
  return 'Diwali_'+clean(to)+'_From_'+clean(from)+'.mp4';
};
export async function renderVideo(sender,recipient,width,progress=()=>{},duration='47'){
  if(exporting)throw new Error('An export is already running.');
  if(![720,1080,2160].includes(width))throw new Error('Choose 720, 1080 or 2160 pixels wide.');
  if(!['35','47','60','finale'].includes(duration))throw new Error('Choose a supported film duration.');
  exporting=true;
  try{
    const personal=cleanNames(sender,recipient);
    const ready=await fetch('./api/ready');
    if(!ready.ok||!(ready.headers.get('content-type')||'').includes('application/json'))
      throw new Error('Start the local Python app to export MP4s.');
    const configuration=await ready.json();
    if(!configuration.ready)throw new Error(configuration.error);
    const surface=document.createElement('canvas');
    surface.width=width;surface.height=width*16/9;
    const context=surface.getContext('2d',{alpha:false});
    const clip=duration==='finale', length=clip?13:Number(duration);
    const frameCount=FPS*length, frames=[];
    for(let i=0;i<frameCount;i++){
      const position=clip?34+i/FPS:i*DURATION/frameCount;
      draw(context,timeline(position,personal));
      const jpg=await new Promise((resolve,reject)=>surface.toBlob(
        blob=>blob?resolve(blob):reject(new Error('Could not render a video frame.')),'image/jpeg',width===2160?.83:.89));
      frames.push(jpg);
      if(i%30===0)progress('Rendering frames · '+Math.floor(i/frameCount*100)+'%');
    }
    progress('Encoding MP4 with FFmpeg…');
    const settings=new URLSearchParams({width,duration});
    const result=await fetch('./api/export?'+settings,{
      method:'POST',headers:{'Content-Type':'application/octet-stream'},body:new Blob(frames),
    });
    if(!result.ok)throw new Error(await result.text());
    const name=filename(personal);
    return {blob:await result.blob(),filename:clip?name.replace('.mp4','_Finale.mp4'):name};
  }finally{exporting=false;}
}
function downloadFile(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
$('download').onclick=async()=>{
  $('download').disabled=true;
  try{
    const {blob,filename:name}=await renderVideo(names.from,names.to,Number($('quality').value),s=>$('status').textContent=s,$('duration').value);
    downloadFile(blob,name);$('status').textContent='Your personalized MP4 is ready.';
  }catch(e){$('status').textContent=e.message;}
  finally{$('download').disabled=false;}
};
go(0);requestAnimationFrame(animate);


