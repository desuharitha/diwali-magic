import {writeFile} from 'node:fs/promises';
import {withBrowser} from './browser.mjs';

const [chrome,url,width,duration]=process.argv.slice(2);
let input='';
for await(const part of process.stdin)input+=part;
const rows=JSON.parse(input);
await withBrowser(chrome,url,async({evaluate})=>{
  for(const {from,to,path} of rows){
    const result=await evaluate(`(async()=>{
      const {renderVideo}=await import(new URL('app.js',location.href));
      const {blob}=await renderVideo(${JSON.stringify(from)},${JSON.stringify(to)},${Number(width)},undefined,${JSON.stringify(duration)});
      return await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onerror=reject;reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);
      });
    })()`);
    await writeFile(path,Buffer.from(result,'base64'),{flag:'wx'});
    console.log('Exported '+path);
  }
});
