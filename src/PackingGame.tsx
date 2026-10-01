import { useEffect, useMemo, useRef, useState } from 'react';
import {
  complete,
  daily,
  drop,
  orientations,
  validate,
} from './game';
import type { Dims, Placement } from './game';
import { Scene } from './Scene';
import { ResultShare } from './ResultShare';
import { formatTime, HINT_PENALTY_SECONDS, scoredSeconds } from './timing';
import { usePackingClock } from './usePackingClock';
import { useStruggleHint } from './useStruggleHint';
import './styles.css';

type Props = {
  day: string;
  initialBest: number | null;
  canSave: boolean;
  onSave: (result: {
    day: string;
    boxId: string;
    placements: Placement[];
  }) => Promise<{ utilization: number; best: number }>;
  onDescribe?: (snapshot: Record<string, unknown>) => void;
  saveLabel?: string;
};

const shortNames = [
  'Book',
  'Coffee',
  'Phones',
  'Light',
  'Kit',
  'Speaker',
  'Tea',
];

export function App({
  day: serverDay,
  initialBest,
  canSave,
  onSave,
  onDescribe,
  saveLabel = 'to your Reddit account',
}: Props) {
  const [day] = useState(serverDay);
  const puzzle = useMemo(() => daily(day), [day]);
  const box = puzzle.boxes.find((candidate) => candidate.id === 'S')!;
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [undo, setUndo] = useState<Placement[][]>([]);
  const [selected, setSelected] = useState<string | null>(
    puzzle.items[0]?.id ?? null
  );
  const [orientation, setOrientation] = useState(0);
  const [cell, setCell] = useState<[number, number]>([0, 0]);
  const [view, setView] = useState(0);
  const [result, setResult] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [share, setShare] = useState(false);
  const [savedCompletion, setSavedCompletion] = useState(initialBest === 100);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [message, setMessage] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const clock = usePackingClock();
  const struggle = useStruggleHint({
    running: clock.running,
    enabled: !result && !busy && hintCount < 2,
  });
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const firstControl = useRef<HTMLButtonElement>(null);
  const prompt = useRef<HTMLElement>(null);
  const promptReturnFocus = useRef<Element | null>(null);
  const wasResult = useRef(false);
  const saving = useRef(false);
  const item = puzzle.items.find((candidate) => candidate.id === selected);
  const rotations = useMemo(
    () => (item ? orientations(item.dims) : []),
    [item]
  );
  const dims = rotations[orientation % Math.max(1, rotations.length)];
  const preview = useMemo(() => {
    if (!item || !dims) return null;
    const packed = placements.find((placement) => placement.id === item.id);
    if (
      packed &&
      packed.at[0] === cell[0] &&
      packed.at[1] === cell[1] &&
      packed.dims.every((value, axis) => value === dims[axis])
    )
      return packed;
    return drop(item, dims, cell[0], cell[1], placements);
  }, [item, dims, cell, placements]);
  const proposal = preview
    ? [
        ...placements.filter((placement) => placement.id !== preview.id),
        preview,
      ]
    : placements;
  const error = preview ? validate(puzzle.items, box, proposal) : null;
  const readyToSeal = complete(puzzle, box, placements);
  const packedSelection = placements.find(
    (placement) => placement.id === selected
  );
  const movingPacked =
    !!preview &&
    !!packedSelection &&
    (preview.at.some((value, axis) => value !== packedSelection.at[axis]) ||
      preview.dims.some((value, axis) => value !== packedSelection.dims[axis]));
  const hintTarget = puzzle.witness[0]!;
  const hintItem = puzzle.items.find(
    (candidate) => candidate.id === hintTarget.id
  )!;
  const feedback =
    error === 'The item crosses the box boundary.'
      ? 'Outside the box. Try another corner or rotate.'
      : error === 'Every item needs full support beneath it.'
        ? 'Needs full support. Try a flat surface or move the upper parcel first.'
        : (error ??
          (preview
            ? `Column ${cell[0] + 1}, row ${cell[1] + 1}, base ${preview.at[2]}. Ready to place.`
            : 'Every parcel is packed. Seal your box.'));

  useEffect(() => {
    if (result) resultHeading.current?.focus();
    else if (wasResult.current) firstControl.current?.focus();
    wasResult.current = result;
  }, [result]);

  useEffect(() => {
    if (struggle.open) promptReturnFocus.current = document.activeElement;
  }, [struggle.open]);

  useEffect(() => {
    if (!celebrating) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const timer = window.setTimeout(
      () => setCelebrating(false),
      reduced ? 0 : 1800
    );
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  useEffect(() => {
    onDescribe?.({
      puzzleId: puzzle.id,
      day,
      box,
      items: puzzle.items,
      placements,
      selected,
      orientationIndex: orientation,
      orientedDimensions: dims ?? null,
      preview,
      error,
      result,
      score: result ? 100 : null,
      hintCount,
      elapsedSeconds: clock.elapsed,
      scoredSeconds: scoredSeconds(clock.elapsed, hintCount),
      promptOffered: struggle.offered,
    });
  }, [
    onDescribe,
    puzzle,
    day,
    box,
    placements,
    selected,
    orientation,
    dims,
    preview,
    error,
    result,
    hintCount,
    clock.elapsed,
    struggle.offered,
  ]);

  function commit(next: Placement[]) {
    setUndo((previous) => [...previous.slice(-49), placements]);
    setPlacements(next);
    setShare(false);
  }

  function selectParcel(id: string | null, current = placements) {
    setSelected(id);
    const packed = current.find((placement) => placement.id === id);
    const parcel = puzzle.items.find((candidate) => candidate.id === id);
    setOrientation(
      packed && parcel
        ? Math.max(
            0,
            orientations(parcel.dims).findIndex((rotation) =>
              rotation.every((length, axis) => length === packed.dims[axis])
            )
          )
        : 0
    );
    setCell(packed ? [packed.at[0], packed.at[1]] : [0, 0]);
  }

  function pick(id: string) {
    if (result) return;
    clock.begin();
    selectParcel(id);
    setMessage('');
  }

  function testPosition(nextDims: Dims, x: number, y: number) {
    if (!item) return;
    const packed = placements.find((placement) => placement.id === item.id);
    if (
      packed &&
      packed.at[0] === x &&
      packed.at[1] === y &&
      packed.dims.every((value, axis) => value === nextDims[axis])
    )
      return;
    const next = drop(item, nextDims, x, y, placements);
    struggle.attempt(
      !!validate(puzzle.items, box, [
        ...placements.filter((placement) => placement.id !== item.id),
        next,
      ])
    );
  }

  function position(x: number, y: number) {
    if (result || !dims) return;
    clock.begin();
    setCell([x, y]);
    setMessage('');
    testPosition(dims, x, y);
  }

  function rotate() {
    if (result || !item) return;
    clock.begin();
    const next = (orientation + 1) % rotations.length;
    setOrientation(next);
    setMessage('');
    if (next !== orientation && rotations[next])
      testPosition(rotations[next], cell[0], cell[1]);
  }

  function place() {
    if (!preview || error || result) return;
    clock.begin();
    commit(proposal);
    struggle.progress();
    const remaining = puzzle.items.find(
      (parcel) => !proposal.some((placement) => placement.id === parcel.id)
    );
    selectParcel(remaining?.id ?? null, proposal);
    setMessage(
      `${item?.name ?? 'Parcel'} placed.${remaining ? ` Next: ${remaining.name}.` : ' Ready to seal.'}`
    );
  }

  function remove() {
    if (!selected || result) return;
    const next = placements.filter((placement) => placement.id !== selected);
    if (validate(puzzle.items, box, next)) {
      setMessage(
        'This parcel supports another. Remove the parcels above it first.'
      );
      return;
    }
    commit(next);
    setMessage('Parcel removed. Undo is free.');
  }

  function dismissPrompt() {
    if (
      prompt.current?.contains(document.activeElement) &&
      promptReturnFocus.current instanceof HTMLElement
    )
      promptReturnFocus.current.focus();
    struggle.dismiss();
  }

  function revealHint() {
    if (result || hintCount >= 2) return;
    clock.begin();
    dismissPrompt();
    setHintCount((count) => count + 1);
    setMessage('');
  }

  async function saveResult() {
    if (!canSave || saving.current) return;
    saving.current = true;
    setBusy(true);
    setSaveFailed(false);
    setSaveStatus('Saving your completion…');
    const snapshot: Placement[] = placements.map((placement) => ({
      id: placement.id,
      at: [placement.at[0], placement.at[1], placement.at[2]],
      dims: [placement.dims[0], placement.dims[1], placement.dims[2]],
    }));
    try {
      await onSave({ day, boxId: 'S', placements: snapshot });
      setSavedCompletion(true);
      setSaveStatus(`Completion saved ${saveLabel}.`);
    } catch (failure) {
      const detail =
        failure instanceof Error ? failure.message : 'Saving was unavailable.';
      const reload = /reload|stale|too old/i.test(detail);
      setSaveFailed(!reload);
      setSaveStatus(
        reload
          ? 'This result could not be saved. Reload to play today’s order. You can still share this result before reloading.'
          : `${detail} Your solved result is still here. Retry saving before leaving.`
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function seal() {
    if (!readyToSeal || busy || result) return;
    clock.stop();
    struggle.dismiss();
    setResult(true);
    setCelebrating(true);
    setSelected(null);
    setConfirmReset(false);
    setMessage('');
    if (canSave) void saveResult();
    else {
      setSavedCompletion(true);
      setSaveStatus(
        'Guest completion kept for this session. Reloading clears it.'
      );
    }
  }

  const shareText = `Which Box? Daily Dispatch\n${day} UTC · Solved\nPacked in ${formatTime(clock.elapsed)} · ${hintCount} hints (+${hintCount * HINT_PENALTY_SECONDS}s)\nScored time ${formatTime(scoredSeconds(clock.elapsed, hintCount))}\nEvery parcel packed. Personal, unverified time. No solution shown.`;

  return (
    <main className="packing-app">
      <header className="app-header">
        <span className="wordmark">WHICH BOX?</span>
        <time dateTime={day} title={`${day} UTC`}>
          {day.slice(5)} UTC
        </time>
        <strong data-timer role="timer" aria-label="Elapsed packing time">
          {formatTime(clock.elapsed)}
        </strong>
        <span className="packed-count">
          Packed {placements.length}/{puzzle.items.length}
        </span>
      </header>
      <h1>Fit every parcel into this box</h1>
      <div className="layout">
        <section className="workbench" aria-label="3D packing box">
          <div className="view-tools">
            <span>{result ? 'Sealed' : '3D · Drag to orbit'}</span>
            <button
              data-view
              onClick={() => setView((previous) => previous + 1)}
            >
              {view % 2 ? 'Perspective' : 'Top view'}
            </button>
          </div>
          <div className="scene-stage">
            <Scene
              box={box}
              items={puzzle.items}
              placements={placements}
              preview={preview}
              valid={!error}
              view={view}
              sealed={result}
              skipAnimation={result && !celebrating}
              onCell={position}
            />
            <div className="hint-overlay" aria-live="polite">
              {struggle.open && (
                <aside
                  ref={prompt}
                  className="struggle-hint"
                  role="dialog"
                  aria-labelledby="struggle-title"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') dismissPrompt();
                  }}
                >
                  <h2 id="struggle-title">Need a hand?</h2>
                  <p>A starting hint adds 20 seconds.</p>
                  <div className="hint-actions">
                    <button onClick={dismissPrompt}>Keep trying</button>
                    <button onClick={revealHint}>Show hint (+20s)</button>
                  </div>
                </aside>
              )}
            </div>
          </div>
        </section>
        {result ? (
          <section
            className="result"
            data-result
            aria-labelledby="result-heading"
          >
            <h2 id="result-heading" ref={resultHeading} tabIndex={-1}>
              Solved. Every parcel fits.
            </h2>
            <p className="result-time">
              {formatTime(clock.elapsed)} <span>packing time</span>
            </p>
            <p data-penalty>
              {hintCount} hints · +{hintCount * HINT_PENALTY_SECONDS}s
            </p>
            <p data-scored>
              Scored time{' '}
              <strong>
                {formatTime(scoredSeconds(clock.elapsed, hintCount))}
              </strong>
            </p>
            <p role="status">{saveStatus}</p>
            <div className="result-actions">
              <button
                data-share
                className="primary"
                aria-expanded={share}
                aria-controls="result-share"
                onClick={() => setShare(!share)}
              >
                {share ? 'Hide share card' : 'Share result'}
              </button>
              <button
                data-retry
                disabled={busy}
                onClick={() => {
                  setResult(false);
                  setCelebrating(false);
                  clock.begin();
                  setShare(false);
                  setSaveFailed(false);
                  selectParcel(null);
                  setMessage(
                    'Clock and hints continue. Select a packed parcel to move it.'
                  );
                }}
              >
                Keep improving
              </button>
              {saveFailed && (
                <button
                  data-save-retry
                  disabled={busy}
                  onClick={() => {
                    void saveResult();
                  }}
                >
                  Retry saving
                </button>
              )}
              {celebrating && (
                <button onClick={() => setCelebrating(false)}>
                  Skip celebration
                </button>
              )}
            </div>
            {share && (
              <div id="result-share">
                <ResultShare
                  day={day}
                  puzzleId={puzzle.id}
                  utilization={100}
                  boxName={box.name}
                  hint={hintCount > 0}
                  elapsedSeconds={clock.elapsed}
                  hintCount={hintCount}
                />
                <label htmlFor="share">
                  Copy this spoiler-free result. Nothing is posted
                  automatically.
                </label>
                <textarea
                  id="share"
                  readOnly
                  value={shareText}
                  onFocus={(event) => event.target.select()}
                />
              </div>
            )}
          </section>
        ) : (
          <section className="packing-controls" aria-label="Packing controls">
            <div
              className="items"
              role="group"
              aria-label="Parcels, select a packed parcel to move it"
            >
              {puzzle.items.map((parcel, index) => {
                const packed = placements.some(
                  (placement) => placement.id === parcel.id
                );
                return (
                  <button
                    key={parcel.id}
                    ref={index === 0 ? firstControl : undefined}
                    data-item={parcel.id}
                    aria-label={`${index + 1}. ${parcel.name}. ${packed ? 'Packed, select to move' : 'Not packed'}`}
                    aria-pressed={selected === parcel.id}
                    className={packed ? 'packed' : ''}
                    onClick={() => pick(parcel.id)}
                  >
                    <span
                      className="parcel-number"
                      style={{ backgroundColor: parcel.color }}
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <span>{shortNames[index]}</span>
                    <span className="packed-mark" aria-hidden="true">
                      {packed ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="placement-heading">
              <strong>{item?.name ?? 'All parcels packed'}</strong>
              <span>
                {dims ? `${dims.join(' × ')} · W × D × H` : 'Ready to seal'}
              </span>
            </div>
            <div className="grid-workspace">
              <div
                className="position-pad"
                style={{ gridTemplateColumns: `repeat(${box.dims[0]}, 44px)` }}
                role="group"
                aria-label="Placement grid, top view"
                aria-describedby="grid-help preview-feedback"
              >
                {Array.from(
                  { length: box.dims[0] * box.dims[1] },
                  (_, index) => {
                    const x = index % box.dims[0],
                      y = Math.floor(index / box.dims[0]);
                    const stack = placements
                      .filter(
                        (placement) =>
                          x >= placement.at[0] &&
                          x < placement.at[0] + placement.dims[0] &&
                          y >= placement.at[1] &&
                          y < placement.at[1] + placement.dims[1]
                      )
                      .sort((a, b) => a.at[2] - b.at[2]);
                    const top = stack[stack.length - 1];
                    const parcelIndex = puzzle.items.findIndex(
                      (parcel) => parcel.id === top?.id
                    );
                    const contents = stack.length
                      ? stack
                          .map(
                            (placement) =>
                              `${puzzle.items.find((parcel) => parcel.id === placement.id)!.name}, height ${placement.at[2]} to ${placement.at[2] + placement.dims[2]}`
                          )
                          .join('; ')
                      : 'Empty, floor height 0';
                    const inPreview =
                      preview &&
                      x >= preview.at[0] &&
                      x < preview.at[0] + preview.dims[0] &&
                      y >= preview.at[1] &&
                      y < preview.at[1] + preview.dims[1];
                    return (
                      <button
                        key={index}
                        data-cell={`${x},${y}`}
                        disabled={!item}
                        className={
                          inPreview
                            ? error
                              ? 'preview-invalid'
                              : 'preview-valid'
                            : ''
                        }
                        aria-label={`Column ${x + 1}, row ${y + 1}. ${contents}.`}
                        aria-pressed={!!item && cell[0] === x && cell[1] === y}
                        onClick={() => position(x, y)}
                      >
                        {top ? parcelIndex + 1 : '·'}
                      </button>
                    );
                  }
                )}
              </div>
              <div className="grid-actions">
                <span className="grid-label">GRID</span>
                <button
                  data-rotate
                  disabled={!item || rotations.length < 2}
                  aria-describedby="preview-feedback"
                  onClick={rotate}
                >
                  Rotate
                </button>
                <button
                  data-remove
                  disabled={
                    !placements.some((placement) => placement.id === selected)
                  }
                  onClick={remove}
                >
                  Remove
                </button>
                <button
                  data-undo
                  disabled={!undo.length}
                  onClick={() => {
                    const previous = undo[undo.length - 1];
                    if (!previous) return;
                    setPlacements(previous);
                    setUndo((history) => history.slice(0, -1));
                    selectParcel(
                      puzzle.items.find(
                        (parcel) =>
                          !previous.some(
                            (placement) => placement.id === parcel.id
                          )
                      )?.id ??
                        puzzle.items[0]?.id ??
                        null,
                      previous
                    );
                    setMessage('Undone. No time penalty.');
                  }}
                >
                  Undo
                </button>
              </div>
            </div>
            <p id="grid-help" className="subtle">
              Tap a corner to preview, then Place.
            </p>
            <p
              id="preview-feedback"
              className={error ? 'feedback invalid' : 'feedback'}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {feedback}
            </p>
            <div className="primary-actions">
              {readyToSeal && !movingPacked ? (
                <button data-seal className="primary" onClick={seal}>
                  Seal box
                </button>
              ) : (
                <button
                  data-place
                  className="primary"
                  disabled={!preview || !!error}
                  aria-describedby="preview-feedback"
                  onClick={place}
                >
                  Place parcel
                </button>
              )}
              <button data-hint disabled={hintCount >= 2} onClick={revealHint}>
                {hintCount >= 2 ? 'Hints used' : 'Hint (+20s)'}
              </button>
            </div>
            {message && (
              <p className="action-message" role="status">
                {message}
              </p>
            )}
            {hintCount > 0 && (
              <div id="packing-hint" className="hint" role="status">
                <strong>
                  {hintCount === 1
                    ? 'A starting orientation'
                    : 'A starting position'}{' '}
                  · +{hintCount * HINT_PENALTY_SECONDS}s
                </strong>
                <p>
                  For an empty box, start with {hintItem.name}:{' '}
                  {hintTarget.dims.join(' × ')} (W × D × H).
                  {hintCount > 1 &&
                    ` Column ${hintTarget.at[0] + 1}, row ${hintTarget.at[1] + 1}, on the floor.`}{' '}
                  Your arrangement may need changing.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
      <details className="more">
        <summary>More · help & arrangement</summary>
        <h2>How to pack</h2>
        <p>
          Select a parcel, tap its top-left corner on the grid, rotate if
          needed, then Place. Width, depth and height are shown as W × D × H.
          Grid numbers identify the top packed parcel. Height is automatic.
          Parcels need full support and must stay inside the box.
        </p>
        <p>
          Select packed parcels to move them. Remove upper parcels before their
          supports. Undo has no penalty. Two optional hints each add{' '}
          {HINT_PENALTY_SECONDS} seconds to scored time.
        </p>
        <p>
          The clock starts with your first packing action and stops when you
          seal. It continues in other tabs. Keep improving resumes the same
          clock and hints. Reset only unpacks the arrangement. Reloading clears
          unfinished play.
        </p>
        <p>
          {savedCompletion
            ? `Completed ${canSave ? saveLabel : 'in this guest session'}.`
            : canSave
              ? `Completion can be saved ${saveLabel}.`
              : 'Guest completion lasts for this session only.'}
        </p>
        <h2>Arrangement in text</h2>
        <p>Box: {box.dims.join(' × ')} units (W × D × H).</p>
        {placements.length ? (
          <ul>
            {placements.map((placement) => (
              <li key={placement.id}>
                {
                  puzzle.items.find((parcel) => parcel.id === placement.id)!
                    .name
                }
                : column {placement.at[0] + 1}, row {placement.at[1] + 1}, base{' '}
                {placement.at[2]}, top {placement.at[2] + placement.dims[2]};{' '}
                {placement.dims.join(' × ')} units.
              </li>
            ))}
          </ul>
        ) : (
          <p>The box is empty.</p>
        )}
        {!result && (
          <>
            <button
              data-clear
              disabled={!placements.length}
              onClick={() => setConfirmReset(true)}
            >
              Reset arrangement…
            </button>
            {confirmReset && (
              <div
                className="reset-confirm"
                role="group"
                aria-label="Confirm reset arrangement"
              >
                <p>
                  Unpack every parcel? Your clock and hints stay. Undo can
                  restore the arrangement.
                </p>
                <button
                  onClick={() => {
                    commit([]);
                    selectParcel(puzzle.items[0]?.id ?? null, []);
                    setConfirmReset(false);
                    setMessage('Arrangement reset. Clock and hints kept.');
                  }}
                >
                  Reset arrangement
                </button>
                <button onClick={() => setConfirmReset(false)}>Cancel</button>
              </div>
            )}
          </>
        )}
        <p className="subtle">
          {day} UTC · Fictional parcel sizes · Rules dd-1
        </p>
      </details>
    </main>
  );
}
