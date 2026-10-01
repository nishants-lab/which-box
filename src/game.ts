export type Dims = [number, number, number];
export type Item = { id: string; name: string; dims: Dims; color: string };
export type Box = { id: string; name: string; dims: Dims };
export type Placement = { id: string; at: Dims; dims: Dims };
export type Puzzle = { id: string; day: string; items: Item[]; boxes: Box[]; witness: Placement[] };
export const RULES = 'dd-1';
export const volume = (d: Dims) => d[0]*d[1]*d[2];
export const utcDay = (now=new Date()) => now.toISOString().slice(0,10);
function rng(text:string) { let s=2166136261;for(const c of text)s=Math.imul(s^c.charCodeAt(0),16777619);return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; }
export function orientations(d:Dims): Dims[] {
 const [a,b,c]=d;return [...new Map<string,Dims>([[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]].map(v=>[v.join(','),v as Dims])).values()];
}
export function daily(day=utcDay()): Puzzle {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||utcDay(new Date(day+'T00:00:00Z'))!==day)throw Error('Invalid UTC day');
 const random=rng(RULES+day), w=4+Math.floor(random()*2), d=4, h=3;
 const parts: {at:Dims;dims:Dims}[]=[{at:[0,0,0],dims:[w,d,h]}];
 const count=6+Math.floor(random()*2);
 while(parts.length<count){
  const choices=parts.map((v,i)=>({v,i})).filter(({v})=>v.dims.some(n=>n>1)).sort((a,b)=>volume(b.v.dims)-volume(a.v.dims));
  const {v,i}=choices[Math.floor(random()*Math.min(2,choices.length))];
  const axes=[0,1,2].filter(a=>v.dims[a]>1), axis=axes[Math.floor(random()*axes.length)], cut=1+Math.floor(random()*(v.dims[axis]-1));
  const first={at:[...v.at] as Dims,dims:[...v.dims] as Dims},second={at:[...v.at] as Dims,dims:[...v.dims] as Dims};
  first.dims[axis]=cut;second.at[axis]+=cut;second.dims[axis]-=cut;parts.splice(i,1,first,second);
 }
 const colors=['#809cab','#c4977d','#8a9f79','#c3a254','#9b90ac','#649b96','#b48488'];
 const names=['Paperback','Coffee tin','Headphones','Desk light','Travel kit','Speaker','Tea box'];
 const items=parts.map((v,i)=>{const os=orientations(v.dims);return {id:'item-'+i,name:names[i],dims:os[Math.floor(random()*os.length)],color:colors[i]};});
 return {id:RULES+'/'+day,day,items,boxes:[{id:'S',name:'Compact',dims:[w,d,h]},{id:'M',name:'Roomy',dims:[w+1,d,h]},{id:'L',name:'Generous',dims:[w+1,d+1,h+1]}],witness:parts.map((v,i)=>({id:items[i].id,...v})).sort((a,b)=>a.at[2]-b.at[2])};
}
export function overlaps(a:Placement,b:Placement):boolean {return [0,1,2].every(i=>a.at[i]<b.at[i]+b.dims[i]&&b.at[i]<a.at[i]+a.dims[i]);}
export function validShape(p:Placement,items:Item[]):boolean {
 const item=items.find(i=>i.id===p.id);return !!item&&p.at.length===3&&p.dims.length===3&&[...p.at,...p.dims].every(Number.isInteger)&&p.at.every(n=>n>=0)&&p.dims.every(n=>n>0)&&orientations(item.dims).some(d=>d.every((n,i)=>n===p.dims[i]));
}
export function supported(p:Placement,others:Placement[]):boolean {
 if(p.at[2]===0)return true;
 for(let x=p.at[0];x<p.at[0]+p.dims[0];x++)for(let y=p.at[1];y<p.at[1]+p.dims[1];y++){
  if(!others.some(q=>q.id!==p.id&&q.at[2]+q.dims[2]===p.at[2]&&x>=q.at[0]&&x<q.at[0]+q.dims[0]&&y>=q.at[1]&&y<q.at[1]+q.dims[1]))return false;
 }return true;
}
export function validate(items:Item[],box:Box,ps:Placement[]):string|null {
 if(new Set(ps.map(p=>p.id)).size!==ps.length)return 'An item appears twice.';
 for(const p of ps){
  if(!validShape(p,items))return 'The item dimensions or position are invalid.';
  if(p.at.some((n,i)=>n+p.dims[i]>box.dims[i]))return 'The item crosses the box boundary.';
  if(ps.some(q=>q.id!==p.id&&overlaps(p,q)))return 'Items overlap.';
  if(!supported(p,ps))return 'Every item needs full support beneath it.';
 }return null;
}
export function drop(item:Item,dims:Dims,x:number,y:number,ps:Placement[]):Placement {
 let z=0;for(const q of ps)if(q.id!==item.id&&x<q.at[0]+q.dims[0]&&q.at[0]<x+dims[0]&&y<q.at[1]+q.dims[1]&&q.at[1]<y+dims[1])z=Math.max(z,q.at[2]+q.dims[2]);
 return {id:item.id,at:[x,y,z],dims};
}
export function complete(p:Puzzle,b:Box,ps:Placement[]):boolean {return ps.length===p.items.length&&validate(p.items,b,ps)===null;}
export function utilization(items:Item[],b:Box):number {return 100*items.reduce((s,i)=>s+volume(i.dims),0)/volume(b.dims);}
export type Saved = { id:string; day:string; boxId:string; utilization:number };
export function cleanHistory(value:unknown): Saved[] {
 if(!Array.isArray(value))return [];
 return value.filter((r):r is Saved=>!!r&&typeof r==='object'&&typeof r.id==='string'&&typeof r.day==='string'&&typeof r.boxId==='string'&&Number.isFinite(r.utilization)&&r.utilization>0&&r.utilization<=100).filter(r=>{
  try{const p=daily(r.day),b=p.boxes.find(b=>b.id===r.boxId);return r.id===p.id&&!!b&&Math.abs(r.utilization-utilization(p.items,b))<1e-8;}catch{return false;}
 }).sort((a,b)=>b.day.localeCompare(a.day)).slice(0,30);
}
