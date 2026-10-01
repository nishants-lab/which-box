import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { worldCells } from './voxel';
import type { Cell, VPlacement, VPuzzle } from './voxel';

type Props = {
  puzzle: VPuzzle;
  placements: VPlacement[];
  ghost: VPlacement | null;
  valid: boolean;
  top: boolean;
  onCell: (x: number, y: number) => void;
};
type SceneAPI = { sync: (props: Props) => void; view: (top: boolean) => void };

export function CreativeScene(props: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const api = useRef<SceneAPI | null>(null);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => { latest.current = props; }, [props]);
  const visualKey = JSON.stringify([props.puzzle.id, props.placements, props.ghost, props.valid]);

  useEffect(() => {
    const node = mount.current;
    if (!node) return;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch {
      queueMicrotask(() => { if (!disposed) setFailed(true); });
      return () => { disposed = true; };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor('#eeeade', 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', '3D packing bench. Drag to orbit. Use the position grid to place pieces.');
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 150);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI * .49;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa69276, 2.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.7);
    sun.position.set(-4, 12, 8);
    scene.add(sun);
    const content = new THREE.Group();
    scene.add(content);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null;
    let lost = false;
    let previousIds = new Set(latest.current.placements.map(p => p.id));
    let animations: { group: THREE.Group; start: number; height: number }[] = [];
    const render = () => { if (!lost) renderer.render(scene, camera); };
    const tick = (now: number) => {
      frame = null;
      animations = animations.filter(({ group, start, height }) => {
        const progress = motion.matches ? 1 : Math.min(1, (now - start) / 320);
        group.position.y = height * Math.pow(1 - progress, 3);
        return progress < 1;
      });
      render();
      if (animations.length) frame = requestAnimationFrame(tick);
    };
    const settle = () => {
      if (!motion.matches) return;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      animations.forEach(({ group }) => { group.position.y = 0; });
      animations = [];
      render();
    };
    motion.addEventListener('change', settle);
    controls.addEventListener('change', render);
    function view(top: boolean) {
      const [w, d, h] = latest.current.puzzle.size;
      const distance = Math.max(w, d, h) * 2.35;
      controls.target.set(0, h * .35, 0);
      camera.position.set(top ? .001 : distance * .8, top ? distance * 1.5 : distance, top ? .001 : distance);
      controls.minDistance = Math.max(w, d, h) * 1.3;
      controls.maxDistance = distance * 3;
      controls.update();
      render();
    }
    function sync(next: Props) {
      if (lost) return;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      animations = [];
      content.traverse(dispose);
      content.clear();
      const [w, d, h] = next.puzzle.size;
      const allowed = new Set(next.puzzle.container.map(c => c.join(',')));
      const cube = (cell: Cell, color: string, alpha: number, parent: THREE.Group, size = .96) => {
        const geometry = new THREE.BoxGeometry(size, size, size);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .85, transparent: alpha < 1, opacity: alpha, depthWrite: alpha === 1 }));
        mesh.position.set(cell[0] - w / 2 + .5, cell[2] + .5, cell[1] - d / 2 + .5);
        parent.add(mesh);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: alpha < .2 ? '#8c8270' : '#39473c', transparent: alpha < 1, opacity: Math.min(1, alpha + .25) }));
        edges.position.copy(mesh.position);
        parent.add(edges);
      };
      const base = new THREE.Mesh(new THREE.BoxGeometry(w + .12, .08, d + .12), new THREE.MeshStandardMaterial({ color: '#c7af86', roughness: 1 }));
      base.position.y = -.06;
      content.add(base);
      for (let x = 0; x < w; x++) for (let y = 0; y < d; y++) for (let z = 0; z < h; z++) {
        if (!allowed.has([x, y, z].join(','))) cube([x, y, z], '#777365', .12, content, .99);
      }
      const outlineGeometry = new THREE.BoxGeometry(w, h, d);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(outlineGeometry), new THREE.LineBasicMaterial({ color: '#8b7758', transparent: true, opacity: .65 }));
      outlineGeometry.dispose();
      outline.position.y = h / 2;
      content.add(outline);
      const grid: THREE.Vector3[] = [];
      for (let x = 0; x <= w; x++) grid.push(new THREE.Vector3(x - w / 2, .005, -d / 2), new THREE.Vector3(x - w / 2, .005, d / 2));
      for (let y = 0; y <= d; y++) grid.push(new THREE.Vector3(-w / 2, .005, y - d / 2), new THREE.Vector3(w / 2, .005, y - d / 2));
      content.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid), new THREE.LineBasicMaterial({ color: '#a38e6d' })));
      for (const placement of next.placements) {
        const piece = next.puzzle.pieces.find(p => p.id === placement.id);
        if (!piece) continue;
        const group = new THREE.Group();
        worldCells(piece, placement).forEach(cell => cube(cell, piece.color, 1, group));
        content.add(group);
        if (!previousIds.has(piece.id) && !motion.matches) {
          group.position.y = h * .6;
          animations.push({ group, start: performance.now(), height: h * .6 });
        }
      }
      previousIds = new Set(next.placements.map(p => p.id));
      if (next.ghost) {
        const piece = next.puzzle.pieces.find(p => p.id === next.ghost?.id);
        if (piece) worldCells(piece, next.ghost).forEach(cell => cube(cell, next.valid ? '#3d987a' : '#c5513c', .38, content, 1));
      }
      render();
      if (animations.length) frame = requestAnimationFrame(tick);
    }
    const resize = () => {
      const width = Math.max(1, node.clientWidth), height = Math.max(1, node.clientHeight);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    let down: [number, number] | null = null;
    const pointerDown = (event: PointerEvent) => { down = [event.clientX, event.clientY]; };
    const pointerCancel = () => { down = null; };
    const pointerUp = (event: PointerEvent) => {
      const origin = down; down = null;
      if (!origin || Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 5 || lost) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), camera);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return;
      const [w, d] = latest.current.puzzle.size;
      const x = Math.floor(hit.x + w / 2), y = Math.floor(hit.z + d / 2);
      if (x >= 0 && y >= 0 && x < w && y < d) latest.current.onCell(x, y);
    };
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; controls.enabled = false; if (frame !== null) cancelAnimationFrame(frame); frame = null; setFailed(true); };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerCancel);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    api.current = { sync, view };
    resize(); view(latest.current.top); sync(latest.current);
    return () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect(); motion.removeEventListener('change', settle);
      controls.removeEventListener('change', render); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      scene.traverse(dispose); renderer.dispose(); renderer.domElement.remove(); api.current = null;
    };
  }, []);
  useEffect(() => { api.current?.sync(latest.current); }, [visualKey]);
  useEffect(() => { api.current?.view(props.top); }, [props.top]);
  return <div className="creative-scene scene" ref={mount}>{failed && <p className="creative-render-error">3D is unavailable. Use the position grid and orientation previews below to keep packing.</p>}</div>;
}

function dispose(object: THREE.Object3D) {
  const mesh = object as THREE.Mesh;
  mesh.geometry?.dispose();
  if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
}
