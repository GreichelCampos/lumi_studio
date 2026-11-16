export interface DocumentationSection {
  title: string;
  exampleKind: 'executable' | 'syntax-only' | 'informational';
  description: string;
  code: string;
}

export interface KeywordDoc {
  word: string;
  category: string;
  desc: string;
}

export const LUMI_KEYWORDS: KeywordDoc[] = [
  { word: 'principal', category: 'Estructura', desc: 'Define el bloque principal del programa' },
  { word: 'habitacion', category: 'Espacio', desc: 'Declara una habitación con dimensiones (ancho, largo, alto)' },
  { word: 'piso', category: 'Espacio', desc: 'Declara un piso con nombre y propiedades color o material' },
  { word: 'pared', category: 'Espacio', desc: 'Declara una pared con orientación norte, sur, este u oeste' },
  { word: 'puerta', category: 'Aperturas', desc: 'Declara una abertura en una pared con orientación y medidas' },
  { word: 'ventana', category: 'Aperturas', desc: 'Declara una abertura en una pared con orientación y medidas' },
  { word: 'colocar', category: 'Transformación', desc: 'Posiciona un objeto 3D en coordenadas [x, y, z]' },
  { word: 'rotar', category: 'Transformación', desc: 'Aplica rotación [rx, ry, rz] a una entidad' },
  { word: 'mover', category: 'Transformación', desc: 'Reemplaza la posición absoluta de un objeto previamente colocado' },
  { word: 'si / sino', category: 'Control', desc: 'Estructura condicional lógica' },
  { word: 'hacer', category: 'Control', desc: 'Ciclo de iteración delimitado por cabecera con punto y coma (;)' },
  { word: 'mientras', category: 'Control', desc: 'Ciclo condicional iterativo' },
  { word: 'nulo', category: 'Valor', desc: 'Representa ausencia de valor; comparable solo con == y !=' },
  { word: 'mostrar', category: 'E/S', desc: 'Emite texto o datos a la consola del IDE' },
  { word: 'leer', category: 'E/S', desc: 'Pide un dato y continúa cuando la persona responde' },
  { word: 'entero / decimal', category: 'Tipos', desc: 'Números sin parte fraccionaria y con punto decimal, por ejemplo 4 y 2.5' },
  { word: 'texto', category: 'Tipos', desc: 'Cadena entre comillas dobles, por ejemplo "sala"' },
  { word: 'booleano', category: 'Tipos', desc: 'Usa verdadero o falso para condiciones' },
  { word: 'lista', category: 'Tipos', desc: 'Agrupa elementos entre corchetes y separados por comas' },
  { word: 'vector', category: 'Tipos', desc: 'Guarda exactamente tres componentes [x, y, z]' },
  { word: 'funcion / retornar', category: 'Funciones', desc: 'Declara una función con tipo de retorno. Usá vacio para una función sin resultado' },
  { word: 'importar / usar', category: 'Proyectos', desc: 'Incorpora una función de otro archivo .lumi del proyecto' },
  { word: 'segun / caso / defecto', category: 'Control', desc: 'Elige un bloque según el valor de una expresión' },
  { word: 'y / o / no', category: 'Operaciones', desc: 'Combinan o invierten valores booleanos' },
  { word: 'visualizar3D', category: 'Render', desc: 'Palabra reservada sin instrucción implementada en el parser actual' },
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

si seleccion == nulo {
  mostrar("No se seleccionó ningún elemento inicial")>>
}

mostrar(colores_disponibles)>>

principal {
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
    code: 'entero cantidad = 4>>\nmostrar("Cantidad")>>',
  },
  {
    title: 'Paréntesis, corchetes y comas',
    advice: 'Las dimensiones de una habitación van entre paréntesis. Un vector va entre corchetes y lleva tres componentes separados por comas. Las listas también usan corchetes y comas.',
    code: 'habitacion sala(5, 4, 3) {}\nvector punto = [1, 0, -2]>>\nlista colores = ["azul", "rojo"]>>',
  },
  {
    title: 'Parámetros y argumentos de funciones',
    advice: 'En la declaración, cada parámetro lleva tipo y nombre. Separá los parámetros y los argumentos de la llamada con comas.',
    code: `funcion entero suma(entero a, entero b) {
  retornar a + b>>
}
mostrar(suma(1, 2))>>`,
  },
  {
    title: 'Ciclos y bloques',
    advice: 'En hacer, separá la inicialización, la condición y la actualización con punto y coma. Usá llaves para indicar qué se repite.',
    code: `hacer entero i = 0; i < 3; i = i + 1 {
  mostrar(i)>>
}`,
  },
  {
    title: 'Tipos incompatibles y dimensiones inválidas',
    advice: 'Si una variable es entero, su valor no puede ser texto. Las tres dimensiones de una habitación deben ser mayores que cero.',
    code: 'entero cantidad = 4>>\ntexto nombre = "Sala">>\nhabitacion sala(5, 4, 3) {}',
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
  { title: 'Ejecutá una habitación', advice: 'Pegá este programa en el archivo principal y pulsá Ejecutar Lumi (F6). La escena final muestra la silla desplazada.',
    code: `principal {
  habitacion sala(5, 4, 3) {
    silla asiento {}
    colocar asiento [0, 0, 0]>>
    mover asiento [1, 0, 0]>>
  }
}` },
  { title: 'Avanzá por los pasos', advice: 'Abrí Depurador en la consola. Usá Paso anterior y Paso siguiente o Reproducir paso a paso. El visor muestra cómo estaba la habitación en el paso elegido.',
    code: 'colocar asiento [0, 0, 0]>>' },
  { title: 'Inspeccioná el objeto y su código', advice: 'Buscá el paso de mover. Revisá la línea activa y la posición del objeto. Si el paso tiene una referencia al código, podés ir a esa línea.',
    code: 'mover asiento [1, 0, 0]>>' },
  { title: 'Probá una coordenada fuera de la sala', advice: 'Cambiá el movimiento a este valor y volvé a ejecutar. El diagnóstico indica que el asiento salió de la habitación. Volvé a usar [1, 0, 0] y revisá la escena.',
    code: 'mover asiento [20, 0, 0]>>' },
];
