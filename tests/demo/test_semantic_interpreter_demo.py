from demos.semantic_interpreter_demo import run_demo


def test_advance_demo_output(capsys):
    exit_code = run_demo()
    output = capsys.readouterr().out

    assert exit_code == 0
    assert "Salida: 0" in output
    assert "Salida: mitad" in output
    assert "Salida: 2" in output
    assert "SEM_TYPE_MISMATCH" in output
    assert "principal.lumi:12:5" in output
