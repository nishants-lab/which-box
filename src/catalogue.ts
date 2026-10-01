import data from './catalogue-data.json' with { type: 'json' };
import type {VPuzzle} from './voxel.ts';

// This published v1 order is immutable: append-only changes would also change Daily selection.
export const catalogue: VPuzzle[] = data as unknown as VPuzzle[];
export function findPuzzle(id: string): VPuzzle | undefined {
  return catalogue.find(puzzle => puzzle.id === id);
}
export function dailyPuzzle(day: string): VPuzzle {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day + 'T00:00:00Z')) || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) throw Error('Invalid UTC day');
  if (!catalogue.length) throw Error('The puzzle catalogue is empty.');
  let hash = 2166136261;
  for (const c of 'voxel-catalogue-1/' + day) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return catalogue[(hash >>> 0) % catalogue.length]!;
}
