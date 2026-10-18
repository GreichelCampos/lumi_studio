"""Run real Lumi source through the application facade, without UI or JSON IPC."""

from services.compiler_service import CompilerService
from services.execution_service import ExecutionService


def run_demo() -> int:
    compiler = CompilerService()
    executor = ExecutionService(compiler)
    compilation = compiler.compile_project(
        {
            "principal.lumi": (
                'importar "utilidades.lumi" usar sumar>>\n'
                'mostrar("Inicio")>>\nmostrar(sumar(4, 5))>>'
            ),
            "utilidades.lumi": (
                "funcion entero sumar(entero a, entero b) { retornar a + b>> }"
            ),
        },
        entry_file="principal.lumi",
    )
    print(f"Análisis: {compilation.status.value}")
    execution = executor.execute(compilation)
    print(f"Ejecución: {execution.status.value}")
    for line in execution.output:
        print(f"Salida: {line}")

    failed = executor.execute_source("mostrar(4 / 0)>>", "error.lumi")
    print(f"Ejecución con error: {failed.status.value}")
    for diagnostic in failed.diagnostics:
        print(
            f"[{diagnostic.code}] "
            f"{diagnostic.file}:{diagnostic.line}:{diagnostic.column} "
            f"{diagnostic.description}"
        )
    return 0 if execution.succeeded and failed.diagnostics else 1


if __name__ == "__main__":
    raise SystemExit(run_demo())
