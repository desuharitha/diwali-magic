import {recordHostedMp4} from './hosted-export.js';
import {WIDTH, HEIGHT, FPS, DURATION, SCENES, draw, timeline, lamps, rand, clamp, showCues, SHOW_LENGTH, FLIGHT, FIREWORK_LIFE, cameraAt, journey, journeyCamera, hitDiya} from './art.js';
import {createJourney, greetingPath, greetingFragment, parseGreeting, wishError} from './journey.js';

const $=id=>document.getElementById(id);
const canvas=$('art'), ctx=canvas.getContext('2d',{alpha:false});
const from=$('from'), to=$('to'), wish=$('wish');
const nameLimit=40;
const linkNames=parseGreeting(location.hash,location.pathname,location.search);
const readName=(value,fallback)=>Array.from(value?.trim()||'').slice(0,nameLimit).join('')||fallback;
const defaults={from:'Lahari 🌹',to:'Pallavi'};
const cleanNames=(sender,recipient)=>({from:readName(sender,defaults.from),to:readName(recipient,defaults.to)});
let names=cleanNames(linkNames?.from,linkNames?.to);
from.value=names.from;to.value=names.to;
const viewer=!!linkNames;
if(viewer){
  document.body.classList.add('viewer');
  $('recipient-title').textContent='Happy Diwali, '+names.to+'!';
  $('recipient-from').textContent='With love, '+names.from;
  if(linkNames.wish){
    $('recipient-wish').hidden=false;
    $('recipient-wish').textContent=linkNames.wish;
    canvas.setAttribute('aria-describedby','recipient-wish');
  }
  document.title='Happy Diwali, '+names.to+'!';
  $('cinema-controls').insertBefore($('sound'),$('cinema-exit'));
}
document.documentElement.classList.add('ready');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let scene=0,start=performance.now(),lit=[],litAt=[],revealed=false,lanterns=[],bursts=[],sparks=[],seed=0;
let audio, volume, music, fireworkBus, muted=false, lastTrail=0, lastChime=0, lastFrame=0;
let low=matchMedia('(pointer: coarse)').matches, frames=0, slowFrames=0;
let playing=false, paused=false, heldAt=null, previousTime=-1;
let story=createJourney(), storyFrame=story.update(0);
let diyaFallback=false, announcedLamps=new Set(), closingVolley=false;
const actHints=['Tap the house','Tap the diyas','Tap the rangoli','Tap the lantern','Tap the sky'];
const cueHint=$('scene-cue');
const invitation=$('invitation'), cinemaControls=$('cinema-controls');
function holdClock(){
  if(heldAt===null)heldAt=performance.now();
}
function releaseClock(){
  if(heldAt!==null){start+=performance.now()-heldAt;heldAt=null;}
}
const finaleStatus=$('finale-status');
let showStart=null, nextCue=0, ambientAt=Infinity, ambientIndex=0, showRunning=false, lastUserBurst=-Infinity;
const time=()=> ((heldAt??performance.now())-start)/1000;
const melody=[261.63,329.63,392,440,392,329.63,293.66,261.63,220,261.63,329.63,392,349.23,329.63,293.66,220];

function tone(hz,level,duration,offset=0,type='sine') {
  if(!audio||audio.state==='closed'||muted||(viewer&&(!playing||paused)))return;
  const at=audio.currentTime+offset, osc=audio.createOscillator(), gain=audio.createGain();
  osc.type=type;osc.frequency.value=hz;
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(level,at+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  osc.connect(gain).connect(volume);osc.start(at);osc.stop(at+duration+.015);
}
const soundBuffers={};
const sampleVoices=new Set();
let loadingSounds=false, airNoise;
function stopSamples(){
  for(const source of sampleVoices)source.stop();
  sampleVoices.clear();
}
function loadSounds(){
  if(loadingSounds)return;
  loadingSounds=true;
  for(const name of ['launch','boom','crackle']){
    fetch(new URL('./firework-'+name+'.wav',import.meta.url))
      .then(response=>{if(!response.ok)throw Error();return response.arrayBuffer();})
      .then(bytes=>audio.decodeAudioData(bytes))
      .then(buffer=>{soundBuffers[name]=buffer;}).catch(()=>{});
  }
}
function sample(name,level,pitch=1,delay=0){
  if(!audio||muted||document.hidden||paused||sampleVoices.size>=16||!soundBuffers[name])return false;
  const source=audio.createBufferSource(), gain=audio.createGain();
  source.buffer=soundBuffers[name];source.playbackRate.value=pitch;
  gain.gain.value=level;
  source.connect(gain).connect(fireworkBus);
  sampleVoices.add(source);
  source.onended=()=>{sampleVoices.delete(source);source.disconnect();gain.disconnect();};
  source.start(audio.currentTime+delay);
  return true;
}
function softAir(level,duration,frequency){
  if(!audio||muted||document.hidden||paused)return;
  if(!airNoise){
    airNoise=audio.createBuffer(1,audio.sampleRate,audio.sampleRate);
    const data=airNoise.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=2*rand(i+812)-1;
  }
  const at=audio.currentTime, source=audio.createBufferSource(), filter=audio.createBiquadFilter(), gain=audio.createGain();
  source.buffer=airNoise;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.65;
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(level,at+duration*.22);
  gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(filter).connect(gain).connect(volume);
  source.start(at);source.stop(at+duration);
}
function diyaSound(){softAir(.035,.26,440);tone(704,.032,.42,.07);chime(.018);}
function enableSound(){
  if(muted)return;
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return;
  try{
    if(!audio){
      audio=new Audio();volume=audio.createGain();volume.gain.value=.72;volume.connect(audio.destination);
      fireworkBus=audio.createDynamicsCompressor();
      fireworkBus.threshold.value=-18;fireworkBus.ratio.value=4;fireworkBus.connect(volume);
      loadSounds();
    }
    audio.resume().catch(()=>{});
    if(!music){
      let beat=0;
      music=setInterval(()=>{
        if(document.hidden||muted||audio.state!=='running'||(viewer&&(!playing||paused)))return;
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
  updateVolume();
  if(muted)stopSamples();else enableSound();
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
function haptic(pattern){
  if(typeof navigator.vibrate!=='function')return;
  if(pattern!==0&&(reduced.matches||document.hidden))return;
  try{navigator.vibrate(pattern);}catch{/* Device or browser declined vibration. */}
}
const activationHaptics=[18,0,22,16,[16,28,20]];
function interact(point){
  enableSound();
  const t=time();
  const [x,y]=point||[WIDTH/2,HEIGHT*.68];
  if(!reduced.matches)trail(x,y,9);
  if(scene===0){if(!point){go(1);haptic(18);}chime();return;}
  if(scene===1){
    if(lit.length===5){if(!point)go(2);return;}
    const [scale,cx,cy]=cameraAt(scene,t,reduced.matches);
    const lamp=point?hitDiya(cx+(x-WIDTH/2)/scale,cy+(y-HEIGHT/2)/scale)
      :lamps.findIndex((_,i)=>!lit.includes(i));
    if(lamp<0||lit.includes(lamp))return;
    lit.push(lamp);litAt[lamp]=t;diyaSound();haptic(12);refresh();return;
  }
  if(scene===2){
    if(revealed){if(!point)go(3);return;}
    revealed=true;chime(.052);haptic(22);refresh();return;
  }
  if(scene===3){
    lanterns=lanterns.filter(l=>t-l.time<8).slice(-5);
    lanterns.push({x:clamp(x,64,WIDTH-64),time:t});tone(523.25,.06,.95);chime();haptic(16);return;
  }
  userFirework(point,t);
  if(showStart===null)startShow(t);
}
function userFirework(point,t){
  if(t-lastUserBurst<.14)return;
  lastUserBurst=t;
  const k=seed++;
  const active=bursts.filter(b=>b.major&&t-b.time<FIREWORK_LIFE);
  if(active.length>=(low?3:5))bursts.splice(bursts.indexOf(active[0]),1);
  launchFirework({x:point?.[0]??125+rand(k)*(WIDTH-250),
    y:point?.[1]??210+rand(k+9)*240,time:t,seed:k,
    depth:'near',palette:k%5,scale:1.22,major:true});
  haptic(activationHaptics[4]);
}
function refreshFinale(){
  if(scene!==4)return;
  $('action').textContent=showStart===null?'Start fireworks':'Launch a firework';
  $('stop-show').disabled=!showRunning&&!bursts.length;
}
function resetFireworks(status){
  stopSamples();
  haptic(0);
  bursts=[];showStart=null;nextCue=0;ambientAt=Infinity;ambientIndex=0;showRunning=false;lastUserBurst=-Infinity;
  finaleStatus.textContent=status;
  refreshFinale();
}
function startShow(t){
  showStart=t;nextCue=0;ambientAt=t+SHOW_LENGTH+.8;showRunning=true;
  finaleStatus.textContent='Automatic fireworks playing.';
  refreshFinale();
}
function fireworkLevel(burst){
  return burst.major?1:burst.depth==='far'?.33:Math.min(.86,.46*burst.scale);
}
function launchFirework(burst){
  bursts.push(burst);
  refreshFinale();
}
function playBursts(t){
  for(const burst of bursts){
    const flight=t-burst.time;
    if(flight<0)continue;
    const level=fireworkLevel(burst);
    if(!burst.launched){
      burst.launched=true;
      if(flight<FLIGHT&&!sample('launch',.19*level,1.34+(burst.seed%4)*.09))softAir(.028*level,.3,670);
    }
    const age=flight-FLIGHT;
    if(burst.sounded||age<0)continue;
    burst.sounded=true;
    if(age>.18)continue;
    const pitch=burst.depth==='far'?1.08:.8+(burst.seed%4)*.07;
    if(!sample('boom',.42*level,pitch))tone(63+burst.palette*7,.087*level,.35,0,'triangle');
    if(burst.scale>=1||burst.style===2||burst.style===4)sample('crackle',.18*level,pitch+.18,.15);
    if(burst.depth==='near')sample('boom',.075*level,pitch*.83,.26);
  }
}
function advanceShow(t){
  const hadBursts=bursts.length>0;
  bursts=bursts.filter(b=>t-b.time<FIREWORK_LIFE);
  if(hadBursts&&!bursts.length)refreshFinale();
  if(!showRunning)return;
  while(nextCue<showCues.length&&t>=showStart+showCues[nextCue].time){
    const cue=showCues[nextCue++];
    const cueTime=showStart+cue.time;
    if(t-cueTime<FIREWORK_LIFE)launchFirework({...cue,time:cueTime});
  }
  if(t>=ambientAt){
    const n=ambientIndex++;
    if(n===0)finaleStatus.textContent='Fireworks still sparkling. Replay or stop whenever you like.';
    launchFirework({time:t,x:105+rand(n+90)*(WIDTH-210),y:190+rand(n+210)*285,
      seed:n+175,depth:'far',palette:n%5,scale:.65+rand(n+40)*.28});
    ambientAt=t+2.8+rand(n+320)*2.5;
  }
}
$('stop-show').onclick=()=>resetFireworks('Fireworks stopped.');
$('replay-show').onclick=()=>{
  enableSound();
  resetFireworks('');
  startShow(time());
};
function updateVolume(){
  if(volume)volume.gain.setTargetAtTime(muted||(viewer&&(!playing||paused||document.hidden))?0:.72,
    audio.currentTime,.025);
}
let screenLock=null, requestingScreen=false;
function needsScreen(){
  return playing&&!paused&&!document.hidden&&storyFrame.t<journey.closing+journey.writingDuration+2;
}
async function keepScreenAwake(){
  if(!navigator.wakeLock||requestingScreen||screenLock||!needsScreen())return;
  requestingScreen=true;
  try{
    const lock=await navigator.wakeLock.request('screen');
    if(!needsScreen()){await lock.release();return;}
    screenLock=lock;
    lock.addEventListener('release',()=>{if(screenLock===lock)screenLock=null;},{once:true});
  }catch{/* Playback works when the device declines the screen lock. */}
  finally{requestingScreen=false;}
}
function releaseScreen(){
  const lock=screenLock;
  screenLock=null;
  if(lock)lock.release().catch(()=>{});
}
function beginJourney(){
  heldAt=null;
  go(0,true);
  previousTime=-1;playing=true;paused=false;
  story=createJourney();storyFrame=story.update(0);
  diyaFallback=false;announcedLamps.clear();closingVolley=false;
  invitation.hidden=true;cinemaControls.hidden=false;
  $('cinema-pause').textContent='Pause';
  canvas.tabIndex=0;
  canvas.focus({preventScroll:true});
  enableSound();updateVolume();keepScreenAwake();
}
$('begin').onclick=beginJourney;
$('cinema-replay').onclick=beginJourney;
$('cinema-exit').onclick=()=>{
  playing=false;paused=false;heldAt=null;releaseScreen();
  go(0,true);updateVolume();
  invitation.hidden=false;cinemaControls.hidden=true;cueHint.hidden=true;
  canvas.removeAttribute('tabindex');
  $('begin').focus({preventScroll:true});
};
$('cinema-pause').onclick=()=>{
  paused=!paused;
  if(paused){holdClock();releaseScreen();stopSamples();haptic(0);}
  else if(!document.hidden){releaseClock();enableSound();keepScreenAwake();}
  $('cinema-pause').textContent=paused?'Resume':'Pause';
  updateVolume();
};
document.addEventListener('visibilitychange',()=>{
  if(!viewer||!playing)return;
  if(document.hidden){holdClock();releaseScreen();stopSamples();}
  else if(!paused){releaseClock();keepScreenAwake();}
  updateVolume();
});
function advanceJourney(now,tap=false){
  storyFrame=story.update(now,tap);
  const {act,t,waiting,events}=storyFrame;
  scene=act;
  if(waiting&&cueHint.textContent!==actHints[act])cueHint.textContent=actHints[act];
  cueHint.hidden=!waiting;
  for(const cue of events){
    if(cue===0){chime(.04);tone(660,.022,.65,.17);}
    if(cue===2)for(let i=0;i<5;i++)tone(840+i*175,.026,.55,i*.115);
    if(cue===4)startShow(journey.acts[4]);
  }
  if(act>=1&&!diyaFallback&&((act===1&&now>=storyFrame.readyAt+3)||act>1)){
    diyaFallback=true;
    let next=t;
    lamps.forEach((_,i)=>{
      if(litAt[i]===undefined){litAt[i]=next;next+=.53;}
    });
  }
  litAt.forEach((mark,i)=>{
    if(t>=mark&&!announcedLamps.has(i)){
      announcedLamps.add(i);diyaSound();
    }
  });
  for(const release of journey.lanterns){
    if(!release.background&&previousTime<release.time&&t>=release.time)softAir(.025,.67,560);
  }
  if(scene===4)advanceShow(t);
  const grand=journey.closing+journey.writingDuration;
  if(t>=grand&&!closingVolley){
    closingVolley=true;
    [[130,170,1,1.1],[365,210,0,1.52],[583,149,3,1.16],[510,292,4,1.25],[224,307,5,1.2]]
      .forEach(([x,y,palette,scale],i)=>{
        const launch=grand+i*.17;
        bursts.push({x,y,palette,scale,time:launch,depth:'near',seed:210+i,style:i});
      });
  }
  if(t>=journey.closing+journey.writingDuration+2&&previousTime<journey.closing+journey.writingDuration+2)releaseScreen();
  previousTime=t;
  return events;
}
function interactJourney(point){
  if(!playing||paused)return;
  const now=time();
  const justActivated=advanceJourney(now);
  const {act,t,waiting}=storyFrame;
  const [x,y]=point??[0,0];
  if(point&&!reduced.matches)trail(x,y,9);
  const [scale,cx,cy]=journeyCamera(t,reduced.matches);
  const wx=cx+(x-WIDTH/2)/scale, wy=cy+(y-HEIGHT/2)/scale;
  if(act===1){
    const lamp=point?hitDiya(wx,wy):lamps.findIndex((_,i)=>litAt[i]===undefined||litAt[i]>t);
    if(lamp<0)return;
    if(waiting)advanceJourney(now,true);
    if(litAt[lamp]===undefined||litAt[lamp]>t){
      litAt[lamp]=t;announcedLamps.add(lamp);diyaSound();haptic(12);
    }
    return;
  }
  const targets=[
    wx>92&&wx<638&&wy>490&&wy<795,
    false,
    Math.hypot((wx-360)*.7,wy-1027)<110,
    Math.hypot(wx-355,wy-740)<95,
    wy<675,
  ];
  if(waiting&&(!point||targets[act])){
    if(advanceJourney(now,true).includes(act))haptic(activationHaptics[act]);
    return;
  }
  if(!waiting&&act===4&&(!point||targets[4])&&!justActivated.includes(4))userFirework(point,t);
}
function stagePoint(e){
  const r=canvas.getBoundingClientRect();
  return [(e.clientX-r.left)*WIDTH/r.width,(e.clientY-r.top)*HEIGHT/r.height];
}
canvas.addEventListener('pointermove',e=>{
  if((viewer&&(!playing||paused))||(e.pointerType==='touch'&&!e.buttons))return;
  const now=performance.now();
  if(reduced.matches||now-lastTrail<30)return;
  lastTrail=now;trail(...stagePoint(e),low?2:4);
  if(now-lastChime>145){lastChime=now;chime(.013);}
});
canvas.addEventListener('pointerdown',e=>{
  if(e.isPrimary&&e.button===0){canvas.setPointerCapture(e.pointerId);(viewer?interactJourney:interact)(stagePoint(e));}
});
$('previous').onclick=()=>{enableSound();go(scene-1);};
$('next').onclick=()=>{enableSound();go(scene+1);};
$('action').onclick=()=>interact();
window.addEventListener('keydown',e=>{
  if(viewer){
    if(!e.repeat&&e.target===canvas&&(e.key===' '||e.key==='Enter')){e.preventDefault();interactJourney();}
    return;
  }
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
  wish.setCustomValidity(wishError(wish.value));
  if(!$('link').hidden){
    if(wish.validity.valid)$('link').value=greetingUrl().href;
    else {$('link').hidden=true;$('link').value='';}
  }
};
[from,to,wish].forEach(field=>field.addEventListener('input',updateNames));
function greetingUrl(){
  const url=new URL('./',location.href);
  const message=wish.value.trim()?wish.value:'';
  // Reserved path separators use the existing hash route across static hosts.
  if(!url.hostname.endsWith('.chatgpt.site')||/[\/\\]/.test(names.from+names.to))url.hash=greetingFragment({...names,wish:message});
  else{
    url.pathname+=greetingPath(names);
    if(message)url.searchParams.set('wish',message);
  }
  return url;
}
function showLink(){
  if(!wish.reportValidity())return null;
  const url=greetingUrl(), link=$('link');
  link.hidden=false;link.value=url.href;
  return url;
}
const localNote=()=>['localhost','127.0.0.1'].includes(location.hostname)?
  ' This preview link opens on this computer. Use the public site to share with friends.':'';
$('generate').onclick=()=>{
  if(!showLink())return;
  $('status').textContent='Your greeting link is ready.'+localNote();
};
$('preview').onclick=()=>{const url=showLink();if(url)window.open(url.href,'_blank','noopener');};
async function copyLink(){
  const url=showLink();
  if(!url)return;
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
  if(!url)return;
  if(!navigator.share||localNote())return copyLink();
  try{await navigator.share({title:'Happy Diwali, '+names.to+'!',url:url.href});}
  catch(e){if(e.name!=='AbortError')await copyLink();}
};
$('restart').onclick=()=>{enableSound();go(0,true);canvas.scrollIntoView({block:'nearest'});};

function animate(now){
  requestAnimationFrame(animate);
  if(document.hidden||now-lastFrame<31)return;
  const elapsed=time();
  if(viewer&&playing&&!paused)advanceJourney(elapsed);
  const t=viewer?(playing?storyFrame.t:0):elapsed;
  if(!viewer&&scene===4)advanceShow(t);
  if(!paused)playBursts(t);
  if(exporting)return;
  if(lastFrame&&now-lastFrame>46)slowFrames++;
  if(++frames===75){if(slowFrames>16)low=true;frames=0;slowFrames=0;}
  lastFrame=now;
  const width=low?450:720;
  if(canvas.width!==width){canvas.width=width;canvas.height=width*16/9;}
  draw(ctx,{scene,t,names,lit,litAt,revealed,lanterns:viewer?journey.lanterns:lanterns,
    bursts,sparks,openingWish:linkNames?.wish,sparkTime:elapsed,waiting:viewer&&playing&&storyFrame.waiting,low,reduceMotion:reduced.matches,cinematic:viewer});
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
const hostedExport=!['localhost','127.0.0.1','[::1]'].includes(location.hostname);
let savedFilmUrl;
$('download').onclick=async()=>{
  $('download').disabled=true;
  try{
    const width=Number($('quality').value), duration=$('duration').value;
    const progress=message=>$('status').textContent=message;
    if(hostedExport){
      const personal={...names};
      const blob=await recordHostedMp4(personal,width,duration,progress);
      const name=filename(personal).replace('.mp4',duration==='finale'?'_Finale.mp4':'.mp4');
      if(savedFilmUrl)URL.revokeObjectURL(savedFilmUrl);
      savedFilmUrl=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=savedFilmUrl;link.download=name;link.textContent='Save MP4';
      $('status').replaceChildren('Your personalized MP4 is ready. ',link);
      link.click();
    }else{
      const {blob,filename:name}=await renderVideo(names.from,names.to,width,progress,duration);
      downloadFile(blob,name);progress('Your personalized MP4 is ready.');
    }
  }catch(e){$('status').textContent=e.message;}
  finally{$('download').disabled=false;}
};
go(0);requestAnimationFrame(animate);


