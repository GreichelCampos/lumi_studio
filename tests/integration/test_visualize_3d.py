from lumi_language.ast_adapter import normalize_ast
from lumi_language.lexer import Lexer
from lumi_language.parser import Parser, ParserError
from services.execution_service import ExecutionService
from services.protocol.dispatcher import RequestDispatcher


def parse(source: str):
    return Parser(Lexer(source, "principal.lumi").tokenize()).parse()


def execute(body: str):
    return ExecutionService().execute_source(
        f"principal {{ {body} }}", "principal.lumi"
    )


def test_parser_builds_visualize_3d_node_with_source_location():
    program = normalize_ast(parse("principal {\n  visualizar3D(sala)>>\n}"))
    node = program["statements"][0]["body"][0]
    assert node == {
        "node": "Visualize3DNode",
        "room_name": "sala",
        "file": "principal.lumi",
        "line": 2,
        "column": 3,
    }


def test_parser_rejects_non_identifier_argument():
    parser = Parser(
        Lexer('principal { visualizar3D("sala")>> }', "principal.lumi").tokenize()
    )
    try:
        parser.parse()
    except ParserError:
        pass
    else:
        raise AssertionError("visualizar3D must reject non-room identifiers")
    assert parser.diagnostics[0].code == "SYN_UNEXPECTED_TOKEN"


def test_last_executed_request_wins_without_filtering_scene_plan():
    result = execute(
        "habitacion sala(5,4,3){} habitacion cocina(4,3,3){} "
        "visualizar3D(sala)>> visualizar3D(cocina)>>"
    )
    assert result.succeeded
    assert result.visualization_room == "cocina"
    assert [room.name for room in result.scene_plan.rooms] == ["sala", "cocina"]


def test_missing_runtime_room_is_a_controlled_failure():
    result = execute("habitacion sala(5,4,3){} visualizar3D(patio)>>")
    assert result.status.value == "failed"
    assert result.scene_plan is None
    assert result.visualization_room is None
    assert [diagnostic.code for diagnostic in result.diagnostics] == [
        "RUN_VISUALIZE_ROOM_NOT_FOUND"
    ]


def test_request_respects_conditions_loops_and_functions():
    source = """
funcion vacio elegir() { visualizar3D(cocina)>> }
principal {
  habitacion sala(5,4,3){}
  habitacion cocina(4,3,3){}
  si falso { visualizar3D(sala)>> }
  repetir 2 { visualizar3D(sala)>> }
  elegir()>>
}
"""
    result = ExecutionService().execute_source(source, "principal.lumi")
    assert result.succeeded
    assert result.visualization_room == "cocina"


def test_protocol_serializes_preferred_room_id_only_for_successful_execution():
    source = (
        "principal { habitacion sala(5,4,3){} habitacion cocina(4,3,3){} "
        "visualizar3D(cocina)>> }"
    )
    response = RequestDispatcher().dispatch({
        "protocolVersion": "1.0.0",
        "requestId": "visualize-1",
        "operation": "execute",
        "entryFile": "principal.lumi",
        "files": {"principal.lumi": source},
    })
    result = response["result"]
    cocina = next(room for room in result["scenePlan"]["rooms"] if room["name"] == "cocina")
    assert result["preferredRoomId"] == cocina["id"]
    assert len(result["scenePlan"]["rooms"]) == 2


def test_without_visualize_keeps_preference_absent():
    result = execute("habitacion sala(5,4,3){} habitacion cocina(4,3,3){}")
    assert result.succeeded
    assert result.visualization_room is None

