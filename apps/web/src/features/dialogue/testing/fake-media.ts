import { vi } from 'vitest';

export class FakeTrack {
  stopped = false;
  stop() {
    this.stopped = true;
  }
}

export class FakeStream {
  readonly tracks = [new FakeTrack(), new FakeTrack()];
  getTracks() {
    return this.tracks;
  }
}

export class FakeMediaRecorder extends EventTarget {
  static supported = new Set(['audio/webm;codecs=opus']);
  static instances: FakeMediaRecorder[] = [];
  static failOnConstruct = false;
  static isTypeSupported(mime: string) {
    return FakeMediaRecorder.supported.has(mime);
  }

  state: 'inactive' | 'recording' = 'inactive';
  readonly mimeType: string;
  emitData = true;

  constructor(
    readonly stream: FakeStream,
    options: { mimeType: string },
  ) {
    super();
    if (FakeMediaRecorder.failOnConstruct) {
      throw new DOMException('Unsupported', 'NotSupportedError');
    }
    this.mimeType = options.mimeType;
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (this.emitData) {
      const data = new Blob(['voice'], { type: this.mimeType });
      this.dispatchEvent(Object.assign(new Event('dataavailable'), { data }));
    }
    this.dispatchEvent(new Event('stop'));
  }

  fail() {
    this.state = 'inactive';
    this.dispatchEvent(new Event('error'));
  }
}

export class FakeAnalyser {
  static amplitude = 0;
  fftSize = 0;
  getByteTimeDomainData(samples: Uint8Array) {
    samples.fill(128);
    samples.fill(128 + Math.round(FakeAnalyser.amplitude * 127), 0, 2);
  }
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  closed = false;
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  createAnalyser() {
    return new FakeAnalyser();
  }
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

export function installFakeMedia() {
  const getUserMedia = vi.fn<(c: MediaStreamConstraints) => Promise<unknown>>();
  const streams: FakeStream[] = [];
  getUserMedia.mockImplementation(() => {
    const stream = new FakeStream();
    streams.push(stream);
    return Promise.resolve(stream);
  });
  FakeMediaRecorder.supported = new Set(['audio/webm;codecs=opus']);
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.failOnConstruct = false;
  FakeAudioContext.instances = [];
  FakeAnalyser.amplitude = 0;
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  return { getUserMedia, streams };
}

export function removeMediaDevices() {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
}
