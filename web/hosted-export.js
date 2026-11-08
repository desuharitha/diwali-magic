import {WIDTH, HEIGHT, FPS, DURATION, draw, timeline} from './art.js';

export async function recordHostedMp4(names,width,duration,progress){
  const types=['video/mp4;codecs=avc1,mp4a.40.2','video/mp4'];
  const mimeType=types.find(type=>window.MediaRecorder?.isTypeSupported(type));
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!mimeType||!Audio||!HTMLCanvasElement.prototype.captureStream)
    throw new Error('This browser cannot record MP4. Try Chrome or Edge on a computer, or use the local FFmpeg creator.');
  if(![720,1080,2160].includes(width)||!['35','47','60','finale'].includes(duration))
    throw new Error('Choose a supported film size and length.');
  const audio=new Audio();
  let stream, recorder;
  try{
    await audio.resume();
    progress('Preparing the film… Keep this tab open.');
    const response=await fetch(new URL('./export-track.m4a',import.meta.url));
    if(!response.ok)throw new Error('Could not load the film soundtrack. Please try again.');
    const track=await audio.decodeAudioData(await response.arrayBuffer());
    const clip=duration==='finale', length=clip?13:Number(duration);
    const speed=clip?1:DURATION/length;
    const offset=clip?34:0;
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=width*HEIGHT/WIDTH;
    const context=canvas.getContext('2d',{alpha:false});
    const render=t=>draw(context,timeline(Math.min(DURATION-.001,offset+t*speed),names));
    render(0);
    stream=canvas.captureStream(FPS);
    const destination=audio.createMediaStreamDestination();
    stream.addTrack(destination.stream.getAudioTracks()[0]);
    const source=audio.createBufferSource();
    source.buffer=track;source.playbackRate.value=speed;source.connect(destination);
    recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:width===2160?12000000:5500000});
    return await new Promise((resolve,reject)=>{
      const chunks=[];
      let frame, started, lastSecond=-1;
      function cleanup(){
        cancelAnimationFrame(frame);
        document.removeEventListener('visibilitychange',visibility);
      }
      function fail(error){
        cleanup();reject(error);
      }
      function visibility(){
        if(document.hidden)fail(new Error('The tab was hidden during export. Retry and keep it visible until the film is ready.'));
      }
      function tick(){
        const elapsed=audio.currentTime-started;
        const second=Math.floor(elapsed);
        if(second!==lastSecond){
          lastSecond=second;
          progress('Recording MP4 · '+Math.min(100,Math.floor(elapsed/length*100))+'%. Keep this tab visible.');
        }
        render(elapsed);
        if(elapsed>=length){cleanup();recorder.stop();}
        else frame=requestAnimationFrame(tick);
      }
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>fail(new Error('The browser could not record this MP4. Try a smaller resolution.'));
      recorder.onstop=()=>{
        cleanup();
        const blob=new Blob(chunks,{type:'video/mp4'});
        if(blob.size)resolve(blob);
        else reject(new Error('The browser returned an empty film. Try a smaller resolution.'));
      };
      try{
        if(document.hidden){visibility();return;}
        document.addEventListener('visibilitychange',visibility);
        recorder.start();
        started=audio.currentTime;
        source.start(started,offset,length*speed);
        frame=requestAnimationFrame(tick);
      }catch(error){fail(error);}
    });
  }finally{
    if(recorder&&recorder.state!=='inactive')recorder.stop();
    stream?.getTracks().forEach(track=>track.stop());
    await audio.close().catch(()=>{});
  }
}
