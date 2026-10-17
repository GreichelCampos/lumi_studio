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
  { word: 'principal', category: 'Estructura', desc: 'Punto de entrada obligatorio del programa' },
  { word: 'habitacion', category: 'Espacio', desc: 'Declara una habitación 3D con dimensiones [ancho, largo, alto]' },
  { word: 'piso', category: 'Espacio', desc: 'Define material y textura del suelo' },
  { word: 'pared', category: 'Espacio', desc: 'Configura propiedades de muro (norte, sur, este, oeste)' },
  { word: 'puerta', category: 'Aperturas', desc: 'Declara una apertura de acceso en un muro' },
  { word: 'ventana', category: 'Aperturas', desc: 'Declara una apertura de iluminación en un muro' },
  { word: 'colocar', category: 'Transformación', desc: 'Posiciona un objeto 3D en coordenadas [x, y, z]' },
  { word: 'rotar', category: 'Transformación', desc: 'Aplica rotación [rx, ry, rz] a una entidad' },
  { word: 'mover', category: 'Transformación', desc: 'Desplaza un objeto respecto a su posición actual' },
  { word: 'si / sino', category: 'Control', desc: 'Estructura condicional lógica' },
  { word: 'hacer', category: 'Control', desc: 'Ciclo de iteración delimitado por cabecera con punto y coma (;)' },
  { word: 'mientras', category: 'Control', desc: 'Ciclo condicional iterativo' },
  { word: 'nulo', category: 'Valor', desc: 'Representa ausencia de valor; comparable solo con == y !=' },
  { word: 'mostrar', category: 'E/S', desc: 'Emite texto o datos a la consola del IDE' },
  { word: 'leer', category: 'E/S', desc: 'Solicita entrada de datos al usuario' },
  { word: 'visualizar3D', category: 'Render', desc: 'Genera el ScenePlan tridimensional para el visor' },
];

export const LUMI_DOCUMENTATION_SECTIONS: DocumentationSection[] = [
  {
    title: '1. Estructura y Filosofía de Lumi',
    description: 'Lumi (Lenguaje Unificado de Modelado de Interiores) es un lenguaje declarativo y procedural en español para diseñar, validar y renderizar espacios arquitectónicos 3D.',
    code: `-- Todas las instrucciones simples finalizan con >>
-- El origen [0.0, 0.0, 0.0] se ubica en el centro del piso de la habitación.

principal {
  habitacion sala(5.0, 4.0, 2.7) {
    piso material "madera">>
    pared norte color "blanco">>
    pared sur color "gris">>
    
    colocar sofa en [0.0, 0.0, -1.0]>>
    colocar mesa en [0.0, 0.0, 0.5]>>
  }
  
  visualizar3D(sala)>>
}`
  },
  {
    title: '2. Tipos de Datos y Manejo de Nulo',
    description: 'Lumi cuenta con tipos primitivos (entero, decimal, texto, booleano) y compuestos (vector, lista). "nulo" representa ausencia de valor y conserva el tipo declarado de la variable.',
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
    description: 'Instrucciones espaciales para delimitar muros, aperturas y distribución de mobiliario con centro relativo [0,0,0].',
    code: `habitacion dormitorio(4.5, 4.0, 2.6) {
  piso material "madera">>
  pared norte color "azul">>
  pared sur color "blanco">>
  
  puerta en norte {
    ancho = 0.85>>
    alto = 2.10>>
    posicion = 1.2>>
  }
  
  ventana en sur {
    ancho = 1.80>>
    alto = 1.40>>
    posicion = -0.5>>
  }

  colocar cama en [0.0, 0.0, -0.8]>>
  colocar lampara en [-1.2, 0.0, -0.8]>>
  colocar escritorio en [1.2, 0.0, 1.1]>>
}`
  },
  {
    title: '4. Ciclo "hacer" y Modularidad',
    description: 'El punto y coma (;) es reservado exclusivamente como separador de cláusulas dentro del encabezado del ciclo "hacer".',
    code: `funcion vacio colocar_hileras(entero total) {
  hacer entero i = 0; i < total; i = i + 1 {
    colocar silla en [(i - 1.5) * 0.7, 0.0, 0.0]>>
  }
}`
  },
  {
    title: '5. Depuración Espacial e Innovación',
    description: 'Estudio Lumi valida colisiones tridimensionales, elementos fuera de límites y pasos peatonales bloqueados.',
    code: `-- Estados del Asistente Lumi:
-- 🟢 Verde: Compilación exitosa y válida
-- 🟣 Morado: Compilando y generando ScenePlan
-- 🔵 Cian: Listo para programar
-- 🟡 Amarillo: Advertencias espaciales o de paso
-- 🔴 Rojo: Colisión o mueble fuera de la habitación`
  }
];
