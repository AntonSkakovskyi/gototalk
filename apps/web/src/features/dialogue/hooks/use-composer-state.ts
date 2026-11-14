import { useState } from 'react';

export type TextFormMode = 'closed' | 'requested' | 'automatic';

/** State that must outlive the answer composer, which remounts on every turn. */
export function useComposerState() {
  const [textForm, setTextForm] = useState<TextFormMode>('closed');
  const [recording, setRecording] = useState(false);
  return { textForm, setTextForm, recording, setRecording };
}

export type ComposerState = ReturnType<typeof useComposerState>;
