# Paquete de Estudio Lumi para Windows

El paquete utiliza Electron 44.8.0, electron-builder 26.15.3 y CPython embebido
3.13.14 para Windows x64. El instalador NSIS es por usuario, no requiere instalar
Python ni Node.js y conserva los proyectos y los metadatos al desinstalar.
La versión declarada sigue siendo 0.1.0. El instalador existente es anterior al
flujo espacial combinado: no se ha regenerado ni aceptado ese paquete. La escena
Python real está verificada en Electron de desarrollo; esas pruebas no certifican
el artefacto instalado. Registrar revisión de código y SHA-256 para distinguir builds
con el mismo nombre antes de distribuirlos.

## Generación

Requiere Windows x64, Node.js y las dependencias del repositorio. El gestor
declarado es Bun 1.4.3; `bun.lock` fija las dependencias de Electron.
Con las dependencias ya instaladas, desde `apps/desktop`:

```powershell
npm.cmd run lint
npm.cmd run dist:win
```

`dist:win` compila Electron y React, prepara el runtime y genera:

- `dist/release/Estudio-Lumi-0.1.0-x64-setup.exe`: instalador.
- `dist/release/win-unpacked/Estudio Lumi.exe`: ejecutable sin instalar.
- El archivo `.blockmap` es auxiliar del empaquetador; no se configuró actualización automática.

`npm.cmd run pack:win` genera solo la carpeta ejecutable. Se necesita conexión
durante la primera generación para descargar CPython y las herramientas de
empaquetado. La aplicación distribuida no necesita Vite ni conexión para compilar.
Cerrar los ejecutables de la carpeta de salida antes de regenerar; Windows puede
bloquear sus DLL. No ejecutar empaquetado y pruebas del mismo paquete en paralelo.

## Contenido y rutas

`electron-builder.json` incluye únicamente los bundles de Electron, el frontend
compilado y los recursos declarados. Las dependencias de desarrollo, pruebas,
cachés, referencias locales y mapas de código fuente no se distribuyen.

| Ubicación en el paquete | Contenido |
|---|---|
| `resources/app.asar` | Main, preload y `renderer/dist` |
| `resources/lumi/python` | CPython embebido, biblioteca estándar y licencia |
| `resources/lumi/backend` | Módulos originales `services`, `lumi_language` y `spatial` |
| `resources/lumi/lumi-taskbar-adapted.ico` | Ícono oficial del IDE |

El backend combinado debe incluir `spatial/scene_builder.py` y
`services/protocol/scene_adapter.py`, junto al intérprete y los servicios/protocolo
actualizados. El script copia estos directorios; verificar su contenido contra la
revisión de origen después de generar, no asumir que una carpeta de salida antigua
contiene la integración.

`packaging/python-runtime.json` fija la URL, versión y SHA-256 de CPython.
`scripts/prepare-runtime.mjs` verifica los bytes antes de extraerlos; el valor
esperado se tomó del digest publicado en el archivo Sigstore de Python.org.
Comparar ese digest no sustituye una verificación completa de la firma Sigstore.
El archivo `python313._pth` limita importaciones a la biblioteca estándar y los
módulos incluidos. No se distribuyen pip, paquetes de pruebas ni las dependencias
gráficas del IDE Python antiguo. La fachada actual no requiere paquetes externos.
Si el núcleo introduce nuevas dependencias, deben revisarse explícitamente para
el paquete; no se instala todo `requirements.txt` en el equipo destinatario.

Producción ejecuta el Python incluido con `-I -B -u -m services.worker`, fuera de
ASAR y sin depender del directorio de trabajo, PATH, PYTHONPATH, PYTHONHOME o
LUMI_PYTHON del usuario. Desarrollo conserva su servidor Vite y selección actual
de Python. El frontend empaquetado utiliza `lumi-app://ide/index.html`; el manejador
de recursos y la autorización IPC restringen el origen y las rutas permitidas.

Las geometrías y materiales actuales del visor se construyen localmente.
El build elimina la solicitud de fuentes a Google y utiliza las alternativas
tipográficas del sistema; el editor conserva un respaldo monoespaciado para sus
capas de texto y resaltado. Desarrollo conserva la solicitud original.

La identidad de Windows y de accesos directos es `org.lumi.estudio`.
Los proyectos residen en las carpetas elegidas por el usuario, fuera del directorio
instalado. El IDE empaquetado impide seleccionar carpetas dentro de su instalación
como ubicación de proyectos, para que el desinstalador no elimine sus fuentes.
Los metadatos permanecen en `app.getPath('userData')`; NSIS configura
`deleteAppDataOnUninstall: false`. Los errores técnicos del worker se registran en
`backend.log` dentro de ese perfil. Si falta el runtime, el IDE indica reinstalar
la aplicación y no sustituye Python por el compilador de demostración.

## Verificación del paquete

Desde `apps/desktop`, después de generar y sin otro empaquetado en ejecución:

```powershell
npm.cmd run test:packaged
npm.cmd run test:installer
```

La primera prueba abre el ejecutable real con un perfil temporal y variables de
Python externas inválidas. Comprueba ejecución, análisis, diagnósticos, guardado,
reapertura, importación `.lumic`, WebGL, ícono y error de runtime ausente. Los
ejemplos `.lumic` son fixtures, no escenas generadas por Python.

La prueba actual del paquete no sustituye el E2E de escena runtime: comprueba
análisis de habitación sin escena y visualización de un fixture importado, pero
no ejecuta una habitación hasta el visor. Antes de aceptar el paquete combinado
debe ampliarse esa cobertura o realizarse y registrarse el recorrido real contra
el ejecutable empaquetado: habitación, piso, mueble colocado, mover/rotar, error
espacial y retirada de escena anterior. El script runtime de desarrollo usa Vite
y no puede contabilizarse como prueba del paquete sin adaptar su lanzamiento.

La segunda instala silenciosamente en una carpeta temporal, ejecuta las pruebas
del paquete instalado y desinstala. Se niega a ejecutarse si encuentra una
instalación anterior registrada. Puede crear y retirar accesos directos mediante
el instalador; ejecutarla en una cuenta de prueba. Conserva una carpeta de
evidencia temporal y comprueba que un proyecto externo siga intacto. Las pruebas
utilizan el argumento `--user-data-dir` para aislar sus perfiles.

Generar el instalador no demuestra que instalar/desinstalar funcione. Los
resultados de cada ejecución deben verificarse por separado. Una prueba local
automatizada tampoco sustituye probar en un equipo Windows limpio sin Python,
incluyendo instalación interactiva, permisos, antivirus y reapertura tras reiniciar.
Sin un certificado configurado, el artefacto no ofrece firma de editor de confianza.
No se configura publicación ni se hace push durante la generación.
