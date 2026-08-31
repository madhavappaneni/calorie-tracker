import { grams, kcal } from '../lib/format';
import type { Totals } from '../lib/types';

/** The day at a glance: calories remaining against the target, protein against the
 *  band. On laptops this becomes the sticky right rail (spec §3.1). */
export function DaySummary({
  totals,
  calorieTarget,
  proteinMin,
  proteinMax,
  entryCount,
}: {
  totals: Totals;
  calorieTarget: number;
  proteinMin: number;
  proteinMax: number;
  entryCount: number;
}) {
  const remaining = calorieTarget - totals.calories;
  const over = remaining < 0;
  const calPct = Math.min(100, (totals.calories / Math.max(1, calorieTarget)) * 100);

  // Protein scale leaves headroom past the band so overshoot stays visible.
  const scale = Math.max(proteinMax * 1.25, totals.protein_g * 1.05, 1);
  const proteinPct = Math.min(100, (totals.protein_g / scale) * 100);
  const bandLeft = (proteinMin / scale) * 100;
  const bandWidth = ((proteinMax - proteinMin) / scale) * 100;
  const inBand = totals.protein_g >= proteinMin && totals.protein_g <= proteinMax;
  const proteinState = inBand ? 'good' : totals.protein_g > proteinMax ? 'over' : 'under';

  return (
    <section className="summary card" aria-label="Day summary">
      <div className="summary-head">
        <div>
          <p className="metric-value">
            {kcal(Math.abs(remaining))}
            <span className="metric-unit">{over ? 'kcal over' : 'kcal left'}</span>
          </p>
          <p className="muted small">
            {kcal(totals.calories)} of {kcal(calorieTarget)} · {entryCount}{' '}
            {entryCount === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      </div>

      <div className={`bar ${over ? 'over' : ''}`}>
        <div className="bar-fill" style={{ width: `${calPct}%` }} />
      </div>

      <div className="protein">
        <div className="protein-head">
          <span className="field-label">Protein</span>
          <span className={`protein-value ${proteinState}`}>
            {grams(totals.protein_g)} g
            <span className="muted small">
              {' '}
              / {proteinMin}–{proteinMax}
            </span>
          </span>
        </div>
        <div className="bar protein-bar">
          <div className="band" style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }} />
          <div className={`bar-fill ${proteinState}`} style={{ width: `${proteinPct}%` }} />
        </div>
        <p className="muted small">
          {inBand
            ? 'In band.'
            : totals.protein_g > proteinMax
              ? `${grams(totals.protein_g - proteinMax)} g over the band.`
              : `${grams(proteinMin - totals.protein_g)} g to go.`}
        </p>
      </div>

      <dl className="macro-grid">
        <div>
          <dt>Carbs</dt>
          <dd>{grams(totals.carbs_g)} g</dd>
        </div>
        <div>
          <dt>Fat</dt>
          <dd>{grams(totals.fat_g)} g</dd>
        </div>
      </dl>
    </section>
  );
}
