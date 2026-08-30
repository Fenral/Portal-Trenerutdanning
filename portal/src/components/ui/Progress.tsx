export type ProgressProps = Readonly<{
  value: number;
  label: string;
}>;

export function Progress({ value, label }: ProgressProps) {
  const finiteValue = Number.isFinite(value) ? value : 0;
  const safeValue = Math.min(100, Math.max(0, Math.round(finiteValue)));

  return (
    <div className="nivaa-progress">
      <div className="nivaa-progress__label">
        <span>{label}</span>
        <strong>{safeValue} %</strong>
      </div>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        aria-valuetext={`${safeValue} prosent`}
        className="nivaa-progress__track"
        role="progressbar"
      >
        <span style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}
