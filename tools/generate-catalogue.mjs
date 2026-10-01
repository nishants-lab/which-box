import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {orientations, legalOrder, solve, complete} from '../src/voxel.ts';

const key = c => c.join(',');
const signature = cells => cells.map(key).sort().join(';');
let seed = 0x51a7c09;
const random = n => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % n; };
const colors = ['#668d9c', '#c0936b', '#8eaa72', '#a88ba9', '#c0a151', '#729c95'];
const names = ['Book bundle', 'Folded stand', 'Gift stack', 'Tea set', 'Desk kit', 'Travel pack'];
const target = Number(process.env.CATALOGUE_TARGET ?? 30);
const attempts = Number(process.env.CATALOGUE_ATTEMPTS ?? 1600);
const catalogue = [], seen = new Set();
const counts = {Standard: 0, Hard: 0, Expert: 0};
function partition(layer, count) {
  for (let retry = 0; retry < 20; retry++) {
    const free = new Map(layer.map(c => [key(c), c])), groups = [];
    for (let i = 0; i < count; i++) {
      const available = [...free.values()];
      const start = available[random(available.length)];
      if (!start) break;
      groups.push([start]); free.delete(key(start));
    }
    while (free.size) {
      const possible = [];
      groups.forEach((group, i) => group.forEach(c => {
        for (const axis of [0, 1]) for (const sign of [-1, 1]) {
          const next = [...c]; next[axis] += sign;
          if (free.has(key(next))) possible.push([i, next]);
        }
      }));
      if (!possible.length) break;
      const [i, next] = possible[random(possible.length)];
      groups[i].push(next); free.delete(key(next));
    }
    if (!free.size && groups.length === count && groups.every(g => g.length >= 3 && g.length <= 9)) return groups;
  }
  return null;
}
function puzzleSignature(puzzle) {
  const container = [];
  for (let t = 0; t < 4; t++) {
    const rotated = puzzle.container.map(([x,y,z]) => t === 0 ? [x,y,z] : t === 1 ? [-y,x,z] : t === 2 ? [-x,-y,z] : [y,-x,z]);
    const min = [0,1,2].map(a => Math.min(...rotated.map(c => c[a])));
    container.push(signature(rotated.map(c => c.map((n,a) => n-min[a]))));
  }
  return container.sort()[0] + '|' + puzzle.pieces.map(p => orientations(p.cells).map(signature).sort()[0]).sort().join('|');
}
for (let attempt = 0; attempt < attempts && Object.values(counts).some(n => n < target); attempt++) {
  const w = 3 + random(2), d = 2 + random(2), h = 2, variant = random(3);
  const container = [];
  for (let z = 0; z < h; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
    if (variant === 1 && x === w - 1 && y === d - 1) continue;
    if (variant === 2 && z === 0 && x === w - 1 && y === d - 1) continue;
    container.push([x,y,z]);
  }
  const groups = [];
  for (let z = 0; z < h; z++) {
    const layer = container.filter(c => c[2] === z), parts = partition(layer, layer.length > 10 && random(3) === 0 ? 3 : 2);
    if (!parts) break;
    groups.push(...parts);
  }
  if (groups.flat().length !== container.length) continue;
  const pieces = [], witness = [];
  groups.forEach((cells, i) => {
    const at = [0,1,2].map(a => Math.min(...cells.map(c => c[a])));
    const local = cells.map(c => c.map((n,a) => n-at[a]));
    const id = 'piece-' + i;
    pieces.push({id,name:names[i],color:colors[i],cells:local});
    witness.push({id,at,orientation:0});
  });
  if (pieces.every(p => p.cells.length === (Math.max(...p.cells.map(c => c[0]))+1)*(Math.max(...p.cells.map(c => c[1]))+1))) continue;
  const puzzle = {id:'candidate',rules:'voxel-1',title:'',difficulty:'Standard',size:[w,d,h],container,pieces,witness,solutionCount:null,certified:false};
  const hashInput = puzzleSignature(puzzle);
  if (seen.has(hashInput)) continue;
  seen.add(hashInput);
  if (!legalOrder(puzzle, witness)) continue;
  const result = solve(puzzle, {maxSolutions: 12, nodeBudget: 12000});
  if (!result.solutions.length) continue;
  const difficulty = result.exhaustive && result.solutions.length <= 2 ? 'Expert' : (pieces.length >= 5 || variant !== 0 ? 'Hard' : 'Standard');
  if (counts[difficulty] >= target) continue;
  const hash = createHash('sha256').update(hashInput).digest('hex');
  puzzle.id = 'voxel-1/' + hash.slice(0,12);
  puzzle.title = (variant === 1 ? 'Corner' : variant === 2 ? 'Raised corner' : 'Parcel') + ' ' + String(counts[difficulty]+1).padStart(2,'0');
  puzzle.difficulty = difficulty;
  puzzle.witness = result.solutions[0];
  puzzle.solutionCount = result.exhaustive ? result.solutions.length : null;
  puzzle.certified = result.exhaustive;
  puzzle.evidence = {contentHash:hash,solver:'exact-cover-1',equivalence:'identical-physical-pieces+gravity-rotations',nodes:result.nodes,exhaustive:result.exhaustive};
  if (!complete(puzzle,puzzle.witness)) throw Error('Invalid generated witness');
  catalogue.push(puzzle); counts[difficulty]++;
  if (catalogue.length % 10 === 0) console.log(JSON.stringify({attempt, counts}));
}
writeFileSync(new URL('../src/catalogue-data.json', import.meta.url), JSON.stringify(catalogue,null,2)+'\n');
console.log(JSON.stringify({inventory:counts,total:catalogue.length,uniqueCandidates:seen.size,seed:'51a7c09',solver:'exact-cover-1'}));
if (!catalogue.length || counts.Expert === 0) process.exitCode = 1;
