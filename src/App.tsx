import {useCallback,useEffect,useRef,useState} from 'react';
import {runtime} from './runtime';
import {GameHub} from './GameHub';
import {emptyProgress,restoreProgress,freshId} from './progress';
import type {Progress,Attempt} from './progress';
import {findPuzzle} from './catalogue';
import {complete,legalOrder} from './voxel';
import {utcDay} from './game';
const KEY='creative-progress-v2';
type Envelope={revision:string;progress:Progress};
export function App(){
 const [day]=useState(utcDay),[initial,setInitial]=useState<Progress|null>(null),[problem,setProblem]=useState(''),[recover,setRecover]=useState(false);
 const snapshot=useRef<Record<string,unknown>>({loading:true}),revision=useRef(''),writer=useRef(freshId());
 useEffect(()=>{let active=true;runtime.serve({describeView:()=>snapshot.current});runtime.ready();void runtime.storage.get<unknown>(KEY).then(raw=>{if(!active)return;const env=raw&&typeof raw==='object'&&'progress' in raw&&'revision' in raw?raw as Envelope:null;revision.current=env?.revision??'';const restored=restoreProgress(env?.progress??raw);if(restored.damaged){setProblem('Some saved progress cannot be restored. Keep it unchanged or start a fresh creative collection. Your earlier daily results are kept separately.');setRecover(true);}else setInitial(restored.progress);}).catch(()=>{if(active){setProblem('Saved progress could not be read. Retry or continue without restoring.');setRecover(true);}});return()=>{active=false;};},[]);
 const save=useCallback(async(progress:Progress)=>{
  const write=async()=>{const raw=await runtime.storage.get<Envelope|null>(KEY);if((raw?.revision??'')!==revision.current)throw Error('A newer save exists in another window. Reload before continuing.');const next={revision:writer.current+':'+freshId(),progress};await runtime.storage.set(KEY,next);revision.current=next.revision;};
  if(typeof navigator!=='undefined'&&navigator.locks)await navigator.locks.request('which-box-creative-save',write);else await write();
 },[]);
 const finish=useCallback(async(a:Attempt)=>{const p=findPuzzle(a.puzzleId);if(!p||!complete(p,a.placements)||!legalOrder(p,a.placements))throw Error('The arrangement is not a complete playable solution.');},[]);
 const describe=useCallback((value:Record<string,unknown>)=>{snapshot.current=value;},[]);
 if(!initial)return <main className="boot"><h1>Everything Fits</h1><p role="status">{problem||'Opening your packing bench…'}</p>{recover&&<><button onClick={()=>{setInitial(emptyProgress());setRecover(false);}}>Start a fresh collection</button><p>The unreadable save is not overwritten until you start playing. Earlier daily history is untouched.</p></>}</main>;
 return <GameHub day={day} initial={initial} saveProgress={save} saveCompletion={finish} onDescribe={describe} storageLabel="Saved on this device"/>;
}
