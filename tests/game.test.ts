import {test} from 'node:test';
import assert from 'node:assert/strict';
import {daily,utcDay,drop,validate,complete,volume,orientations,cleanHistory} from '../src/game.ts';
import type {Placement} from '../src/game.ts';
test('same UTC day and rules yield the same puzzle',()=>{assert.deepEqual(daily(),daily());const midnight=Date.parse(utcDay()+'T00:00:00Z');assert.notEqual(utcDay(new Date(midnight)),utcDay(new Date(midnight-1)));});
test('120 daily orders have valid, fully supported constructive solutions',()=>{const base=Date.parse(utcDay()+'T00:00:00Z');for(let day=0;day<120;day++){const p=daily(utcDay(new Date(base+day*86400000)));const placed:Placement[]=[];for(const w of p.witness){const i=p.items.find(i=>i.id===w.id)!;assert.deepEqual(drop(i,w.dims,w.at[0],w.at[1],placed),w);placed.push(w);assert.equal(validate(p.items,p.boxes[0],placed),null);}assert.equal(complete(p,p.boxes[0],placed),true);assert.equal(p.items.reduce((v,i)=>v+volume(i.dims),0),volume(p.boxes[0].dims));}});
test('rotations preserve volume and avoid duplicate orientations',()=>{assert.equal(orientations([1,2,3]).length,6);assert.equal(orientations([2,2,2]).length,1);for(const d of orientations([1,2,3]))assert.equal(volume(d),6);});
test('rejects duplicate placements, bad dimensions, partial packs and corrupt results',()=>{const p=daily(),w=p.witness[0];assert.notEqual(validate(p.items,p.boxes[0],[w,w]),null);assert.notEqual(validate(p.items,p.boxes[0],[{...w,dims:[99,1,1]}]),null);assert.equal(complete(p,p.boxes[0],[w]),false);assert.deepEqual(cleanHistory([null,{day:utcDay(),id:'fake',utilization:999}]),[]);assert.throws(()=>daily('invalid'));});

import {formatTime,scoredSeconds} from '../src/timing.ts';
test('time formatting and transparent hint penalties',()=>{assert.equal(formatTime(0),'0:00');assert.equal(formatTime(102),'1:42');assert.equal(formatTime(3601),'60:01');assert.equal(scoredSeconds(102,1),122);assert.equal(scoredSeconds(102,2),142);assert.equal(scoredSeconds(102,0),102);});
