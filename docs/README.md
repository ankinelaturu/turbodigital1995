# TurboDigital 1995 — Documentation

Boolean expression → animated logic circuit diagram with truth table.

This folder documents the web app and its connection to the original Turbo C / BGI DOS project.

## Contents

| Document | Description |
|----------|-------------|
| [Overview](./overview.md) | Project background, goals, and feature summary |
| [Architecture](./architecture.md) | App structure, data flow, and file map |
| [Expression syntax](./expression-syntax.md) | Boolean operators, parsing rules, and examples |
| [Circuit layout](./circuit-layout.md) | Rails, wires, jumpers, and gate placement |
| [Drawing & animation](./drawing-and-animation.md) | Pen-style rendering, draw queue, and CRT theme |
| [Development](./development.md) | Setup, scripts, and how to extend the app |

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173/ and enter a Boolean expression, or pick an example chip, then click **Draw**.

## Example expressions

| Name | Expression |
|------|------------|
| 2:1 multiplexer | `S'·A+S·B` |
| Sum of products | `A·B+C'` |
| Grouped | `(A·B)+(C'·D)` |
| XOR | `A·B'+A'·B` |
