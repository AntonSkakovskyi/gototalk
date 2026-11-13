import { useEffect, useRef } from 'react';

export function useFocusWhen<T extends HTMLElement>(
  enabled: boolean,
  trigger?: string,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (enabled) {
      ref.current?.focus();
    }
  }, [enabled, trigger]);

  return ref;
}
