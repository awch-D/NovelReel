import { useEffect, useRef } from "react";

export function usePolling(fn: () => void, interval: number, enabled: boolean) {
  const savedFn = useRef(fn);
  savedFn.current = fn;

  useEffect(() => {
    if (!enabled) return;
    savedFn.current();
    const id = setInterval(() => savedFn.current(), interval);
    return () => clearInterval(id);
  }, [interval, enabled]);
}
