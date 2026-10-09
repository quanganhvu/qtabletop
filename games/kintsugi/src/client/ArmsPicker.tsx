import { useEffect } from 'react';
import { CHARGES, DIVISIONS, PRESET_ARMS, TINCTURES, randomArms, type Arms, type Tincture } from '../shared/heraldry';
import { FRAME_NAMES, KAMON_COLORS, KAMON_COLOR_NAMES, MOTIF_NAMES } from './art/kamon';
import { Crest, cx } from './pieces';

const same = (a: Arms, b: Arms) => JSON.stringify(a) === JSON.stringify(b);

/** Choose a ready-made family crest (kamon) or design your own; changes apply live. */
export function ArmsPicker({ value, onChange, onClose }: { value: Arms; onChange: (arms: Arms) => void; onClose: () => void }) {
  const set = (patch: Partial<Arms>) => onChange({ ...value, ...patch });
  const banded = value.division !== 'plain';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const swatches = (selected: Tincture, pickTincture: (t: Tincture) => void, disabled = false) => (
    <div className={cx('swatches', disabled && 'disabled')}>
      {TINCTURES.map((t) => (
        <button
          key={t}
          type="button"
          className={cx('swatch', selected === t && 'selected')}
          style={{ background: KAMON_COLORS[t] }}
          title={KAMON_COLOR_NAMES[t]}
          aria-label={KAMON_COLOR_NAMES[t]}
          disabled={disabled}
          onClick={() => pickTincture(t)}
        />
      ))}
    </div>
  );

  return (
    <div className="overlay arms-overlay" onClick={onClose}>
      <div className="panel arms-picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your family crest">
        <div className="arms-head">
          <h2>Your family crest</h2>
          <button className="btn ghost tiny" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="arms-body">
          <div className="arms-preview">
            <Crest arms={value} size={150} />
            <button className="btn small" onClick={() => onChange(randomArms())}>⟳ Randomize</button>
          </div>

          <div className="arms-options">
            <h3>Ready-made</h3>
            <div className="arms-grid presets">
              {PRESET_ARMS.map((a, i) => (
                <button key={i} type="button" className={cx('arms-option', same(a, value) && 'selected')} onClick={() => onChange(a)} aria-label={`Preset ${i + 1}`}>
                  <Crest arms={a} size={40} />
                </button>
              ))}
            </div>

            <h3>Design your own</h3>
            <div className="arms-label">Shape</div>
            <div className="arms-grid">
              {DIVISIONS.map((d) => (
                <button key={d} type="button" className={cx('arms-option', value.division === d && 'selected')} title={FRAME_NAMES[d]} onClick={() => set({ division: d })}>
                  <Crest arms={{ ...value, division: d, charge: 'none' }} size={30} />
                </button>
              ))}
            </div>

            <div className="arms-colors">
              <div>
                <div className="arms-label">Main color</div>
                {swatches(value.field, (t) => set({ field: t }))}
              </div>
              <div>
                <div className="arms-label">{banded ? 'Edge color' : 'Edge color (not for a plain circle)'}</div>
                {swatches(value.second, (t) => set({ second: t }), !banded)}
              </div>
            </div>

            <div className="arms-label">Motif</div>
            <div className="arms-grid">
              {CHARGES.map((c) => (
                <button key={c} type="button" className={cx('arms-option', value.charge === c && 'selected')} title={MOTIF_NAMES[c]} onClick={() => set({ charge: c })}>
                  <Crest arms={{ ...value, charge: c }} size={30} />
                </button>
              ))}
            </div>

            <div className="arms-label">Motif color</div>
            {swatches(value.chargeColor, (t) => set({ chargeColor: t }))}
          </div>
        </div>

        <div className="arms-foot">
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
