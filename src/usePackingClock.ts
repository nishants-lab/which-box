import {useEffect,useRef,useState} from 'react';
export function usePackingClock(){
 const start=useRef<number|null>(null),carry=useRef(0),[elapsed,setElapsed]=useState(0),[running,setRunning]=useState(false);
 const read=()=>carry.current+(start.current===null?0:Math.max(0,performance.now()-start.current));
 useEffect(()=>{if(!running)return;const id=setInterval(()=>setElapsed(Math.floor(read()/1000)),200);return()=>clearInterval(id);},[running]);
 return {elapsed,running,begin(){if(start.current===null){start.current=performance.now();setRunning(true);}},stop(){carry.current=read();start.current=null;setRunning(false);const seconds=Math.floor(carry.current/1000);setElapsed(seconds);return seconds;},reset(){carry.current=0;start.current=null;setElapsed(0);setRunning(false);}};
}
