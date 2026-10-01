import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Box, Item, Placement } from './game';
type Props={box:Box;items:Item[];placements:Placement[];preview:Placement|null;valid:boolean;view:number;sealed:boolean;onCell:(x:number,y:number)=>void};
export function Scene(props:Props){
 const mount=useRef<HTMLDivElement>(null), latest=useRef(props), [error,setError]=useState(false);
 latest.current=props;
 const state=useRef<{scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;controls:OrbitControls;group:THREE.Group}|null>(null);
 useEffect(()=>{
  if(!mount.current)return;const node=mount.current;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setError(true);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xf0ece1,1);node.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Rotatable 3D packing box. Drag to orbit; use the placement grid below for keyboard access.');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(7,8,9);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,0);controls.enableDamping=false;controls.minDistance=7;controls.maxDistance=24;controls.maxPolarAngle=Math.PI*.48;controls.enablePan=false;
  scene.add(new THREE.HemisphereLight(0xffffff,0xb7a382,2.3));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-3,10,7);scene.add(sun);
  const group=new THREE.Group();scene.add(group);state.current={scene,camera,renderer,controls,group};
  const render=()=>renderer.render(scene,camera);controls.addEventListener('change',render);
  const observer=new ResizeObserver(()=>{const width=node.clientWidth,height=node.clientHeight;renderer.setSize(width,height);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();render();});observer.observe(node);
  let down=[0,0];const start=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};
  const end=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
   const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
   const hit=new THREE.Vector3();if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit)){const b=latest.current.box;const x=Math.floor(hit.x+b.dims[0]/2),y=Math.floor(hit.z+b.dims[1]/2);if(x>=0&&y>=0&&x<b.dims[0]&&y<b.dims[1])latest.current.onCell(x,y);}
  };
  renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerup',end);
  const lost=(e:Event)=>{e.preventDefault();setError(true);};renderer.domElement.addEventListener('webglcontextlost',lost);
  return ()=>{observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',start);renderer.domElement.removeEventListener('pointerup',end);renderer.domElement.removeEventListener('webglcontextlost',lost);group.traverse(dispose);renderer.dispose();node.removeChild(renderer.domElement);state.current=null;};
 },[]);
 useEffect(()=>{
  const s=state.current;if(!s)return;s.group.traverse(dispose);s.group.clear();const [w,d,h]=props.box.dims;
  const cuboid=(width:number,depth:number,height:number,x:number,y:number,z:number,color:string,alpha=1,wire=false)=>{
   const geo=new THREE.BoxGeometry(width,height,depth),mat=new THREE.MeshStandardMaterial({color,roughness:.9,transparent:alpha<1,opacity:alpha,depthWrite:alpha===1});const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x-w/2+width/2,z+height/2,y-d/2+depth/2);s.group.add(mesh);
   if(wire){const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0x574632,transparent:alpha<1,opacity:alpha}));edges.position.copy(mesh.position);s.group.add(edges);}return mesh;
  };
  cuboid(w+.22,d+.22,.12,-.11,-.11,-.12,'#bb9866',1,true);
  cuboid(w+.22,.09,h,-.11,-.09,0,'#c9aa7b',.28,true);cuboid(.09,d+.22,h,-.09,-.11,0,'#c9aa7b',.22,true);
  cuboid(w+.22,.09,h,-.11,d,0,'#d5b786',.12,true);cuboid(.09,d+.22,h,w,-.11,0,'#d5b786',.12,true);
  const points:THREE.Vector3[]=[];for(let x=0;x<=w;x++)points.push(new THREE.Vector3(x-w/2,.005,-d/2),new THREE.Vector3(x-w/2,.005,d/2));for(let y=0;y<=d;y++)points.push(new THREE.Vector3(-w/2,.005,y-d/2),new THREE.Vector3(w/2,.005,y-d/2));
  s.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xb59b77})));
  for(const p of props.placements){const item=props.items.find(i=>i.id===p.id)!;cuboid(p.dims[0]-.04,p.dims[1]-.04,p.dims[2]-.04,p.at[0]+.02,p.at[1]+.02,p.at[2]+.02,item.color,1,true);}
  if(props.preview&&!props.sealed){const p=props.preview;cuboid(...p.dims,...p.at,props.valid?'#60a680':'#cd6b5b',.42,true);}
  if(props.sealed)cuboid(w+.22,d+.22,.12,-.11,-.11,h,'#cba97b',.6,true);
  s.renderer.render(s.scene,s.camera);
 },[props.box,props.items,props.placements,props.preview,props.valid,props.sealed]);
 useEffect(()=>{const s=state.current;if(!s)return;if(props.view%2)s.camera.position.set(.01,15,.01);else s.camera.position.set(7,8,9);s.controls.update();s.renderer.render(s.scene,s.camera);},[props.view]);
 return <div className="scene" ref={mount}>{error&&<div className="render-error">3D view unavailable on this device. The placement grid and all packing controls still work.</div>}</div>;
}
function dispose(obj:THREE.Object3D){const m=obj as THREE.Mesh;if(m.geometry)m.geometry.dispose();if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>v.dispose());}
