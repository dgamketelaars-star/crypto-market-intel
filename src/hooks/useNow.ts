import { useEffect, useState } from 'react';

/** Re-renders the caller every `intervalMs`, used to keep staleness/time displays honest. */
export function useNow(intervalMs = 5_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
