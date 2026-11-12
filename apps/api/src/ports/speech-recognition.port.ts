import type { Transcript } from '@gototalk/shared';

/** DI-токен SpeechRecognitionPort (інтерфейс не існує в рантаймі). */
export const SPEECH_RECOGNITION_PORT = Symbol('SPEECH_RECOGNITION_PORT');

export interface SpeechRecognitionPort {
  /**
   * Розпізнає аудіо репліки.
   * @param audio вміст аудіофайлу
   * @param mime MIME-тип запису (наприклад, `audio/webm`)
   * @param index необов'язковий індекс заготовленої відповіді для Fake-адаптера
   *   (кількість user-реплік у сесії); реальні адаптери його ігнорують
   */
  transcribe(audio: Buffer, mime: string, index?: number): Promise<Transcript>;
}
