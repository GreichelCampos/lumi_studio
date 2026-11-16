from services.compiler_service import CompilerService
from services.execution_service import ExecutionService, ExecutionStatus
from services.protocol.dispatcher import RequestDispatcher
from services.results import CompilationStatus


def compile_project(entry, extra=None):
    sources = {"principal.lumi": entry, **(extra or {})}
    return CompilerService().compile_project(sources, entry_file="principal.lumi")


def test_exactly_one_main_in_designated_entry_is_valid():
    result = compile_project("principal { mostrar(1)>> }")
    assert result.status is CompilationStatus.COMPLETED


def test_missing_and_empty_entry_are_semantic_errors():
    for source in ("mostrar(5)>>", ""):
        result = compile_project(source)
        assert result.status is CompilationStatus.FAILED
        assert result.diagnostics[0].code == "SEM_ENTRY_POINT_MISSING"
        if source:
            assert result.diagnostics[1].code == (
                "SEM_TOP_LEVEL_EXECUTABLE_STATEMENT"
            )
        else:
            assert len(result.diagnostics) == 1
        assert (result.diagnostics[0].file, result.diagnostics[0].line) == (
            "principal.lumi", 1,
        )
        assert ExecutionService().execute(result).status is ExecutionStatus.BLOCKED


def test_duplicate_main_reports_the_duplicate_location():
    result = compile_project("principal {}\nprincipal {}")
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_ENTRY_POINT_DUPLICATE"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "principal.lumi", 2, 1,
    )


def test_main_in_reachable_auxiliary_module_is_rejected():
    result = compile_project(
        'importar "util.lumi" usar valor>> principal { mostrar(valor())>> }',
        {"util.lumi": "funcion entero valor() { retornar 3>> } principal {}"},
    )
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_ENTRY_POINT_IN_IMPORTED_MODULE"
    assert diagnostic.file == "util.lumi"


def test_nested_main_does_not_count_as_the_project_entry_point():
    result = compile_project("funcion vacio iniciar() { principal {} }")
    assert [item.code for item in result.diagnostics] == [
        "SEM_ENTRY_POINT_MISSING",
        "SEM_ENTRY_POINT_INVALID_LOCATION",
    ]


def test_auxiliary_without_main_and_imported_function_remain_valid():
    result = compile_project(
        'importar "util.lumi" usar valor>> principal { mostrar(valor())>> }',
        {"util.lumi": "funcion entero valor() { retornar 3>> }"},
    )
    execution = ExecutionService().execute(result)
    assert execution.status is ExecutionStatus.COMPLETED
    assert execution.output == ("3",)


def test_top_level_executable_statement_is_rejected_and_not_run():
    result = compile_project(
        'mostrar("fuera")>>\nfuncion entero valor() { retornar 7>> }\n'
        'principal { mostrar(valor())>> }'
    )
    execution = ExecutionService().execute(result)
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_TOP_LEVEL_EXECUTABLE_STATEMENT"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "principal.lumi", 1, 1,
    )
    assert "nivel superior" in diagnostic.description
    assert execution.status is ExecutionStatus.BLOCKED
    assert execution.output == ()


def test_global_variable_function_and_import_remain_valid():
    result = compile_project(
        'importar "util.lumi" usar sumar>>\n'
        "entero base = 2>>\n"
        "funcion entero local() { retornar base>> }\n"
        "principal { mostrar(sumar(local(), 3))>> }",
        {
            "util.lumi": (
                "entero ajuste = 1>>\n"
                "funcion entero sumar(entero a, entero b) { "
                "retornar a + b + ajuste>> }"
            )
        },
    )
    execution = ExecutionService().execute(result)
    assert execution.status is ExecutionStatus.COMPLETED
    assert execution.output == ("6",)


def test_top_level_spatial_instruction_is_rejected_but_main_spatial_code_is_valid():
    invalid = compile_project(
        "habitacion fuera(5, 4, 3) {} principal {}"
    )
    valid = compile_project(
        "principal { habitacion sala(5, 4, 3) {} }"
    )
    assert invalid.diagnostics[0].code == "SEM_TOP_LEVEL_EXECUTABLE_STATEMENT"
    assert valid.status is CompilationStatus.COMPLETED


def test_top_level_executable_statement_in_imported_module_is_rejected():
    result = compile_project(
        'importar "util.lumi" usar valor>> principal { mostrar(valor())>> }',
        {
            "util.lumi": (
                'mostrar("carga")>> '
                "funcion entero valor() { retornar 3>> }"
            )
        },
    )
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "SEM_TOP_LEVEL_EXECUTABLE_STATEMENT"
    assert (diagnostic.file, diagnostic.line, diagnostic.column) == (
        "util.lumi", 1, 1,
    )


def test_missing_designated_entry_is_rejected_before_parsing():
    try:
        CompilerService().compile_project({"otro.lumi": "principal {}"}, entry_file="ausente.lumi")
    except ValueError as error:
        assert "principal" in str(error)
    else:
        raise AssertionError("Se esperaba el rechazo del archivo principal inexistente")


def test_protocol_propagates_entry_diagnostic_and_does_not_attempt_execution():
    response = RequestDispatcher().dispatch({
        "protocolVersion": "1.0.0",
        "requestId": "entry-contract",
        "operation": "execute",
        "entryFile": "principal.lumi",
        "files": {"principal.lumi": ""},
    })
    assert response["status"] == "blocked"
    assert response["result"]["executionAttempted"] is False
    assert response["result"]["diagnostics"][0]["code"] == (
        "SEM_ENTRY_POINT_MISSING"
    )
