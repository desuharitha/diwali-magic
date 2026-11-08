const maxWidth=570, maxHeight=226;
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
let cachedWish, cachedLayout;

function layout(c,wish){
  if(cachedWish===wish)return cachedLayout;
  const source=wish.split(/\r\n?|\n/).map(line=>{
    const text=line.replaceAll('\t','    ');
    return segmenter?Array.from(segmenter.segment(text),item=>item.segment):Array.from(text);
  });
  let result;
  for(let size=37;size>=15;size-=2){
    const font='italic '+size+'px "Palatino Linotype", Georgia, "Noto Serif Telugu", "Noto Serif Devanagari", "Nirmala UI", serif';
    c.font=font;
    const lines=[];
    for(const graphemes of source){
      let start=0;
      if(!graphemes.length)lines.push('');
      while(start<graphemes.length){
        let end=start, space=-1, line='';
        while(end<graphemes.length){
          const next=line+graphemes[end];
          if(end>start&&c.measureText(next).width>maxWidth)break;
          if(/\s/u.test(graphemes[end]))space=end+1;
          line=next;end++;
        }
        if(end<graphemes.length&&space>start)end=space;
        lines.push(graphemes.slice(start,end).join(''));
        start=end;
      }
    }
    const step=size*1.48;
    result={font,step,lines:lines.map(text=>({text,width:Math.min(maxWidth,c.measureText(text).width)}))};
    if(lines.length*step<=maxHeight)break;
  }
  cachedWish=wish;
  return cachedLayout=result;
}

export function drawOpeningWish(c,wish,t,reduced){
  if(t<=0)return;
  c.save();
  const {font,step,lines}=layout(c,wish);
  const center=360, middle=620, height=step*lines.length;
  const start=middle-(height-step)/2;
  const veil=c.createRadialGradient(center,middle,20,center,middle,345);
  veil.addColorStop(0,'#160c22b5');veil.addColorStop(.68,'#160c2268');veil.addColorStop(1,'transparent');
  c.globalAlpha=Math.min(1,t/.5);
  c.fillStyle=veil;c.fillRect(10,middle-height/2-44,700,height+88);
  c.font=font;c.textAlign='center';c.textBaseline='middle';
  const progress=Math.max(0,(t-.30)/6)*lines.length;
  for(let i=0;i<lines.length;i++){
    const {text,width}=lines[i];
    if(!width||progress<=i)continue;
    const reveal=Math.min(1,(progress-i)*1.22);
    const y=start+i*step, left=center-width/2;
    c.save();
    if(reveal<1&&!reduced){
      c.beginPath();c.rect(left-12,y-step*.7,(width+24)*reveal,step*1.4);c.clip();
    }
    c.globalAlpha=reduced?Math.min(1,reveal*2):1;
    c.shadowBlur=11;c.shadowColor='#eeac47';c.fillStyle='#fff2cd';
    c.fillText(text,center,y,maxWidth);
    c.restore();
    if(reveal<1&&!reduced){
      const x=left+width*reveal;
      c.save();c.shadowColor='#ffd381';c.shadowBlur=10;c.fillStyle='#fff0b2';
      for(let j=0;j<8;j++){
        c.globalAlpha=.2+.65*(1-j/8);
        c.fillRect(x-j*4,y+Math.sin(t*12+j*2.7)*9,2.4-j*.16,2.4-j*.16);
      }
      c.restore();
    }
  }
  c.restore();
}
