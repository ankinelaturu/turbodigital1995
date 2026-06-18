# Circuit layout

The layout engine converts the parse tree into a schematic: vertical **rails**, horizontal **wires**, **jumpers**, and **gates**.

## Layout philosophy

The diagram is a **direct visual encoding of the expression tree**, not a minimized circuit:

- Inner subexpressions (parentheses, higher precedence) are drawn closer to the input rails.
- Outer operators (typically OR) appear farther right, toward the output.
- Each operator node becomes one gate.
- Repeated subexpressions are **not** deduplicated — the same formula twice means two gates.

This matches the original Turbo C program’s approach: brackets and AND/OR order determine placement.

## Vertical rails

Every variable in the expression gets a dedicated **vertical column**:

```
A     B     S
|     |     |
|     |     |
|     |     |
```

- Label centered above the rail (`A`, `B`, `S`, …)
- Rail runs from `railTop` down to the bottom of the circuit
- Column spacing: `LAYOUT.railSpacing` (90px)
- Left margin: `LAYOUT.marginX` (60px)

Variables are sorted alphabetically for column assignment.

## Gate placement

Gates are placed in a **gate zone** to the right of every rail column — never overlapping the vertical rails.

```
A     B     C     |  [NOT] [AND] [OR]  → F
|     |     |     |   gate zone
```

- `gateZoneStartX` = rightmost rail X + `railToGateGap` (50px)
- Each gate layer uses `layerSpacing` (110px) from that start line
- Layer depth comes from the parse tree: inner operators are closer, outer operators farther right

| Node | Placement |
|------|-----------|
| **Variable** | Tap point on that variable’s rail; Y advances by `rowStep` |
| **NOT** | Gate at `gateZoneStartX + (depth − 1) × layerSpacing` |
| **AND / OR** | Same column rule; Y = average of both input wire heights |

Horizontal wires run from rails (or prior gate outputs) into the gate zone before any gate symbol is drawn there.

## Horizontal wires

Connections use **orthogonal routing** into each gate:

1. Horizontal from source (rail or prior gate) to `gateInputX − 30px` (jumpers on crossed rails)
2. Vertical at that column to the gate input height
3. Short horizontal into the gate

```
source --------+
               |
               +---- gate
```

Output to **F** remains a straight horizontal segment.

## Jumper arcs

When a horizontal wire crosses another variable’s rail column **without connecting to it**, a **semicircular jumper** is placed over that rail:

```
A     B     C
|     |     |
|-----)-----+----→   ← jumper over B's rail
|     |     |
```

Rules in `makeHorizontalWire`:

1. Compute horizontal span from source X to destination X.
2. For each other variable’s rail X within that span (excluding the source rail), add a jumper.
3. Jumper is a small arc (`jumperRadius` = 10px) drawn above the crossing point.

## Output

The root expression’s output connects horizontally to a terminal labeled **F**, 60px to the right of the final gate.

## Example: `S'·A+S·B`

Parse tree:

```
        OR
       /  \
   AND    AND
  /  \   /  \
NOT  A  S    B
 |
 S
```

Rough left-to-right flow:

1. S rail → NOT → wire to first AND
2. A rail → first AND
3. S rail → second AND
4. B rail → second AND
5. Both AND outputs → OR → F

## Layout constants

Defined in `src/lib/types.ts` as `LAYOUT`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `marginX` | 60 | Left padding |
| `marginY` | 70 | Top padding |
| `railSpacing` | 20 | Distance between rail columns |
| `layerSpacing` | 110 | Horizontal gap between logic layers |
| `gateWidth` | 52 | AND/OR symbol width |
| `gateHeight` | 44 | AND/OR symbol height |
| `notWidth` | 28 | NOT triangle width |
| `notHeight` | 28 | NOT triangle height |
| `gateWireStub` | 30 | Horizontal stop before gate; wire turns vertical then enters |
| `rowStep` | 56 | Vertical spacing between tap points |
| `jumperRadius` | 10 | Jumper arc radius |
| `railTop` | 50 | Y where rails begin |
| `labelOffsetY` | -28 | Label above rail top |
