# Expression syntax

## Operators

| Operation | Symbols | Precedence |
|-----------|---------|------------|
| NOT | `'` (postfix), `!` (prefix), `NOT` | Highest |
| AND | `·` (middle dot), or adjacent operands (`AB`) | Middle |
| OR | `+`, `\|`, `OR` | Lowest |

`*` and `&` are also accepted as aliases for AND.

Parentheses `(` `)` override precedence.

## Normalization

Before parsing, the input is normalized:

- Whitespace removed
- `·` → internal AND token
- `&` → AND
- `|` → `+`
- `NOT` → `!`
- `AND` → AND
- `OR` → `+`

## NOT forms

Both prefix and postfix NOT are supported:

| Written | Meaning |
|---------|---------|
| `C'` | NOT C |
| `!C` | NOT C |
| `S'·A` | (NOT S) AND A |

Postfix `'` is the primary style (matches classic Boolean notation).

## Implicit AND

Operands next to each other without an operator are ANDed:

| Written | Parsed as |
|---------|-----------|
| `AB` | A AND B |
| `A·B` | A AND B |
| `A'B` | (NOT A) AND B |

## Examples

| Expression | Description |
|------------|-------------|
| `A·B+C` | (A AND B) OR C |
| `A·B+C'` | (A AND B) OR (NOT C) |
| `(A·B)+(C'·D)` | Two product terms ORed |
| `S'·A+S·B` | 2:1 multiplexer: if S=0 pick A, if S=1 pick B |
| `A·B'+A'·B` | XOR |
| `A+B·C` | A OR (B AND C) — AND binds tighter than OR |

## Parse errors

The parser throws `ParseError` for:

- Empty input
- Unexpected tokens
- Missing closing parenthesis
- Invalid characters

Errors are shown below the expression input field.

## Variables

- Single letters `A`–`Z` (case-insensitive, stored uppercase)
- Multi-character names supported if alphanumeric (e.g. `IN1`) — uncommon for Boolean homework style

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
