import json
from pathlib import Path

import pytest

from lumi_language.symbol_table import DataType, Symbol, SymbolKind, SymbolTable


FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    with (FIXTURES / name).open(encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


def symbol_from_declaration(declaration: dict) -> Symbol:
    return Symbol(
        name=declaration["name"],
        kind=SymbolKind.VARIABLE,
        data_type=DataType(declaration["type"]),
        file=declaration["file"],
        line=declaration["line"],
        column=declaration["column"],
    )


def test_defines_and_resolves_declarations():
    fixture = load_fixture("declarations.json")
    table = SymbolTable()

    for declaration in fixture["statements"]:
        assert table.define(symbol_from_declaration(declaration))

    assert table.resolve("cantidad").data_type is DataType.INTEGER
    assert table.resolve("mensaje").data_type is DataType.STRING


def test_rejects_duplicate_in_current_scope():
    fixture = load_fixture("duplicate_declaration.json")
    table = SymbolTable()
    first, duplicate = fixture["statements"]

    assert table.define(symbol_from_declaration(first))
    assert not table.define(symbol_from_declaration(duplicate))
    assert table.resolve("ancho").line == first["line"]


def test_child_scope_resolves_parent_declaration():
    fixture = load_fixture("lexical_scopes.json")
    table = SymbolTable()
    table.define(symbol_from_declaration(fixture["statements"][0]))
    child = table.create_child_scope("if")

    assert child.resolve("cantidad") is table.resolve("cantidad")


def test_child_declaration_is_not_visible_in_parent_scope():
    fixture = load_fixture("lexical_scopes.json")
    child_declaration = fixture["statements"][1]["body"][0]
    table = SymbolTable()
    child = table.create_child_scope("if")
    child.define(symbol_from_declaration(child_declaration))

    assert child.resolve("mensaje") is not None
    assert table.resolve("mensaje") is None


def test_child_scope_can_shadow_parent_declaration():
    fixture = load_fixture("declarations.json")
    outer_symbol = symbol_from_declaration(fixture["statements"][0])
    inner_symbol = Symbol(
        name=outer_symbol.name,
        kind=SymbolKind.VARIABLE,
        data_type=DataType.DECIMAL,
        file="principal.lumi",
        line=5,
        column=5,
    )
    table = SymbolTable()
    table.define(outer_symbol)
    child = table.create_child_scope("block")

    assert child.define(inner_symbol)
    assert child.resolve("cantidad") is inner_symbol
    assert table.resolve("cantidad") is outer_symbol


def test_unresolved_name_returns_none():
    assert SymbolTable().resolve("no_declarada") is None


@pytest.mark.parametrize(
    "source_name, expected_type",
    [
        ("entero", DataType.INTEGER),
        ("decimal", DataType.DECIMAL),
        ("texto", DataType.STRING),
        ("booleano", DataType.BOOLEAN),
    ],
)
def test_simple_data_types(source_name, expected_type):
    assert DataType(source_name) is expected_type
