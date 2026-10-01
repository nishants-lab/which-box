import {useEffect, useRef, useState} from 'react';
import {runtime} from './runtime';
import {App as PackingGame} from './PackingGame';
import {cleanHistory,complete,daily,utcDay,utilization} from './game';
import type {Placement,Saved} from './game';
const KEY='daily-practice-v1';
export function App(){
 const [day]=useState(utcDay),[loaded,setLoaded]=useState(false),[initialBest,setInitialBest]=useState<number|null>(null);
 const history=useRef<Saved[]>([]),snapshot=useRef<Record<string,unknown>>({loading:true});
 useEffect(()=>{let active=true;runtime.serve({describeView:()=>snapshot.current});runtime.ready();
  void runtime.storage.get<unknown>(KEY).then(value=>{if(!active)return;history.current=cleanHistory(value);setInitialBest(history.current.find(r=>r.day===day&&r.boxId==='S')?.utilization??null);setLoaded(true);}).catch(()=>{if(active)setLoaded(true);});
  return()=>{active=false;};
 },[day]);
 async function save(result:{day:string;boxId:string;placements:Placement[]}){
  const p=daily(result.day),b=p.boxes.find(b=>b.id==='S');
  if(!b||result.boxId!=='S'||!complete(p,b,result.placements))throw Error('Invalid packing result');
  const score=utilization(p.items,b),entry={id:p.id,day:p.day,boxId:b.id,utilization:score};
  const next=cleanHistory([...history.current.filter(r=>r.id!==p.id),entry]);
  await runtime.storage.set(KEY,next);history.current=next;return {utilization:score,best:score};
 }
 if(!loaded)return <main className="boot"><h1>Which Box?</h1><p role="status">Opening your packing bench…</p></main>;
 return <PackingGame day={day} initialBest={initialBest} canSave={true} onSave={save} saveLabel="on this device" onDescribe={value=>{snapshot.current=value;}}/>;
}
