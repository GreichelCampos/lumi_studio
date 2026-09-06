# Lumi Type Compatibility

## Assignment compatibility

Lumi permits assignment between identical types and widening from `entero` to `decimal`. It does not perform implicit narrowing from `decimal` to `entero`.

| Target | Value | Valid |
| --- | --- | --- |
| `entero` | `entero` | Yes |
| `decimal` | `entero` | Yes |
| `decimal` | `decimal` | Yes |
| `texto` | `texto` | Yes |
| `booleano` | `booleano` | Yes |
| `entero` | `decimal` | No |
| Any simple type | Different nonnumeric type | No |

Invalid assignments produce `SEM_TYPE_MISMATCH`.

## Binary operations

| Operator | Accepted operands | Result |
| --- | --- | --- |
| `+`, `-`, `*` | `entero`, `entero` | `entero` |
| `+`, `-`, `*` | Mixed numeric operands | `decimal` |
| `/` | Numeric operands | `decimal` |
| `+` | `texto`, `texto` | `texto` |
| `y`, `o` | `booleano`, `booleano` | `booleano` |
| `>`, `<`, `>=`, `<=` | Numeric operands | `booleano` |
| `==`, `!=` | Identical types | `booleano` |
| `==`, `!=` | Mixed numeric operands | `booleano` |

Other combinations produce `SEM_INVALID_BINARY_OPERATION`.

## Unary operations

| Operator | Accepted operand | Result |
| --- | --- | --- |
| `no` | `booleano` | `booleano` |
| `-` | `entero` | `entero` |
| `-` | `decimal` | `decimal` |

Other combinations produce `SEM_INVALID_UNARY_OPERATION`.

## Scope of this matrix

This initial matrix covers the simple-type validation required by L-014. Collection operations and the special `nulo` value will be specified separately before their semantic validation is implemented.
