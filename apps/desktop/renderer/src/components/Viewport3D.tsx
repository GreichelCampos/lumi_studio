import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { ScenePlan, SourceReference } from '../types';
import { ThreeSceneManager } from './viewport/ThreeSceneManager';
import { RoomSelector } from './viewport/RoomSelector';
import { ObjectPropertiesCard, SelectedEntity } from './viewport/ObjectPropertiesCard';
import { ViewportEmptyState, EmptyStateType } from './viewport/ViewportEmptyState';
import { VisualLegendOverlay } from './viewport/VisualLegendOverlay';
import { useOptionalIdeSettings } from '../context/IdeSettingsContext';
import { 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Ruler, 
  Grid, 
  Sun, 
  Moon, 
  Camera, 
  Sparkles,
  Compass,
  Box,
  Maximize2,
  Minimize2,
  Scan,
  Crosshair
} from 'lucide-react';

interface Viewport3DProps {
  sceneGenerationUnavailable?: boolean;
  scenePlan: ScenePlan | null;
  activeObjectId?: string | null;
  debugActiveObjectId?: string | null;
  onSelectObject?: (objectId: string | null) => void;
  onNavigateToSource?: (sourceRef: SourceReference) => void;
  onCompile?: () => void;
  onInsertRoom?: () => void;
  hasCompileErrors?: boolean;
  isCompiled?: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  sceneGenerationUnavailable = false,
  scenePlan,
  activeObjectId = null,
  debugActiveObjectId = null,
  onSelectObject,
  onNavigateToSource,
  onCompile,
  onInsertRoom,
  hasCompileErrors = false,
  isCompiled = true,
  isMaximized = false,
  onToggleMaximize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<ThreeSceneManager | null>(null);

  const ideContext = useOptionalIdeSettings();
  const currentTheme = ideContext?.currentTheme;
  const spatialBackground = ideContext?.settings?.spatialBackground;

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [showDimensions, setShowDimensions] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [lightingMode, setLightingMode] = useState<'day' | 'evening' | 'cyber'>('day');
  const [showLegend, setShowLegend] = useState(false);

  // Centralized clear selection action
  const clearSelection = useCallback(() => {
    if (onSelectObject) {
      onSelectObject(null);
    }
  }, [onSelectObject]);

  // Escape key deselects object
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeObjectId) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeObjectId, clearSelection]);

  // Determinar la habitación activa inicial o sincronizar con cambios de scenePlan
  useEffect(() => {
    if (scenePlan?.rooms && scenePlan.rooms.length > 0) {
      if (!selectedRoomId || !scenePlan.rooms.some((r) => r.id === selectedRoomId)) {
        setSelectedRoomId(scenePlan.rooms[0].id);
      }
    } else {
      setSelectedRoomId(null);
    }
  }, [scenePlan, selectedRoomId]);

  // Si se selecciona un objeto externamente (ej: desde panel de diagnósticos o editor o depurador), asegurar que la habitación correspondiente esté activa
  useEffect(() => {
    const targetObjId = activeObjectId || debugActiveObjectId;
    if (!targetObjId || !scenePlan) return;

    for (const r of scenePlan.rooms) {
      const hasObj = r.objects.some((o) => o.id === targetObjId);
      const hasDoor = r.doors.some((d) => d.id === targetObjId);
      const hasWin = r.windows.some((w) => w.id === targetObjId);

      if (hasObj || hasDoor || hasWin) {
        if (selectedRoomId !== r.id) {
          setSelectedRoomId(r.id);
        }
        break;
      }
    }
  }, [activeObjectId, debugActiveObjectId, scenePlan, selectedRoomId]);

  // Habitación activa actual
  const activeRoom = useMemo(() => {
    if (!scenePlan?.rooms || scenePlan.rooms.length === 0) return null;
    return scenePlan.rooms.find((r) => r.id === selectedRoomId) || scenePlan.rooms[0];
  }, [scenePlan, selectedRoomId]);

  // Obtener datos detallados de la entidad seleccionada para el Property Panel (single source of truth)
  const selectedEntityData = useMemo<SelectedEntity | null>(() => {
    if (!activeObjectId || !activeRoom) return null;

    const obj = activeRoom.objects.find((o) => o.id === activeObjectId);
    if (obj) return { kind: 'object', data: obj };

    const door = activeRoom.doors.find((d) => d.id === activeObjectId);
    if (door) return { kind: 'door', data: door };

    const win = activeRoom.windows.find((w) => w.id === activeObjectId);
    if (win) return { kind: 'window', data: win };

    return null;
  }, [activeObjectId, activeRoom]);

  // Callback cuando se hace clic en una entidad en el canvas 3D
  const handleEntityClicked = useCallback(
    (entityId: string | null) => {
      if (onSelectObject) {
        onSelectObject(entityId);
      }
    },
    [onSelectObject]
  );

  const [webglError, setWebGLError] = useState<string | null>(null);

  // Inicializar ThreeSceneManager
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const manager = new ThreeSceneManager({
        container: containerRef.current,
        onSelectEntity: handleEntityClicked,
        activeTheme: currentTheme,
        spatialBackground: spatialBackground,
      });
      sceneManagerRef.current = manager;
      setWebGLError(null);
    } catch (err: any) {
      console.warn('WebGL / Three.js could not be initialized in this environment:', err);
      sceneManagerRef.current = null;
      setWebGLError(err?.message || 'Error inicializando WebGL');
    }

    return () => {
      try {
        sceneManagerRef.current?.dispose();
      } catch (disposeErr) {
        console.warn('Error disposing ThreeSceneManager:', disposeErr);
      }
      sceneManagerRef.current = null;
    };
  }, [handleEntityClicked]);

  // Sincronizar tema espacial cuando cambia el tema del IDE o la iluminación
  useEffect(() => {
    if (!sceneManagerRef.current) return;
    sceneManagerRef.current.applyTheme(currentTheme, spatialBackground, lightingMode);
  }, [currentTheme, spatialBackground, lightingMode]);

  // Sincronizar dimensiones y encuadre 3D de inmediato al maximizar o restaurar el panel
  useEffect(() => {
    if (!sceneManagerRef.current) return;
    sceneManagerRef.current.handleResize();
    const animFrame = requestAnimationFrame(() => {
      sceneManagerRef.current?.handleResize();
      if (activeRoom) {
        sceneManagerRef.current?.focusRoom();
      }
    });
    const timer = setTimeout(() => {
      sceneManagerRef.current?.handleResize();
      if (activeRoom) {
        sceneManagerRef.current?.focusRoom();
      }
    });
    return () => {
      cancelAnimationFrame(animFrame);
      clearTimeout(timer);
    };
  }, [isMaximized, activeRoom]);

  // Track previous focused entity id to focus camera gently on selection change
  const prevFocusedIdRef = useRef<string | null>(null);

  // Re-renderizar habitación cuando cambian datos
  useEffect(() => {
    if (!sceneManagerRef.current) return;

    if (activeRoom) {
      sceneManagerRef.current.renderRoom(activeRoom, activeObjectId, debugActiveObjectId);
      
      // Si se acaba de seleccionar un objeto nuevo, enfocar suavemente
      if (activeObjectId && activeObjectId !== prevFocusedIdRef.current) {
        if (selectedEntityData && selectedEntityData.kind === 'object') {
          sceneManagerRef.current.focusObject(selectedEntityData.data.position);
        }
      }
      prevFocusedIdRef.current = activeObjectId;
    }
  }, [activeRoom, activeObjectId, debugActiveObjectId, selectedEntityData]);

  // Manejador para cambio de habitación con limpieza de selección si no pertenece a la nueva
  const handleRoomSelect = useCallback(
    (newRoomId: string) => {
      setSelectedRoomId(newRoomId);
      if (activeObjectId && scenePlan) {
        const targetRoom = scenePlan.rooms.find((r) => r.id === newRoomId);
        if (targetRoom) {
          const belongsToTarget =
            targetRoom.objects.some((o) => o.id === activeObjectId) ||
            targetRoom.doors.some((d) => d.id === activeObjectId) ||
            targetRoom.windows.some((w) => w.id === activeObjectId);

          if (!belongsToTarget) {
            onSelectObject?.(null);
          }
        }
      }
    },
    [activeObjectId, scenePlan, onSelectObject]
  );

  // Controles de visualización
  const handleToggleDimensions = () => {
    const next = !showDimensions;
    setShowDimensions(next);
    sceneManagerRef.current?.toggleDimensions(next);
    if (activeRoom) sceneManagerRef.current?.renderRoom(activeRoom, activeObjectId);
  };

  const handleToggleAxes = () => {
    const next = !showAxes;
    setShowAxes(next);
    sceneManagerRef.current?.toggleAxes(next);
    if (activeRoom) sceneManagerRef.current?.renderRoom(activeRoom, activeObjectId);
  };

  const handleToggleWireframe = () => {
    const next = !wireframeMode;
    setWireframeMode(next);
    sceneManagerRef.current?.toggleWireframe(next);
    if (activeRoom) sceneManagerRef.current?.renderRoom(activeRoom, activeObjectId);
  };

  const handleLightingChange = (mode: 'day' | 'evening' | 'cyber') => {
    setLightingMode(mode);
    sceneManagerRef.current?.setLighting(mode);
  };

  const handleResetCamera = () => {
    sceneManagerRef.current?.resetCamera();
  };

  const handleFocusRoom = () => {
    sceneManagerRef.current?.focusRoom();
  };

  const handleFocusSelectedObject = () => {
    if (selectedEntityData && selectedEntityData.kind === 'object') {
      sceneManagerRef.current?.focusObject(selectedEntityData.data.position);
    } else {
      sceneManagerRef.current?.focusObject();
    }
  };

  const handleZoom = (delta: number) => {
    sceneManagerRef.current?.zoomCamera(delta);
  };

  const handleSnapshot = () => {
    const dataUrl = sceneManagerRef.current?.captureSnapshot();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `lumi-render-${activeRoom?.name || 'escena'}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  // Determinar estado vacío (Solo cuando no hay ScenePlan válido disponible)
  let emptyState: EmptyStateType | null = null;
  if (sceneGenerationUnavailable && !scenePlan) {
    emptyState = 'scene_unavailable';
  } else
  if (!scenePlan) {
    if (hasCompileErrors) {
      emptyState = 'compile_errors';
    } else if (!isCompiled) {
      emptyState = 'no_compile';
    } else {
      emptyState = 'no_rooms';
    }
  } else if (scenePlan.rooms.length === 0) {
    emptyState = 'no_rooms';
  }

  return (
    <div id="viewport-3d-main" className="relative w-full h-full flex flex-col glass-panel shadow-2xl overflow-hidden select-none">
      {/* 3D Viewport Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 glass-panel-header z-10">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {/* Room Selector */}
          {scenePlan && scenePlan.rooms.length > 0 && (
            <RoomSelector
              rooms={scenePlan.rooms}
              activeRoomId={selectedRoomId}
              onSelectRoom={handleRoomSelect}
            />
          )}

          {/* Coordinate system badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl glass-btn text-[11px] text-[var(--ide-text-muted)] font-mono flex-shrink-0">
            <Compass className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
            <span>Origen [0,0,0]</span>
          </div>
        </div>

        {/* Action icons & Controls */}
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
          {/* Focus Selected Object */}
          <button
            id="btn-focus-object"
            onClick={handleFocusSelectedObject}
            disabled={!activeObjectId}
            className={`p-1.5 rounded-xl text-xs transition-all ${
              activeObjectId
                ? 'glass-btn text-[var(--ide-accent)] border-[var(--ide-accent)]/50 cursor-pointer bg-[var(--ide-accent-bg)]'
                : 'bg-white/5 text-[var(--ide-text-muted)]/50 border border-white/5 cursor-not-allowed'
            }`}
            title={activeObjectId ? 'Enfocar objeto seleccionado' : 'Selecciona un objeto para enfocarlo'}
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          {/* Focus Room Frame */}
          <button
            id="btn-focus-room"
            onClick={handleFocusRoom}
            className="p-1.5 rounded-xl glass-btn text-[var(--ide-text)] hover:text-white text-xs transition-all"
            title="Ajustar encuadre para aprovechar al máximo el espacio de la habitación"
          >
            <Scan className="w-3.5 h-3.5 text-[var(--ide-text)]" />
          </button>

          {/* Camera Reset */}
          <button
            id="btn-reset-camera"
            onClick={handleResetCamera}
            className="p-1.5 rounded-xl glass-btn text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] text-xs transition-all"
            title="Restablecer cámara isométrica (calculada según habitación)"
            aria-label="Restablecer cámara isométrica"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Zoom In */}
          <button
            id="btn-zoom-in"
            onClick={() => handleZoom(0.25)}
            className="p-1.5 rounded-xl glass-btn text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] text-xs transition-all"
            title="Acercar cámara"
            aria-label="Acercar cámara"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Out */}
          <button
            id="btn-zoom-out"
            onClick={() => handleZoom(-0.25)}
            className="p-1.5 rounded-xl glass-btn text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] text-xs transition-all"
            title="Alejar cámara"
            aria-label="Alejar cámara"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-0.5 hidden sm:block" />

          {/* Reference Axes Toggle */}
          <button
            id="btn-toggle-axes"
            onClick={handleToggleAxes}
            className={`p-1.5 rounded-xl text-xs transition-all ${
              showAxes
                ? 'glass-btn bg-[var(--ide-accent-bg)] text-[var(--ide-accent)] border-[var(--ide-accent)]/40 font-bold'
                : 'glass-btn text-[var(--ide-text-muted)]'
            }`}
            title="Mostrar / Ocultar ejes coordenados X y Z"
            aria-label="Mostrar u ocultar ejes coordenados"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Dimensions Cotas Toggle */}
          <button
            id="btn-toggle-dimensions"
            onClick={handleToggleDimensions}
            className={`p-1.5 rounded-xl text-xs transition-all ${
              showDimensions
                ? 'glass-btn bg-[var(--ide-accent-bg)] text-[var(--ide-accent)] border-[var(--ide-accent)]/40 font-bold'
                : 'glass-btn text-[var(--ide-text-muted)]'
            }`}
            title="Mostrar / Ocultar cotas métricas"
            aria-label="Mostrar u ocultar cotas métricas"
          >
            <Ruler className="w-3.5 h-3.5" />
          </button>

          {/* Wireframe toggle */}
          <button
            id="btn-toggle-wireframe"
            onClick={handleToggleWireframe}
            className={`p-1.5 rounded-xl text-xs transition-all ${
              wireframeMode
                ? 'glass-btn bg-[var(--ide-accent-bg)] text-[var(--ide-accent)] border-[var(--ide-accent)]/40 font-bold'
                : 'glass-btn text-[var(--ide-text-muted)]'
            }`}
            title="Modo Alámbrico (Wireframe)"
            aria-label="Modo alámbrico"
          >
            <Box className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-0.5 hidden sm:block" />

          {/* Lighting Mode Selector */}
          <div className="flex items-center rounded-xl glass-btn p-0.5 border border-[var(--ide-panel-border)]">
            <button
              id="btn-light-day"
              onClick={() => handleLightingChange('day')}
              className={`p-1 rounded-lg transition-all ${
                lightingMode === 'day' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
              }`}
              title="Iluminación diurna"
              aria-label="Iluminación diurna"
            >
              <Sun className="w-3 h-3" />
            </button>
            <button
              id="btn-light-evening"
              onClick={() => handleLightingChange('evening')}
              className={`p-1 rounded-lg transition-all ${
                lightingMode === 'evening' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
              }`}
              title="Iluminación atardecer"
              aria-label="Iluminación atardecer"
            >
              <Moon className="w-3 h-3" />
            </button>
            <button
              id="btn-light-cyber"
              onClick={() => handleLightingChange('cyber')}
              className={`p-1 rounded-lg transition-all ${
                lightingMode === 'cyber' ? 'bg-[var(--ide-accent-bg)] text-[var(--ide-accent)] border border-[var(--ide-accent)]/40' : 'text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
              }`}
              title="Iluminación Nocturna / Cyber"
              aria-label="Iluminación nocturna"
            >
              <Sparkles className="w-3 h-3" />
            </button>
          </div>

          {/* Snapshot Button */}
          <button
            id="btn-snapshot"
            onClick={handleSnapshot}
            className="p-1.5 rounded-xl glass-btn text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] text-xs transition-all ml-0.5"
            title="Capturar imagen PNG de la vista 3D"
            aria-label="Capturar imagen PNG"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore Viewport Panel Toggle */}
          {onToggleMaximize && (
            <button
              id="btn-toggle-maximize-viewport"
              onClick={onToggleMaximize}
              className={`p-1.5 rounded-xl text-xs transition-all ml-1 ${
                isMaximized
                  ? 'glass-btn bg-[var(--ide-accent-bg)] text-[var(--ide-accent)] border-[var(--ide-accent)]/50 shadow-md'
                  : 'glass-btn text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]'
              }`}
              title={isMaximized ? 'Restaurar vista dividida del IDE' : 'Maximizar visor 3D para aprovechar todo el espacio'}
              aria-label={isMaximized ? 'Restaurar vista dividida del IDE' : 'Maximizar visor 3D'}
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Container */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 w-full h-full min-h-0 cursor-grab active:cursor-grabbing" />

        {/* WebGL Error / Fallback State */}
        {webglError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-[var(--ide-bg,#02110c)]/90 backdrop-blur-md">
            <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 mb-3">
              <Box className="w-8 h-8 text-amber-400" />
            </div>
            <h4 className="text-sm font-semibold text-[var(--ide-text)] mb-1">
              Aceleración 3D no disponible en este entorno
            </h4>
            <p className="text-xs text-[var(--ide-text-muted)] max-w-sm mb-3">
              El navegador o el entorno de vista previa no tiene habilitado el contexto WebGL. El resto del IDE (editor, compilador, diagnósticos, explorador y mascota Lumi) continúa funcionando con normalidad.
            </p>
          </div>
        )}

        {/* Empty State Overlay */}
        {!webglError && emptyState && (
          <ViewportEmptyState
            type={emptyState}
            onCompile={onCompile}
            onInsertRoom={onInsertRoom}
          />
        )}

        {/* Object Properties Overlay Card - Single source of truth: selectedEntityData derives purely from activeObjectId */}
        {selectedEntityData && (
          <ObjectPropertiesCard
            entity={selectedEntityData}
            onClose={clearSelection}
            onNavigateToSource={onNavigateToSource}
          />
        )}

        {/* Visual Legend Toggle & Card */}
        {activeRoom && !emptyState && (
          <div className="absolute bottom-3 left-3 z-10">
            <VisualLegendOverlay
              isOpen={showLegend}
              onToggle={() => setShowLegend((prev) => !prev)}
            />
          </div>
        )}

        {/* Bottom Coordinates & Stats Badge (hidden during object inspection to avoid visual clutter) */}
        {activeRoom && !emptyState && !selectedEntityData && (
          <div className="absolute bottom-3 right-3 glass-card px-3 py-1.5 text-[10px] sm:text-[11px] font-mono text-[var(--ide-text-muted)] shadow-lg flex items-center gap-2 sm:gap-3 select-none border border-[var(--ide-panel-border)] max-w-[calc(100%-8rem)] z-10 pointer-events-none">
            <span className="text-[var(--ide-accent)] font-bold truncate">{activeRoom.name}</span>
            <span className="opacity-75">
              [{activeRoom.dimensions[0].toFixed(1)}×{activeRoom.dimensions[1].toFixed(1)}×{activeRoom.dimensions[2].toFixed(1)}m]
            </span>
            <span className="hidden md:inline">
              Área: <strong className="text-[var(--ide-text)]">{activeRoom.calculatedArea.toFixed(1)} m²</strong>
            </span>
            <span className="hidden lg:inline">
              Vol: <strong className="text-[var(--ide-text)]">{activeRoom.calculatedVolume.toFixed(1)} m³</strong>
            </span>
            <span className="hidden sm:inline">
              Entidades: <strong className="text-[var(--ide-text)] font-bold">{activeRoom.objects.length + activeRoom.doors.length + activeRoom.windows.length}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
