import { describe, expect, it } from 'vitest';
import { cleanTranscript } from './clean-transcript.js';

describe('cleanTranscript', () => {
  it('[TC-04-01] removes a filler together with the comma before and after it', () => {
    expect(cleanTranscript('I go, um, to the office')).toBe(
      'I go to the office',
    );
    expect(cleanTranscript('I go and, uh, run')).toBe('I go and run');
  });

  it('[TC-04-01] removes a leading filler and capitalises the first letter', () => {
    expect(cleanTranscript('Um, yesterday I went home.')).toBe(
      'Yesterday I went home.',
    );
  });

  it('[TC-04-01] matches fillers case-insensitively and as whole words only', () => {
    expect(cleanTranscript('UH, fine. ER, ok')).toBe('Fine. ok');
    expect(cleanTranscript('Her summer is humid.')).toBe(
      'Her summer is humid.',
    );
  });

  it('[TC-04-01] removes "well," only when it is followed by a comma', () => {
    expect(cleanTranscript('Well, I agree.')).toBe('I agree.');
    expect(cleanTranscript('I do well in tests.')).toBe('I do well in tests.');
  });

  it('[TC-04-01] collapses whitespace to single spaces and trims', () => {
    expect(cleanTranscript('  I   go \n home  ')).toBe('I go home');
  });

  it('[TC-04-01] leaves a text without fillers unchanged except for the first letter', () => {
    expect(cleanTranscript('hello there.')).toBe('Hello there.');
    expect(cleanTranscript('')).toBe('');
  });

  it('[TC-00-05] is deterministic', () => {
    const text = 'Um, a, uh, b';
    expect(cleanTranscript(text)).toBe(cleanTranscript(text));
  });
});
