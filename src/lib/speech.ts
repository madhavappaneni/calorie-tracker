import { useCallback, useEffect, useRef, useState } from 'react';

/* The Web Speech API is not in TypeScript's DOM lib, so the surface we use is
   declared here. It is built into the browser — no key, no account, no cost. */

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechAlternative;
}
interface SpeechResultList {
  readonly length: number;
  [index: number]: SpeechResult;
}
interface SpeechResultEvent extends Event {
  resultIndex: number;
  results: SpeechResultList;
}
interface SpeechErrorEvent extends Event {
  error: string;
}
interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognizerCtor = new () => SpeechRecognizer;

function recognizerCtor(): SpeechRecognizerCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognizerCtor;
    webkitSpeechRecognition?: SpeechRecognizerCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = (): boolean => recognizerCtor() !== null;

export type SpeechStatus = 'idle' | 'listening' | 'denied' | 'error';

export interface SpeechInput {
  supported: boolean;
  status: SpeechStatus;
  /** What has been heard so far, including the not-yet-final tail. */
  transcript: string;
  message: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Dictation via the browser's own recogniser. Chrome and Safari implement this;
 * Firefox does not, so callers must respect `supported`.
 */
export function useSpeechInput(onFinal: (transcript: string) => void): SpeechInput {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const recognizer = useRef<SpeechRecognizer | null>(null);
  const finalText = useRef('');
  const handler = useRef(onFinal);
  handler.current = onFinal;

  // Tear down on unmount so the mic never outlives the form.
  useEffect(
    () => () => {
      recognizer.current?.abort();
      recognizer.current = null;
    },
    [],
  );

  const stop = useCallback(() => recognizer.current?.stop(), []);

  const reset = useCallback(() => {
    finalText.current = '';
    setTranscript('');
    setMessage(null);
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    const Ctor = recognizerCtor();
    if (!Ctor) return;
    recognizer.current?.abort();

    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    finalText.current = '';
    setTranscript('');
    setMessage(null);

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalText.current += text;
        else interim += text;
      }
      setTranscript((finalText.current + interim).trim());
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setStatus('denied');
        setMessage('Microphone permission was denied.');
        return;
      }
      setStatus('error');
      setMessage(
        e.error === 'no-speech'
          ? "Didn't catch that — try again."
          : e.error === 'network'
            ? 'Speech recognition needs a network connection.'
            : 'Could not use the microphone.',
      );
    };

    rec.onend = () => {
      setStatus((s) => (s === 'listening' ? 'idle' : s));
      const heard = finalText.current.trim();
      if (heard) handler.current(heard);
    };

    recognizer.current = rec;
    try {
      rec.start();
      setStatus('listening');
    } catch {
      setStatus('error');
      setMessage('Could not start the microphone.');
    }
  }, []);

  return { supported: recognizerCtor() !== null, status, transcript, message, start, stop, reset };
}
