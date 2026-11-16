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
  { word: 'habitacion', category: 'Espacio', desc: 'Declara una habitación 3D con dimensiones [ancho, largo, alto]' },
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
    title: '1. Estructura y Filosofía de Lumi',
    exampleKind: 'executable',
    description: 'Analizar código revisa el programa. Ejecutar Lumi genera la habitación y el piso mediante el intérprete real y publica sus pasos espaciales para el depurador. El visor también acepta archivos .lumic válidos.',
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
    title: '2. Tipos de Datos y Manejo de Nulo',
    exampleKind: 'syntax-only',
    description: 'El parser acepta tipos primitivos, listas, vectores y el tipo nulo. Las listas y los vectores declarados como variables todavía no se evalúan en el intérprete; este ejemplo permite comprobar su análisis, no una ejecución completa. Los vectores de colocar, mover y rotar sí se evalúan en operaciones espaciales.',
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
}`
  },
  {
    title: '3. Elementos Arquitectónicos y Muebles',
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
    title: '4. Ciclo "hacer" y Modularidad',
    exampleKind: 'executable',
    description: 'El punto y coma separa las cláusulas del ciclo hacer. Analizar código revisa este programa; Ejecutar Lumi muestra 0, 1 y 2 en la consola.',
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
    title: '5. Depuración Espacial e Innovación',
    exampleKind: 'informational',
    description: 'El IDE reproduce los pasos y snapshots generados por Python, además de archivos .lumic compatibles. La validación espacial comprueba colisiones, elementos fuera de límites y puertas bloqueadas antes de publicar una escena válida.',
    code: `-- Esta sección es informativa, no un programa de depuración.
-- Los colores muestran los estados recibidos por el IDE.
-- Un estado visual no demuestra detección automática de conflictos.
-- Analizar código revisa; Ejecutar Lumi ejecuta las instrucciones admitidas.`
  }
];
