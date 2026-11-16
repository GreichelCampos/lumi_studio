from lumi_language.interpreter import Interpreter


def literal(value, literal_kind):
    return {
        "node": "LiteralNode",
        "value": value,
        "literal_kind": literal_kind,
    }


def list_node(*elements):
    return {"node": "ListNode", "elements": list(elements)}


def show(expression):
    return {"node": "ShowNode", "expression": expression}


def test_list_elements_are_evaluated_recursively_in_order():
    evaluated = []

    def provide_input(prompt):
        evaluated.append(prompt)
        return prompt

    expression = list_node(
        {"node": "ReadNode", "message": literal("primero", "texto")},
        list_node(
            {"node": "ReadNode", "message": literal("segundo", "texto")},
        ),
    )

    result = Interpreter(input_provider=provide_input).execute({
        "node": "ProgramNode",
        "statements": [show(expression)],
    })

    assert result.succeeded
    assert evaluated == ["primero", "segundo"]
    assert result.output == ['["primero", ["segundo"]]']


def test_list_format_distinguishes_lumi_value_types():
    expression = list_node(
        literal(1, "entero"),
        literal(2.5, "decimal"),
        literal("texto", "texto"),
        literal(True, "booleano"),
        literal(None, "nulo"),
        list_node(literal("a", "texto"), literal("b", "texto")),
    )

    result = Interpreter().execute({
        "node": "ProgramNode",
        "statements": [
            show(expression),
            show(literal("texto individual", "texto")),
            show(list_node()),
        ],
    })

    assert result.succeeded
    assert result.output == [
        '[1, 2.5, "texto", verdadero, nulo, ["a", "b"]]',
        "texto individual",
        "[]",
    ]
