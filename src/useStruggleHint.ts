import { useEffect, useRef, useState } from 'react';

type Options = { running: boolean; enabled: boolean };

export function useStruggleHint({ running, enabled }: Options) {
  const offeredRef = useRef(false);
  const invalidAttempts = useRef(0);
  const activeMilliseconds = useRef(0);
  const [offered, setOffered] = useState(false);
  const [open, setOpen] = useState(false);

  function offer() {
    if (offeredRef.current || !enabled || document.hidden) return;
    // Record this before scheduling a render so simultaneous triggers cannot reopen it.
    offeredRef.current = true;
    setOffered(true);
    setOpen(true);
  }

  useEffect(() => {
    if (!running || !enabled || offered) return;
    let last = performance.now();
    let visible = !document.hidden;
    const tick = () => {
      const now = performance.now();
      if (visible) activeMilliseconds.current += Math.max(0, now - last);
      last = now;
      if (
        activeMilliseconds.current >= 60_000 &&
        !document.hidden &&
        !offeredRef.current
      ) {
        offeredRef.current = true;
        setOffered(true);
        setOpen(true);
      }
    };
    const visibilityChanged = () => {
      tick();
      visible = !document.hidden;
    };
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [running, enabled, offered]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);

  return {
    offered,
    open: open && enabled,
    dismiss() {
      setOpen(false);
    },
    attempt(invalid: boolean) {
      if (!enabled || !invalid || document.hidden) return;
      invalidAttempts.current += 1;
      if (invalidAttempts.current >= 3) offer();
    },
    progress() {
      invalidAttempts.current = 0;
      activeMilliseconds.current = 0;
      setOpen(false);
    },
  };
}
