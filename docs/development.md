# Development

## Prerequisites

- Node.js 18+
- npm

## Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server (default http://localhost:5173) |
| `npm run build` | Typecheck and production build → `dist/` |
| `npm run preview` | Serve production build locally |

## Project dependencies

**Runtime**

- `react`, `react-dom`

**Dev**

- `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`

No routing library, no canvas/WebGL wrapper — keeps the bundle small.

## Extending the app

### Add a preset chip

Edit `PRESETS` in `src/components/ExpressionInput.tsx`:

```typescript
{ label: 'My circuit', expr: "A·B+C'" },
```

### Add a gate type (e.g. XOR)

1. Extend `AST` and parser in `parse.ts` if using a new operator.
2. Add gate type to `GateType` in `types.ts`.
3. Handle placement in `layout.ts` (`layoutNode` switch).
4. Add geometry in `gateStrokes()` inside `drawQueue.ts`.

### Adjust layout spacing

Edit constants in `src/lib/types.ts` → `LAYOUT`.

### Change draw speed

Edit `durationMs` values in `buildDrawQueue()` and `gateStrokes()` in `drawQueue.ts`, or multiply all durations by a global speed factor.

### Change colors

Edit `COLORS` in `types.ts` and CSS variables in `src/App.css`.

## Testing manually

1. Start dev server.
2. Try each preset chip — verify parse, layout, animation, truth table.
3. Test edge cases:
   - Single variable: `A`
   - Deep nesting: `((A·B)+C)·D`
   - Many variables: `(A·B)+(C·D)+(E·F)`
   - Invalid input: `A++B`, `(A·B` — should show error

## Build output

Production build emits static files to `dist/` suitable for any static host (Netlify, GitHub Pages, etc.). No server-side logic required.

## Future ideas

- Export schematic as PNG/SVG
- Step-through / pause animation
- Click gates to highlight truth table rows
- XOR / NAND / NOR gate support
- Sequential logic (flip-flops) — would need a different layout model
- Keyboard shortcut for Draw (Enter already works in input)
