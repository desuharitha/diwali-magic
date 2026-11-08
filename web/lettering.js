const strokes=[
  'M9 80 Q24 69 30 31 Q38 -1 52 10 Q60 21 47 46 M17 54 Q45 42 74 43 M61 84 Q62 63 79 20 Q84 8 92 5',
  'M105 52 C83 43 72 81 88 80 Q103 80 111 55 Q96 85 110 81 Q118 79 123 72',
  'M121 63 Q134 47 135 51 Q120 89 115 109 Q120 84 140 59 C159 39 167 65 146 80 Q137 86 131 81',
  'M158 70 Q173 51 176 53 Q161 88 155 109 Q160 84 181 59 C200 40 207 65 187 80 Q178 86 172 82',
  'M202 56 Q190 82 203 81 Q215 79 227 54 Q219 80 204 105 Q191 125 181 116 Q177 105 209 91 Q232 82 240 71',
  'M267 82 Q285 59 299 17 M280 20 C315 -4 350 7 339 44 C330 75 290 94 262 80',
  'M346 55 Q327 85 342 82 Q352 81 359 72 M350 42 L352 39',
  'M360 56 Q346 88 363 81 Q374 76 382 57 Q373 83 387 80 Q401 75 406 56',
  'M430 54 C413 45 398 80 412 81 Q426 81 436 55 Q422 85 434 81 Q443 79 450 69',
  'M449 71 Q480 25 472 12 Q462 8 447 56 Q436 88 454 82 Q465 80 474 69',
  'M478 55 Q459 84 474 82 Q486 79 496 69 M483 41 L485 38',
];
let lettering;
function traceStrokes(){
  let total=0;
  const paths=strokes.flatMap(stroke=>stroke.split(/ (?=M)/)).map(stroke=>{
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',stroke);
    const length=path.getTotalLength(), count=Math.ceil(length/2.2);
    const points=Array.from({length:count+1},(_,i)=>path.getPointAtLength(i*length/count));
    const part={points,length,offset:total};
    total+=length;
    return part;
  });
  return {paths,total};
}
export const WRITING_DURATION=4.7;
export function goldenWriting(c,age,low,reduced){
  const {paths,total}=lettering??=traceStrokes();
  const limit=total*Math.min(1,age/(reduced?1.2:WRITING_DURATION));
  let head;
  c.save();c.translate(35,190);c.scale(1.3,1.3);
  c.lineCap='round';c.lineJoin='round';
  c.beginPath();
  for(const {points,length,offset} of paths){
    if(limit<=offset)break;
    const end=Math.min(points.length-1,(limit-offset)/length*(points.length-1));
    c.moveTo(points[0].x,points[0].y);
    for(let i=1;i<=Math.floor(end);i++)c.lineTo(points[i].x,points[i].y);
    const last=points[Math.floor(end)],next=points[Math.ceil(end)],fraction=end%1;
    head={x:last.x+(next.x-last.x)*fraction,y:last.y+(next.y-last.y)*fraction};
    c.lineTo(head.x,head.y);
  }
  c.strokeStyle='#c87c31';c.lineWidth=6.5;c.shadowColor='#ffae47';c.shadowBlur=14;c.stroke();
  c.shadowBlur=0;
  const sweep=(age-WRITING_DURATION)*335-60;
  const ink=c.createLinearGradient(sweep-58,0,sweep+58,0);
  ink.addColorStop(0,'#ffe19a');ink.addColorStop(.5,'#fffbe6');ink.addColorStop(1,'#ffe19a');
  c.strokeStyle=reduced?'#ffe19a':ink;c.lineWidth=3.4;c.stroke();
  if(head&&limit<total&&!reduced){
    c.shadowColor='#ffc66d';c.shadowBlur=15;c.fillStyle='#fff6d5';
    c.beginPath();c.arc(head.x,head.y,3.6,0,Math.PI*2);c.fill();c.shadowBlur=0;
  }
  if(!reduced){
    c.fillStyle='#ffe0a1';
    const density=low?105:240;
    for(let i=0;i<density;i++){
      const part=paths[i%paths.length],step=((i*47)%127)/126;
      if(part.offset+part.length*step>limit)continue;
      const point=part.points[Math.round(step*(part.points.length-1))];
      const wave=(Math.sin(age*(2+i%6)+i*4.7)+1)/2;
      c.globalAlpha=(.15+.67*wave)*(age>WRITING_DURATION+2?.48:1);
      const dx=Math.sin(i*5.41)*(3+wave*14),dy=Math.cos(i*9.12)*(3+wave*15);
      c.fillRect(point.x+dx,point.y+dy,1+wave,1+wave);
    }
  }
  c.restore();
}
