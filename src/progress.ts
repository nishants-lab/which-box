import { catalogue, dailyPuzzle, findPuzzle } from './catalogue.ts';
import { complete, legalOrder, validate } from './voxel.ts';
import type { VPlacement, VPuzzle } from './voxel.ts';
export type Difficulty = 'Standard'|'Hard'|'Expert';
export type Attempt = {puzzleId:string;placements:VPlacement[];elapsedMs:number;hints:number;promptOffered:boolean;started:boolean;solved:boolean;attemptId:string};
export type Completion = {puzzleId:string;attemptId:string;mode:'Daily'|'Free play';day:string;hints:number;elapsedMs:number};
export type Progress = {version:2;daily:{day:string;attempt:Attempt}|null;free:Attempt|null;difficulty:Difficulty;seen:string[];completions:Completion[]};
export const emptyProgress = ():Progress => ({version:2,daily:null,free:null,difficulty:'Standard',seen:[],completions:[]});
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(n:unknown,max:number):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
const dayValid=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function cleanAttempt(raw:unknown):Attempt|null {
 if(!record(raw)||typeof raw.puzzleId!=='string'||typeof raw.attemptId!=='string'||!raw.attemptId||raw.attemptId.length>100||!Array.isArray(raw.placements)||!finite(raw.elapsedMs,365*86400000)||!Number.isInteger(raw.hints)||!finite(raw.hints,2)||typeof raw.promptOffered!=='boolean'||typeof raw.started!=='boolean'||typeof raw.solved!=='boolean')return null;
 const puzzle=findPuzzle(raw.puzzleId);if(!puzzle||raw.placements.length>puzzle.pieces.length)return null;
 const placements:VPlacement[]=[];
 for(const v of raw.placements){if(!record(v)||typeof v.id!=='string'||!puzzle.pieces.some(i=>i.id===v.id)||!Array.isArray(v.at)||v.at.length!==3||!v.at.every((n,axis)=>Number.isSafeInteger(n)&&n>=0&&n<(puzzle.size[axis]??0))||!Number.isSafeInteger(v.orientation)||!finite(v.orientation,23))return null;placements.push({id:v.id,at:[v.at[0],v.at[1],v.at[2]],orientation:v.orientation});}
 try{if(validate(puzzle,placements)||!legalOrder(puzzle,placements)||(raw.solved&&!complete(puzzle,placements)))return null;}catch{return null;}
 return {puzzleId:raw.puzzleId,attemptId:raw.attemptId,placements,elapsedMs:raw.elapsedMs,hints:raw.hints,promptOffered:raw.promptOffered,started:raw.started,solved:raw.solved};
}
export function restoreProgress(raw:unknown):{progress:Progress;damaged:boolean}{
 if(raw===null||raw===undefined)return {progress:emptyProgress(),damaged:false};
 if(!record(raw)||raw.version!==2||!['Standard','Hard','Expert'].includes(String(raw.difficulty))||!Array.isArray(raw.seen)||!Array.isArray(raw.completions))return {progress:emptyProgress(),damaged:true};
 const p=emptyProgress();p.difficulty=raw.difficulty as Difficulty;let damaged=false;
 if(raw.daily!==null){if(record(raw.daily)&&dayValid(raw.daily.day)){const a=cleanAttempt(raw.daily.attempt);if(a&&a.puzzleId===dailyPuzzle(raw.daily.day).id)p.daily={day:raw.daily.day,attempt:a};else damaged=true;}else damaged=true;}
 if(raw.free!==null){p.free=cleanAttempt(raw.free);if(!p.free)damaged=true;}
 const known=new Set(catalogue.map(p=>p.id));p.seen=[...new Set(raw.seen.filter((id):id is string=>typeof id==='string'&&known.has(id)))];
 for(const c of raw.completions.slice(-100)){if(record(c)&&typeof c.puzzleId==='string'&&known.has(c.puzzleId)&&typeof c.attemptId==='string'&&c.attemptId.length<=100&&(c.mode==='Daily'||c.mode==='Free play')&&dayValid(c.day)&&finite(c.elapsedMs,365*86400000)&&finite(c.hints,2)&&Number.isInteger(c.hints))p.completions.push({puzzleId:c.puzzleId,attemptId:c.attemptId,mode:c.mode,day:c.day,elapsedMs:c.elapsedMs,hints:c.hints});else damaged=true;}
 return {progress:p,damaged};
}
export function newAttempt(puzzle:VPuzzle):Attempt{return {puzzleId:puzzle.id,attemptId:freshId(),placements:[],elapsedMs:0,hints:0,promptOffered:false,started:false,solved:false};}
export function chooseNext(progress:Progress,day:string,random=Math.random):{puzzle:VPuzzle|null;exhausted:boolean}{
 const dailyId=dailyPuzzle(day).id;const pool=catalogue.filter(p=>p.difficulty===progress.difficulty&&p.id!==dailyId);const unseen=pool.filter(p=>!progress.seen.includes(p.id));
 return {puzzle:unseen.length?unseen[Math.min(unseen.length-1,Math.floor(Math.max(0,random())*unseen.length))]??null:null,exhausted:pool.length>0&&!unseen.length};
}

export function freshId():string {
 const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]! & 15)|64;bytes[8]=(bytes[8]! & 63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
