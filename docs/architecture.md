# Architecture

## Data flow

```
Boolean string
      │
      ▼
  parse.ts ──────────► AST
      │                  │
      │                  ├──► evaluate.ts ──► Truth table
      │                  │
      ▼                  ▼
  layout.ts ──────► CircuitLayout
      │
      ▼
  drawQueue.ts ───► Stroke[]
      │
      ▼
  canvasDraw.ts ──► CircuitCanvas (animated render)
```

When the user clicks **Draw**:

1. `parse(expression)` builds an abstract syntax tree (AST).
2. `buildLayout(ast)` computes rail positions, gate placements, and wire segments.
3. `buildTruthTable(ast, variables)` fills the truth table panel.
4. `buildDrawQueue(layout)` orders every visual primitive for animation.
5. `CircuitCanvas` runs `requestAnimationFrame` and draws strokes progressively.

## React components

```
App
├── ExpressionInput     Expression field, chips, Draw button, syntax help
├── CircuitCanvas       Canvas element + animation loop
└── TruthTable          Tabular 0/1 output for all input combos
```

### ExpressionInput

- Controlled text input for the Boolean expression.
- Preset chips defined in `PRESETS` (mux, XOR, half-adder, etc.).
- Enter key triggers draw; displays parse errors.

### CircuitCanvas

- Receives `layout` and `drawKey` (incremented on each draw to restart animation).
- Builds the draw queue on layout change.
- Animates one stroke at a time; completed strokes stay on screen.
- Scales canvas to container width via `ResizeObserver`.

### TruthTable

- Read-only display of variables and output column F.
- Updates when a valid expression is parsed.

## Library modules (`src/lib/`)

| File | Responsibility |
|------|----------------|
| `parse.ts` | Tokenize and parse expressions into AST; collect variable names |
| `evaluate.ts` | Evaluate AST for given inputs; build full truth table |
| `layout.ts` | AST → rails, gates, wires, jumpers, output point |
| `drawQueue.ts` | Layout → ordered list of strokes with durations |
| `canvasDraw.ts` | Render partial/completed strokes; CRT overlay |
| `types.ts` | Shared types, layout constants, color palette |

## AST shape

```typescript
type AST =
  | { type: 'var'; name: string }
  | { type: 'not'; child: AST }
  | { type: 'and'; left: AST; right: AST }
  | { type: 'or'; left: AST; right: AST };
```

## CircuitLayout shape

```typescript
interface CircuitLayout {
  variables: string[];
  rails: RailLayout[];      // vertical bus per variable
  gates: GateLayout[];      // AND, OR, NOT positions
  wires: WireLayout[];      // horizontal segments + jumper metadata
  labels: LabelLayout[];    // A, B, S above rails
  output: Point;            // F output terminal
  width: number;
  height: number;
}
```

## Stroke shape (animation unit)

```typescript
interface Stroke {
  kind: 'line' | 'arc' | 'polyline' | 'text';
  phase: 'label' | 'rail' | 'wire' | 'jumper' | 'gate' | 'output';
  points: Point[];
  arc?: { cx, cy, r, start, end };  // radians
  text?: string;
  durationMs: number;
}
```

## Source tree

```
src/
├── main.tsx
├── App.tsx
├── App.css
├── components/
│   ├── ExpressionInput.tsx
│   ├── CircuitCanvas.tsx
│   └── TruthTable.tsx
└── lib/
    ├── parse.ts
    ├── evaluate.ts
    ├── layout.ts
    ├── drawQueue.ts
    ├── canvasDraw.ts
    └── types.ts
```
