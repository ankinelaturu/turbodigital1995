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
}

export function ExpressionInput({ value, onChange, onDraw, error }: ExpressionInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onDraw();
  };

  return (
    <section className="expression-input">
      <header className="panel-header">
        <h1>TurboDigital 1995</h1>
        <p className="subtitle">Boolean expression → circuit diagram</p>
      </header>

      <div className="input-row">
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
        Use · for AND, + for OR, ' or ! for NOT. Variables: A–Z. Parentheses for grouping.
      </p>
    </section>
  );
}
