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
  { word: 'leer', category: 'E/S', desc: 'Pide un dato en Electron y continúa cuando la persona responde' },
  { word: 'visualizar3D', category: 'Render', desc: 'Palabra reservada sin instrucción implementada en el parser actual' },
];

export const LUMI_DOCUMENTATION_SECTIONS: DocumentationSection[] = [
  {
    title: 'Una habitación con piso',
    exampleKind: 'executable',
    description: 'Compilar (F5) analiza el archivo principal. Ejecutar Lumi (F6) corre ese archivo y genera la habitación y el piso mediante el intérprete real y publica sus pasos espaciales para el depurador. El visor también acepta archivos .lumic válidos.',
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
    description: 'El IDE reproduce los pasos y snapshots generados por Python, además de archivos .lumic compatibles. La validación espacial comprueba colisiones, elementos fuera de límites y puertas bloqueadas antes de publicar una escena válida.',
    code: `-- Esta sección es informativa, no un programa de depuración.
-- Los colores muestran el estado del paso reproducido.
-- Los errores de ejecución aparecen en Diagnósticos.
-- Compilar revisa; Ejecutar Lumi ejecuta las instrucciones admitidas.`
  }
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
