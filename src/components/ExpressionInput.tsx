/**
 * Expression field, example presets dropdown, and Draw trigger.
 */
import { useEffect, useRef, useState } from 'react';
import { OUTPUT_NAME, type SourceSpan } from '../lib/types';

export interface PresetExpression {
  label: string;
  expr: string;
  /**
   * Longer description shown as a subtitle in the dropdown.
   */
  hint?: string;
}

/**
 * Example expressions available from the input dropdown.
 */
export const PRESETS: PresetExpression[] = [
  { label: 'A+B+C', expr: 'A+B+C' },
  { label: 'A·B + C', expr: 'A·B+C' },
  { label: 'A·B + C\'', expr: "A·B+C'" },
  { label: '(A·B)+(C\'·D)', expr: "(A·B)+(C'·D)" },
  { label: '2:1 Mux', expr: "S'·A+S·B" },
  { label: 'XOR', expr: 'A^B' },
  { label: 'XOR (expanded)', expr: "A·B'+A'·B" },
  { label: 'A+B·C', expr: 'A+B·C' },
  { label: 'Half adder sum', expr: "A·B'+A'·B" },
  { label: 'Half adder carry', expr: 'A·B' },
  {
    label: 'Twin towers',
    expr: "((A·B)+(C·D'))·((E+F')+(A'·B'))+(C·E·F)",
    hint: 'Two stacked sum-of-products blocks, multiplied, plus C·E·F',
  },
  {
    label: 'Fuse cascade',
    expr: "((A+B)·(C'+D))·(E+F')+A·B·C·D·E·F",
    hint: 'Product of sum pairs, then a six-input AND finale',
  },
];

interface ExpressionInputProps {
  value: string;
  onChange: (value: string) => void;
  onDraw: () => void;
  error: string | null;
  highlightSpan?: SourceSpan | null;
}

/**
 * Clamp a highlight span to the current expression length.
 */
function clampSpan(value: string, span: SourceSpan): SourceSpan {
  const start = Math.max(0, Math.min(span.start, value.length));
  const end = Math.max(start, Math.min(span.end, value.length));
  return { start, end };
}

/**
 * Expression input with syntax highlighting, examples dropdown, and Draw button.
 */
export function ExpressionInput({
  value,
  onChange,
  onDraw,
  error,
  highlightSpan,
}: ExpressionInputProps) {
  const [examplesOpen, setExamplesOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!examplesOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setExamplesOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExamplesOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [examplesOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onDraw();
  };

  const selectPreset = (expr: string) => {
    onChange(expr);
    setExamplesOpen(false);
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
        <div className="expr-field-wrap" ref={wrapRef}>
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
          <button
            type="button"
            className="expr-examples-trigger"
            onClick={() => setExamplesOpen((open) => !open)}
            aria-expanded={examplesOpen}
            aria-haspopup="listbox"
            aria-label="Example expressions"
            title="Example expressions"
          >
            <span className="expr-examples-chevron" aria-hidden />
          </button>
          {examplesOpen && (
            <ul className="expr-examples-menu" role="listbox" aria-label="Example expressions">
              {PRESETS.map((p) => (
                <li key={p.label} role="option">
                  <button
                    type="button"
                    className="expr-examples-item"
                    onClick={() => selectPreset(p.expr)}
                    title={p.expr}
                  >
                    <span className="expr-examples-item-label">{p.label}</span>
                    {p.hint && <span className="expr-examples-item-hint">{p.hint}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" className="draw-btn" onClick={onDraw}>
          Draw
        </button>
      </div>

      {error && <p className="error-msg" role="alert">{error}</p>}

      <p className="syntax-hint">
        Use · for AND, ^ for XOR, + for OR, ' for NOT. Inputs: A–Y; output is {OUTPUT_NAME}.
      </p>
    </section>
  );
}
