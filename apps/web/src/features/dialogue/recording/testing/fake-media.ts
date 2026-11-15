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
  static failOnStart = false;
  static deferEvents = false;
  static isTypeSupported(mime: string) {
    return FakeMediaRecorder.supported.has(mime);
  }

  state: 'inactive' | 'recording' = 'inactive';
  readonly mimeType: string;
  emitData = true;
  stopCalls = 0;
  private pending: Array<() => void> = [];

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
    if (FakeMediaRecorder.failOnStart) {
      throw new DOMException('Cannot start', 'InvalidStateError');
    }
    this.state = 'recording';
  }

  stop() {
    this.stopCalls += 1;
    this.state = 'inactive';
    this.emit(() => {
      if (this.emitData) {
        const data = new Blob(['voice'], { type: this.mimeType });
        this.dispatchEvent(Object.assign(new Event('dataavailable'), { data }));
      }
      this.dispatchEvent(new Event('stop'));
    });
  }

  fail() {
    this.state = 'inactive';
    this.emit(() => this.dispatchEvent(new Event('error')));
  }

  flush() {
    this.pending.splice(0).forEach((dispatch) => dispatch());
  }

  private emit(dispatch: () => void) {
    if (FakeMediaRecorder.deferEvents) this.pending.push(dispatch);
    else dispatch();
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
  static failOnSetup = false;
  static initialState: 'running' | 'suspended' = 'running';
  state = FakeAudioContext.initialState;
  closed = false;
  resumed = false;
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createMediaStreamSource() {
    if (FakeAudioContext.failOnSetup) {
      throw new DOMException('Bad stream', 'InvalidStateError');
    }
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  createAnalyser() {
    return new FakeAnalyser();
  }
  resume() {
    this.resumed = true;
    this.state = 'running';
    return Promise.resolve();
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
  FakeMediaRecorder.failOnStart = false;
  FakeMediaRecorder.deferEvents = false;
  FakeAudioContext.instances = [];
  FakeAudioContext.failOnSetup = false;
  FakeAudioContext.initialState = 'running';
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
