import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Box, Item, Placement } from './game';
type Props={box:Box;items:Item[];placements:Placement[];preview:Placement|null;valid:boolean;view:number;sealed:boolean;skipAnimation?:boolean;onCell:(x:number,y:number)=>void};
type Tween={start:number;duration:number;update:(progress:number)=>void;done?:()=>void};
type Parcel={group:THREE.Group;signature:string;removing:boolean};
type SceneState={sync:(props:Props)=>void;setView:(view:number)=>void};

export function Scene(props:Props){
 const mount=useRef<HTMLDivElement>(null),latest=useRef(props),state=useRef<SceneState|null>(null),[error,setError]=useState(false);
 latest.current=props;
 // Preview and callbacks are recreated by the parent even when only its timer changes.
 const visualKey=JSON.stringify([props.box,props.items,props.placements,props.preview,props.valid,props.sealed,props.skipAnimation]);
 useEffect(()=>{
  if(!mount.current)return;
  const node=mount.current;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setError(true);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xf0ece1,1);node.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Rotatable 3D packing box. Drag to orbit; use the placement grid below for keyboard access.');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(7,8,9);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,0);controls.enableDamping=false;controls.minDistance=7;controls.maxDistance=24;controls.maxPolarAngle=Math.PI*.48;controls.enablePan=false;controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff,0xb7a382,2.3));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-3,10,7);scene.add(sun);
  const shell=new THREE.Group(),parcels=new THREE.Group(),finish=new THREE.Group();scene.add(shell,parcels,finish);
  const entries=new Map<string,Parcel>(),tweens=new Map<THREE.Object3D,Tween>();
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced=motion.matches,frame:number|null=null,disposed=false,contextLost=false,boxKey='',sealed=false,preview:Parcel|null=null;
  const render=()=>{if(!disposed&&!contextLost)renderer.render(scene,camera);};
  const tick=(now:number)=>{
   frame=null;if(disposed||contextLost)return;
   for(const [key,tween] of tweens){
    const progress=Math.min(1,Math.max(0,(now-tween.start)/tween.duration));
    tween.update(1-Math.pow(1-progress,3));
    if(progress===1){tweens.delete(key);tween.done?.();}
   }
   render();if(tweens.size)frame=requestAnimationFrame(tick);
  };
  const animate=(key:THREE.Object3D,duration:number,update:Tween['update'],done?:Tween['done'])=>{
   tweens.delete(key);
   if(reduced||(latest.current.skipAnimation&&key.parent===finish)){update(1);done?.();return;}
   update(0);tweens.set(key,{start:performance.now(),duration,update,done});
   if(frame===null&&!contextLost)frame=requestAnimationFrame(tick);
  };
  const discard=(group:THREE.Object3D)=>{group.traverse(obj=>{tweens.delete(obj);dispose(obj);});group.removeFromParent();};
  const clear=(group:THREE.Group)=>{for(const child of [...group.children])discard(child);};
  const changeMotion=()=>{
   reduced=motion.matches;
   if(reduced){
    if(frame!==null)cancelAnimationFrame(frame);frame=null;
    for(const [key,tween] of tweens){tweens.delete(key);tween.update(1);tween.done?.();}
    render();
   }
  };
  motion.addEventListener('change',changeMotion);
  const cancelCamera=()=>{tweens.delete(camera);};
  controls.addEventListener('start',cancelCamera);controls.addEventListener('change',render);
  const resize=()=>{const width=Math.max(1,node.clientWidth),height=Math.max(1,node.clientHeight);renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();};
  const observer=new ResizeObserver(resize);observer.observe(node);resize();
  let down:[number,number]|null=null;
  const start=(event:PointerEvent)=>{down=[event.clientX,event.clientY];};
  const cancelPointer=()=>{down=null;};
  const end=(event:PointerEvent)=>{
   const origin=down;down=null;if(!origin||Math.hypot(event.clientX-origin[0],event.clientY-origin[1])>5||contextLost)return;
   const rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return;
   const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
   const hit=new THREE.Vector3();
   if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit)){
    const b=latest.current.box,x=Math.floor(hit.x+b.dims[0]/2),y=Math.floor(hit.z+b.dims[1]/2);
    if(x>=0&&y>=0&&x<b.dims[0]&&y<b.dims[1])latest.current.onCell(x,y);
   }
  };
  renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerup',end);renderer.domElement.addEventListener('pointercancel',cancelPointer);
  const lost=(event:Event)=>{event.preventDefault();contextLost=true;controls.enabled=false;if(frame!==null)cancelAnimationFrame(frame);frame=null;tweens.clear();setError(true);};
  renderer.domElement.addEventListener('webglcontextlost',lost);

  const moveParcel=(entry:Parcel,p:Placement,w:number,d:number,alpha:number,isNew:boolean,isPreview:boolean)=>{
   const inset=isPreview?0:.04,target=new THREE.Vector3(p.at[0]-w/2+p.dims[0]/2,p.at[2]+p.dims[2]/2,p.at[1]-d/2+p.dims[1]/2);
   const scale=new THREE.Vector3(p.dims[0]-inset,p.dims[2]-inset,p.dims[1]-inset),group=entry.group;
   if(isNew){group.position.copy(target);group.scale.copy(scale);if(!isPreview)group.position.y+=latest.current.box.dims[2]+.6;}
   const from=group.position.clone(),fromScale=group.scale.clone(),fromAlpha=opacity(group);
   const lift=!isNew&&!isPreview&&from.distanceToSquared(target)>.001?Math.max(.5,latest.current.box.dims[2]+.5-Math.min(from.y,target.y)):0;
   animate(group,isPreview?180:460,t=>{
    group.position.lerpVectors(from,target,t);group.position.y+=Math.sin(Math.PI*t)*lift;group.scale.lerpVectors(fromScale,scale,t);setOpacity(group,THREE.MathUtils.lerp(fromAlpha,alpha,t));
   });
  };
  const sync=(next:Props)=>{
   if(disposed||contextLost)return;
   const [w,d,h]=next.box.dims,nextBoxKey=JSON.stringify([next.box.id,next.box.dims]);
   if(boxKey!==nextBoxKey){
    clear(shell);clear(parcels);clear(finish);entries.clear();preview=null;sealed=false;boxKey=nextBoxKey;
    const cuboid=(width:number,depth:number,height:number,x:number,y:number,z:number,color:string,alpha=1)=>{
     const group=createCuboid(color,alpha);group.scale.set(width,height,depth);group.position.set(x-w/2+width/2,z+height/2,y-d/2+depth/2);shell.add(group);
    };
    cuboid(w+.22,d+.22,.12,-.11,-.11,-.12,'#bb9866');
    cuboid(w+.22,.09,h,-.11,-.09,0,'#c9aa7b',.28);cuboid(.09,d+.22,h,-.09,-.11,0,'#c9aa7b',.22);
    cuboid(w+.22,.09,h,-.11,d,0,'#d5b786',.12);cuboid(.09,d+.22,h,w,-.11,0,'#d5b786',.12);
    const points:THREE.Vector3[]=[];
    for(let x=0;x<=w;x++)points.push(new THREE.Vector3(x-w/2,.005,-d/2),new THREE.Vector3(x-w/2,.005,d/2));
    for(let y=0;y<=d;y++)points.push(new THREE.Vector3(-w/2,.005,y-d/2),new THREE.Vector3(w/2,.005,y-d/2));
    shell.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xb59b77})));
   }
   const active=new Set(next.placements.map(p=>p.id));
   for(const [id,entry] of entries){
    if(active.has(id)||entry.removing)continue;
    entry.removing=true;const from=entry.group.position.clone(),fromAlpha=opacity(entry.group);
    animate(entry.group,260,t=>{entry.group.position.y=from.y+t*.9;setOpacity(entry.group,fromAlpha*(1-t));},()=>{discard(entry.group);entries.delete(id);});
   }
   for(const p of next.placements){
    const item=next.items.find(i=>i.id===p.id);if(!item)continue;
    const signature=JSON.stringify([p,item.color]);let entry=entries.get(p.id);const isNew=!entry;
    if(!entry){entry={group:createCuboid(item.color),signature:'',removing:false};entries.set(p.id,entry);parcels.add(entry.group);}
    if(entry.signature!==signature||entry.removing){
     entry.signature=signature;entry.removing=false;setColor(entry.group,item.color);moveParcel(entry,p,w,d,1,isNew,false);
    }
   }
   if(next.preview&&!next.sealed){
    const p=next.preview,color=next.valid?'#60a680':'#cd6b5b',signature=JSON.stringify([p,color]),isNew=!preview;
    if(!preview){preview={group:createCuboid(color,.42),signature:'',removing:false};parcels.add(preview.group);}
    if(preview.signature!==signature){preview.signature=signature;setColor(preview.group,color);moveParcel(preview,p,w,d,.42,isNew,true);}
   }else if(preview){discard(preview.group);preview=null;}
   if(next.skipAnimation)finish.traverse(obj=>{const tween=tweens.get(obj);if(tween){tweens.delete(obj);tween.update(1);tween.done?.();}});if(next.sealed!==sealed){
    sealed=next.sealed;clear(finish);
    if(sealed){
     const hinge=new THREE.Group();hinge.position.set(0,h+.06,-d/2-.11);finish.add(hinge);
     const lid=createCuboid('#cba97b',.88);lid.scale.set(w+.22,.12,d+.22);lid.position.z=(d+.22)/2;hinge.add(lid);
     const tape=createCuboid('#e6cd92',.94);hinge.add(tape);tape.position.y=.075;tape.scale.set(.48,.025,.001);
     animate(hinge,950,t=>{
      const close=Math.min(1,t/.72),strip=Math.max(0,(t-.72)/.28);
      hinge.rotation.x=-Math.PI*.48*(1-close);tape.visible=strip>0;tape.scale.z=(d+.22)*Math.max(.001,strip);tape.position.z=tape.scale.z/2;
     });
    }
   }
   render();
  };
  const setView=(view:number)=>{if(disposed||contextLost)return;
   const from=camera.position.clone(),target=view%2?new THREE.Vector3(.01,15,.01):new THREE.Vector3(7,8,9);
   animate(camera,650,t=>{camera.position.lerpVectors(from,target,t);controls.update();});render();
  };
  state.current={sync,setView};
  return ()=>{
   disposed=true;if(frame!==null)cancelAnimationFrame(frame);tweens.clear();observer.disconnect();motion.removeEventListener('change',changeMotion);
   controls.removeEventListener('start',cancelCamera);controls.removeEventListener('change',render);controls.dispose();
   renderer.domElement.removeEventListener('pointerdown',start);renderer.domElement.removeEventListener('pointerup',end);renderer.domElement.removeEventListener('pointercancel',cancelPointer);renderer.domElement.removeEventListener('webglcontextlost',lost);
   scene.traverse(dispose);scene.clear();entries.clear();renderer.dispose();renderer.domElement.remove();state.current=null;
  };
 },[]);
 useEffect(()=>{state.current?.sync(latest.current);},[visualKey]);
 useEffect(()=>{state.current?.setView(props.view);},[props.view]);
 return <div className="scene" ref={mount}>{error&&<div className="render-error">3D view unavailable on this device. The placement grid and all packing controls still work.</div>}</div>;
}
function createCuboid(color:string,alpha=1){
 const group=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1);
 group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.9,transparent:alpha<1,opacity:alpha,depthWrite:alpha===1})));
 group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:0x574632,transparent:alpha<1,opacity:alpha})));
 return group;
}
function opacity(group:THREE.Group){return (group.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.Material>).material.opacity;}
function setOpacity(group:THREE.Group,alpha:number){
 for(const child of group.children){const material=(child as THREE.Mesh<THREE.BufferGeometry,THREE.Material>).material;
  const transparent=alpha<1;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.opacity=alpha;material.depthWrite=!transparent;
 }
}
function setColor(group:THREE.Group,color:string){(group.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.color.set(color);}
function dispose(obj:THREE.Object3D){const mesh=obj as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(material=>material.dispose());}
