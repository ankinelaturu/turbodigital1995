# Overview

## What is TurboDigital 1995?

TurboDigital 1995 is a browser-based recreation of a DOS-era program written in **Turbo C** using the **Borland Graphics Interface (BGI)**. The original tool:

1. Accepted a **Boolean algebra expression**
2. Drew a **combinational logic circuit** from it
3. Used **vertical rails** for each input variable (A, B, S, …)
4. Routed **horizontal connections** from those rails to logic gates
5. Drew gate symbols with basic geometry — lines, arcs, rectangles
6. Rendered everything in **phosphor green** on a dark screen, with the satisfying feel of lines and arcs appearing as if drawn by hand on a CRT

This web version preserves that spirit: same layout rules, same draw order, same retro aesthetic — implemented with **Vite**, **TypeScript**, **React**, and the **Canvas 2D API**.

## What the app does today

| Feature | Status |
|---------|--------|
| Parse Boolean expressions | ✓ |
| Animated circuit diagram | ✓ |
| Vertical input rails per variable | ✓ |
| Horizontal wire taps | ✓ |
| Jumper arcs at rail crossings | ✓ |
| AND / OR / NOT gate symbols | ✓ |
| Pen-style progressive drawing | ✓ |
| Phosphor green CRT theme | ✓ |
| Truth table | ✓ |
| Example expression chips | ✓ |

## UI layout

The single-page app has three main areas:

1. **Expression input** — text field, example chips, Draw button
2. **Circuit canvas** — animated schematic
3. **Truth table** — all input combinations and output F

## Design principles

- **Expression-faithful layout** — the diagram follows the parse tree (parentheses and operator precedence), not a minimized or optimized gate network.
- **Variable-centric wiring** — each input gets a fixed vertical column; gates tap off those rails horizontally.
- **Simple routing** — no industrial EDA autorouter; just predictable rules for taps and jumpers.
- **Visible construction** — drawing happens in a fixed order so the circuit appears to be built step by step.

## Technology stack

| Layer | Choice |
|-------|--------|
| Build | Vite 6 |
| Language | TypeScript |
| UI | React 19 |
| Rendering | HTML Canvas 2D |
| Font | IBM Plex Mono |

WebGL was considered but Canvas 2D is a better fit for lines, arcs, and the pen-drawing animation model.
