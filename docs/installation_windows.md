# Instalar Estudio Lumi en Windows

## Requisitos y alcance

El instalador actual está destinado a Windows x64. Incluye Electron, el IDE y
CPython 3.13.14 con los módulos necesarios para el worker Lumi. No requiere instalar
Node.js, Python ni las herramientas de desarrollo. El visor requiere WebGL y un
controlador gráfico compatible; no se ha establecido una versión mínima de Windows
mediante una matriz de equipos de prueba.

El artefacto no tiene firma de editor de confianza. La instalación y desinstalación
se han ejercitado mediante automatización local en Windows x64; siguen pendientes
las comprobaciones interactivas en una computadora limpia sin Python.

## Instalar y abrir

1. Obtén `Estudio-Lumi-0.1.0-x64-setup.exe` de una distribución de confianza.
   Este repositorio no configura publicación automática ni un enlace de descarga.
2. Guarda tus proyectos fuera de la carpeta de instalación, por ejemplo en una
   carpeta propia dentro de Documentos.
3. Ejecuta el instalador. La configuración NSIS instala para el usuario actual,
   sin asistente de selección de directorio y sin solicitar instalación global.
4. Abre **Estudio Lumi** desde el menú Inicio o el acceso directo disponible.
   El instalador no inicia la aplicación automáticamente.
5. Comprueba que la interfaz indique **Modo Python real**. Crea un proyecto y
   ejecuta el ejemplo del [manual](user_manual.md#analizar-y-ejecutar).

Windows o el antivirus pueden advertir sobre un ejecutable sin firma. Comprueba
su procedencia y, si el distribuidor facilita un SHA-256, contrástalo antes de
continuar. No desactives las protecciones del sistema para instalarlo.

## Desinstalar y conservar el trabajo

1. Guarda los archivos y cierra Estudio Lumi.
2. En **Configuración de Windows → Aplicaciones**, busca **Estudio Lumi** y elige
   **Desinstalar**. También puede utilizarse el desinstalador de su carpeta instalada.
3. Los proyectos guardados fuera de la instalación se conservan. Los metadatos del
   perfil también se conservan: desinstalar no es un procedimiento de borrado de
   datos personales. Los cambios que solo estaban en memoria no son archivos guardados.

El IDE impide elegir su carpeta de instalación como ubicación de proyectos. No
copies fuentes allí manualmente. Mantén una copia de seguridad de tus carpetas;
el instalador no proporciona un sistema de respaldo.

## Si no inicia o no encuentra Python

Cierra todas las instancias y reinstala el paquete desde su distribución original.
La versión instalada utiliza su propio runtime: instalar otro Python o cambiar
`LUMI_PYTHON` no repara un componente faltante del paquete. Los errores técnicos
del worker se registran en `backend.log` dentro del perfil `userData` de Electron.
No compartas ese registro sin revisar si contiene rutas o información del proyecto.

Para generar el instalador desde el repositorio, consulta
[empaquetado de Windows](windows_packaging.md). Para trabajar con fuentes o
importar escenas, continúa con el [manual de usuario](user_manual.md).
