import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const REGION_ID = 'barcode-region';

/** Packaged-food symbologies only — QR/PDF417 would just slow the decode loop. */
const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
  Html5QrcodeSupportedFormats.CODE_128,
];

/** Camera scanning (spec §7.1). Rear camera on a phone, webcam on a laptop; no
 *  camera or a denied permission drops straight through to manual entry. */
export function BarcodeScanner({
  onDetected,
  onManual,
}: {
  onDetected: (barcode: string) => void;
  onManual: () => void;
}) {
  const [status, setStatus] = useState<'starting' | 'scanning' | 'blocked'>('starting');
  const [message, setMessage] = useState('');
  const detected = useRef(onDetected);
  detected.current = onDetected;

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let done = false;

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser cannot open a camera here.');
        }
        scanner = new Html5Qrcode(REGION_ID, {
          formatsToSupport: FORMATS,
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (w, h) => ({
              width: Math.floor(Math.min(w * 0.9, 340)),
              height: Math.floor(Math.min(h * 0.55, 190)),
            }),
          },
          (text) => {
            if (done) return;
            done = true;
            detected.current(text.trim());
          },
          () => {
            /* per-frame "not found" noise — ignored by design */
          },
        );
        if (!done) setStatus('scanning');
      } catch (e) {
        const err = e as { name?: string; message?: string };
        setMessage(
          err?.name === 'NotAllowedError'
            ? 'Camera permission was denied.'
            : err?.name === 'NotFoundError'
              ? 'No camera found on this device.'
              : err?.message || 'Could not start the camera.',
        );
        setStatus('blocked');
      }
    };
    void start();

    return () => {
      done = true;
      const s = scanner;
      if (!s) return;
      // stop() rejects if it never started; either way clear the DOM it injected.
      (s.isScanning ? s.stop() : Promise.resolve())
        .catch(() => undefined)
        .then(() => {
          try {
            s.clear();
          } catch {
            /* element already gone */
          }
        });
    };
  }, []);

  return (
    <div className="scanner">
      <div id={REGION_ID} className={`scanner-region ${status === 'blocked' ? 'hidden' : ''}`} />
      {status === 'starting' ? <p className="muted center">Opening camera…</p> : null}
      {status === 'scanning' ? (
        <p className="muted center">Point the rear camera at the barcode.</p>
      ) : null}
      {status === 'blocked' ? (
        <div className="scanner-blocked">
          <p>{message}</p>
          <button type="button" className="btn primary" onClick={onManual}>
            Enter it manually
          </button>
        </div>
      ) : null}
    </div>
  );
}
