import { useMemo, useState, useEffect, useCallback } from 'react';
import { ExpressionInput } from './components/ExpressionInput';
import { CircuitCanvas } from './components/CircuitCanvas';
import { TruthTable } from './components/TruthTable';
import { parse, ParseError, collectVariables } from './lib/parse';
import { buildTruthTable } from './lib/evaluate';
import { buildLayout } from './lib/layout';
import type { CircuitLayout, SourceSpan } from './lib/types';
import './App.css';

function App() {
  const [expression, setExpression] = useState("S'·A+S·B");
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<CircuitLayout | null>(null);
  const [drawKey, setDrawKey] = useState(0);
  const [ast, setAst] = useState<ReturnType<typeof parse> | null>(null);
  const [highlightSpan, setHighlightSpan] = useState<SourceSpan | null>(null);

  const variables = useMemo(() => (ast ? collectVariables(ast) : []), [ast]);
  const truthRows = useMemo(
    () => (ast ? buildTruthTable(ast, variables) : []),
    [ast, variables],
  );

  const handleDraw = useCallback(() => {
    try {
      const parsed = parse(expression);
      const built = buildLayout(parsed);
      setAst(parsed);
      setLayout(built);
      setDrawKey((k) => k + 1);
      setError(null);
      setHighlightSpan(null);
    } catch (e) {
      setError(e instanceof ParseError ? e.message : 'Invalid expression');
      setLayout(null);
      setAst(null);
      setHighlightSpan(null);
    }
  }, [expression]);

  useEffect(() => {
    handleDraw();
    // Initial demo draw only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGateHover = useCallback(
    (hover: { sourceSpan: SourceSpan } | null) => {
      setHighlightSpan(hover?.sourceSpan ?? null);
    },
    [],
  );

  return (
    <div className="app">
      <ExpressionInput
        value={expression}
        onChange={(v) => {
          setExpression(v);
          setHighlightSpan(null);
        }}
        onDraw={handleDraw}
        error={error}
        highlightSpan={highlightSpan}
      />

      <main className="main-panels">
        <CircuitCanvas
          layout={layout}
          ast={ast}
          drawKey={drawKey}
          onGateHover={handleGateHover}
        />
        <TruthTable variables={variables} rows={truthRows} />
      </main>

      <footer className="footer">
        <span>Phosphor green CRT mode</span>
        <span>Draw → simulate with input switches</span>
      </footer>
    </div>
  );
}

export default App;
