import {acts} from './journey.js';

export const WIDTH = 720, HEIGHT = 1280, FPS = 30, DURATION = 47;
export const SCENES = [
  ['The lantern-lit house', 'Move your pointer or trace the courtyard with a finger.', 'Enter the courtyard'],
  ['Light the diyas', 'Tap a lamp or press Space to kindle the next flame.', 'Light a diya'],
  ['A wish in color', 'Tap or press Space to wake the rangoli.', 'Reveal the wish'],
  ['A light for the sky', 'Tap or press Space to release a sky lantern.', 'Release a lantern'],
  ['Fireworks for Diwali', 'Tap the sky or press Space to start the show.', 'Start fireworks'],
];
export const cuts = [0, 8, 17, 26, 34, DURATION];
export const lampTimes = [9, 10.4, 11.8, 13.2, 14.6];
const cueFile = await fetch(new URL('./fireworks.json', import.meta.url));
if (!cueFile.ok) throw new Error('Could not load the fireworks cues.');
const show = await cueFile.json();
export const FLIGHT = show.flight, FIREWORK_LIFE = show.lifetime;
export const showCues = show.cues.map(([time,x,y,depth,palette,scale],i)=>
  ({time,x,y,depth,palette,scale,seed:i+15}));
export const SHOW_LENGTH = showCues.at(-1).time + FIREWORK_LIFE;
const exportBursts = [
  {time:show.exportStart-cuts[4],x:486,y:313,depth:'near',palette:0,scale:1.22,seed:5,major:true},
  ...showCues.map(cue=>({...cue,time:cue.time+show.exportStart-cuts[4]})),
];
export const colors = ['#ffce83','#ff879f','#92efe0','#cbaaff','#ff9f69'];
export const lamps = [[124,931],[231,901],[360,887],[489,901],[596,931]];
export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi,x));
export const smooth = x => { x = clamp(x); return x*x*(3-2*x); };
export const rand = n => {
  const v = Math.sin(n*127.1 + 78.233)*43758.5453;
  return v - Math.floor(v);
};

function ellipse(c,x,y,rx,ry,fill) {
  c.fillStyle = fill; c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fill();
}
function polygon(c,points,fill) {
  c.fillStyle = fill; c.beginPath();
  points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
  c.closePath(); c.fill();
}
function rect(c,x,y,w,h,fill) { c.fillStyle = fill; c.fillRect(x,y,w,h); }
function line(c,x,y,xx,yy,color,w=1) {
  c.strokeStyle=color; c.lineWidth=w; c.beginPath(); c.moveTo(x,y); c.lineTo(xx,yy); c.stroke();
}
function glow(c,x,y,r,color) {
  const g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,color); g.addColorStop(1,'transparent');
  rect(c,x-r,y-r,2*r,2*r,g);
}
function windowLight(c,x,y,w,h) {
  rect(c,x-6,y-4,w+12,h+12,'#321b2a');
  c.beginPath(); c.moveTo(x,y+h); c.lineTo(x,y+w/2); c.arc(x+w/2,y+w/2,w/2,Math.PI,0);
  c.lineTo(x+w,y+h); c.closePath(); c.fillStyle='#f5b978'; c.fill();
  glow(c,x+w/2,y+h/2,w*1.25,'#ffa54a38');
  for(let i=1;i<4;i++) line(c,x+i*w/4,y+10,x+i*w/4,y+h,'#63333a',1.5);
  line(c,x,y+h*.64,x+w,y+h*.64,'#63333a',2);
  rect(c,x-7,y+h,w+14,4,'#d19365');
}
function stringLights(c,x,y,w,drop) {
  c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo(x+w/2,y+drop*2,x+w,y);
  c.lineWidth=1;c.strokeStyle='#b68557';c.stroke();
  for(let i=0;i<=24;i++){
    const u=i/24, xx=x+w*u, yy=y+4*drop*u*(1-u);
    glow(c,xx,yy,9,'#ffaf5a68');ellipse(c,xx,yy,1.65,2.3,'#fff0b3');
  }
}
function tree(c,x,y,s,seed) {
  c.save();c.translate(x,y);c.scale(s,s);
  polygon(c,[[-7,10],[-3,-59],[-31,-102],[0,-81],[22,-114],[6,-67],[11,10]],'#201522');
  for(let i=0;i<20;i++){
    const u=rand(seed+i),v=rand(seed+i+42);
    ellipse(c,(u-.5)*125,-60-v*90,12+v*19,9+u*16,i%4?'#25192c':'#312139');
  }
  c.restore();
}
function paintSky(c) {
  const sky=c.createLinearGradient(0,0,0,820);
  sky.addColorStop(0,'#100d26');sky.addColorStop(.55,'#29203d');sky.addColorStop(1,'#6a4148');
  rect(c,0,0,WIDTH,HEIGHT,sky);
  for(let i=0;i<116;i++){
    const x=rand(i)*WIDTH,y=rand(i+150)*750,r=.55+rand(i+80)*1.25;
    ellipse(c,x,y,r,r,i%7?'#c9a9bd80':'#ffe6b5c0');
  }
  glow(c,563,208,78,'#fbb07935');
  ellipse(c,563,208,32,32,'#f8d0a3');ellipse(c,575,197,28,28,'#211932');
  for(let i=0;i<20;i++) {
    const x=i*39,y=674-rand(i)*66;
    rect(c,x,y,34,145,i%2?'#35283d':'#423043');
    rect(c,x+9,y+19,4,8,'#a17261');
  }
}
function paintCourtyard(c) {
  for(const [x,y,size,seed] of [[49,753,1.24,1],[675,753,1.32,21],[96,725,.78,34],[635,727,.85,63]])
    tree(c,x,y,size,seed);
  const floor=c.createLinearGradient(0,737,0,HEIGHT);
  floor.addColorStop(0,'#604049');floor.addColorStop(.56,'#3b2739');floor.addColorStop(1,'#221529');
  rect(c,0,753,WIDTH,HEIGHT-753,floor);
  for(let i=-8;i<=8;i++)line(c,360+i*27,749,360+i*106,HEIGHT,'#c68b6734');
  for(const y of [770,797,832,876,934,1009,1102,1210])line(c,0,y,WIDTH,y,'#c68b672e');
  polygon(c,[[0,765],[174,711],[174,746],[0,888]],'#492d3d');
  polygon(c,[[546,711],[720,765],[720,888],[546,746]],'#492d3d');
  for(const x of [70,585]){
    rect(c,x,655,65,103,'#704353');windowLight(c,x+17,675,25,43);
    polygon(c,[[x-11,657],[x+11,634],[x+54,634],[x+76,657]],'#45263e');
  }
  c.save();c.translate(-120,396);
  const wall=c.createLinearGradient(230,130,720,375);
  wall.addColorStop(0,'#b5715e');wall.addColorStop(.55,'#864c4d');wall.addColorStop(1,'#603747');
  polygon(c,[[715,213],[744,225],[744,343],[715,358]],'#45283a');
  rect(c,245,207,470,151,wall);rect(c,295,121,370,112,wall);
  polygon(c,[[222,220],[258,192],[702,192],[738,220]],'#462237');
  polygon(c,[[267,130],[307,98],[653,98],[693,130]],'#44253c');
  rect(c,267,128,426,6,'#ad6453');rect(c,223,219,514,6,'#bd7e5a');
  rect(c,248,226,465,10,'#572f3e');rect(c,295,134,370,6,'#633848');
  for(const x of [260,300,660,699]){rect(c,x,226,7,131,'#ce8d69');rect(c,x-4,349,15,8,'#b57559');}
  for(const x of [320,385,540,605])windowLight(c,x,142,34,43);
  for(const x of [276,340,578,642])windowLight(c,x,247,41,65);
  windowLight(c,443,138,74,59); windowLight(c,435,239,90,113);
  rect(c,466,260,28,93,'#fff1bb');glow(c,480,343,91,'#ffc47645');
  rect(c,410,194,140,5,'#c58b68');
  for(let x=415;x<550;x+=9)rect(c,x,181,3,16,'#462535');
  rect(c,409,179,142,4,'#e5aa76');
  for(let i=0;i<4;i++)rect(c,412-i*8,351+i*6,136+i*16,5,'#ae7662');
  stringLights(c,278,132,404,12);
  stringLights(c,238,225,242,11);stringLights(c,480,225,242,11);
  stringLights(c,120,365,130,20);stringLights(c,710,365,130,20);
  for(let i=0;i<22;i++) {
    const x=251+i*22,y=354+2*Math.sin(i);
    glow(c,x,y-3,12,'#ffac6370');ellipse(c,x,y-3,1.7,2.5,'#ffdfa0');
  }
  c.restore();
  for(const [x,y] of [[68,812],[650,812],[42,941],[677,941]]){
    ellipse(c,x,y+10,22,7,'#20142390');
    rect(c,x-2,y-24,4,34,'#3b2130');glow(c,x,y-22,38,'#ffab5a65');
    ellipse(c,x,y-23,4,6,'#ffcf86');
  }
}
function paintFoliage(c){
  for(let side=0;side<2;side++){
    c.save();if(side){c.translate(WIDTH,0);c.scale(-1,1);}
    for(let i=0;i<27;i++){
      const x=rand(i+side*37)*112-27,y=1008+rand(i+190)*300;
      ellipse(c,x,y,15+rand(i+250)*31,9+rand(i+351)*19,i%3?'#25212f':'#403042');
      if(i%3===0)ellipse(c,x+8,y-5,3,2.4,i%2?'#cd777f':'#e4a65f');
    }
    line(c,0,547,53,462,'#211728',6);line(c,20,515,65,512,'#211728',4);
    for(let i=0;i<14;i++)ellipse(c,rand(i+94)*71-8,460+rand(i+70)*68,13,7,'#2e2235');
    c.restore();
  }

}
function paintLayer(paint) {
  const layer=document.createElement('canvas');
  layer.width=WIDTH;layer.height=HEIGHT;
  paint(layer.getContext('2d'));
  return layer;
}
const skyLayer=paintLayer(paintSky), courtyardLayer=paintLayer(paintCourtyard), foliageLayer=paintLayer(paintFoliage);
const plate=paintLayer(c=>{c.drawImage(skyLayer,0,0);c.drawImage(courtyardLayer,0,0);});

function diya(c,x,y,s,lit,t,ignition=1) {
  c.save();c.translate(x,y);c.scale(s,s);
  ellipse(c,0,9,36,7,'#100a1b80');
  if(lit)glow(c,0,-9,(49+3*Math.sin(t*10))*ignition,'#ff9b3d82');
  c.beginPath();c.moveTo(-30,0);c.quadraticCurveTo(-22,20,1,18);c.quadraticCurveTo(22,17,31,-2);
  c.closePath();c.fillStyle='#a84742';c.fill();c.strokeStyle='#f1ad6c';c.lineWidth=1.8;c.stroke();
  ellipse(c,0,0,30,6,'#e6915f');ellipse(c,0,0,25,3.6,'#502436');
  for(let i=-18;i<=18;i+=6)ellipse(c,i,9+3*(1-Math.abs(i)/18),1.2,1.2,'#ffc47c');
  line(c,-2,0,3,-6,'#35212a',2);
  if(lit){
    c.scale(1,ignition);
    const sway=3*Math.sin(t*9);
    c.beginPath();c.moveTo(3,-3);c.bezierCurveTo(-13,-10,5+sway,-24,5+sway,-30);
    c.bezierCurveTo(10+sway,-22,18,-7,3,-3);
    c.fillStyle='#ffb450';c.fill();ellipse(c,4,-9,3.5,6,'#fff4bb');
  }
  c.restore();
}
function rangoli(c,t,brightness) {
  c.save();c.translate(360,1027);c.scale(1,.62);c.rotate(t*.07);
  const r=102+38*brightness;
  c.globalAlpha=.27+(.66+.06*Math.sin(t*2.1))*brightness;
  glow(c,0,0,r*1.6,'#f49c574c');
  for(let i=0;i<16;i++){
    c.rotate(Math.PI/8);
    ellipse(c,r*.73,0,r*.27,r*.103,colors[i%4]);
    ellipse(c,r*.87,0,r*.105,r*.043,'#401c44');
    ellipse(c,r*1.10,0,r*.03,r*.03,'#ffdf90');
    ellipse(c,r*.38,0,r*.21,r*.07,colors[(i+2)%5]);
  }
  ellipse(c,0,0,15,15,'#ffca78');ellipse(c,0,0,8,8,'#f17785');
  c.restore();
}
function lantern(c,x,y,s,t) {
  c.save();c.translate(x,y);c.rotate(Math.sin(t*1.6)*.09);c.scale(s,s);
  glow(c,0,0,70,'#ff913c70');
  const paper=c.createLinearGradient(-18,0,18,0);
  paper.addColorStop(0,'#c65343');paper.addColorStop(.5,'#ffd593');paper.addColorStop(1,'#d66647');
  polygon(c,[[-16,-20],[16,-20],[21,-10],[15,20],[-15,20],[-21,-10]],paper);
  line(c,-9,-19,-8,19,'#da7646');line(c,9,-19,8,19,'#da7646');
  ellipse(c,0,20,15,3,'#7d3c3d');ellipse(c,0,21,5,2,'#fff2b7');c.restore();
}
const fireworkPalettes = [
  ['#ffb459','#ffe6a0'], ['#f378ad','#ffc6d9'], ['#62ded3','#ecfff8'],
  ['#8aafff','#ecf6ff'], ['#ff746f','#ffe0a6'],
];
function firework(c,b,t,low) {
  const dt=t-b.time;
  if(dt<0||dt>=FIREWORK_LIFE)return;
  const far=b.depth==='far', [trailColor,tipColor]=fireworkPalettes[b.palette];
  c.save();
  if(dt<FLIGHT){
    const progress=dt/FLIGHT, y=b.y+(far?780-b.y:940-b.y)*(1-progress)**1.45;
    const x=b.x+Math.sin(progress*Math.PI)*12;
    c.globalAlpha=far?.61:1;
    line(c,x,y,x-3,y+23,trailColor,far?1:2);
    ellipse(c,x,y,2,2,tipColor);
    c.restore();
    return;
  }
  const age=dt-FLIGHT, fade=clamp(1-age/(FIREWORK_LIFE-FLIGHT));
  const count=far?(low?13:27):(low?23:48);
  const spread=1-Math.exp(-age*2.6), drop=age*age*(far?16:24);
  c.globalAlpha=fade*(far?.65:.94);
  if(!low&&age<.42)glow(c,b.x,b.y,30+age*85,trailColor+'64');
  c.strokeStyle=trailColor;c.lineWidth=far?1:1.7;c.fillStyle=tipColor;
  const tips=[];
  c.beginPath();
  for(let i=0;i<count;i++){
    const angle=i/count*Math.PI*2+b.seed, dx=Math.cos(angle),dy=Math.sin(angle);
    const jitter=rand(b.seed*91+i);
    const ring=i%3===0?.58:1;
    const radius=(77+jitter*53)*ring*b.scale*spread;
    const x=b.x+dx*radius,y=b.y+dy*radius+drop;
    const tail=(far?9:16)*fade*b.scale;
    c.moveTo(x-dx*tail,y-dy*tail-age*6);c.lineTo(x,y);
    if(i%2===0||!low)tips.push(x,y);
  }
  c.stroke();
  for(let i=0;i<tips.length;i+=2)c.fillRect(tips[i],tips[i+1],far?1.6:2.3,far?1.6:2.3);
  c.restore();
}
function centered(c, text, y, size, color, max=WIDTH-100) {
  c.textAlign='center';c.textBaseline='middle';
  c.font=size+'px Georgia, "Noto Serif", serif';
  c.fillStyle=color;c.fillText(text,WIDTH/2,y,max);
}
function message(c, title, caption, y, alpha, size) {
  c.save();c.globalAlpha=alpha;
  const veil=c.createLinearGradient(0,y-75,0,y+82);
  veil.addColorStop(0,'transparent');veil.addColorStop(.42,'#1b102bde');veil.addColorStop(1,'transparent');
  rect(c,0,y-75,WIDTH,157,veil);
  c.shadowColor='#ffad61';c.shadowBlur=10;
  centered(c,title,y,size,'#ffe3a8');
  c.shadowBlur=0;centered(c,caption,y+51,30,'#fff0d8',WIDTH-90);c.restore();
}
export function cameraAt(scene,t,reduceMotion){
  const motion=reduceMotion?1:smooth(t/(scene===0?8:6));
  const cameras=[[1+motion*.045,360,670],[1.035+motion*.025,360,700],
    [1.05,360,692],[1.035,360,624],[1,360,640]];
  const [scale,cx,cy]=cameras[scene];
  return [scale,cx,clamp(cy,HEIGHT/2/scale,HEIGHT-HEIGHT/2/scale)];
}

// Recipient cues use one clock across the five acts and the ambient closing.
export const journey = {
  acts,
  lamps:lampTimes,
  lanterns:[{time:26.5,x:355},{time:28.9,x:208},{time:30.6,x:512},
    {time:32.9,x:287},{time:35.3,x:557},{time:38.5,x:420}],
  closing:51,
};
const cameraKeys=[[0,1,640],[8,1.045,666],[15,1.073,682],[23,1.055,672],
  [33,1.03,632],[39,1,640]];
export function journeyCamera(t,reduced){
  if(reduced)return [1,360,640];
  const i=cameraKeys.findIndex(key=>key[0]>t);
  if(i<0)return [1,360,640];
  const [start,z,y]=cameraKeys[i-1], [end,nextZ,nextY]=cameraKeys[i];
  const progress=smooth((t-start)/(end-start));
  return [z+(nextZ-z)*progress,360,y+(nextY-y)*progress];
}

export function draw(c,{scene,t,names,lit=[],litAt=[],revealed=false,lanterns=[],bursts=[],sparks=[],sparkTime=t,waiting=false,low=false,reduceMotion=false,fade=0,cinematic=false}) {
  c.setTransform(c.canvas.width/WIDTH,0,0,c.canvas.height/HEIGHT,0,0);
  c.clearRect(0,0,WIDTH,HEIGHT);
  c.save();
  const [scale,cx,cy]=cinematic?journeyCamera(t,reduceMotion):cameraAt(scene,t,reduceMotion);
  c.translate(WIDTH/2,HEIGHT/2);c.scale(scale,scale);
  c.translate(-cx,-cy);
  if(scene===4&&bursts.length){
    c.drawImage(skyLayer,0,0);
    for(const b of bursts)if(b.depth==='far')firework(c,b,t,low||reduceMotion);
    c.drawImage(courtyardLayer,0,0);
  }else c.drawImage(plate,0,0);
  if(cinematic&&t<15){
    const shade=c.createLinearGradient(0,420,0,870);
    shade.addColorStop(0,'transparent');shade.addColorStop(.53,'#160d2b');
    shade.addColorStop(1,'transparent');
    c.save();c.globalAlpha=.53*(1-smooth((t-.5)/14.5));
    rect(c,0,420,WIDTH,450,shade);c.restore();
  }
  const rangoliLight=cinematic?smooth((t-journey.acts[2])/4):Number(scene>=3||revealed);
  rangoli(c,reduceMotion?0:t,rangoliLight);
  if(cinematic){
    lamps.forEach(([x,y],i)=>{
      const ignition=litAt[i]??journey.lamps[i];
      const size=.70+(.15+(i===2?.26:0))*smooth((t-5)/5)*(1-smooth((t-16)/5));
      diya(c,x,y,size,t>=ignition,t+i,.18+.82*smooth((t-ignition)/.7));
    });
  }
  if(!cinematic&&scene!==1)lamps.forEach(([x,y],i)=>diya(c,x,y,.70,scene>=2,t+i));
  if(!cinematic&&scene===1){
    lamps.forEach(([x,y],i)=>diya(c,x,y,i===2?1.28:.78,lit.includes(i),t+i,.2+.8*smooth((t-(litAt[i]??-1))/.52)));
    for(let i=0;i<6;i++)diya(c,185+i*70,788,.42,lit.length>i%5,t);
  }
  if(!cinematic&&scene>=3){
    const count=scene===4?7:3;
    for(let i=0;i<count;i++) {
      const x=115+i*(scene===4?83:238),y=555-((t*(17+i)+i*71)%435);
      lantern(c,x+Math.sin(t+i)*15,y,.34+rand(i)*.25,t+i);
    }
  }
  if(cinematic&&scene===3&&t<journey.lanterns[0].time){
    const lift=waiting?0:smooth((t-journey.acts[3])/.5);
    c.save();
    c.globalAlpha=.78*(1-lift);
    lantern(c,journey.lanterns[0].x,740,1.12,reduceMotion?0:sparkTime);
    c.restore();
  }
  lanterns.forEach(l=>{
    const age=t-l.time;
    if(age>=0&&age<9){
      c.save();
      if(cinematic)c.globalAlpha=smooth(age/.55)*(1-smooth((age-7.6)/1.4));
      lantern(c,l.x+(reduceMotion?0:Math.sin(age)*18),740-age*(reduceMotion?65:82),1.12-age*.068,t);
      c.restore();
    }
  });
  c.translate(reduceMotion?0:Math.sin(t*.24)*4,0);
  c.drawImage(foliageLayer,0,0);
  c.restore();
  if(!cinematic&&scene===0)message(c,'Diwali Magic','A festival of light and little wonders',179,smooth(t/.9),58);
  if(!cinematic&&scene===1&&lit.length===0)message(c,'Light the diyas','One small flame can light up a courtyard',178,smooth(t/.6),52);
  if(!cinematic&&scene===2&&revealed)message(c,'Happy Diwali, '+names.to+'!','May every little spark bring a new reason to smile.',170,1,59);
  if(!cinematic&&scene===3)message(c,'Send a wish into the sky','Let it rise with the lanterns',174,smooth(t/.6),50);
  for(const b of bursts)if(b.depth!=='far')firework(c,b,t,low||reduceMotion);
  if(!cinematic&&scene===4&&t>2.4)message(c,'Happy Diwali, '+names.to+'!','With love, '+names.from,1152,smooth((t-2.4)/.9),52);
  if(cinematic){
    const wish=smooth((t-19)/2.2)*(1-smooth((t-25)/2.4));
    if(wish>0)message(c,'Happy Diwali, '+names.to+'!','May every little spark bring a new reason to smile.',178,wish,55);
    const closing=smooth((t-journey.closing)/2.4);
    if(closing>0)message(c,'Happy Diwali, '+names.to+'!','With love, '+names.from,1152,closing,52);
  }
  for(const s of sparks){
    const a=sparkTime-s.time;
    if(a<0||a>.64)continue;
    c.save();c.globalAlpha=1-a/.64;
    const x=s.x+s.vx*a,y=s.y+s.vy*a+27*a*a,r=s.size;
    line(c,x-r,y,x+r,y,'#ffde90',1.2);line(c,x,y-r,x,y+r,'#fff2c3',1.2);
    c.restore();
  }
  if(fade)rect(c,0,0,WIDTH,HEIGHT,'rgba(18,11,28,'+fade+')');
}
export function timeline(seconds,names) {
  const scene=cuts.findIndex((_,i)=>seconds<cuts[i+1]);
  const index=scene<0?4:scene, t=seconds-cuts[index];
  const sparks=[];
  if(index===0)for(let i=0;i<80;i++){
    const time=1+i*.075;
    if(t-time>=0&&t-time<.64)sparks.push({time,x:114+i*6,y:873+Math.sin(i*.08)*61,vx:rand(i)*24-12,vy:-24,size:2+rand(i+8)*2});
  }
  return {scene:index,t,names,lit:lampTimes.flatMap((time,i)=>seconds>=time?[i]:[]),
    litAt:lampTimes.map(time=>time-cuts[1]),revealed:index===2&&t>1.4,lanterns:index===3?[{time:1.3,x:360},{time:3.4,x:528}]:[],
    bursts:index===4?exportBursts.filter(b=>t>=b.time&&t-b.time<FIREWORK_LIFE):[],sparks,fade:Math.max(0,1-t/.32,1-(cuts[index+1]-seconds)/.32)*.92};
}


