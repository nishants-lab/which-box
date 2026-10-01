import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { complete, drop, orientations, validate, worldCells } from './voxel';
import type { Cell, Piece, VPlacement, VPuzzle } from './voxel';
import { CreativeScene } from './CreativeScene';
import { ResultShare } from './ResultShare';
import { freshId } from './progress';
import { formatTime, scoredSeconds } from './timing';
import './creative.css';

export type Attempt = {
  puzzleId: string;
  placements: VPlacement[];
  elapsedMs: number;
  hints: number;
  promptOffered: boolean;
  started: boolean;
  solved: boolean;
  attemptId: string;
};
type Props = {
  puzzle: VPuzzle;
  initialAttempt?: Attempt;
  onAttempt: (attempt: Attempt) => void;
  onComplete: (attempt: Attempt) => Promise<void>;
  onNext: () => void;
  mode: 'Daily' | 'Free play';
  completionLabel?: string;
  completionRecorded?: boolean;
  onDescribe?: (snapshot: Record<string, unknown>) => void;
  registerFlush?: (flush: (() => Attempt) | null) => void;
};

function cellKey(cells: Cell[]) { return cells.map(cell => cell.join(',')).sort().join(';'); }
function normalized(cells: Cell[]): Cell[] {
  const min = ([0, 1, 2] as const).map(axis => Math.min(...cells.map(cell => cell[axis])));
  return cells.map(cell => cell.map((value, axis) => value - (min[axis] ?? 0)) as Cell);
}
export function turnOrientation(cells: Cell[], rotations: Cell[][], axis: 'spin' | 'tip'): number {
  const turned = normalized(cells.map(([x, y, z]) => axis === 'spin' ? [-y, x, z] : [x, -z, y]));
  return Math.max(0, rotations.findIndex(rotation => cellKey(rotation) === cellKey(turned)));
}

export function witnessHint(puzzle: VPuzzle, placements: VPlacement[]): { text: string; target?: VPlacement } {
  if (!complete(puzzle, puzzle.witness)) return { text: 'No verified hint is available for this puzzle. Try another orientation and check the empty cells.' };
  const matches = (placement: VPlacement, target: VPlacement) => {
    const piece = puzzle.pieces.find(p => p.id === placement.id)!;
    return cellKey(worldCells(piece, placement)) === cellKey(worldCells(piece, target));
  };
  const conflicts = placements.filter(placement => {
    const target = puzzle.witness.find(w => w.id === placement.id);
    return !target || !matches(placement, target);
  });
  if (conflicts.length) {
    const removable = conflicts.find(placement => !validate(puzzle, placements.filter(p => p.id !== placement.id)));
    const piece = puzzle.pieces.find(p => p.id === (removable ?? conflicts[conflicts.length - 1]!).id)!;
    return { text: `${piece.name} differs from the verified arrangement. ${removable ? `Remove ${piece.name} to follow that arrangement.` : 'Remove the pieces above it first, then remove it.'} Your current arrangement may still have another solution.` };
  }
  for (const target of puzzle.witness) {
    if (placements.some(p => p.id === target.id)) continue;
    const proposal = drop(puzzle, target.id, target.orientation, target.at[0], target.at[1], placements);
    if (!proposal || !matches(proposal, target) || validate(puzzle, [...placements, proposal])) continue;
    const piece = puzzle.pieces.find(p => p.id === target.id)!;
    return { text: `${piece.name}: orientation ${target.orientation + 1}, column ${target.at[0] + 1}, row ${target.at[1] + 1}, base ${target.at[2]}. The preview is set. Place it when ready.`, target };
  }
  return { text: complete(puzzle, placements) ? 'Every piece is packed. Finish this puzzle.' : 'No next drop matches the verified arrangement from this state. Undo the last move and check its support.' };
}

function blockedGhost(puzzle: VPuzzle, piece: Piece, orientation: number, x: number, y: number, placements: VPlacement[]): VPlacement {
  const shape = orientations(piece.cells)[orientation] ?? [];
  const allowed = new Set(puzzle.container.map(cell => cell.join(",")));
  const occupied = new Set(placements.filter(p => p.id !== piece.id).flatMap(p => worldCells(puzzle.pieces.find(item => item.id === p.id)!, p)).map(cell => cell.join(",")));
  let z = puzzle.size[2];
  // Invalid drops still preview at the first obstruction, never through it.
  while (z > 0 && !shape.some(cell => {
    const world: Cell = [cell[0] + x, cell[1] + y, cell[2] + z - 1];
    return occupied.has(world.join(",")) || (world[2] < puzzle.size[2] && !allowed.has(world.join(",")));
  })) z--;
  return { id: piece.id, orientation, at: [x, y, z] };
}

function PieceIcon({ piece, cells = piece.cells }: { piece: Piece; cells?: Cell[] }) {
  const projected = cells.map(([x, y, z]) => ({ x: (x - y) * 6, y: (x + y) * 3 - z * 6, depth: x + y + z }));
  const left = Math.min(...projected.map(p => p.x)) - 7, top = Math.min(...projected.map(p => p.y)) - 7;
  const width = Math.max(...projected.map(p => p.x)) - left + 8, height = Math.max(...projected.map(p => p.y)) - top + 8;
  return <svg className="creative-piece-icon" viewBox={`${left} ${top} ${width} ${height}`} aria-hidden="true">
    {projected.sort((a, b) => a.depth - b.depth).map((p, index) => <g key={index} transform={`translate(${p.x} ${p.y})`} fill={piece.color} stroke="#344237" strokeWidth=".6">
      <path d="M0 -6 6 -3 0 0 -6 -3Z" /><path d="M-6 -3 0 0 0 6 -6 3Z" /><path d="M0 0 6 -3 6 3 0 6Z" /><path d="M0 -6 6 -3 0 0 -6 -3Z" fill="white" fillOpacity=".25" /><path d="M0 0 6 -3 6 3 0 6Z" fill="black" fillOpacity=".12" />
    </g>)}
  </svg>;
}

export function CreativeGame(props: Props) {
  const { puzzle, mode } = props;
  const callbacks = useRef(props);
  useLayoutEffect(() => { callbacks.current = props; }, [props]);
  const [attempt, setAttempt] = useState<Attempt>(() => {
    const saved = props.initialAttempt;
    if (saved?.puzzleId === puzzle.id && !validate(puzzle, saved.placements)) return { ...saved, solved: saved.solved && complete(puzzle, saved.placements) };
    return { puzzleId: puzzle.id, placements: [], elapsedMs: 0, hints: 0, promptOffered: false, started: false, solved: false, attemptId: freshId() };
  });
  const current = useRef(attempt);
  const lastEmitted = useRef(attempt);
  const lastTick = useRef(0);
  const visible = useRef(!document.hidden);
  const activeSinceMove = useRef(0);
  const invalidAttempts = useRef(0);
  const [selected, setSelected] = useState<string | null>(() => puzzle.pieces.find(p => !attempt.placements.some(at => at.id === p.id))?.id ?? null);
  const [orientation, setOrientation] = useState(0);
  const [cell, setCell] = useState<[number, number]>([0, 0]);
  const [top, setTop] = useState(false);
  const [history, setHistory] = useState<VPlacement[][]>([]);
  const [message, setMessage] = useState('');
  const [hintText, setHintText] = useState('');
  const [offerOpen, setOfferOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [share, setShare] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveFailed, setSaveFailed] = useState(!!props.initialAttempt?.solved && !props.completionRecorded);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const piece = puzzle.pieces.find(p => p.id === selected);
  const rotations = useMemo(() => piece ? orientations(piece.cells) : [], [piece]);
  const oriented = rotations[orientation] ?? rotations[0];
  const placements = attempt.placements;
  const packed = placements.find(p => p.id === selected);
  const preview = useMemo(() => {
    if (!piece || attempt.solved) return null;
    if (packed && packed.orientation === orientation && packed.at[0] === cell[0] && packed.at[1] === cell[1]) return packed;
    return drop(puzzle, piece.id, orientation, cell[0], cell[1], placements);
  }, [puzzle, piece, packed, orientation, cell, placements, attempt.solved]);
  const error = preview ? validate(puzzle, [...placements.filter(p => p.id !== preview.id), preview]) : null;
  const valid = !!preview && !error;
  const ghost = attempt.solved || !piece ? null : preview ?? blockedGhost(puzzle, piece, orientation, cell[0], cell[1], placements);
  const ghostCells = piece && ghost ? worldCells(piece, ghost) : [];
  const footprint = new Set(ghostCells.map(([x, y]) => `${x},${y}`));
  const container = new Set(puzzle.container.map(c => c.join(',')));
  const occupancy = new Map<string, { piece: Piece; z: number }>();
  for (const placement of placements) {
    const placedPiece = puzzle.pieces.find(p => p.id === placement.id)!;
    for (const [x, y, z] of worldCells(placedPiece, placement)) {
      const key = `${x},${y}`;
      if (!occupancy.has(key) || occupancy.get(key)!.z < z) occupancy.set(key, { piece: placedPiece, z });
    }
  }
  const ready = complete(puzzle, placements) && (!piece || !!packed && packed.orientation === orientation && packed.at[0] === cell[0] && packed.at[1] === cell[1]);
  const feedback = attempt.solved ? 'All pieces packed.' : !piece ? 'All pieces placed. Finish when ready.' : error ?? (preview ? `Column ${cell[0] + 1}, row ${cell[1] + 1}, base ${preview.at[2]}. Ready to ${packed ? 'move' : 'place'}.` : 'No supported drop here. Turn the piece or choose another position.');

  const readClock = useCallback(() => {
    const now = performance.now();
    const elapsed = Math.max(0, now - lastTick.current);
    lastTick.current = now;
    if (current.current.started && !current.current.solved && visible.current) {
      current.current = { ...current.current, elapsedMs: current.current.elapsedMs + elapsed };
      activeSinceMove.current += elapsed;
    }
    return current.current;
  }, []);
  const persist = useCallback(function persist(patch: Partial<Attempt> = {}) {
    current.current = { ...readClock(), ...patch };
    setAttempt(current.current);
    lastEmitted.current = current.current;
    if (current.current.started || current.current.solved || current.current.placements.length) callbacks.current.onAttempt(current.current);
    return current.current;
  }, [readClock]);
  function begin() { if (!current.current.started) persist({ started: true }); }
  const offer = useCallback(() => {
    if (current.current.promptOffered || current.current.hints >= 2 || current.current.solved || document.hidden) return;
    persist({ promptOffered: true });
    setOfferOpen(true);
  }, [persist]);
  function invalid(message: string) {
    setMessage(message);
    invalidAttempts.current++;
    if (invalidAttempts.current >= 3) offer();
  }
  useLayoutEffect(() => { lastTick.current = performance.now(); visible.current = !document.hidden; }, []);
  useEffect(() => {
    const flush = () => {
      const value = readClock();
      if (value !== lastEmitted.current) { lastEmitted.current = value; callbacks.current.onAttempt(value); }
      return value;
    };
    callbacks.current.registerFlush?.(flush);
    const interval = window.setInterval(() => {
      if (!current.current.started || current.current.solved) return;
      persist();
      if (activeSinceMove.current >= 60_000) offer();
    }, 1000);
    const visibility = () => { persist(); visible.current = !document.hidden; };
    const pagehide = () => { flush(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
      flush();
      callbacks.current.registerFlush?.(null);
    };
  }, [offer, persist, readClock]);
  useEffect(() => {
    if (!offerOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOfferOpen(false); actionRef.current?.focus(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [offerOpen]);
  useEffect(() => { if (attempt.solved) resultHeading.current?.focus(); }, [attempt.solved]);
  useEffect(() => {
    callbacks.current.onDescribe?.({ mode, puzzleId: puzzle.id, title: puzzle.title, difficulty: puzzle.difficulty, size: puzzle.size, pieces: puzzle.pieces, container: puzzle.container, placements, selected, orientationIndex: orientation, orientedCells: oriented ?? [], preview, error, result: attempt.solved, hintCount: attempt.hints, elapsedSeconds: Math.floor(attempt.elapsedMs / 1000), elapsedMs: attempt.elapsedMs, promptOffered: attempt.promptOffered, promptOpen: offerOpen, attemptId: attempt.attemptId });
  }, [attempt, selected, orientation, oriented, placements, preview, error, offerOpen, mode, puzzle]);

  function select(id: string) {
    if (attempt.solved) return;
    begin(); setSelected(id); setMessage('');
    const placement = placements.find(p => p.id === id);
    setOrientation(placement?.orientation ?? 0);
    if (placement) setCell([placement.at[0], placement.at[1]]);
  }
  function chooseCell(x: number, y: number) {
    if (attempt.solved) return;
    begin(); setCell([x, y]); setMessage('');
    if (piece && !drop(puzzle, piece.id, orientation, x, y, placements)) invalid('No supported drop here. Try another position or turn.');
  }
  function chooseOrientation(next: number) {
    begin(); setOrientation(next); setMessage('');
    if (piece && !drop(puzzle, piece.id, next, cell[0], cell[1], placements)) invalid('This orientation does not fit here. Choose another position or turn.');
  }
  function rotate(axis: 'spin' | 'tip') { if (oriented) chooseOrientation(turnOrientation(oriented, rotations, axis)); }
  function apply(next: VPlacement[], record = true) {
    const issue = validate(puzzle, next);
    if (issue) { invalid(issue); return false; }
    if (record) setHistory(previous => [...previous.slice(-49), placements]);
    persist({ placements: next });
    activeSinceMove.current = 0; invalidAttempts.current = 0;
    setOfferOpen(false); setMessage(''); setHintText('');
    return true;
  }
  function place() {
    begin();
    if (!preview || error) { invalid(error ?? 'This position is blocked or unsupported. Try another position or turn.'); return; }
    if (!apply([...placements.filter(p => p.id !== preview.id), preview])) return;
    const next = puzzle.pieces.find(p => p.id !== preview.id && !placements.some(at => at.id === p.id));
    setSelected(next?.id ?? null); setOrientation(0);
  }
  function remove() {
    if (!packed) return;
    begin();
    if (apply(placements.filter(p => p.id !== packed.id))) setMessage(`${piece!.name} returned to the tray.`);
  }
  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    begin();
    if (apply(previous, false)) {
      setHistory(values => values.slice(0, -1));
      setSelected(puzzle.pieces.find(p => !previous.some(at => at.id === p.id))?.id ?? null); setOrientation(0);
    }
  }
  function hint() {
    if (attempt.solved || current.current.hints >= 2) return;
    begin();
    const recommendation = witnessHint(puzzle, placements);
    persist({ hints: current.current.hints + 1 });
    setHintText(recommendation.text); setOfferOpen(false);
    if (recommendation.target) { setSelected(recommendation.target.id); setOrientation(recommendation.target.orientation); setCell([recommendation.target.at[0], recommendation.target.at[1]]); }
  }
  function reset() {
    if (apply([])) {
      setSelected(puzzle.pieces[0]?.id ?? null); setOrientation(0); setCell([0, 0]); setConfirmReset(false);
      setMessage('Pieces reset. Timer and hints stay with this attempt.');
    }
  }
  async function finish() {
    if (saving.current || !complete(puzzle, current.current.placements)) return;
    saving.current = true; setBusy(true); setSaveFailed(false); setOfferOpen(false);
    const result = persist({ solved: true });
    try { await callbacks.current.onComplete(result); setSaveStatus(callbacks.current.completionLabel ?? 'Completion recorded.'); }
    catch { setSaveFailed(true); setSaveStatus('Your box is solved. Saving failed. Retry saving before leaving.'); }
    finally { saving.current = false; setBusy(false); }
  }
  const elapsedSeconds = Math.floor(attempt.elapsedMs / 1000);
  const shareText = `Everything Fits · ${mode}\n${puzzle.title} · ${puzzle.difficulty}\n${puzzle.id}\nPacked in ${formatTime(elapsedSeconds)} · ${attempt.hints} hints (+${attempt.hints * 20}s)\nScored time ${formatTime(scoredSeconds(elapsedSeconds, attempt.hints))}\nUnverified single-player result · No solution shown`;
  async function copyText() { try { await navigator.clipboard.writeText(shareText); setMessage('Result copied. Paste it where you choose.'); } catch { setMessage('Copy is unavailable. Select and copy the text below.'); } }

  return <main className="creative-app">
    <header className="creative-heading"><div><h1>{puzzle.title}</h1><p>{puzzle.difficulty} · {placements.length}/{puzzle.pieces.length} packed</p></div><div className="creative-clock"><strong data-timer>{formatTime(elapsedSeconds)}</strong><span>{attempt.hints ? `+${attempt.hints * 20}s hints` : 'packing time'}</span></div></header>
    <div className={attempt.solved ? "creative-layout creative-solved" : "creative-layout"}>
      <section className="creative-bench" aria-label="Packing bench"><CreativeScene puzzle={puzzle} placements={placements} ghost={ghost} valid={valid} top={top} onCell={chooseCell} /><button className="creative-view" data-view aria-pressed={top} onClick={() => setTop(value => !value)}>{top ? 'Orbit view' : 'Top view'}</button><span className="creative-dimensions">{puzzle.size.join(' × ')} cells</span>{offerOpen && !attempt.solved && <aside className="creative-hint creative-offer" aria-label="Optional packing hint"><h2>Want a hint?</h2><p>A hint adds 20 seconds to your score. Dismissing is free.</p><div className="creative-actions"><button onClick={hint}>Use hint (+20s)</button><button onClick={() => { setOfferOpen(false); actionRef.current?.focus(); }}>Keep trying</button></div></aside>}</section>
      <section className="creative-controls" aria-label="Packing controls">
        <div className="creative-tray" aria-label="Choose a piece">{puzzle.pieces.map(candidate => <button key={candidate.id} data-item={candidate.id} aria-pressed={selected === candidate.id} disabled={attempt.solved} onClick={() => select(candidate.id)} style={{ '--piece-color': candidate.color } as CSSProperties}><PieceIcon piece={candidate} /><span>{candidate.name}<small>{placements.some(p => p.id === candidate.id) ? 'Packed ✓' : `${candidate.cells.length} cells`}</small></span></button>)}</div>
        <div className="creative-turns"><span>{piece ? <><PieceIcon piece={piece} cells={oriented ?? piece.cells} /><b>{piece.name}</b></> : 'All pieces packed'}</span><button data-spin disabled={!piece || attempt.solved} onClick={() => rotate('spin')}>↻ Spin</button><button data-tip disabled={!piece || attempt.solved} onClick={() => rotate('tip')}>↷ Tip</button></div>
        <div className="creative-position"><div><p className="creative-grid-label" id="creative-grid-help">Position grid <span>top view · front ↓</span></p><div className="creative-grid position-pad" role="group" aria-label="Position grid" aria-describedby="creative-grid-help" style={{ gridTemplateColumns: `repeat(${puzzle.size[0]}, minmax(44px, 1fr))` }}>
          {Array.from({ length: puzzle.size[0] * puzzle.size[1] }, (_, index) => {
            const x = index % puzzle.size[0], y = Math.floor(index / puzzle.size[0]), key = `${x},${y}`;
            const allowed = puzzle.container.some(c => c[0] === x && c[1] === y);
            const occupied = occupancy.get(key);
            const inGhost = footprint.has(key);
            const blocked = inGhost && ghostCells.some(c => c[0] === x && c[1] === y && !container.has(c.join(',')));
            return <button key={key} data-cell={key} className={`${allowed ? '' : 'void'} ${inGhost ? valid && !blocked ? 'ghost-valid' : 'ghost-invalid' : ''}`} aria-label={`Column ${x + 1}, row ${y + 1}${!allowed ? ', outside container' : occupied ? `, ${occupied.piece.name}, height ${occupied.z + 1}` : ', empty'}${inGhost ? ', preview' : ''}`} aria-pressed={cell[0] === x && cell[1] === y} disabled={attempt.solved} onClick={() => chooseCell(x, y)} style={occupied ? { '--cell-color': occupied.piece.color } as CSSProperties : undefined}><span>{!allowed ? '×' : occupied ? occupied.z + 1 : '·'}</span>{cell[0] === x && cell[1] === y && <i aria-hidden="true" />}</button>;
          })}
        </div></div><div className="creative-side-actions"><button data-undo disabled={!history.length || attempt.solved} onClick={undo}>Undo</button><button data-remove disabled={!packed || attempt.solved} onClick={remove}>Remove</button><button data-hint disabled={attempt.hints >= 2 || attempt.solved} onClick={hint}>Hint <small>+20s</small></button></div></div>
        <p className={`creative-feedback ${!valid && piece && !attempt.solved ? 'invalid' : ''}`} role="status">{message || feedback}</p>
        {!attempt.solved && <button className="creative-primary creative-place" ref={actionRef} data-place={!ready ? '' : undefined} data-seal={ready ? '' : undefined} disabled={busy || (!piece && !ready)} onClick={ready ? () => void finish() : place}>{ready ? 'Finish puzzle' : packed ? 'Move piece' : 'Place piece'}</button>}
        {hintText && <aside className="creative-hint" id="packing-hint">{hintText}<p>{attempt.hints}/2 hints used · +{attempt.hints * 20}s scored time</p></aside>}
        
        <details className="creative-more"><summary>More: orientations, reset &amp; rules</summary>{piece && !attempt.solved && <><p>Choose an orientation. Spin turns on the floor; Tip rolls front to back.</p><div className="creative-orientations">{rotations.map((cells, index) => <button key={index} data-orientation={index} aria-label={`Orientation ${index + 1}`} aria-pressed={orientation === index} onClick={() => chooseOrientation(index)}><PieceIcon piece={piece} cells={cells} /><span>{index + 1}</span></button>)}</div></>}
          <p>Pack every piece into the outlined container. Shaded cells are outside the container. Pieces fall straight down and need support under each exposed bottom cell. Grid numbers show the highest occupied layer.</p><p>Two optional hints, +20 seconds each. The timer pauses when this view is hidden or you change modes. Reset keeps this attempt’s time and hint count.</p>
          {!attempt.solved && <button onClick={() => setConfirmReset(true)}>Reset pieces…</button>}{confirmReset && <div className="creative-hint"><p>Return all pieces to the tray? Time and hints stay.</p><button onClick={reset}>Reset pieces</button><button onClick={() => setConfirmReset(false)}>Cancel</button></div>}
        </details>
      </section>
    </div>
    {attempt.solved && <section className="creative-result" data-result><h2 tabIndex={-1} ref={resultHeading}>Everything fits.</h2>{puzzle.difficulty === 'Expert' && puzzle.certified && <p>Verified puzzle: {puzzle.solutionCount} distinct solution{puzzle.solutionCount === 1 ? '' : 's'}.</p>}<p><strong>{formatTime(scoredSeconds(elapsedSeconds, attempt.hints))}</strong> scored time · {formatTime(elapsedSeconds)} packing + {attempt.hints * 20}s hints</p><p role="status">{busy ? 'Saving completion…' : saveStatus || 'Puzzle completed.'}</p><div className="creative-actions">{saveFailed && <button disabled={busy} onClick={() => void finish()}>Retry saving</button>}<button className="creative-primary" data-next disabled={busy || saveFailed} onClick={props.onNext}>Next puzzle</button><button data-share onClick={() => setShare(value => !value)}>{share ? 'Hide share options' : 'Share result'}</button></div>{share && <><p>No solution is included. Nothing is posted automatically.</p><ResultShare day={puzzle.id} puzzleId={puzzle.id} utilization={100} boxName={puzzle.title} modeLabel={mode + ' · ' + puzzle.difficulty} puzzleTitle={puzzle.title} hint={attempt.hints > 0} elapsedSeconds={elapsedSeconds} hintCount={attempt.hints} /><textarea aria-label="Spoiler-free result text" readOnly value={shareText} /><button onClick={() => void copyText()}>Copy result text</button></>}</section>}
  </main>;
}
