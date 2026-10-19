export interface DocumentationSection {
  title: string;
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
  { word: 'pared', category: 'Espacio', desc: 'Declara una pared; su orientación todavía requiere especificación' },
  { word: 'puerta', category: 'Aperturas', desc: 'Declara una apertura de acceso en un muro' },
  { word: 'ventana', category: 'Aperturas', desc: 'Declara una apertura de iluminación en un muro' },
  { word: 'colocar', category: 'Transformación', desc: 'Posiciona un objeto 3D en coordenadas [x, y, z]' },
  { word: 'rotar', category: 'Transformación', desc: 'Aplica rotación [rx, ry, rz] a una entidad' },
  { word: 'mover', category: 'Transformación', desc: 'Reemplaza la posición absoluta de un objeto previamente colocado' },
  { word: 'si / sino', category: 'Control', desc: 'Estructura condicional lógica' },
  { word: 'hacer', category: 'Control', desc: 'Ciclo de iteración delimitado por cabecera con punto y coma (;)' },
  { word: 'mientras', category: 'Control', desc: 'Ciclo condicional iterativo' },
  { word: 'nulo', category: 'Valor', desc: 'Representa ausencia de valor; comparable solo con == y !=' },
  { word: 'mostrar', category: 'E/S', desc: 'Emite texto o datos a la consola del IDE' },
  { word: 'leer', category: 'E/S', desc: 'Sintaxis de entrada; la entrada interactiva todavía no está disponible en Electron' },
  { word: 'visualizar3D', category: 'Render', desc: 'Palabra reservada sin instrucción implementada en el parser actual' },
];

export const LUMI_DOCUMENTATION_SECTIONS: DocumentationSection[] = [
  {
    title: '1. Estructura y Filosofía de Lumi',
    description: 'Compilar puede informar análisis espacial incompleto. Ejecutar Python genera la habitación y el piso de este ejemplo mediante el intérprete real. El visor también acepta archivos .lumic válidos; las trazas Python siguen pendientes.',
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
    description: 'El parser acepta tipos primitivos, listas, vectores y nulo. Las listas y los vectores todavía no se evalúan en el intérprete; este ejemplo permite comprobar su análisis, no una ejecución completa.',
    code: `-- Declaraciones de tipos primitivos y compuestos
entero cantidad_sillas = 4>>
decimal factor_escala = 1.25>>
texto estilo_decoracion = "minimalista">>
booleano iluminacion_dia = verdadero>>
vector origen_sala = [0.0, 0.0, 0.0]>>
lista colores_disponibles = ["blanco", "gris", "azul"]>>

-- Variables con valor nulo
entero seleccion = nulo>>

si seleccion == nulo {
  mostrar("No se seleccionó ningún elemento inicial")>>
}`
  },
  {
    title: '3. Elementos Arquitectónicos y Muebles',
    description: 'Declaraciones y vectores admitidos por la gramática. La generación de estos elementos, la orientación de paredes y los tamaños de muebles y aberturas siguen pendientes. Las propiedades color y material se escriben sin dos puntos ni signo igual.',
    code: `habitacion dormitorio(4.5, 4.0, 2.6) {
  piso suelo {
    material "madera">>
  }
  pared muro {
    color "azul">>
  }
  puerta acceso {}
  ventana abertura {}
  cama cama_principal {
    color "blanco">>
  }
  lampara luz {}
  escritorio mesa_trabajo {}
  colocar cama_principal [0.0, 0.0, -0.8]>>
  colocar luz [-1.2, 0.0, -0.8]>>
  colocar mesa_trabajo [1.2, 0.0, 1.1]>>
}`
  },
  {
    title: '4. Ciclo "hacer" y Modularidad',
    description: 'El punto y coma separa las cláusulas del ciclo hacer. Compilar analiza este programa; Ejecutar Python muestra 0, 1 y 2 en la consola.',
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
    description: 'El IDE reproduce pasos y snapshots de archivos .lumic o de la demostración. Python todavía no genera trazas espaciales. La detección real de colisiones, elementos fuera de límites y pasos bloqueados sigue pendiente.',
    code: `-- Esta sección es informativa, no un programa de depuración.
-- Los colores muestran los estados recibidos por el IDE.
-- Un estado visual no demuestra detección automática de conflictos.
-- Compilar analiza; Ejecutar Python ejecuta las instrucciones admitidas.`
  }
];
