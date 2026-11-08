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

const encodeName=name=>encodeURIComponent(name).replace(/-/g,'%2D');
export function greetingFragment({from,to}){
  return '/from'+encodeName(from)+'-To'+encodeName(to);
}
export function parseGreeting(hash){
  const fragment=hash.replace(/^#/,'');
  const readable=/^\/from(.+?)-To(.+)$/.exec(fragment);
  if(readable){
    try{return {from:decodeURIComponent(readable[1]),to:decodeURIComponent(readable[2])};}
    catch{return null;}
  }
  const legacy=new URLSearchParams(fragment);
  return legacy.has('from')&&legacy.has('to')?{from:legacy.get('from'),to:legacy.get('to')}:null;
}
