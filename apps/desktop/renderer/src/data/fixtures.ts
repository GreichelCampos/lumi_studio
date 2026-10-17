import { LumiProject } from '../types';

export const INITIAL_PROJECTS: LumiProject[] = [
  {
    id: 'casa-ejemplo',
    name: 'CasaEjemplo',
    description: 'Proyecto principal con sala de estar moderna y comedor modular',
    location: '~/ProyectosLumi/CasaEjemplo',
    activeFileId: 'casa-ejemplo-principal',
    entryFileId: 'casa-ejemplo-principal',
    openTabIds: ['casa-ejemplo-principal', 'casa-ejemplo-muebles'],
    files: [
      {
        id: 'casa-ejemplo-principal',
        name: 'principal.lumi',
        path: 'CasaEjemplo/principal.lumi',
        isEntry: true,
        content: `importar "muebles.lumi" usar crear_comedor>>

principal {
  decimal ancho = 5.0>>
  decimal largo = 4.0>>
  decimal alto = 2.7>>
  texto material_piso = "madera">>
  booleano agregar_planta = verdadero>>

  -- El origen [0.0, 0.0, 0.0] se ubica en el centro del piso
  habitacion sala(ancho, largo, alto) {
    piso material material_piso>>
    pared norte color "blanco">>
    pared sur color "gris">>
    
    puerta en norte {
      ancho = 0.90>>
      alto = 2.10>>
      posicion = 1.1>>
    }
    
    ventana en sur {
      ancho = 1.50>>
      alto = 1.20>>
      posicion = -0.8>>
    }

    colocar sofa en [0.0, 0.0, -0.9]>>
    colocar mesa en [0.0, 0.0, 0.6]>>

    si agregar_planta {
      colocar planta en [1.8, 0.0, 1.3]>>
    }
  }

  decimal area = ancho * largo>>
  mostrar("Área de la sala: " + area)>>
  visualizar3D(sala)>>
}`
      },
      {
        id: 'casa-ejemplo-muebles',
        name: 'muebles.lumi',
        path: 'CasaEjemplo/muebles.lumi',
        content: `-- Módulo de definición de muebles modulares
funcion vacio crear_comedor(entero cantidad_sillas) {
  colocar mesa en [0.0, 0.0, 0.0]>>
  
  hacer entero i = 0; i < cantidad_sillas; i = i + 1 {
    colocar silla en [(i - 1.5) * 0.7, 0.0, 0.0]>>
  }
}

funcion vacio crear_sala_estar() {
  colocar sofa en [0.0, 0.0, -1.0]>>
  colocar mesa en [0.0, 0.0, 0.5]>>
  colocar planta en [1.8, 0.0, 1.2]>>
}`
      },
      {
        id: 'casa-ejemplo-habitaciones',
        name: 'habitaciones.lumi',
        path: 'CasaEjemplo/habitaciones.lumi',
        content: `-- Definición de configuraciones de habitaciones
lista dimensiones_estandar = [
  [6.0, 5.0, 2.8],
  [4.0, 3.5, 2.6],
  [3.5, 3.0, 2.5]
]>>

funcion decimal calcular_volumen(decimal ancho, decimal largo, decimal alto) {
  retornar ancho * largo * alto>>
}`
      },
      {
        id: 'casa-ejemplo-materiales',
        name: 'materiales.lumi',
        path: 'CasaEjemplo/materiales.lumi',
        content: `-- Paleta de acabados y texturas estándar para Lumi
lista acabados_disponibles = [
  "madera_roble",
  "marmol_blanco",
  "concreto_pulido",
  "azul_noche"
]>>`
      }
    ]
  },
  {
    id: 'dormitorio-moderno',
    name: 'DormitorioModerno',
    description: 'Dormitorio con cama king, estantería, escritorio y lámpara de noche',
    location: '~/ProyectosLumi/DormitorioModerno',
    activeFileId: 'dormitorio-principal',
    entryFileId: 'dormitorio-principal',
    openTabIds: ['dormitorio-principal'],
    files: [
      {
        id: 'dormitorio-principal',
        name: 'principal.lumi',
        path: 'DormitorioModerno/principal.lumi',
        isEntry: true,
        content: `principal {
  decimal ancho = 4.5>>
  decimal largo = 4.0>>
  decimal alto = 2.6>>

  habitacion dormitorio(ancho, largo, alto) {
    piso material "madera">>
    pared norte color "azul">>
    pared sur color "blanco">>
    
    puerta en norte {
      ancho = 0.85>>
      alto = 2.10>>
      posicion = 1.0>>
    }

    ventana en sur {
      ancho = 1.80>>
      alto = 1.40>>
      posicion = -0.6>>
    }

    colocar cama en [-0.2, 0.0, -0.8]>>
    colocar lampara en [-1.4, 0.0, -0.8]>>
    colocar escritorio en [1.1, 0.0, 1.1]>>
    colocar estanteria en [-1.4, 0.0, 1.2]>>
  }

  visualizar3D(dormitorio)>>
}`
      }
    ]
  },
  {
    id: 'oficina-estudio',
    name: 'OficinaEstudio',
    description: 'Espacio de trabajo minimalista con escritorio, estantería y sillón',
    location: '~/ProyectosLumi/OficinaEstudio',
    activeFileId: 'oficina-principal',
    entryFileId: 'oficina-principal',
    openTabIds: ['oficina-principal'],
    files: [
      {
        id: 'oficina-principal',
        name: 'principal.lumi',
        path: 'OficinaEstudio/principal.lumi',
        isEntry: true,
        content: `principal {
  decimal ancho = 5.0>>
  decimal largo = 4.5>>
  decimal alto = 2.8>>

  habitacion oficina(ancho, largo, alto) {
    piso material "concreto">>
    pared norte color "gris">>
    pared este color "blanco">>

    puerta en norte {
      ancho = 0.90>>
      alto = 2.10>>
      posicion = 1.3>>
    }

    ventana en este {
      ancho = 2.00>>
      alto = 1.50>>
      posicion = 0.0>>
    }

    colocar escritorio en [0.0, 0.0, -0.8]>>
    colocar silla en [0.0, 0.0, 0.0]>>
    colocar estanteria en [1.8, 0.0, -0.4]>>
    colocar sofa en [-1.2, 0.0, 1.1]>>
    colocar planta en [1.8, 0.0, 1.4]>>
  }

  visualizar3D(oficina)>>
}`
      }
    ]
  },
  {
    id: 'demo-error-espacial',
    name: 'DemoDepurador',
    description: 'Ejemplo con alertas espaciales intencionales para verificar el depurador',
    location: '~/ProyectosLumi/DemoDepurador',
    activeFileId: 'demo-error-principal',
    entryFileId: 'demo-error-principal',
    openTabIds: ['demo-error-principal'],
    files: [
      {
        id: 'demo-error-principal',
        name: 'principal.lumi',
        path: 'DemoDepurador/principal.lumi',
        isEntry: true,
        content: `-- Este archivo contiene problemas espaciales intencionales
-- para demostrar la validación en tiempo de compilación

principal {
  decimal ancho = 4.0>>
  decimal largo = 3.5>>
  decimal alto = 2.5>>

  habitacion sala(ancho, largo, alto) {
    piso material "madera">>
    pared norte color "blanco">>

    puerta en norte {
      ancho = 0.90>>
      alto = 2.10>>
      posicion = 0.5>>
    }

    -- ADVERTENCIA ESPACIAL: La cama excede los límites laterales (X > 2.0 respecto al centro)
    colocar cama en [2.8, 0.0, -0.3]>>

    -- ERROR DE COLISIÓN: El sofá y la mesa están colocados en la misma coordenada
    colocar sofa en [0.0, 0.0, 0.5]>>
    colocar mesa en [0.0, 0.0, 0.5]>>
  }

  visualizar3D(sala)>>
}`
      }
    ]
  }
];
