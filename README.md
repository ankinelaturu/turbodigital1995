# TurboDigital 1995

Boolean expression → animated logic circuit diagram with truth table. A modern recreation of a Turbo C / BGI DOS project.

**Documentation:** [docs/](./docs/README.md)

## Run

```bash
npm install
npm run dev
```

## Features

- Parse Boolean expressions (`·`, `^`, `+`, `'`, parentheses)
- Vertical input rails per variable with animated pen-style drawing
- Horizontal wire taps and jumper arcs at rail crossings
- AND / OR / XOR / NOT gate symbols from lines and arcs
- Interactive simulation with input switches after the pen draw
- Phosphor green CRT dark theme
- Truth table for all input combinations

## Syntax

Inputs are **A–Y**; **Z** is reserved for the circuit output terminal.

| Operation | Symbol |
|-----------|--------|
| AND | `·` (middle dot); also juxtaposition (`AB` = `A·B`) |
| OR | `+` |
| XOR | `^` |
| NOT | postfix `'` (e.g. `C'`) |

Precedence (low → high): **OR**, **XOR**, **AND**, **NOT**. Parentheses override precedence.

Example: `S'·A+S·B` (2:1 multiplexer)

Full syntax details (including optional parser aliases): [expression-syntax.md](./docs/expression-syntax.md).
