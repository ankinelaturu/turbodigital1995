import { OUTPUT_NAME, type SourceSpan } from '../lib/types';

export interface PresetExpression {
  label: string;
  expr: string;
}

export const PRESETS: PresetExpression[] = [
  { label: 'A+B+C', expr: 'A+B+C' },
  { label: 'A·B + C', expr: 'A·B+C' },
  { label: 'A·B + C\'', expr: "A·B+C'" },
  { label: '(A·B)+(C\'·D)', expr: "(A·B)+(C'·D)" },
  { label: '2:1 Mux', expr: "S'·A+S·B" },
  { label: 'XOR', expr: "A·B'+A'·B" },
  { label: 'A+B·C', expr: 'A+B·C' },
  { label: 'Half adder sum', expr: "A·B'+A'·B" },
  { label: 'Half adder carry', expr: 'A·B' },
];

interface ExpressionInputProps {
  value: string;
  onChange: (value: string) => void;
  onDraw: () => void;
  error: string | null;
  highlightSpan?: SourceSpan | null;
}

function clampSpan(value: string, span: SourceSpan): SourceSpan {
  const start = Math.max(0, Math.min(span.start, value.length));
  const end = Math.max(start, Math.min(span.end, value.length));
  return { start, end };
}

export function ExpressionInput({
  value,
  onChange,
  onDraw,
  error,
  highlightSpan,
}: ExpressionInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onDraw();
  };

  const span =
    highlightSpan && highlightSpan.end > highlightSpan.start
      ? clampSpan(value, highlightSpan)
      : null;

  return (
    <section className="expression-input">
      <header className="panel-header">
        <h1>TurboDigital 1995</h1>
        <p className="subtitle">Boolean expression → circuit diagram</p>
      </header>

      <div className="input-row">
        <div className="expr-field-wrap">
          <div className="expr-highlight-backdrop" aria-hidden>
            {span && (
              <>
                <span className="expr-highlight-ghost">{value.slice(0, span.start)}</span>
                <mark className="expr-highlight-mark">{value.slice(span.start, span.end)}</mark>
                <span className="expr-highlight-ghost">{value.slice(span.end)}</span>
              </>
            )}
          </div>
          <input
            type="text"
            className="expr-field"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. A·B+C' or S'·A+S·B"
            spellCheck={false}
            aria-label="Boolean expression"
          />
        </div>
        <button type="button" className="draw-btn" onClick={onDraw}>
          Draw
        </button>
      </div>

      {error && <p className="error-msg" role="alert">{error}</p>}

      <div className="chips">
        <span className="chips-label">Examples:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="chip"
            onClick={() => onChange(p.expr)}
            title={p.expr}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="syntax-hint">
        Use · for AND, + for OR, ' for NOT. Inputs: A–Y; output is {OUTPUT_NAME}.
      </p>
    </section>
  );
}
