import { audioFileName, baseMimeType, pickRecorderMime } from './recorder-mime';

describe('pickRecorderMime', () => {
  it('[TC-04-05] prefers webm opus when supported', () => {
    expect(pickRecorderMime(() => true)).toBe('audio/webm;codecs=opus');
  });

  it('[TC-04-05] falls back to ogg opus', () => {
    expect(pickRecorderMime((mime) => mime.startsWith('audio/ogg'))).toBe(
      'audio/ogg;codecs=opus',
    );
  });

  it('[TC-04-05] falls back to mp4 on Safari-like browsers', () => {
    expect(pickRecorderMime((mime) => mime === 'audio/mp4')).toBe('audio/mp4');
  });

  it('[TC-04-05] returns null when nothing is supported', () => {
    expect(pickRecorderMime(() => false)).toBeNull();
  });
});

describe('baseMimeType', () => {
  it.each([
    ['audio/webm;codecs=opus', 'audio/webm'],
    ['Audio/MP4', 'audio/mp4'],
    ['audio/ogg; codecs=opus', 'audio/ogg'],
    ['', ''],
  ])('[TC-04-05] strips parameters from %s', (mime, expected) => {
    expect(baseMimeType(mime)).toBe(expected);
  });
});

describe('audioFileName', () => {
  it.each([
    ['audio/webm;codecs=opus', 'answer.webm'],
    ['audio/ogg;codecs=opus', 'answer.ogg'],
    ['audio/mp4', 'answer.m4a'],
    ['video/x-unknown', 'answer.webm'],
  ])('[TC-04-05] names a %s recording', (mime, name) => {
    expect(audioFileName(mime)).toBe(name);
  });
});
