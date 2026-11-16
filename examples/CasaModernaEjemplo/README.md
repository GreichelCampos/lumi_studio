# CasaModernaEjemplo

Ejemplo ampliado de una vivienda moderna construido únicamente con la sintaxis y el catálogo disponibles en Lumi Studio.

## Cómo abrirlo

1. Abra la carpeta `examples/CasaModernaEjemplo` como proyecto.
2. Seleccione `principal.lumi` como archivo principal.
3. Use F5 para compilar y analizar.
4. Use F6 para ejecutar y generar la escena 3D.
5. Use el depurador espacial para recorrer declaraciones, colocaciones y rotaciones.

## Distribución

El proyecto contiene sala, cocina, comedor para seis personas, dormitorio principal, dos dormitorios secundarios, dos baños, lavandería, pasillo, terraza, cochera y jardín. Cada espacio utiliza dimensiones en metros, pisos, aberturas y mobiliario compatibles con el backend real.

Las funciones `organizar_comedor()` y `amueblar_terraza()` muestran que las funciones Lumi pueden producir efectos espaciales dentro de la habitación activa.

## Catálogo utilizado

Se utilizan sofá, mesas, sillas, plantas, camas, escritorios, lámparas, estanterías, armarios, cuadro y alfombra. Los colores y materiales son propiedades visuales; las dimensiones físicas proceden del catálogo oficial de Lumi 1.0.

## Limitaciones reales

- Lumi todavía no dispone de electrodomésticos, sanitarios, lavadora, automóvil ni mobiliario exterior especializado. Por eso esos objetos no se simulan con nombres inventados.
- Las habitaciones no tienen una posición global dentro de una planta arquitectónica. El visor organiza cada habitación de forma independiente.
- Terraza y jardín se representan como habitaciones espaciales porque el contrato actual no define áreas exteriores abiertas.
- `cuadro`, `alfombra` y algunos muebles sin geometría especializada pueden aparecer con la geometría genérica del visor, aunque sí tienen dimensiones físicas en el catálogo backend.
- El portón de cochera utiliza el elemento `puerta`; Lumi aún no distingue tipos especializados de abertura.

## Resultado esperado

F5 debe finalizar sin diagnósticos. F6 debe imprimir `Casa moderna preparada`, producir trece espacios y conservar todas las colocaciones sin colisiones, objetos fuera de límites ni puertas bloqueadas. La disponibilidad de la traza depende además de los límites públicos de 1000 pasos y 4 MiB de respuesta.
