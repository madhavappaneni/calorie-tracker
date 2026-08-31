import { useState } from 'react';
import { useSpeechInput } from '../lib/speech';
import { parseSpokenFood } from '../lib/voice';
import type { FoodDraft } from '../lib/types';

/**
 * Dictate a food instead of typing it (spec §11 was silent on this; it is the
 * fastest path for home-cooked food, where there is no barcode to scan).
 * Everything runs in the browser — no API key, no account, no per-entry cost.
 * Parsed values land in the form as editable defaults, never a silent save.
 */
export function VoiceEntry({ onParsed }: { onParsed: (draft: Partial<FoodDraft>) => void }) {
  const [summary, setSummary] = useState<string | null>(null);

  const speech = useSpeechInput((heard) => {
    const { draft, found } = parseSpokenFood(heard);
    onParsed(draft);
    setSummary(
      found.length > 0
        ? `Filled ${found.join(', ')} — check them before saving.`
        : "Couldn't find any numbers in that — fill the rest in yourself.",
    );
  });

  if (!speech.supported) return null;

  const listening = speech.status === 'listening';

  return (
    <div className="voice">
      <div className="voice-head">
        <button
          type="button"
          className={listening ? 'btn voice-btn on' : 'btn voice-btn'}
          onClick={() => {
            setSummary(null);
            listening ? speech.stop() : speech.start();
          }}
          aria-pressed={listening}
        >
          <MicIcon />
          {listening ? 'Listening — tap to stop' : 'Speak it'}
        </button>
        {!listening && !summary ? (
          <span className="muted small">“chicken breast 220 calories 40 protein 5 carbs 8 fat”</span>
        ) : null}
      </div>

      {speech.transcript ? <p className="voice-transcript">“{speech.transcript}”</p> : null}
      {speech.message ? <p className="error small">{speech.message}</p> : null}
      {summary && !listening ? <p className="muted small">{summary}</p> : null}
    </div>
  );
}

const MicIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
  </svg>
);
