import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'editing' | 'returned';

export function useInlineEdit() {
  const [phase, setPhase] = useState<Phase>('idle');
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (phase === 'returned') {
      triggerRef.current?.focus();
    }
  }, [phase]);

  return {
    editing: phase === 'editing',
    triggerRef,
    start: () => setPhase('editing'),
    finish: () => setPhase('returned'),
  };
}
