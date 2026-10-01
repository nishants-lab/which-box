import { useEffect, useState } from 'react';
import { runtime } from './runtime';
type Result = {day:string;puzzleId:string;utilization:number;boxName:string;hint:boolean};
type Card = {url:string;blob:Blob;file:File};
export function makeResultCanvas(r:Result):HTMLCanvasElement {
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=800;
 const c=canvas.getContext('2d');if(!c)throw Error('Image drawing is unavailable.');
 c.fillStyle='#f7f3eb';c.fillRect(0,0,1200,800);
 c.fillStyle='#29362e';c.font='bold 27px sans-serif';c.fillText('WHICH BOX?',64,80);
 c.fillStyle='#b34c26';c.font='18px sans-serif';c.fillText('THE DAILY DISPATCH',64,143);
 c.strokeStyle='#dad8cd';c.lineWidth=2;c.beginPath();c.moveTo(64,104);c.lineTo(1136,104);c.stroke();
 c.fillStyle='#29362e';c.font='28px Georgia';c.fillText(r.day+' / UTC',830,79);
 c.font='136px Georgia';c.fillText(r.utilization.toFixed(1)+'%',58,322);
 c.fillStyle='#51705b';c.font='32px sans-serif';c.fillText('BOX UTILIZATION',64,382);
 c.fillStyle='#29362e';c.font='26px sans-serif';c.fillText(r.boxName+' box  /  '+(r.hint?'Hint used':'No hints used'),64,455);
 c.fillStyle='#ddd9cb';c.fillRect(64,492,660,12);c.fillStyle='#66836b';c.fillRect(64,492,660*Math.max(0,Math.min(100,r.utilization))/100,12);
 const polygon=(points:number[][],fill:string)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle='#8b6e45';c.stroke();};
 polygon([[840,287],[986,228],[1120,294],[975,359]],'#e6c89d');polygon([[840,287],[975,359],[975,490],[840,417]],'#bf9866');polygon([[975,359],[1120,294],[1120,425],[975,490]],'#d4af79');
 c.strokeStyle='#f2dfbd';c.lineWidth=17;c.beginPath();c.moveTo(909,260);c.lineTo(1047,327);c.stroke();
 c.fillStyle='#29362e';c.font='italic 38px Georgia';c.fillText('Same order. Better packing.',64,591);
 c.font='20px sans-serif';c.fillText(runtime.imageLabel.slice(0,85),64,645);
 c.fillStyle='#697066';c.font='18px sans-serif';c.fillText('Single-player result · Unverified · No solution shown',64,719);c.fillText(r.puzzleId+' · v1.1',64,752);
 return canvas;
}
export function ResultShare(props:Result){
 const [card,setCard]=useState<Card|null>(null),[status,setStatus]=useState('Preparing your image…');
 const [nativeAvailable,setNativeAvailable]=useState(false);
 useEffect(()=>{let active=true,url='';setCard(null);setStatus('Preparing your image…');
  try{const canvas=makeResultCanvas(props);canvas.toBlob(blob=>{if(!active)return;if(!blob){setStatus('Image export failed. You can copy the text below.');return;}
   url=URL.createObjectURL(blob);const file=new File([blob],`which-box-${props.day}.png`,{type:'image/png'});setCard({url,blob,file});
   let native=false;try{native=!!navigator.canShare?.({files:[file]});}catch{}setNativeAvailable(native);setStatus('Your image is ready. No packing arrangement or personal information is included.');
  },'image/png');}catch{setStatus('Image export is unavailable. You can copy the text below.');}
  return()=>{active=false;if(url)URL.revokeObjectURL(url);};
 },[props.day,props.puzzleId,props.utilization,props.boxName,props.hint]);
 async function share(){if(!card)return;try{await navigator.share({files:[card.file],title:'Which Box? Daily Dispatch',text:`${props.day} · ${props.utilization.toFixed(1)}% utilization. ${runtime.playLabel}`});setStatus('Shared using your device share menu.');}catch(e){setStatus(e instanceof Error&&e.name==='AbortError'?'Sharing cancelled. Your image is still ready.':'Device sharing is unavailable. Download the PNG or copy the image instead.');}}
 async function copy(){if(!card)return;try{await navigator.clipboard.write([new ClipboardItem({'image/png':card.blob})]);setStatus('Image copied. Paste it into your message.');}catch{setStatus('Image copying was blocked. Try Download PNG, or save the preview image.');}}
 return <section className="image-share" aria-label="Share result image">
  {card&&<><img data-result-image src={card.url} width="1200" height="800" alt={`Which Box result for ${props.day}: ${props.utilization.toFixed(1)}% utilization, ${props.boxName} box, ${props.hint?'hint used':'no hints'}. Unverified single-player result.`}/>
   <div className="image-actions"><a data-download className="download-image" href={card.url} download={card.file.name} onClick={()=>setStatus('PNG download requested. If your app blocks downloads, copy the image or save the preview.')}>Download PNG</a>
   {typeof ClipboardItem!=='undefined'&&typeof navigator.clipboard?.write==='function'&&<button data-copy-image onClick={copy}>Copy image</button>}
   {nativeAvailable&&<button data-native-share onClick={share}>Share image…</button>}</div></>}
  <p role="status">{status}</p><p className="subtle">You choose where to share. Nothing is posted automatically. If downloads are blocked, right-click or long-press the preview to save it.</p>
 </section>;
}
