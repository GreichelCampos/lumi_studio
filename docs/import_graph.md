# L-034: compilation-scoped import graph

`lumi_language.import_context` is internal front-end traversal data. Each root
parser creates a context unless one is explicitly supplied by its caller. Child
parsers share that same context. No global or service-instance state is used.
The existing `active_files` stack remains the only cycle detector.

## Identity, relationships and modules

File identities are exact resolver keys. No path normalization, disk lookup or
symbol visibility rule is introduced. An import's requested symbol is metadata
on its relationship; retaining an AST does not export its declarations.

`relations` records each syntactically complete import instruction before
resolution, including missing dependencies and the edge that closes a cycle.
Each `ImportRelation` contains importer, dependency, source file, line, column,
requested symbol and a zero-based order. Order is depth-first encounter order:
an imported module is traversed before the next instruction in its importer.
Imports not reached after an error are not recorded.

Successful modules are cached in the compilation context. Every import
instruction records its relationship before checking the active stack and then
consulting `reusable_program(file)`. A hit updates the importing parser's direct
`imported_programs` map with the same complete AST and skips resolution,
tokenization and parsing. No Parser or exception is cached.

Each instruction in a successfully parsed module is therefore recorded once.
Repeated imports of that module still record their own edges, with symbols and
locations intact, but do not replay its outgoing instructions. A shared module's
existing outgoing edges retain the complete observed closure. Order remains
first-encounter depth-first order. Failed visits can still repeat instructions.
`direct_dependencies(file)` returns unique dependencies in first-encounter
order. `reachable_dependencies(file)` computes the observed transitive closure
iteratively, excludes its origin and terminates even for cyclic graphs. Neither
query implies successful parsing.

`modules` retains one `ModuleRecord` per reached identity, including the entry:

| State | Meaning | Valid AST |
| --- | --- | --- |
| discovered | Referenced, not processed (for example, no resolver) | No |
| processing | Parsing is active | No |
| succeeded | Parsing returned without diagnostics | Yes |
| partial | Recovery returned with diagnostics | No |
| failed | Resolution, lexing or parsing raised | No |

`parsing_completed` distinguishes a returned recovering parse from an aborted
one. `failure_kind` stores the exception type name, never the exception or its
traceback. It is internal metadata, not a new diagnostic code. Lexical failures
keep the existing lexical error contract; they do not invent `Diagnostic`s.
Syntax/import diagnostics belong to the parser that produced them. A parent's
module record excludes copied child diagnostics, while `Parser.diagnostics`
continues to aggregate them through the existing `finally` propagation.

`successful_programs` returns a fresh mapping of all currently successful ASTs,
including transitive modules and the entry. ASTs themselves remain mutable core
objects and must be treated as read-only by consumers. Semantic validity is not
asserted by this mapping. `complete` is true only if all discovered modules
succeeded. A failed or unresolved traversal describes a partial observed graph;
it makes no claim about imports beyond the failure point. Recovery can continue
to add successfully processed modules without making a partial entry valid.

## Compiler service integration

`CompilerService._compile_with_dependencies(source, file, sources=...)` returns
`(CompilationResult, context)` for internal callers, including controlled
lexical and parser failures. Unexpected exceptions still propagate. Every call
allocates its own context and uses the existing source snapshot.

Public `compile` and `compile_project` retain their result contracts.
`CompilationResult.imported_programs` still contains direct imports only; the
semantic analyzer, interpreter, serialization and Python-IDE protocol do not
receive a flattened transitive symbol environment. No public result field or
serialized field was added.

The semantic analyzer receives `context.successful_programs` as an AST catalog.
It uses that catalog only when an explicit `ImportNode` requests a symbol,
including imports inside an imported function body. The catalog does not define
symbols, analyze unrequested functions or process a dependency's top-level
imports automatically. Failed and partial modules cannot enter this catalog.
The interpreter receives the same successful AST catalog through internal
result transport. Explicit transitive imports inside a called imported function
can therefore execute without introducing any symbol visibility rule.

## Execution catalog transport

`CompilationResult._compiled_programs` is an optional keyword-only private
`Mapping[str, ProgramNode]`, defaulting to `None` and excluded from repr and
comparison. `_compile_with_dependencies` attaches a `MappingProxyType` around a
fresh `context.successful_programs` dictionary to each result using dataclass
replacement. The map includes the successfully parsed entry and all successful
reached modules; failed and partial records are absent. This also applies to
controlled failed compilations, whose execution remains blocked as before.
No module is recompiled to construct the map. It contains ASTs only, without
parsers, traversal state, exceptions or tracebacks.

The map is an immutable membership snapshot, not a deep freeze of AST nodes.
AST consumers must keep treating those nodes as read-only; the interpreter
normalizes them into its own dictionaries and lists. Later changes to the
source mapping or traversal registry cannot replace this compilation's ASTs.
Each result owns its snapshot, so interleaved compilations and separate compiler
and execution services do not share a last-project catalog.

`ExecutionService.execute` passes this map to the interpreter. A `None` catalog
uses `imported_programs` as the legacy fallback; an explicitly empty catalog does
not. Execution never recompiles or reads current external sources. Runtime
scopes and closures still belong to each execution, and only the requested
symbol is defined when its explicit import instruction executes. Helpers and
module-level imports receive no automatic visibility. Conflicts, import order
and validation of unrequested functions retain their existing rules.

The public `imported_programs` map remains direct imports. Public JSON and wire
adapters enumerate their fields explicitly and never expose the private catalog.
No automatic `asdict()` conversion of results is used in production services.
Dataclass repr/compare flags do not filter `asdict()`; generic dataclass
introspection is not the public serialization contract. Use the existing
explicit serializers, which are tested to produce the same output with or
without the private catalog. The Python-IDE protocol has no new fields.

## Semantic diagnostic provenance

Bodies are still analyzed at every permitted import occurrence in the existing
importer's scope. Only aggregation of semantic diagnostics changes. Within one
`analyze()` call the key is `(id(normalized_source_node), rule_cause, diagnostic)`.
Normalized source trees stay alive for that call. The entire immutable Diagnostic
is included, preserving category, code, file, line, column, description and
suggestion. Rule causes are explicit immutable tuples: inferred/expected types
and operators for type checks, resolved Symbol values and argument information
for call checks, and involved names/symbols for declaration checks. Symbols
include declaration location, origin and signature, so equal messages from
different resolved declarations remain separate causes.

Distinct source nodes remain distinct even if fixtures assign them identical
locations and messages. The same source node with a different cause also remains
distinct. Import-instruction diagnostics bypass semantic deduplication and keep
their individual occurrences. There is no text-based deduplication and no
file-level or body-level skip. Provenance state resets on every analysis and is
not stored in the parsing cache or exposed through public diagnostic fields.

## Successful parsing cache and failure policy

Only `succeeded` records with completed parsing, no own diagnostics and an AST
are reusable. Partial/recovering and failed records are never hits. The active
stack check always precedes lookup: a cycle diagnostic belongs to its current
path and closing instruction. The entry uses the same registry and active stack.

`CompilerService` copies the supplied source mapping before lexing the entry;
strings are immutable and its resolver uses that private snapshot. Mutation of
the caller's mapping cannot change sources mid-compilation. Each subsequent
compile creates a fresh snapshot and context. Direct Parser callers supplying
custom resolvers must likewise keep their source view stable for the duration
of the parse; this layer does not enumerate or snapshot arbitrary resolvers.

Successful parsing currently implies no parser diagnostics, including child
errors. Consequently a hit contributes no copied diagnostics. Module records
retain own diagnostics; a missing-file or cycle error belongs to the importing
instruction; the root `Parser.diagnostics` remains the aggregated project list.
No text-based diagnostic deduplication is performed. Semantic diagnostics are
still produced later for each relevant import instruction.

Failed modules are resolved and parsed again if reached during recovery. Their
latest record replaces the prior result and aggregate diagnostics can contain
separate occurrences of the same module error. This intentionally preserves the
previous safe behavior. A future failure cache must specify diagnostic occurrence
identity, aggregation order and path-dependent import failures before reuse; it
must not suppress distinct errors with equal descriptions or retain tracebacks.

AST dataclasses remain mutable, but existing semantic and runtime consumers use
`normalize_ast` to build separate dictionaries/lists. Tests verify the reused
original is unchanged after analysis, execution and serialization. No new AST
copying or freezing policy was introduced. Future transitive semantic consumers
must preserve this ownership contract, module-local symbol visibility and the
separation between a parsing success and semantic validity.
