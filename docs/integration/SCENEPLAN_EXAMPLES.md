# Ejemplos reproducibles de ScenePlan

## Cómo reproducirlos

Los cinco ejemplos fueron ejecutados en esta rama mediante `RequestDispatcher` con protocolo `1.0.0`, operación `execute`, archivo de entrada `principal.lumi` y un mapa `files` con ese archivo. Los JSON siguientes son salidas verificadas; se omiten únicamente espacios sin significado. Los textos de diagnósticos se muestran con Unicode correcto aunque la consola de auditoría usó una codificación distinta.

## A. Una habitación

```lumi
habitacion sala(5, 4, 2.7) { }
```

```json
{
  "protocolVersion": "1.0.0",
  "requestId": "example-a",
  "operation": "execute",
  "status": "completed",
  "result": {
    "entryFile": "principal.lumi",
    "analysisStatus": "incomplete",
    "stage": "semantic",
    "output": [],
    "diagnostics": [],
    "limitations": ["spatial_semantics_unavailable"],
    "executionAttempted": true,
    "capabilities": {"scenePlan": true, "debugTrace": false, "interactiveInput": false, "cancellation": false},
    "scenePlan": {
      "version": "1.0.0",
      "rooms": [{
        "id": "room:principal.lumi:1:1:sala",
        "name": "sala",
        "dimensions": [5, 4, 2.7],
        "floor": {"material": "standard", "color": "#e2e8f0"},
        "walls": {
          "north": {"color": "#f1f5f9", "material": "standard"},
          "south": {"color": "#f1f5f9", "material": "standard"},
          "east": {"color": "#f1f5f9", "material": "standard"},
          "west": {"color": "#f1f5f9", "material": "standard"}
        },
        "doors": [], "windows": [], "objects": [],
        "calculatedArea": 20, "calculatedVolume": 54.0
      }]
    }
  }
}
```
## B. Piso y mueble

```lumi
habitacion sala(6, 5, 3) {
  piso suelo { material "madera">> color "beige">> }
  mesa mesa1 { color "rojo">> }
  colocar mesa1 [1, 0, -1]>>
  rotar mesa1 [0, 90, 0]>>
}
```

La salida verificada con el mismo contenido en una sola línea contiene:

```json
{
  "status": "completed",
  "result": {
    "analysisStatus": "incomplete",
    "capabilities": {"scenePlan": true, "debugTrace": false, "interactiveInput": false, "cancellation": false},
    "scenePlan": {"version": "1.0.0", "rooms": [{
      "id": "room:principal.lumi:1:1:sala",
      "name": "sala", "dimensions": [6, 5, 3],
      "floor": {"material": "madera", "color": "beige"},
      "walls": {
        "north": {"color": "#f1f5f9", "material": "standard"},
        "south": {"color": "#f1f5f9", "material": "standard"},
        "east": {"color": "#f1f5f9", "material": "standard"},
        "west": {"color": "#f1f5f9", "material": "standard"}
      },
      "doors": [], "windows": [],
      "objects": [{
        "id": "element:principal.lumi:1:79:mesa1",
        "type": "mesa", "name": "mesa1",
        "position": [1, 0, -1], "rotation": [0, 90, 0],
        "dimensions": [1.2, 0.5, 0.8],
        "sourceRef": {"file": "principal.lumi", "line": 1, "column": 79},
        "roomId": "room:principal.lumi:1:1:sala", "color": "rojo"
      }],
      "calculatedArea": 30, "calculatedVolume": 90
    }]}
  }
}
```

Las columnas cambian si se usa el formato multilínea mostrado; eso demuestra que IDs y `sourceRef` proceden de la ubicación real.

## C. Ejecución de variables, función y condición

```lumi
decimal destino = 2>>
funcion decimal siguiente(decimal valor) { retornar valor + 1>> }
habitacion sala(6, 5, 3) {
  mesa mesa1 { }
  colocar mesa1 [0, 0, 0]>>
  si verdadero { mover mesa1 [siguiente(destino), 0, -1]>> }
}
```

El resultado verificado deja el estado final, no un historial:

```json
{
  "status": "completed",
  "result": {
    "analysisStatus": "incomplete",
    "capabilities": {"scenePlan": true, "debugTrace": false, "interactiveInput": false, "cancellation": false},
    "scenePlan": {"version": "1.0.0", "rooms": [{
      "name": "sala", "dimensions": [6, 5, 3],
      "objects": [{
        "type": "mesa", "name": "mesa1",
        "position": [3, 0, -1], "rotation": [0, 0, 0],
        "dimensions": [1.2, 0.5, 0.8]
      }],
      "calculatedArea": 30, "calculatedVolume": 90
    }]}
  }
}
```

El JSON se abrevia para destacar el efecto de ejecución; la respuesta real también contiene IDs, paredes visuales, piso predeterminado, listas de aberturas y `sourceRef`, con la misma forma del ejemplo B.

## D. Error espacial

```lumi
habitacion sala(0, 4, 3) { }
```

```json
{
  "protocolVersion": "1.0.0",
  "requestId": "example-d",
  "operation": "execute",
  "status": "failed",
  "result": {
    "entryFile": "principal.lumi",
    "analysisStatus": "incomplete",
    "stage": "semantic",
    "output": [],
    "diagnostics": [{
      "category": "SPATIAL",
      "code": "SPA_INVALID_DIMENSION",
      "file": "principal.lumi", "line": 1, "column": 17,
      "description": "La dimensión 'ancho' de la habitación 'sala' debe ser mayor que cero.",
      "suggestion": "Utilice un valor numérico positivo."
    }],
    "limitations": ["spatial_semantics_unavailable"],
    "executionAttempted": true,
    "capabilities": {"scenePlan": false, "debugTrace": false, "interactiveInput": false, "cancellation": false}
  }
}
```

No aparece `scenePlan`: una escena inválida no se publica.

## E. Programa no espacial

```lumi
mostrar(42)>>
```

```json
{
  "protocolVersion": "1.0.0",
  "requestId": "example-e",
  "operation": "execute",
  "status": "completed",
  "result": {
    "entryFile": "principal.lumi",
    "analysisStatus": "completed",
    "stage": "semantic",
    "output": ["42"],
    "diagnostics": [], "limitations": [],
    "executionAttempted": true,
    "capabilities": {"scenePlan": false, "debugTrace": false, "interactiveInput": false, "cancellation": false}
  }
}
```
