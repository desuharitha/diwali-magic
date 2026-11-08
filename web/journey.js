export const acts=[0,8,17,26,36];
const lengths=[5.8,6.4,6.4,8.2,Infinity];

export function createJourney(delay=3){
  let act=0, readyAt=0, started=null;
  function update(now,tap=false){
    const events=[];
    for(;;){
      if(started===null){
        const deadline=readyAt+delay;
        if(now<deadline&&!tap)return {act,t:acts[act],waiting:true,readyAt,events};
        started=Math.min(now,deadline);
        events.push(act);
        tap=false;
      }
      const elapsed=now-started;
      if(elapsed<lengths[act]){
        const span=acts[act+1]-acts[act];
        const t=act===4?acts[act]+elapsed:acts[act]+elapsed*span/lengths[act];
        return {act,t,waiting:false,readyAt,events};
      }
      readyAt=started+lengths[act];
      act++;
      started=null;
      tap=false;
    }
  }
  return {update};
}

export const WISH_LIMIT=240, WISH_LINES=5;
export function wishError(value){
  if(Array.from(value).length>WISH_LIMIT)return 'Use 240 characters or fewer.';
  if(value.split(/\r\n?|\n/).length>WISH_LINES)return 'Use five lines or fewer.';
  return '';
}
const encodeName=name=>encodeURIComponent(name).replace(/-/g,'%2D');
export function greetingPath({from,to}){
  return 'from'+encodeName(from)+'-To'+encodeName(to);
}
export function greetingFragment(names){
  const query=new URLSearchParams();
  if(names.wish?.trim())query.set('wish',names.wish);
  return '/'+greetingPath(names)+(query.size?'?'+query:'');
}
function readableGreeting(segment,query){
  const readable=/^from(.+?)-To(.+)$/.exec(segment);
  if(!readable)return null;
  try{
    const result={from:decodeURIComponent(readable[1]),to:decodeURIComponent(readable[2])};
    const wish=new URLSearchParams(query).get('wish');
    if(wish?.trim()&&!wishError(wish))result.wish=wish;
    return result;
  }catch{return null;}
}
export function parseGreeting(hash,pathname='',search=''){
  const fragment=hash.replace(/^#/,'');
  const question=fragment.indexOf('?');
  const readable=readableGreeting(
    (question<0?fragment:fragment.slice(0,question)).replace(/^\//,''),
    question<0?'':fragment.slice(question+1));
  if(readable)return readable;
  const legacy=new URLSearchParams(fragment);
  if(legacy.has('from')&&legacy.has('to'))return {from:legacy.get('from'),to:legacy.get('to')};
  return readableGreeting(pathname.split('/').filter(Boolean).at(-1)??'',search);
}
