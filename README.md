# TurboDigital 1995

Boolean expression → animated logic circuit diagram with truth table. A modern recreation of a Turbo C / BGI DOS project.

**Documentation:** [docs/](./docs/README.md)

## Run

```bash
npm install
npm run dev
```

## Features

- Parse Boolean expressions (`·`, `+`, `'`, parentheses)
- Vertical input rails per variable with animated pen-style drawing
- Horizontal wire taps and jumper arcs at rail crossings
- AND / OR / NOT gate symbols from lines and arcs
- Phosphor green CRT dark theme
- Truth table for all input combinations

## Syntax

| Operator | Symbols |
|----------|---------|
| AND | `·` (also `*` accepted) |
| OR | `+` |
| NOT | `'` or `!` |

Example: `S'·A+S·B` (2:1 multiplexer)
