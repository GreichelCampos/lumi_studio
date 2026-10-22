"""Front-end JSON snapshots preserve authentic source locations."""

import json
from dataclasses import fields, is_dataclass

import pytest

from lumi_language.ast_adapter import normalize_ast
from lumi_language.diagnostics import Diagnostic, DiagnosticCategory, serialize_diagnostic
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser
from services.compiler_service import CompilerService
from services.protocol.adapters import diagnostic_dto
from services.serialization import serialize_compilation


def assert_locations(original, serialized):
    if is_dataclass(original):
        assert serialized["node"] == type(original).__name__
        assert (serialized["file"], serialized["line"], serialized["column"]) == (
            original.file, original.line, original.column,
        )
        for field in fields(original):
            assert_locations(getattr(original, field.name), serialized[field.name])
    elif isinstance(original, list):
        assert len(original) == len(serialized)
        for node, item in zip(original, serialized):
            assert_locations(node, item)
    else:
        assert original == serialized


@pytest.mark.parametrize("source", [
    "  entero numero = 42>>",
    "principal { si verdadero { mostrar([1, 2 + 3])>> } }",
    '''habitacion sala(5, 4, 3) {
 piso base { material "madera">> }
 pared norte { color "blanco">> }
 puerta entrada { color "rojo">> }
 ventana luz { material "vidrio">> }
 mesa centro { color "azul">> }
 colocar centro [1, 0, 2]>>
 mover centro [2, 0, 1]>>
 rotar centro [0, 90, 0]>>
}''',
])
def test_ast_roundtrip_preserves_every_nested_node(source):
    program = Parser(Lexer(source, "origen.lumi").tokenize()).parse()
    serialized = json.loads(json.dumps(normalize_ast(program), allow_nan=False))
    assert_locations(program, serialized)
    first = serialized["statements"][0]
    assert first["file"] == "origen.lumi"
    assert first["line"] == 1
    assert first["column"] == (3 if source.startswith("  ") else 1)


def test_compilation_serializes_imported_origins():
    sources = {
        "main.lumi": 'importar "a.lumi" usar a>> importar "b.lumi" usar b>>',
        "a.lumi": "funcion entero a() { retornar 1>> }",
        "b.lumi": "\nfuncion entero b() { retornar 2>> }",
    }
    result = CompilerService().compile_project(sources, entry_file="main.lumi")
    serialized = serialize_compilation(result)
    assert result.succeeded
    assert set(serialized["imported_programs"]) == {"a.lumi", "b.lumi"}
    assert_locations(result.program, serialized["program"])
    for file, program in result.imported_programs.items():
        assert_locations(program, serialized["imported_programs"][file])
        assert serialized["imported_programs"][file]["file"] == file
    assert serialized["imported_programs"]["b.lumi"]["line"] == 2
    assert json.loads(json.dumps(serialized, allow_nan=False)) == serialized
    serialized["program"]["statements"].clear()
    assert result.program.statements
    assert "scenePlan" not in serialized


@pytest.mark.parametrize("source", ["", "  ", "-- comentario"])
def test_empty_program_keeps_entry_file(source):
    result = CompilerService().compile(source, "vacio.lumi")
    assert serialize_compilation(result)["program"] == {
        "node": "ProgramNode", "statements": [],
        "file": "vacio.lumi", "line": 1, "column": 1,
    }
    assert Parser([], file="vacio.lumi").parse_with_recovery().file == "vacio.lumi"


def test_empty_import_keeps_its_own_file():
    result = CompilerService().compile(
        'importar "vacio.lumi" usar ausente>>', "main.lumi",
        sources={"vacio.lumi": ""},
    )
    assert serialize_compilation(result)["imported_programs"]["vacio.lumi"]["file"] == "vacio.lumi"


@pytest.mark.parametrize("category", list(DiagnosticCategory))
@pytest.mark.parametrize("suggestion", [None, "", "Revise el origen."])
def test_structured_diagnostic_and_protocol_preserve_all_fields(category, suggestion):
    diagnostic = Diagnostic(category, "EXISTING_CODE", "lib.lumi", 3, 7, "Detalle", suggestion)
    expected = {
        "category": category.value, "code": "EXISTING_CODE", "file": "lib.lumi",
        "line": 3, "column": 7, "description": "Detalle",
    }
    if suggestion is not None:
        expected["suggestion"] = suggestion
    assert serialize_diagnostic(diagnostic) == expected
    assert diagnostic_dto(diagnostic) == expected


@pytest.mark.parametrize("source", ["entero numero =", 'entero numero = "texto">>', 'importar "ausente.lumi" usar x>>'])
def test_real_diagnostics_are_serialized(source):
    result = CompilerService().compile(source, "error.lumi")
    assert result.diagnostics
    assert serialize_compilation(result)["diagnostics"] == [
        serialize_diagnostic(item) for item in result.diagnostics
    ]


def test_lexical_error_keeps_original_text_without_synthetic_diagnostic():
    result = CompilerService().compile(
        'importar "roto.lumi" usar x>>', "main.lumi", sources={"roto.lumi": "\n @"},
    )
    serialized = serialize_compilation(result)
    assert serialized["diagnostics"] == []
    assert serialized["lexical_error"] == result.lexical_error
    assert serialized["lexical_error"].startswith("roto.lumi:2:2:")
    assert serialized["program"] is None


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf"), object()])
def test_non_json_values_fail_without_changing_ast(value):
    from services.serialization import CompilationSerializationError
    result = CompilerService().compile("decimal n = 1.0>>", "n.lumi")
    literal = result.program.statements[0].value
    literal.value = value
    with pytest.raises(CompilationSerializationError) as raised:
        serialize_compilation(result)
    assert raised.value.__cause__ is not None
    assert literal.value is value


def test_decimal_overflow_is_only_a_serialization_failure():
    from services.serialization import CompilationSerializationError
    result = CompilerService().compile("decimal n = " + "9" * 400 + ".0>>", "n.lumi")
    assert result.succeeded
    assert result.program.statements[0].value.value == float("inf")
    with pytest.raises(CompilationSerializationError):
        serialize_compilation(result)


def test_independent_serializations_are_deterministic():
    from services.serialization import serialize_compilation_json
    sources = {
        "main.lumi": 'importar "z.lumi" usar z>> importar "a.lumi" usar a>>',
        "z.lumi": 'funcion texto z() { retornar "á">> }',
        "a.lumi": 'funcion entero a() { retornar 1>> }',
    }
    first = CompilerService().compile_project(sources, entry_file="main.lumi")
    second = CompilerService().compile_project(dict(reversed(list(sources.items()))), entry_file="main.lumi")
    assert first.succeeded and second.succeeded
    assert list(serialize_compilation(first)["imported_programs"]) == ["a.lumi", "z.lumi"]
    encoded = serialize_compilation_json(first)
    assert encoded == serialize_compilation_json(second)
    assert encoded.isascii()
    assert json.loads(encoded) == serialize_compilation(first)
    assert encoded == json.dumps(serialize_compilation(first), allow_nan=False,
                                 ensure_ascii=True, sort_keys=True, separators=(",", ":"))


@pytest.mark.parametrize("source, description", [
    ("\n  @", "carácter inválido '@'"),
    ('\n  "sin cerrar\nsegunda línea', "texto sin cerrar"),
    ("\n  --\nsin cerrar", "comentario multilínea sin cerrar"),
])
@pytest.mark.parametrize("imported", [False, True])
def test_lexical_origin_and_message_compatibility(source, description, imported):
    from lumi_language.lexer_error import LexerError
    from services.protocol.dispatcher import RequestDispatcher
    file = "lib.lumi" if imported else "main.lumi"
    expected = f"{file}:2:3: {description}"
    with pytest.raises(LexerError) as raised:
        Lexer(source, file).tokenize()
    error = raised.value
    assert str(error) == expected
    assert (error.file, error.line, error.column) == (file, 2, 3)
    files = {"main.lumi": 'importar "lib.lumi" usar x>>', "lib.lumi": source} if imported else {file: source}
    result = CompilerService().compile_project(files, entry_file="main.lumi")
    assert result.lexical_error == expected
    assert result.lexical_error_location == error.location
    assert result.diagnostics == ()
    assert not result.can_execute
    snapshot = serialize_compilation(result)
    assert snapshot["lexical_error"] == expected
    assert snapshot["lexical_error_location"] == {"file": file, "line": 2, "column": 3}
    response = RequestDispatcher().dispatch({
        "protocolVersion": "1.0.0", "requestId": "lexical", "operation": "analyze",
        "entryFile": "main.lumi", "files": files,
    })
    assert response["result"]["lexicalError"] == expected
    assert response["result"]["diagnostics"] == []
    assert "lexical_error_location" not in response["result"]
    assert "lexicalErrorLocation" not in response["result"]


def test_legacy_error_and_result_have_no_invented_location():
    from lumi_language.lexer_error import LexerError
    from services.results import CompilationResult, CompilationStatus, AnalysisStage
    error = LexerError("mensaje anterior")
    assert str(error) == "mensaje anterior"
    assert error.location is None
    result = CompilationResult("old.lumi", CompilationStatus.FAILED, AnalysisStage.LEXICAL,
                               (), str(error))
    assert result.lexical_error_location is None
    assert "lexical_error_location" not in serialize_compilation(result)


def test_cyclic_ast_has_controlled_serialization_failure():
    from services.serialization import CompilationSerializationError
    result = CompilerService().compile("mostrar(1)>>", "cycle.lumi")
    result.program.statements.append(result.program)
    with pytest.raises(CompilationSerializationError):
        serialize_compilation(result)
    assert result.program.statements[-1] is result.program
