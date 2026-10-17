import { useState, useEffect, useCallback, useRef } from 'react';
import { DebugStep, DebuggerStatus, PlaybackSpeed, Breakpoint } from '../types';
import { lumiAssistant } from '../services/assistant/LumiAssistantService';

interface UseSpatialDebuggerProps {
  debugSteps: DebugStep[];
  breakpoints?: Breakpoint[];
  onStepChange?: (step: DebugStep) => void;
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
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);

  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;

  const onBreakpointHitRef = useRef(onBreakpointHit);
  onBreakpointHitRef.current = onBreakpointHit;

  const prevStepIndexRef = useRef<number | null>(null);
  const breakpointsRef = useRef<Breakpoint[]>(breakpoints);
  breakpointsRef.current = breakpoints;

  // Track initial or recompilation reset
  useEffect(() => {
    if (debugSteps.length > 0) {
      setCurrentStepIndex(0);
      prevStepIndexRef.current = null;
      setStatus('ready');
    } else {
      setCurrentStepIndex(0);
      prevStepIndexRef.current = null;
      setStatus('idle');
    }
  }, [debugSteps]);

  // Synchronize active step notifications to Editor & 3D & Lumi Assistant
  useEffect(() => {
    if (debugSteps.length > 0 && debugSteps[currentStepIndex] !== undefined) {
      if (prevStepIndexRef.current !== currentStepIndex) {
        prevStepIndexRef.current = currentStepIndex;
        const activeStep = debugSteps[currentStepIndex];
        onStepChangeRef.current?.(activeStep);

        // Assistant messaging based on step event and metadata
        if (activeStep.assistantMessage) {
          if (activeStep.eventType === 'spatial_error') {
            lumiAssistant.onDebugSpatialError(activeStep.assistantMessage);
          } else if (activeStep.eventType === 'spatial_warning') {
            lumiAssistant.onDebugSpatialWarning(activeStep.assistantMessage);
          } else {
            lumiAssistant.onDebugStep(activeStep.sourceRef.file, activeStep.sourceRef.line, activeStep.assistantMessage);
          }
        } else {
          if (activeStep.eventType === 'spatial_error') {
            lumiAssistant.onDebugSpatialError();
          } else if (activeStep.eventType === 'spatial_warning') {
            lumiAssistant.onDebugSpatialWarning();
          } else if (activeStep.eventType === 'end') {
            lumiAssistant.onDebugFinished();
          } else {
            lumiAssistant.onDebugStep(activeStep.sourceRef.file, activeStep.sourceRef.line);
          }
        }
      }
    }
  }, [currentStepIndex, debugSteps]);

  // Execution ticker with Breakpoint detection
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
        const isBreakpoint = breakpointsRef.current.some(
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
  }, [status, debugSteps, playbackSpeed]);

  // Debugger Actions
  const startDebugging = useCallback(() => {
    if (debugSteps.length === 0) return;
    setCurrentStepIndex(0);
    setStatus('running');
    lumiAssistant.onDebugStart();
  }, [debugSteps.length]);

  const play = useCallback(() => {
    if (debugSteps.length === 0) return;
    if (currentStepIndex >= debugSteps.length - 1 || status === 'finished') {
      setCurrentStepIndex(0);
    }
    setStatus('running');
  }, [currentStepIndex, debugSteps.length, status]);

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
  }, [currentStepIndex, debugSteps.length, status]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      if (status === 'finished') {
        setStatus('paused');
      }
    }
  }, [currentStepIndex, status]);

  const jumpToStart = useCallback(() => {
    setCurrentStepIndex(0);
    setStatus('ready');
  }, []);

  const jumpToEnd = useCallback(() => {
    if (debugSteps.length > 0) {
      setCurrentStepIndex(debugSteps.length - 1);
      setStatus('finished');
    }
  }, [debugSteps.length]);

  const resetDebugger = useCallback(() => {
    setCurrentStepIndex(0);
    setStatus(debugSteps.length > 0 ? 'ready' : 'idle');
  }, [debugSteps.length]);

  const jumpToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < debugSteps.length) {
        setCurrentStepIndex(index);
        if (status === 'running') {
          setStatus('paused');
        }
      }
    },
    [debugSteps.length, status]
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
