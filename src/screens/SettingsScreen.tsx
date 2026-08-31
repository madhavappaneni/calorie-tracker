import { useEffect, useState } from 'react';
import { Field, NumberInput } from '../components/ui';
import * as api from '../lib/api';
import { supabase } from '../lib/supabase';
import { validateTargets, TARGET_LIMITS } from '../lib/targets';
import { todayISO } from '../lib/dates';
import { useStore } from '../state/store';

export function SettingsScreen() {
  const { user, settings, setSettings, notify, reportError } = useStore();
  const [calories, setCalories] = useState('');
  const [pMin, setPMin] = useState('');
  const [pMax, setPMax] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Errors appear only once a save has been attempted, then track edits live —
  // nagging about an empty field mid-typing helps nobody.
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setCalories(String(settings.calorie_target));
    setPMin(String(settings.protein_min_g));
    setPMax(String(settings.protein_max_g));
  }, [settings]);

  const validation = validateTargets(calories, pMin, pMax);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!user || !validation.ok) return;
    setSaving(true);
    try {
      const next = await api.saveSettings(user.id, validation.values);
      setSettings(next);
      notify('Targets saved');
    } catch (err) {
      reportError(err);
    } finally {
      setSaving(false);
    }
  };

  /** Manual backup, independent of the scheduled one in the private repo (spec §6, §8). */
  const exportJson = async () => {
    setExporting(true);
    try {
      const data = await api.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `macros-export-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify(`Exported ${data.foods.length} foods and ${data.log_entries.length} entries`);
    } catch (e) {
      reportError(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="settings">
      <header className="screen-head">
        <h1>Settings</h1>
      </header>

      <form className="card" onSubmit={save}>
        <p className="form-section">Daily targets</p>
        <Field label="Calories" hint={`${TARGET_LIMITS.calorieMin.toLocaleString()}–${TARGET_LIMITS.calorieMax.toLocaleString()} kcal, whole numbers`}>
          <NumberInput value={calories} onChange={setCalories} />
        </Field>
        <div className="grid-2">
          <Field label="Protein min (g)">
            <NumberInput value={pMin} onChange={setPMin} />
          </Field>
          <Field label="Protein max (g)">
            <NumberInput value={pMax} onChange={setPMax} />
          </Field>
        </div>
        {attempted && !validation.ok ? <p className="error">{validation.message}</p> : null}
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={saving || !settings}>
            {saving ? 'Saving…' : 'Save targets'}
          </button>
        </div>
      </form>

      <section className="card">
        <p className="form-section">Data</p>
        <p className="muted small">
          Downloads foods, log entries and settings as one JSON file. The scheduled backup
          in the private repo runs twice a week regardless.
        </p>
        <div className="form-actions">
          <button type="button" className="btn" onClick={exportJson} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export JSON'}
          </button>
        </div>
      </section>

      <section className="card">
        <p className="form-section">Account</p>
        <p className="muted small">Signed in as {user?.email ?? 'unknown'}</p>
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                await supabase.auth.signOut();
              } catch (e) {
                reportError(e);
              }
            }}
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
