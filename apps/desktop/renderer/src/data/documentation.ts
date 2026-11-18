export interface DocumentationSection {
  title: string;
  exampleKind: 'executable' | 'syntax-only' | 'informational';
  description: string;
  code: string;
}

export interface KeywordDoc {
  code: string;
  word: string;
  category: string;
  desc: string;
}

export const LUMI_KEYWORDS: KeywordDoc[] = [
  { word: 'principal', category: 'Estructura', desc: 'Define el bloque principal del programa', code: "principal {\n  mostrar(\"Hola\")>>\n}" },
  { word: 'habitacion', category: 'Espacio', desc: 'Declara una habitación con dimensiones (ancho, largo, alto)', code: "habitacion sala(6, 5, 3) {}" },
  { word: 'piso', category: 'Espacio', desc: 'Declara un piso con nombre y propiedades color o material', code: "piso suelo { material \"madera\">> }" },
  { word: 'pared', category: 'Espacio', desc: 'Declara una pared con orientación norte, sur, este u oeste', code: "pared norte { orientacion \"norte\">> }" },
  { word: 'puerta', category: 'Aperturas', desc: 'Declara una abertura en una pared con orientación y medidas', code: "puerta acceso { orientacion \"norte\">> ancho 1>> alto 2>> desplazamiento 1>> }" },
  { word: 'ventana', category: 'Aperturas', desc: 'Declara una abertura en una pared con orientación y medidas', code: "ventana luz { orientacion \"sur\">> ancho 1>> alto 1>> desplazamiento 1>> elevacion 1>> }" },
  { word: 'colocar', category: 'Transformación', desc: 'Posiciona un objeto 3D en coordenadas [x, y, z]', code: "colocar asiento [0, 0, 0]>>" },
  { word: 'rotar', category: 'Transformación', desc: 'Aplica rotación [rx, ry, rz] a una entidad', code: "rotar asiento [0, 90, 0]>>" },
  { word: 'mover', category: 'Transformación', desc: 'Reemplaza la posición absoluta de un objeto previamente colocado', code: "mover asiento [1, 0, 0]>>" },
  { word: 'si / sino', category: 'Control', desc: 'Estructura condicional lógica', code: "si cantidad > 0 { mostrar(\"Hay sillas\")>> } sino { mostrar(\"Sin sillas\")>> }" },
  { word: 'hacer', category: 'Control', desc: 'Ciclo de iteración delimitado por cabecera con punto y coma (;)', code: "hacer entero i = 0; i < 3; i = i + 1 { mostrar(i)>> }" },
  { word: 'mientras', category: 'Control', desc: 'Ciclo condicional iterativo', code: "entero i = 0>>\nmientras i < 3 { mostrar(i)>> i = i + 1>> }" },
  { word: 'nulo', category: 'Valor', desc: 'Representa ausencia de valor; comparable solo con == y !=', code: "nulo resultado = nulo>>\nmostrar(resultado == nulo)>>" },
  { word: 'mostrar', category: 'E/S', desc: 'Emite texto o datos a la consola del IDE', code: "mostrar(\"Hola\")>>" },
  { word: 'leer', category: 'E/S', desc: 'Pide un dato y continúa cuando la persona responde', code: "texto nombre = leer(\"Nombre\")>>" },
  { word: 'entero / decimal', category: 'Tipos', desc: 'Números sin parte fraccionaria y con punto decimal, por ejemplo 4 y 2.5', code: "entero cantidad = 4>>\ndecimal ancho = 5.5>>" },
  { word: 'texto', category: 'Tipos', desc: 'Cadena entre comillas dobles, por ejemplo "sala"', code: "texto nombre = \"Sala\">>" },
  { word: 'booleano', category: 'Tipos', desc: 'Representa verdadero o falso para condiciones', code: "booleano disponible = verdadero>>" },
  { word: 'lista', category: 'Tipos', desc: 'Agrupa elementos entre corchetes y separados por comas', code: "lista colores = [\"azul\", \"rojo\"]>>" },
  { word: 'vector', category: 'Tipos', desc: 'Contiene exactamente tres componentes [x, y, z]', code: "vector punto = [1, 0, 2]>>" },
  { word: 'funcion / retornar', category: 'Funciones', desc: 'Declara una función con tipo de retorno. Usá vacio para una función sin resultado', code: "funcion entero doble(entero n) { retornar n * 2>> }\nprincipal { mostrar(doble(3))>> }" },
  { word: 'importar / usar', category: 'Proyectos', desc: 'Incorpora una función de otro archivo .lumi del proyecto', code: "importar \"calculos.lumi\" usar doble>>\nprincipal { mostrar(doble(3))>> }" },
  { word: 'segun / caso / defecto', category: 'Control', desc: 'Elige un bloque según el valor de una expresión', code: "texto acabado = \"madera\">>\nsegun acabado { caso \"madera\": mostrar(\"Madera\")>> defecto: mostrar(\"Otro\")>> }" },
  { word: 'y / o / no', category: 'Operaciones', desc: 'Combinan o invierten valores booleanos', code: "booleano visible = verdadero y no falso>>\nmostrar(visible o falso)>>" },
  { word: 'visualizar3D', category: 'Render', desc: 'Selecciona la habitación inicial del visor después de ejecutar, por ejemplo visualizar3D(sala)>>', code: "principal { habitacion sala(6, 5, 3) {} visualizar3D(sala)>> }" },
];

export const LUMI_DOCUMENTATION_SECTIONS: DocumentationSection[] = [
  {
    title: 'Una habitación con piso',
    exampleKind: 'executable',
    description: 'Compilar (F5) analiza el archivo principal. Ejecutar Lumi (F6) corre ese archivo y genera la habitación con su piso. Los pasos espaciales se pueden revisar en el depurador. El visor también acepta archivos .lumic válidos.',
    code: `principal {
  habitacion sala(5.0, 4.0, 2.7) {
    piso suelo {
      material "madera">>
      color "#C8A27A">>
    }
  }
}`
  },
  {
    title: 'Variables, listas y vectores',
    exampleKind: 'executable',
    description: 'Lumi permite declarar y evaluar tipos primitivos, listas, vectores y el tipo nulo. Las listas pueden mostrarse en la consola. Las variables vectoriales pueden reutilizarse como operandos de colocar, mover y rotar.',
    code: `-- Declaraciones de tipos primitivos y compuestos
entero cantidad_sillas = 4>>
decimal factor_escala = 1.25>>
texto estilo_decoracion = "minimalista">>
booleano iluminacion_dia = verdadero>>
vector origen_sala = [0.0, 0.0, 0.0]>>
lista colores_disponibles = ["blanco", "gris", "azul"]>>

-- Variable de tipo nulo
nulo seleccion = nulo>>

principal {
  si seleccion == nulo {
    mostrar("No se seleccionó ningún elemento inicial")>>
  }
  mostrar(colores_disponibles)>>
  habitacion muestra(5, 4, 3) {
    mesa mesa_muestra {}
    colocar mesa_muestra origen_sala>>
    mover mesa_muestra [1, 0, 1]>>
    rotar mesa_muestra [0, 45, 0]>>
  }
}`
  },
  {
    title: 'Paredes, aberturas y muebles',
    exampleKind: 'executable',
    description: 'Ejecutar Lumi dibuja el piso, la pared, la puerta, la ventana y los muebles. La pared requiere orientacion. La puerta y la ventana también requieren ancho, alto y desplazamiento. La ventana requiere elevacion.',
    code: `principal {
    habitacion sala(8, 6, 3) {
        piso piso_sala {
            color "gris">>
            material "ceramica">>
        }
        pared pared_norte {
            orientacion "norte">>
            color "blanco">>
            material "concreto">>
        }
        puerta entrada {
            orientacion "norte">>
            ancho 1>>
            alto 2.1>>
            desplazamiento 0.5>>
            material "madera">>
        }
        ventana ventana_sur {
            orientacion "sur">>
            ancho 1.5>>
            alto 1>>
            desplazamiento 3>>
            elevacion 1>>
            material "vidrio">>
        }
        mesa mesa_central {
            color "cafe">>
            material "madera">>
        }
        silla silla_visita {
            color "azul">>
        }

        colocar mesa_central [0, 0, 0]>>
        colocar silla_visita [2, 0, 1]>>
        rotar mesa_central [0, 45, 0]>>
    }
}`
  },
  {
    title: 'Ciclo hacer y llamadas a funciones',
    exampleKind: 'executable',
    description: 'El punto y coma separa las cláusulas del ciclo hacer. Compilar revisa este programa; Ejecutar Lumi muestra 0, 1 y 2 en la consola.',
    code: `funcion vacio mostrar_contadores(entero total) {
  hacer entero i = 0; i < total; i = i + 1 {
    mostrar(i)>>
  }
}
principal {
  mostrar_contadores(3)>>
}`
  },
  {
    title: 'Depuración y validación espacial',
    exampleKind: 'informational',
    description: 'El depurador muestra la escena en cada paso espacial. También puede reproducir pasos de archivos .lumic compatibles. La validación espacial comprueba colisiones, elementos fuera de límites y puertas bloqueadas antes de publicar una escena válida.',
    code: `-- Esta sección es informativa, no un programa de depuración.
-- Los colores muestran el estado del paso reproducido.
-- Los errores de ejecución aparecen en Diagnósticos.
-- Compilar revisa; Ejecutar Lumi ejecuta las instrucciones admitidas.`
  },
  {
    title: "Declarar y actualizar variables",
    exampleKind: 'executable',
    description: "Declarar crea una variable con su tipo. Al asignar otro valor se usa el nombre sin repetir el tipo. Este ejemplo muestra 5 y completado.",
    code: `principal {
    entero cantidad = 2>>
    cantidad = cantidad + 3>>

    texto estado = "pendiente">>
    estado = "completado">>

    mostrar("Cantidad final:")>>
    mostrar(cantidad)>>
    mostrar("Estado final:")>>
    mostrar(estado)>>
}`,
  },
  {
    title: "Operaciones aritméticas y comparaciones",
    exampleKind: 'executable',
    description: "Usá +, -, * y / para calcular. El resultado de ==, !=, <, >, <= o >= es booleano. Los paréntesis agrupan expresiones.",
    code: `principal {
    decimal ancho = 6.0>>
    decimal largo = 4.0>>

    decimal suma = ancho + largo>>
    decimal resta = ancho - largo>>
    decimal area = ancho * largo>>
    decimal division = ancho / largo>>

    mostrar(suma)>>
    mostrar(resta)>>
    mostrar(area)>>
    mostrar(division)>>
}`,
  },
  {
    title: "Operaciones lógicas",
    exampleKind: 'executable',
    description: "y exige que ambas condiciones sean verdaderas. o acepta al menos una. no invierte el valor booleano.",
    code: `principal {
    booleano tiene_puerta = verdadero>>
    booleano tiene_ventana = falso>>

    mostrar(tiene_puerta y tiene_ventana)>>
    mostrar(tiene_puerta o tiene_ventana)>>
    mostrar(no tiene_ventana)>>
}`,
  },
  {
    title: "Condición si y alternativa sino",
    exampleKind: 'executable',
    description: "La condición debe ser booleana. Las llaves delimitan cada bloque y la sangría facilita leerlo.",
    code: `principal {
    decimal ancho = 3.0>>

    si ancho >= 5 {
        mostrar("Habitacion amplia")>>
    } sino {
        mostrar("Habitacion compacta")>>
    }
}`,
  },
  {
    title: "Elegir entre varios casos con segun",
    exampleKind: 'executable',
    description: "Cada caso lleva dos puntos. defecto se usa cuando ningún caso coincide.",
    code: `principal {
    texto material_elegido = "madera">>

    segun material_elegido {
        caso "madera":
            mostrar("Material de madera")>>
        caso "ceramica":
            mostrar("Material de ceramica")>>
        caso "marmol":
            mostrar("Material de marmol")>>
        defecto:
            mostrar("Material desconocido")>>
    }
}`,
  },
  {
    title: "Ciclo mientras",
    exampleKind: 'executable',
    description: "El cuerpo se repite mientras la condición sea verdadera. Actualizá la variable que controla cuándo termina.",
    code: `principal {
    entero cantidad = 0>>

    mientras cantidad < 4 {
        mostrar(cantidad)>>
        cantidad = cantidad + 1>>
    }
}`,
  },
  {
    title: "Leer un dato y mostrarlo",
    exampleKind: 'executable',
    description: "Ejecutá el ejemplo y escribí un nombre cuando aparezca el formulario. La consola muestra la respuesta.",
    code: `principal {
    texto nombre = leer("Escriba su nombre:")>>
    mostrar("Nombre recibido:")>>
    mostrar(nombre)>>
}`,
  },
];

export const LUMI_COMMON_ERRORS = [
  {
    title: 'Falta un valor o el cierre de una instrucción',
    advice: 'Después de = escribí un valor del tipo declarado. Cerrá el texto con comillas, las llamadas con ) y las instrucciones simples con >>.',
    code: 'principal {\n  entero cantidad = 4>>\n  mostrar("Cantidad")>>\n}',
  },
  {
    title: 'Paréntesis, corchetes y comas',
    advice: 'Las dimensiones de una habitación van entre paréntesis. Un vector va entre corchetes y lleva tres componentes separados por comas. Las listas también usan corchetes y comas.',
    code: 'principal {\n  habitacion sala(5, 4, 3) {}\n  vector punto = [1, 0, -2]>>\n  lista colores = ["azul", "rojo"]>>\n}',
  },
  {
    title: 'Parámetros y argumentos de funciones',
    advice: 'En la declaración, cada parámetro lleva tipo y nombre. Separá los parámetros y los argumentos de la llamada con comas.',
    code: `funcion entero suma(entero a, entero b) {
  retornar a + b>>
}
principal { mostrar(suma(1, 2))>> }`,
  },
  {
    title: 'Ciclos y bloques',
    advice: 'En hacer, separá la inicialización, la condición y la actualización con punto y coma. Usá llaves para indicar qué se repite.',
    code: `principal {
  hacer entero i = 0; i < 3; i = i + 1 {
    mostrar(i)>>
  }
}`,
  },
  {
    title: 'Tipos incompatibles y dimensiones inválidas',
    advice: 'Si una variable es entero, su valor no puede ser texto. Las tres dimensiones de una habitación deben ser mayores que cero.',
    code: 'principal {\n  entero cantidad = 4>>\n  texto nombre = "Sala">>\n  habitacion sala(5, 4, 3) {}\n}',
  },
];

export const LUMI_PROJECT_EXAMPLES = [
  { title: 'principal.lumi', description: 'Marcalo como principal en el explorador. Al ejecutarlo, la consola muestra 12.',
    code: `importar "calculos.lumi" usar doble>>
principal {
  mostrar(doble(6))>>
}` },
  { title: 'calculos.lumi', description: 'Guardá este archivo junto a principal.lumi. El parámetro valor existe dentro de la función. retornar entrega el resultado a quien la llamó.',
    code: `funcion entero doble(entero valor) {
  retornar valor * 2>>
}` },
];

export const LUMI_DEBUG_GUIDE = [
  { title: 'Ejecutá una habitación', expected: 'El visor muestra sala con la silla en [1, 0, 0].', troubleshooting: 'Si falta la escena, comprobá el archivo principal, el programa completo y Diagnósticos.', advice: 'Pegá este programa en el archivo principal y pulsá Ejecutar Lumi (F6). La escena final muestra la silla desplazada.',
    code: `principal {
  habitacion sala(5, 4, 3) {
    silla asiento {}
    colocar asiento [0, 0, 0]>>
    mover asiento [1, 0, 0]>>
  }
}` },
  { title: 'Avanzá por los pasos', expected: 'El contador cambia y el visor muestra el estado del paso seleccionado.', troubleshooting: 'Si indica Paso 0 de 0, usá Ejecutar Lumi con el programa del primer paso.', advice: 'Abrí Depurador espacial en la consola. Usá Paso anterior y Paso siguiente o Reproducir paso a paso. El visor muestra cómo estaba la habitación en el paso elegido.',
    code: 'colocar asiento [0, 0, 0]>>' },
  { title: 'Inspeccioná el objeto y su código', expected: 'El paso de mover corresponde a la posición [1, 0, 0] y muestra su ubicación en el código.', troubleshooting: 'Si no hay datos del mueble, avanzá hasta su colocación. Una declaración sin colocar todavía no dibuja el objeto.', advice: 'Buscá el paso de mover. Revisá la línea activa y la posición del objeto. Si el paso tiene una referencia al código, podés ir a esa línea.',
    code: 'mover asiento [1, 0, 0]>>' },
  { title: 'Probá una coordenada fuera de la sala', expected: 'Diagnósticos muestra que el asiento queda fuera de los límites. Al corregir y ejecutar vuelve la escena válida.', troubleshooting: 'Si no aparece el error, comprobá que cambiaste el mover del archivo principal y ejecutaste de nuevo.', advice: 'Cambiá el movimiento a este valor y volvé a ejecutar. El diagnóstico indica que el asiento salió de la habitación. Volvé a usar [1, 0, 0] y revisá la escena.',
    code: 'mover asiento [20, 0, 0]>>' },
];


export interface HelpProcedure {
  title: string;
  action: string;
  expected: string;
  troubleshooting: string;
  code?: string;
}

export const LUMI_FIRST_STEPS: HelpProcedure[] = [
  {
    title: 'Crear un proyecto',
    action: 'Abrí Archivo → Nuevo proyecto... Escribí MiPrimeraSala, pulsá Elegir carpeta... y seleccioná dónde guardar el proyecto. Pulsá Crear proyecto.',
    expected: 'El explorador muestra el proyecto y abre principal.lumi.',
    troubleshooting: 'Si no se crea, revisá el nombre, la ubicación y el aviso del formulario. Elegí una carpeta donde tengás permiso para guardar.',
  },
  {
    title: 'Identificar el archivo principal',
    action: 'Abrí principal.lumi y comprobá la etiqueta Principal en el explorador. Si todavía no es el principal, abrí sus Opciones de archivo y elegí Establecer como principal.',
    expected: 'Ese archivo queda marcado como principal. Compilar y Ejecutar Lumi lo usan aunque después seleccionés otra pestaña.',
    troubleshooting: 'Si se ejecuta otro programa o se solicita un principal, revisá qué archivo está marcado en el explorador.',
  },
  {
    title: 'Editar el programa',
    action: 'Usá Copiar código, cerrá la ayuda con Entendido y pegá este programa completo en principal.lumi. Podés volver a consultar F1 en cualquier momento.',
    expected: 'El editor contiene el bloque principal, la habitación sala, el piso suelo y la silla asiento colocada en el centro.',
    troubleshooting: 'Revisá las llaves, las comas y los cierres >>. El vector de colocar usa corchetes y exactamente tres componentes.',
    code: `principal {
  mostrar("Mi primera sala")>>
  habitacion sala(6, 5, 3) {
    piso suelo {
      material "madera">>
    }
    silla asiento {
      color "azul">>
    }
    colocar asiento [0, 0, 0]>>
  }
}`,
  },
  {
    title: 'Guardar el archivo',
    action: 'Elegí Archivo → Guardar archivo actual o pulsá Ctrl+S.',
    expected: 'El estado del editor indica Guardado y el programa queda escrito en principal.lumi dentro de la carpeta del proyecto.',
    troubleshooting: 'Si sigue modificado o aparece un aviso, revisá que la carpeta exista y permita escribir. Conservá el contenido del editor hasta resolver el guardado.',
  },
  {
    title: 'Compilar el proyecto',
    action: 'Pulsá Compilar o F5.',
    expected: 'La consola registra el resultado del análisis. Este programa termina sin errores. El análisis por sí solo no abre una escena nueva.',
    troubleshooting: 'Si falla, abrí Diagnósticos, leé la descripción y usá Ir al código para corregir la línea y columna señaladas. Después volvé a compilar.',
  },
  {
    title: 'Ejecutar y comprobar el resultado',
    action: 'Pulsá Ejecutar Lumi o F6. En Salida buscá Mi primera sala y revisá la ventana del visor 3D.',
    expected: 'La consola muestra Mi primera sala. El visor contiene una habitación de 6 × 5 × 3 metros, un piso de madera y una silla azul. Un clic en la silla permite revisar sus propiedades.',
    troubleshooting: 'Si falta el texto o la escena, revisá Diagnósticos y el archivo principal. Si la silla no se ve, comprobá colocar asiento [0, 0, 0]>> y usá Restablecer cámara isométrica.',
  },
];

export const LUMI_IDE_PROCEDURES: HelpProcedure[] = [
  {
    title: 'Insertar una habitación desde el formulario',
    action: 'Elegí Insertar → Habitación... o Alt+H. Completá el nombre y las dimensiones, revisá Código Lumi generado y pulsá Insertar en el editor.',
    expected: 'La plantilla aparece en el archivo activo. Si la vas a ejecutar, ubicá la declaración dentro del bloque principal del archivo principal.',
    troubleshooting: 'Si no se inserta, revisá los avisos del formulario y que haya un archivo abierto. Si ya existe una habitación con ese nombre, elegí otro nombre antes de ejecutar.',
  },
  {
    title: 'Proyectos y archivos',
    action: 'Usá Archivo → Abrir proyecto... y Abrir carpeta del disco... para trabajar con una carpeta existente. Nuevo archivo .lumi agrega un archivo al proyecto. Las Opciones de archivo permiten renombrar, eliminar y Establecer como principal. Guardar todos los cambios escribe los archivos modificados.',
    expected: 'El explorador y las pestañas muestran los archivos del proyecto. El principal sigue identificado al abrir un módulo. Al cerrar una pestaña modificada, podés Guardar, Descartar o Cancelar.',
    troubleshooting: 'Si una importación falla, verificá que ambos archivos pertenezcan al proyecto y que la ruta y la función coincidan. Antes de descartar, comprobá si necesitás conservar el borrador.',
  },
  {
    title: 'Compilar y Ejecutar Lumi',
    action: 'Usá Compilar (F5) para analizar el principal y sus importaciones. Usá Ejecutar Lumi (F6) para evaluar las instrucciones del programa y obtener su salida y escena.',
    expected: 'Compilar informa problemas de sintaxis y tipos. Ejecutar Lumi puede pedir datos, escribir en Salida y abrir el visor. Algunas comprobaciones dependen de los valores calculados al ejecutar.',
    troubleshooting: 'Un análisis sin errores no garantiza que una división tenga divisor distinto de cero o que todos los muebles queden dentro de la sala. Si falla F6, revisá el diagnóstico de ejecución.',
  },
  {
    title: 'Responder a leer',
    action: 'Ejecutá el ejemplo y escribí un nombre en Respuesta. Pulsá Enviar entrada. Para detener el programa mientras espera datos, elegí Cancelar ejecución.',
    expected: 'Después de enviar, el programa continúa y Salida muestra el nombre. Compilar no abre el formulario de entrada.',
    troubleshooting: 'Si el programa está esperando, revisá si el formulario Entrada del programa Lumi está abierto. leer devuelve texto; usá una variable de tipo texto para guardar la respuesta.',
    code: `principal {
  texto nombre = leer("¿Cómo te llamás?")>>
  mostrar(nombre)>>
}`,
  },
  {
    title: 'Navegar e inspeccionar el visor',
    action: 'Usá Acercar cámara, Alejar cámara y Restablecer cámara isométrica. Hacé clic en la vista para usar las flechas de desplazamiento; la rueda acerca la cámara al cursor. Elegí una habitación en el selector si hay varias. Seleccioná un mueble colocado y usá Ir al código en sus propiedades para abrir su declaración.',
    expected: 'La cámara cambia de encuadre y la tarjeta muestra los datos del elemento seleccionado. Ir al código navega al archivo y la línea de su declaración.',
    troubleshooting: 'Si no podés enfocar un mueble, comprobá que esté colocado y pertenezca a la habitación seleccionada. Si la vista quedó lejos, usá Restablecer cámara isométrica.',
  },
  {
    title: 'Ajustes y captura de la escena',
    action: 'En Configuración del IDE → Visor 3D y gráficos ajustá cuadrícula, ejes, cotas, iluminación y calidad. La barra del visor tiene Mostrar u ocultar ejes coordenados, Mostrar u ocultar cotas métricas, Modo alámbrico y controles de iluminación. Capturar imagen PNG guarda una imagen de la vista.',
    expected: 'El visor refleja los ajustes. La captura descarga una imagen PNG con el encuadre actual.',
    troubleshooting: 'Si la escena pierde fluidez, elegí Alto Rendimiento y reducí la cantidad de muebles. Si la imagen no aparece, revisá la ubicación de descargas y que exista una escena visible.',
  },
  {
    title: 'Exportar y abrir una escena lumic',
    action: 'Después de ejecutar un programa con habitaciones, usá Archivo → Exportar escena (.lumic)... Para consultar ese archivo, elegí Abrir escena (.lumic)... y seleccionalo.',
    expected: 'La exportación guarda la escena del resultado actual. Abrir un .lumic muestra los datos almacenados en el archivo; no ejecuta de nuevo el programa .lumi. Solo incluye pasos de depuración si el archivo los contiene.',
    troubleshooting: 'Si no se puede exportar, ejecutá un programa con una escena válida. Si falla la apertura, leé el aviso de validación y comprobá que elegiste un archivo .lumic compatible.',
  },
  {
    title: 'Revisar el depurador espacial',
    action: 'Ejecutá una habitación y abrí Depurador espacial. Usá Paso siguiente, Paso anterior, Ir al inicio (Paso 1), Ir al paso final y Reiniciar depuración. Reproducir paso a paso inicia el recorrido y Pausar depuración lo detiene. Podés cambiar la velocidad con los controles disponibles.',
    expected: 'El contador avanza y el visor muestra la escena registrada en cada paso espacial. La línea y el objeto asociados permiten relacionar el código con lo que cambió. El recorrido de la pestaña Depurador espacial de esta ayuda muestra un ejemplo.',
    troubleshooting: 'Si indica Paso 0 de 0, verificá que ejecutaste un programa que cree una escena. Compilar no genera pasos de ejecución. Un archivo .lumic puede no contener pasos. La reproducción recorre estados registrados y no vuelve a pedir datos de leer.',
  },
  {
    title: 'Resolver errores y recuperar la escena',
    action: 'Abrí Diagnósticos y consultá el archivo, la línea, la columna, la descripción y la solución cuando exista. Usá Ir al código, corregí el programa y pulsá Ejecutar Lumi otra vez.',
    expected: 'Al corregir, el resultado nuevo reemplaza el anterior. Un programa que no supera las validaciones muestra el diagnóstico correspondiente.',
    troubleshooting: 'Si borraste parte de una línea, revisá también el símbolo anterior al marcado. Para vectores usá [x, y, z]; para dimensiones usá (ancho, largo, alto). Si falta una propiedad obligatoria de pared, puerta o ventana, consultá Ejemplos.',
  },
  {
    title: 'Atajos de teclado',
    action: 'F1 abre la ayuda. F5 compila. F6 ejecuta. Ctrl+N abre Nuevo archivo .lumi; Ctrl+O abre Abrir proyecto...; Ctrl+S guarda el actual; Ctrl+Shift+S guarda todos; Ctrl+E exporta la escena; Ctrl+Shift+O abre la selección de .lumic; Ctrl+, abre Configuración; Alt+H abre Habitación...',
    expected: 'El atajo abre el mismo flujo que el botón o el menú correspondiente. Escape cierra la ayuda y los formularios que admiten cancelación.',
    troubleshooting: 'Cerrá el formulario activo antes de usar un atajo del editor. Si el teclado de tu equipo reserva las teclas F, usá la combinación Fn correspondiente o elegí la acción desde el menú.',
  },
];
