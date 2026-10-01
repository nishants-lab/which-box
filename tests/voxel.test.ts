import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orientations, worldCells, drop, validate, complete, legalOrder, solve} from '../src/voxel.ts';
import type {Cell, Piece, VPlacement, VPuzzle} from '../src/voxel.ts';

const shapeKey = (cells: Cell[]) => cells.map(c => c.join(',')).sort().join(';');
const piece = (id: string, cells: Cell[]): Piece => ({id, name:id, color:'#888888', cells});
function fixture(size: Cell, pieces: Piece[], container?: Cell[]): VPuzzle {
  const cells: Cell[] = [];
  for(let x=0;x<size[0];x++) for(let y=0;y<size[1];y++) for(let z=0;z<size[2];z++) cells.push([x,y,z]);
  return {id:'test', rules:'voxel-1', title:'Test', difficulty:'Standard', size, container:container??cells, pieces, witness:[], solutionCount:null, certified:false};
}
const at = (id: string, position: Cell, orientation=0): VPlacement => ({id, at:position, orientation});
test('proper rotations preserve cells, connectivity, deduplicate and never mirror a chiral piece',()=>{
  const cells: Cell[] = [[0,0,0],[1,0,0],[0,1,0],[0,2,0],[0,0,1],[0,0,2],[0,0,3]];
  const rotations=orientations(cells);
  assert.equal(rotations.length,24);
  assert.equal(new Set(rotations.map(shapeKey)).size,24);
  for(const r of rotations) {assert.equal(r.length,cells.length); assert.equal(orientations(r).length,24);}
  const mirrored=cells.map(([x,y,z])=>[-x,y,z] as Cell);
  assert.ok(!orientations(mirrored).some(r=>rotations.some(s=>shapeKey(r)===shapeKey(s))));
  assert.equal(orientations([[0,0,0]]).length,1);
  assert.equal(orientations([[0,0,0],[1,0,0]]).length,3);
  rotations[0][0][0]=999;
  assert.ok(orientations(cells)[0][0][0]!==999);
});
test('vertical drop uses real L cells rather than bounding cuboids',()=>{
  const p=fixture([2,2,1],[piece('l',[[0,0,0],[1,0,0],[0,1,0]]),piece('s',[[0,0,0]])]);
  const a=drop(p,'l',0,0,0,[])!;
  assert.deepEqual(a,at('l',[0,0,0]));
  const b=drop(p,'s',0,1,1,[a])!;
  assert.equal(complete(p,[a,b]),true);
  assert.equal(drop(p,'s',0,0,0,[a]),null);
  assert.equal(drop(p,'l',99,0,0,[]),null);
  assert.equal(drop(p,'l',0,-1,0,[]),null);
});
test('every exposed bottom cell needs support and removing support is rejected',()=>{
  const p=fixture([2,1,2],[piece('base',[[0,0,0]]),piece('bar',[[0,0,0],[1,0,0]])]);
  const base=at('base',[0,0,0]);
  assert.equal(drop(p,'bar',0,0,0,[base]),null);
  assert.match(validate(p,[base,at('bar',[0,0,1])])!,/support/);
  const stack=fixture([1,1,2],[piece('a',[[0,0,0]]),piece('b',[[0,0,0]])]);
  assert.equal(validate(stack,[at('a',[0,0,0]),at('b',[0,0,1])]),null);
  assert.equal(drop(stack,'a',0,0,0,[at('a',[0,0,0]),at('b',[0,0,1])]),null);
  assert.match(validate(stack,[at('b',[0,0,1])])!,/support/);
});
test('container solid supports a raised floor but cannot be passed through on descent',()=>{
  const p=fixture([1,1,3],[piece('a',[[0,0,0]])],[[0,0,1],[0,0,2]]);
  assert.deepEqual(drop(p,'a',0,0,0,[]),at('a',[0,0,1]));
  const inaccessible=fixture([1,1,3],[piece('a',[[0,0,0]])],[[0,0,0],[0,0,2]]);
  assert.notEqual(validate(inaccessible,[at('a',[0,0,0])]),null);
  assert.equal(legalOrder(inaccessible,[at('a',[0,0,0])]),null);
});
test('insertion order is reconstructed independently of submitted ordering',()=>{
  const p=fixture([1,1,2],[piece('a',[[0,0,0]]),piece('b',[[0,0,0]])]);
  const placements=[at('b',[0,0,1]),at('a',[0,0,0])];
  assert.deepEqual(legalOrder(p,placements),placements.toReversed());
  assert.equal(complete(p,placements),true);
  assert.equal(complete(p,[placements[1]]),false);
});
test('invalid duplicates, orientations, overlaps and disconnected definitions are rejected',()=>{
  const p=fixture([2,1,1],[piece('a',[[0,0,0]]),piece('b',[[0,0,0]])]);
  for(const placements of [[at('a',[0,0,0]),at('a',[1,0,0])],[at('a',[0,0,0]),at('b',[0,0,0])],[at('a',[0,0,0],-1)],[at('a',[0.5,0,0])],[at('a',[9,0,0])],[at('unknown',[0,0,0])]]) assert.notEqual(validate(p,placements),null);
  assert.notEqual(validate(fixture([3,1,1],[piece('bad',[[0,0,0],[2,0,0]])]),[]),null);
});
test('solver quotients identical physical pieces and gravity rotations, not tilts',()=>{
  const domino: Cell[]=[[0,0,0],[1,0,0]];
  const square=fixture([2,2,1],[piece('a',domino),piece('b',domino)]);
  const result=solve(square);
  assert.equal(result.exhaustive,true);assert.equal(result.solutions.length,1);
  const upright=fixture([2,1,2],[piece('a',domino),piece('b',domino)]);
  assert.equal(solve(upright).solutions.length,2);
  const rectangle=fixture([3,2,1],[piece('a',domino),piece('b',domino),piece('c',domino)]);
  assert.equal(solve(rectangle).solutions.length,2);
});
test('budget exhaustion stays unknown and fixed placements are respected',()=>{
  const p=fixture([2,1,2],[piece('a',[[0,0,0],[1,0,0]]),piece('b',[[0,0,0],[1,0,0]])]);
  assert.deepEqual(solve(p,{nodeBudget:0}),{solutions:[],exhaustive:false,nodes:0});
  assert.equal(solve(p,{nodeBudget:1}).exhaustive,false);
  const fixed=at('a',[0,0,0]);
  const result=solve(p,{fixed:[fixed]});
  assert.equal(result.exhaustive,true);assert.equal(result.solutions.length,1);
  assert.ok(result.solutions[0].some(p=>JSON.stringify(p)===JSON.stringify(fixed)));
});
test('small domino fixtures agree with independent planar exhaustive tiling',()=>{
  function brute(width:number,height:number):number {
    const results=new Set<string>();
    function visit(used:Set<number>,groups:number[][]):void {
      if(used.size===width*height){
        const signatures=[0,1].map(turn=>groups.map(g=>g.map(i=>turn?width*height-1-i:i).sort((a,b)=>a-b).join(',')).sort().join(';'));
        results.add(signatures.sort()[0]);return;
      }
      let i=0;while(used.has(i))i++;
      for(const j of [i%width<width-1?i+1:-1,i+width<width*height?i+width:-1]) if(j>=0&&!used.has(j))visit(new Set([...used,i,j]),[...groups,[i,j]]);
    }
    visit(new Set(),[]);return results.size;
  }
  for(const [w,h] of [[3,2],[4,2],[5,2]]) {
    const pieces=Array.from({length:w*h/2},(_,i)=>piece(String(i),[[0,0,0],[1,0,0]]));
    const result=solve(fixture([w,h,1],pieces));
    assert.equal(result.exhaustive,true);assert.equal(result.solutions.length,brute(w,h));
    for(const solution of result.solutions) assert.equal(complete(fixture([w,h,1],pieces),solution),true);
  }
});
test('world cells reject malformed orientation and preserve translated coordinates',()=>{
  const p=piece('a',[[0,0,0],[1,0,0]]);
  assert.deepEqual(worldCells(p,at('a',[2,3,4])),[[2,3,4],[3,3,4]]);
  assert.deepEqual(worldCells(p,at('a',[0,0,0],100)),[]);
});

test('untrusted placement and puzzle payloads return validation errors without throwing',()=>{
  const p=fixture([1,1,1],[piece('a',[[0,0,0]])]);
  for(const value of [null,{},'bad',[null],[{}],[{id:'a',at:null,orientation:0}],[{id:'a',at:[0,0,0],orientation:'0'}]]) {
    assert.notEqual(validate(p,value as VPlacement[]),null);
    assert.equal(complete(p,value as VPlacement[]),false);
  }
  for(const value of [null,{}, {rules:'voxel-1',size:[1,1,1],container:[],pieces:[null]}]) assert.notEqual(validate(value as VPuzzle,[]),null);
});

import {catalogue,dailyPuzzle,findPuzzle} from '../src/catalogue.ts';
test('catalogue has 90 distinct playable puzzles and 30 exhaustively certified Experts',()=>{
  assert.equal(catalogue.length,90);
  assert.equal(new Set(catalogue.map(p=>p.id)).size,90);
  for(const tier of ['Standard','Hard','Expert']) assert.equal(catalogue.filter(p=>p.difficulty===tier).length,30);
  for(const p of catalogue) {
    assert.ok(p.size[0]<=5&&p.size[1]<=4);
    assert.equal(complete(p,p.witness),true,p.id);
    const placed:VPlacement[]=[];
    for(const move of p.witness) {
      assert.deepEqual(drop(p,move.id,move.orientation,move.at[0],move.at[1],placed),move,p.id);
      placed.push(move);
    }
    if(p.difficulty==='Expert') {assert.equal(p.certified,true);assert.ok(p.solutionCount===1||p.solutionCount===2);}
    if(p.certified) {
      const result=solve(p,{nodeBudget:50000});
      assert.equal(result.exhaustive,true,p.id);
      assert.equal(result.solutions.length,p.solutionCount,p.id);
    } else assert.equal(p.solutionCount,null);
  }
});
test('catalogue UTC day mapping and ID lookup are stable and dates are validated',()=>{
  const day=new Date().toISOString().slice(0,10);
  assert.equal(dailyPuzzle(day),dailyPuzzle(day));
  assert.equal(findPuzzle(dailyPuzzle(day).id),dailyPuzzle(day));
  assert.equal(findPuzzle('missing'),undefined);
  for(const day of ['invalid','2025-02-29','2026-13-01','2026-1-01']) assert.throws(()=>dailyPuzzle(day));
});
