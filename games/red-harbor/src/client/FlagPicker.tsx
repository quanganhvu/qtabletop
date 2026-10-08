import { FLAG_COLORS, FLAG_COLOR_NAMES, FLAG_HEX, FLAG_PATTERNS, FLAG_PATTERN_NAMES, PRESET_FLAGS, randomFlag, type Flag } from '../shared/flags';
import { FlagIcon, cx } from './pieces';

/** A dialog for designing your colony corporation's flag. */
export function FlagPicker({ value, onChange, onClose }: { value: Flag; onChange: (f: Flag) => void; onClose: () => void }) {
  const set = (patch: Partial<Flag>) => onChange({ ...value, ...patch });
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel picker" onClick={(e) => e.stopPropagation()}>
        <h2>Your corporation flag</h2>
        <div className="picker-preview"><FlagIcon flag={value} size={120} /></div>

        <h3>Ready-made</h3>
        <div className="picker-row">
          {PRESET_FLAGS.map((f, i) => (
            <button key={i} type="button" className={cx('picker-opt', JSON.stringify(f) === JSON.stringify(value) && 'on')} onClick={() => onChange(f)}>
              <FlagIcon flag={f} size={36} />
            </button>
          ))}
        </div>

        <h3>Pattern</h3>
        <div className="picker-row">
          {FLAG_PATTERNS.map((pattern) => (
            <button key={pattern} type="button" title={FLAG_PATTERN_NAMES[pattern]} className={cx('picker-opt', value.pattern === pattern && 'on')} onClick={() => set({ pattern })}>
              <FlagIcon flag={{ ...value, pattern }} size={36} />
            </button>
          ))}
        </div>

        <h3>Field</h3>
        <div className="picker-row">
          {FLAG_COLORS.map((field) => (
            <button key={field} type="button" title={FLAG_COLOR_NAMES[field]} className={cx('swatch', value.field === field && 'on')} style={{ background: FLAG_HEX[field] }}
              onClick={() => set({ field, mark: value.mark === field ? value.field : value.mark })} />
          ))}
        </div>

        <h3>Mark</h3>
        <div className="picker-row">
          {FLAG_COLORS.filter((c) => c !== value.field).map((mark) => (
            <button key={mark} type="button" title={FLAG_COLOR_NAMES[mark]} className={cx('swatch', value.mark === mark && 'on')} style={{ background: FLAG_HEX[mark] }} onClick={() => set({ mark })} />
          ))}
        </div>

        <div className="picker-actions">
          <button type="button" className="btn ghost" onClick={() => onChange(randomFlag())}>Surprise me</button>
          <button type="button" className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
