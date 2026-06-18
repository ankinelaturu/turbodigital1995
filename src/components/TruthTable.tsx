import type { TruthTableRow } from '../lib/evaluate';

interface TruthTableProps {
  variables: string[];
  rows: TruthTableRow[];
}

export function TruthTable({ variables, rows }: TruthTableProps) {
  if (variables.length === 0) {
    return (
      <section className="truth-table">
        <h2>Truth table</h2>
        <p className="table-empty">Draw a valid expression to see the truth table.</p>
      </section>
    );
  }

  return (
    <section className="truth-table">
      <h2>Truth table</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {variables.map((v) => (
                <th key={v}>{v}</th>
              ))}
              <th>F</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {variables.map((v) => (
                  <td key={v}>{row.inputs[v] ? '1' : '0'}</td>
                ))}
                <td className={row.output ? 'out-one' : 'out-zero'}>
                  {row.output ? '1' : '0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
