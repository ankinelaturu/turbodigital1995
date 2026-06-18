# Expression syntax

## Operators

Use these symbols in expressions (matches the hint in the app UI):

| Operation | Symbol | Precedence |
|-----------|--------|------------|
| NOT | postfix `'` (e.g. `C'`) | Highest |
| AND | `·` (middle dot) | |
| XOR | `^` | |
| OR | `+` | Lowest |

Parentheses `(` `)` override precedence.

## Implicit AND

Operands next to each other without an operator are ANDed:

| Written | Parsed as |
|---------|-----------|
| `AB` | A AND B |
| `A·B` | A AND B |
| `A'B` | (NOT A) AND B |

## NOT

Postfix `'` is the primary style (classic Boolean notation):

| Written | Meaning |
|---------|---------|
| `C'` | NOT C |
| `S'·A` | (NOT S) AND A |

The keyword `NOT` is also accepted as a prefix operator (e.g. `NOT C`).

## Examples

| Expression | Description |
|------------|-------------|
| `A·B+C` | (A AND B) OR C |
| `A·B+C'` | (A AND B) OR (NOT C) |
| `(A·B)+(C'·D)` | Two product terms ORed |
| `S'·A+S·B` | 2:1 multiplexer: if S=0 pick A, if S=1 pick B |
| `A^B` | A XOR B |
| `A·B'+A'·B` | XOR (expanded) |
| `A+B·C` | A OR (B AND C) — AND binds tighter than OR |

## Parser aliases

The lexer also accepts these alternatives, but **`·`, `+`, `^`, and `'` are the documented style**:

| Operation | Also accepted |
|-----------|----------------|
| AND | `*`, `&`, `.`, keyword `AND`, juxtaposition |
| OR | `\|`, keyword `OR` |
| XOR | keyword `XOR` |
| NOT | keyword `NOT` |

`!` is **not** supported.

## Parse errors

The parser throws `ParseError` for:

- Empty input
- Unexpected tokens
- Missing closing parenthesis
- Invalid characters (including `!`)
- Using `Z` as an input variable

Errors are shown below the expression input field.

## Variables

- Single letters **A–Y** (case-insensitive, stored uppercase)
- **`Z` is reserved** for the circuit output — not an input rail
- Multi-character alphanumeric names are supported (e.g. `IN1`) but uncommon

Variables are sorted alphabetically for rail column order and truth table columns.

## Truth table

For `n` variables, the truth table has `2^n` rows. Rows are ordered with inputs counting in binary from `000…` to `111…`, using the sorted variable order as bit positions (first variable = MSB).

Example for `A`, `B`:

| A | B | F |
|---|---|---|
| 0 | 0 | … |
| 0 | 1 | … |
| 1 | 0 | … |
| 1 | 1 | … |
