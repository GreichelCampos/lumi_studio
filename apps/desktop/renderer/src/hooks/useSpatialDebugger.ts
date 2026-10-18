import { useState, useEffect, useCallback, useRef } from 'react';
import { DebugStep, DebuggerStatus, PlaybackSpeed, Breakpoint } from '../types';
import { validDebugSource } from '../services/editor/debugStepNavigation';
import { lumiAssistant } from '../services/assistant/LumiAssistantService';

interface UseSpatialDebuggerProps {
  debugSteps: DebugStep[];
  breakpoints?: Breakpoint[];
  onStepChange?: (step: DebugStep | null) => void;
  onBreakpointHit?: (step: DebugStep) => void;
}

const SPEED_INTERVALS: Record<PlaybackSpeed, number> = {
  0.5: 2000,
  1: 1000,
  2: 500,
};

export function useSpatialDebugger({
  debugSteps,
  breakpoints = [],
  onStepChange,
  onBreakpointHit,
}: UseSpatialDebuggerProps) {
  const [status, setStatus] = useState<DebuggerStatus>('idle');
  const [cursor, setCursor] = useState({ steps: debugSteps, index: 0 });
  const currentStepIndex = cursor.steps === debugSteps ? cursor.index : 0;
  const stepsRef = useRef(debugSteps);
  stepsRef.current = debugSteps;
  const setCurrentStepIndex = useCallback((value: number | ((index: number) => number)) => {
    if (stepsRef.current !== debugSteps) return;
    setCursor(previous => {
      const index = previous.steps === debugSteps ? previous.index : 0;
      return { steps: debugSteps, index: typeof value === 'function' ? value(index) : value };
    });
  }, [debugSteps]);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);

  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;

  const onBreakpointHitRef = useRef(onBreakpointHit);
  onBreakpointHitRef.current = onBreakpointHit;

  const previousStepRef = useRef<DebugStep | null | undefined>(undefined);
  const breakpointsRef = useRef<Breakpoint[]>(breakpoints);
  breakpointsRef.current = breakpoints;

  useEffect(() => {
    if (debugSteps.length > 0) {
      setStatus('ready');
    } else {
      setStatus('idle');
    }
  }, [debugSteps]);

  useEffect(() => {
    if (debugSteps.length > 0 && debugSteps[currentStepIndex] !== undefined) {
      if (previousStepRef.current !== debugSteps[currentStepIndex]) {
        const activeStep = debugSteps[currentStepIndex];
        previousStepRef.current = activeStep;
        onStepChangeRef.current?.(activeStep);

        const source = validDebugSource(activeStep.sourceRef) ? activeStep.sourceRef : null;
        if (activeStep.assistantMessage) {
          if (activeStep.eventType === 'spatial_error') {
            lumiAssistant.onDebugSpatialError(activeStep.assistantMessage);
          } else if (activeStep.eventType === 'spatial_warning') {
            lumiAssistant.onDebugSpatialWarning(activeStep.assistantMessage);
          } else {
            if (source) lumiAssistant.onDebugStep(source.file, source.line, activeStep.assistantMessage);
            else lumiAssistant.setMessage(activeStep.assistantMessage, 'ready');
          }
        } else {
          if (activeStep.eventType === 'spatial_error') {
            lumiAssistant.onDebugSpatialError();
          } else if (activeStep.eventType === 'spatial_warning') {
            lumiAssistant.onDebugSpatialWarning();
          } else if (activeStep.eventType === 'end') {
            lumiAssistant.onDebugFinished();
          } else {
            if (source) lumiAssistant.onDebugStep(source.file, source.line);
            else lumiAssistant.setMessage('Paso sin referencia de código disponible.', 'ready');
          }
        }
      }
    } else if (previousStepRef.current) {
      previousStepRef.current = null;
      onStepChangeRef.current?.(null);
    }
  }, [currentStepIndex, debugSteps]);

  useEffect(() => {
    if (status !== 'running' || debugSteps.length === 0) return;

    const intervalMs = SPEED_INTERVALS[playbackSpeed] || 1000;

    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        const nextIndex = prev + 1;

        if (nextIndex >= debugSteps.length) {
          setStatus('finished');
          lumiAssistant.onDebugFinished();
          return prev;
        }

        const nextStep = debugSteps[nextIndex];

        // Check if next step hits any breakpoint (file + line match)
        const isBreakpoint = validDebugSource(nextStep.sourceRef) && breakpointsRef.current.some(
          (bp) => bp.line === nextStep.sourceRef.line && (bp.file === nextStep.sourceRef.file || !bp.file)
        );

        if (isBreakpoint) {
          setStatus('paused');
          lumiAssistant.onDebugBreakpoint(nextStep.sourceRef.file, nextStep.sourceRef.line);
          onBreakpointHitRef.current?.(nextStep);
          return nextIndex;
        }

        return nextIndex;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [status, debugSteps, playbackSpeed, setCurrentStepIndex]);

  const startDebugging = useCallback(() => {
    if (debugSteps.length === 0) return;
    setCurrentStepIndex(0);
    setStatus('running');
    lumiAssistant.onDebugStart();
  }, [debugSteps.length, setCurrentStepIndex]);

  const play = useCallback(() => {
    if (debugSteps.length === 0) return;
    if (currentStepIndex >= debugSteps.length - 1 || status === 'finished') {
      setCurrentStepIndex(0);
    }
    setStatus('running');
  }, [currentStepIndex, debugSteps.length, status, setCurrentStepIndex]);

  const pause = useCallback(() => {
    setStatus('paused');
    lumiAssistant.onDebugPaused();
  }, []);

  const togglePlay = useCallback(() => {
    if (status === 'running') {
      pause();
    } else {
      play();
    }
  }, [status, pause, play]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < debugSteps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      if (status === 'idle' || status === 'finished') {
        setStatus('paused');
      }
    } else if (currentStepIndex === debugSteps.length - 1) {
      setStatus('finished');
    }
  }, [currentStepIndex, debugSteps.length, status, setCurrentStepIndex]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      if (status === 'finished') {
        setStatus('paused');
      }
    }
  }, [currentStepIndex, status, setCurrentStepIndex]);

  const jumpToStart = useCallback(() => {
    setCurrentStepIndex(0);
    setStatus('ready');
  }, [setCurrentStepIndex]);

  const jumpToEnd = useCallback(() => {
    if (debugSteps.length > 0) {
      setCurrentStepIndex(debugSteps.length - 1);
      setStatus('finished');
    }
  }, [debugSteps.length, setCurrentStepIndex]);

  const resetDebugger = useCallback(() => {
    setCurrentStepIndex(0);
    setStatus(debugSteps.length > 0 ? 'ready' : 'idle');
  }, [debugSteps.length, setCurrentStepIndex]);

  const jumpToStep = useCallback(
    (index: number) => {
      if (Number.isInteger(index) && index >= 0 && index < debugSteps.length) {
        setCurrentStepIndex(index);
        if (status === 'running') {
          setStatus('paused');
        }
      }
    },
    [debugSteps.length, status, setCurrentStepIndex]
  );

  const changeSpeed = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
  }, []);

  const currentStep = debugSteps[currentStepIndex] || null;

  return {
    status,
    currentStepIndex,
    currentStep,
    playbackSpeed,
    isPlaying: status === 'running',
    startDebugging,
    play,
    pause,
    togglePlay,
    nextStep,
    prevStep,
    jumpToStart,
    jumpToEnd,
    resetDebugger,
    jumpToStep,
    changeSpeed,
  };
}
