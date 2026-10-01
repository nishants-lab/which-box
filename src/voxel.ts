export type Cell = [number, number, number];
export type Piece = { id: string; name: string; color: string; cells: Cell[] };
export type VPlacement = { id: string; at: Cell; orientation: number };
export type VPuzzle = {
  id: string; rules: 'voxel-1'; title: string; difficulty: 'Standard' | 'Hard' | 'Expert';
  size: Cell; container: Cell[]; pieces: Piece[]; witness: VPlacement[];
  solutionCount: number | null; certified: boolean;
};
const key = (c: Cell) => c.join(',');
const compare = (a: Cell, b: Cell) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const cellList = (cells: Cell[]) => [...cells].sort(compare).map(key).join(';');
const integerCell = (c: Cell) => Array.isArray(c) && c.length === 3 && c.every(Number.isSafeInteger);
function normalize(cells: Cell[]): Cell[] {
  const min = [0, 1, 2].map(axis => Math.min(...cells.map(c => c[axis]!)));
  return cells.map(c => c.map((n, axis) => n - min[axis]!) as Cell).sort(compare);
}
const rotationCache = new Map<string, Cell[][]>();
export function orientations(cells: Cell[]): Cell[][] {
  if (!Array.isArray(cells) || !cells.length || !cells.every(integerCell)) return [];
  const input = cellList(cells), cached = rotationCache.get(input);
  if (cached) return cached.map(shape => shape.map(c => [...c] as Cell));
  const rotations = new Map<string, Cell[]>();
  for (const axes of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
    const inversions = axes.reduce((sum, axis, i) => sum + axes.slice(i + 1).filter(b => axis > b).length, 0);
    for (const a of [1, -1]) for (const b of [1, -1]) for (const c of [1, -1]) {
      if (a * b * c * (inversions % 2 ? -1 : 1) !== 1) continue;
      const signs = [a, b, c];
      const shape = normalize(cells.map(v => axes.map((axis, i) => v[axis]! * signs[i]!) as Cell));
      rotations.set(cellList(shape), shape);
    }
  }
  const result = [...rotations.values()];
  rotationCache.set(input, result);
  return result.map(shape => shape.map(c => [...c] as Cell));
}
export function worldCells(piece: Piece, placement: VPlacement): Cell[] {
  if (!placement || !piece || !integerCell(placement.at) || !Number.isInteger(placement.orientation)) return [];
  const shape = orientations(piece.cells)[placement.orientation];
  return shape ? shape.map(c => c.map((n, axis) => n + placement.at[axis]!) as Cell) : [];
}
function connected(cells: Cell[]): boolean {
  if (!cells.length) return false;
  const remaining = new Set(cells.map(key)), queue: Cell[] = [cells[0]!];
  remaining.delete(key(cells[0]!));
  for (let i = 0; i < queue.length; i++) for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const next = [...queue[i]!] as Cell; next[axis] = next[axis]! + sign;
    if (remaining.delete(key(next))) queue.push(next);
  }
  return remaining.size === 0;
}
function definitionError(puzzle: VPuzzle): string | null {
  if (!puzzle || !Array.isArray(puzzle.container) || !Array.isArray(puzzle.pieces)) return 'Invalid puzzle definition.';
  if (puzzle.rules !== 'voxel-1' || !integerCell(puzzle.size) || puzzle.size.some(n => n < 1)) return 'Invalid container dimensions.';
  if (!puzzle.container.length || puzzle.container.some(c => !integerCell(c) || c.some((n, i) => n < 0 || n >= puzzle.size[i]!)) || new Set(puzzle.container.map(key)).size !== puzzle.container.length) return 'Invalid container cells.';
  if (puzzle.pieces.some(p => !p || typeof p.id !== 'string' || !Array.isArray(p.cells))) return 'Invalid piece definition.';
  if (new Set(puzzle.pieces.map(p => p.id)).size !== puzzle.pieces.length) return 'Duplicate piece identifiers.';
  for (const piece of puzzle.pieces) {
    if (!piece.cells.every(integerCell) || new Set(piece.cells.map(key)).size !== piece.cells.length || !connected(piece.cells)) return 'Pieces must contain distinct connected integer cells.';
  }
  return null;
}
function geometryError(puzzle: VPuzzle, placements: VPlacement[]): string | null {
  if (!Array.isArray(placements) || placements.some(p => !p || typeof p.id !== 'string' || !integerCell(p.at) || !Number.isSafeInteger(p.orientation))) return 'Invalid placements.';
  if (new Set(placements.map(p => p.id)).size !== placements.length) return 'A piece appears twice.';
  const container = new Set(puzzle.container.map(key)), occupied = new Set<string>();
  for (const p of placements) {
    const piece = puzzle.pieces.find(piece => piece.id === p.id);
    if (!piece || !integerCell(p.at) || !Number.isInteger(p.orientation)) return 'Invalid piece or position.';
    const cells = worldCells(piece, p);
    if (cells.length !== piece.cells.length) return 'Invalid orientation.';
    for (const c of cells) {
      if (!container.has(key(c))) return 'A piece crosses the container boundary.';
      if (occupied.has(key(c))) return 'Pieces overlap.';
      occupied.add(key(c));
    }
  }
  for (const p of placements) {
    const cells = worldCells(puzzle.pieces.find(piece => piece.id === p.id)!, p);
    for (const [x, y, z] of cells) {
      const below = key([x, y, z - 1]);
      if (z > 0 && container.has(below) && !occupied.has(below)) return 'Every bottom cell needs support.';
    }
  }
  return null;
}
function land(puzzle: VPuzzle, piece: Piece, orientation: number, x: number, y: number, placements: VPlacement[]): VPlacement | null {
  if (![x, y, orientation].every(Number.isSafeInteger)) return null;
  const shape = orientations(piece.cells)[orientation];
  if (!shape || shape.some(c => c[0] + x < 0 || c[0] + x >= puzzle.size[0] || c[1] + y < 0 || c[1] + y >= puzzle.size[1])) return null;
  const container = new Set(puzzle.container.map(key));
  const occupied = new Set(placements.flatMap(p => worldCells(puzzle.pieces.find(i => i.id === p.id)!, p)).map(key));
  const collision = (z: number) => shape.some(c => {
    const cell: Cell = [c[0] + x, c[1] + y, c[2] + z];
    return cell[2] < 0 || occupied.has(key(cell)) || (cell[2] < puzzle.size[2] && !container.has(key(cell)));
  });
  let z = puzzle.size[2];
  while (!collision(z - 1)) z--;
  const placement: VPlacement = { id: piece.id, at: [x, y, z], orientation };
  return geometryError(puzzle, [...placements, placement]) === null ? placement : null;
}
function insertionOrder(puzzle: VPuzzle, placements: VPlacement[], initial: VPlacement[] = []): VPlacement[] | null {
  if (definitionError(puzzle) || geometryError(puzzle, placements)) return null;
  const failed = new Set<string>();
  function search(placed: VPlacement[], remaining: VPlacement[]): VPlacement[] | null {
    if (!remaining.length) return placed;
    const state = remaining.map(p => p.id).sort().join('|');
    if (failed.has(state)) return null;
    for (const target of remaining) {
      const piece = puzzle.pieces.find(p => p.id === target.id)!;
      const dropped = land(puzzle, piece, target.orientation, target.at[0], target.at[1], placed);
      if (!dropped || key(dropped.at) !== key(target.at)) continue;
      const order = search([...placed, target], remaining.filter(p => p !== target));
      if (order) return order;
    }
    failed.add(state);
    return null;
  }
  return search(initial, placements.filter(p => !initial.some(fixed => fixed.id === p.id)));
}
export function legalOrder(puzzle: VPuzzle, placements: VPlacement[]): VPlacement[] | null {
  return insertionOrder(puzzle, placements);
}
export function validate(puzzle: VPuzzle, placements: VPlacement[]): string | null {
  return definitionError(puzzle) || geometryError(puzzle, placements) || (legalOrder(puzzle, placements) ? null : 'These pieces cannot be inserted from above.');
}
export function drop(puzzle: VPuzzle, id: string, orientation: number, x: number, y: number, placements: VPlacement[]): VPlacement | null {
  if (definitionError(puzzle) || !Array.isArray(placements) || placements.some(p => !p || typeof p.id !== 'string')) return null;
  const piece = puzzle.pieces.find(p => p.id === id), rest = placements.filter(p => p.id !== id);
  if (!piece || validate(puzzle, rest)) return null;
  return land(puzzle, piece, orientation, x, y, rest);
}
export function complete(puzzle: VPuzzle, placements: VPlacement[]): boolean {
  return !definitionError(puzzle) && Array.isArray(placements) && placements.length === puzzle.pieces.length && puzzle.pieces.reduce((sum, p) => sum + p.cells.length, 0) === puzzle.container.length && validate(puzzle, placements) === null;
}
function spin([x, y, z]: Cell, turn: number): Cell {
  return turn === 0 ? [x, y, z] : turn === 1 ? [-y, x, z] : turn === 2 ? [-x, -y, z] : [y, -x, z];
}
function symmetryTransforms(puzzle: VPuzzle): ((c: Cell) => Cell)[] {
  const original = cellList(puzzle.container), transforms: ((c: Cell) => Cell)[] = [];
  for (let turn = 0; turn < 4; turn++) {
    const rotated = puzzle.container.map(c => spin(c, turn));
    const offset = [0, 1].map(axis => Math.min(...puzzle.container.map(c => c[axis]!)) - Math.min(...rotated.map(c => c[axis]!)));
    const transform = (c: Cell): Cell => { const r = spin(c, turn); return [r[0] + offset[0]!, r[1] + offset[1]!, r[2]]; };
    if (cellList(puzzle.container.map(transform)) === original) transforms.push(transform);
  }
  return transforms;
}
export function solve(puzzle: VPuzzle, options: { maxSolutions?: number; nodeBudget?: number; fixed?: VPlacement[] } = {}): { solutions: VPlacement[][]; exhaustive: boolean; nodes: number } {
  const solutions: VPlacement[][] = [], fixed = options.fixed ?? [];
  let nodes = 0, exhaustive = true;
  const limit = options.maxSolutions ?? Infinity, budget = options.nodeBudget ?? 100000;
  if (definitionError(puzzle) || validate(puzzle, fixed) || puzzle.pieces.reduce((n, p) => n + p.cells.length, 0) !== puzzle.container.length) return { solutions, exhaustive, nodes };
  const index = new Map(puzzle.container.map((c, i) => [key(c), i]));
  const full = (1n << BigInt(puzzle.container.length)) - 1n;
  const shapeKeys = puzzle.pieces.map(p => orientations(p.cells).map(cellList).sort()[0]);
  const transforms = symmetryTransforms(puzzle), seen = new Set<string>();
  type Candidate = { placement: VPlacement; mask: bigint; piece: number };
  const byCell: Candidate[][] = puzzle.container.map(() => []);
  for (let piece = 0; piece < puzzle.pieces.length; piece++) {
    if (fixed.some(p => p.id === puzzle.pieces[piece]!.id)) continue;
    orientations(puzzle.pieces[piece]!.cells).forEach((shape, orientation) => {
      const bounds = [0, 1, 2].map(axis => Math.max(...shape.map(c => c[axis]!)) + 1);
      for (let x = 0; x <= puzzle.size[0] - bounds[0]!; x++) for (let y = 0; y <= puzzle.size[1] - bounds[1]!; y++) for (let z = 0; z <= puzzle.size[2] - bounds[2]!; z++) {
        const indices = shape.map(c => index.get(key([c[0] + x, c[1] + y, c[2] + z])));
        if (indices.some(i => i === undefined)) continue;
        const mask = indices.reduce<bigint>((m, i) => m | 1n << BigInt(i!), 0n);
        const candidate: Candidate = { placement: { id: puzzle.pieces[piece]!.id, at: [x, y, z], orientation }, mask, piece };
        for (const i of indices) byCell[i!]!.push(candidate);
      }
    });
  }
  const used = new Set(fixed.map(p => puzzle.pieces.findIndex(i => i.id === p.id)));
  const initial = fixed.flatMap(p => worldCells(puzzle.pieces.find(i => i.id === p.id)!, p)).reduce((mask, c) => mask | 1n << BigInt(index.get(key(c))!), 0n);
  const canonical = (placements: VPlacement[]) => transforms.map(transform => placements.map(p => {
    const i = puzzle.pieces.findIndex(piece => piece.id === p.id);
    return shapeKeys[i] + ':' + cellList(worldCells(puzzle.pieces[i]!, p).map(transform));
  }).sort().join('|')).sort()[0]!;
  function search(mask: bigint, placements: VPlacement[]): void {
    if (nodes >= budget || solutions.length >= limit) { exhaustive = false; return; }
    nodes++;
    if (mask === full) {
      const order = insertionOrder(puzzle, placements, fixed);
      if (!order) return;
      const signature = canonical(order);
      if (!seen.has(signature)) { seen.add(signature); solutions.push(order); }
      return;
    }
    let choices: Candidate[] | undefined;
    for (let i = 0; i < byCell.length; i++) {
      if ((mask & 1n << BigInt(i)) !== 0n) continue;
      const available = byCell[i]!.filter(c => !used.has(c.piece) && (c.mask & mask) === 0n && !shapeKeys.some((shape, j) => j < c.piece && shape === shapeKeys[c.piece] && !used.has(j)));
      if (!available.length) return;
      if (!choices || available.length < choices.length) choices = available;
    }
    for (const candidate of choices ?? []) {
      used.add(candidate.piece);
      search(mask | candidate.mask, [...placements, candidate.placement]);
      used.delete(candidate.piece);
      if (!exhaustive) return;
    }
  }
  search(initial, fixed);
  return { solutions, exhaustive, nodes };
}
