export interface StartupBridge {
  /** Shows the hidden main window after the splash has committed in React. */
  presentSplash(): Promise<void>;
  /** Resolves after Electron has completed its real startup attempt. */
  whenReady(): Promise<void>;
}

declare global {
  interface Window { lumiStartup?: StartupBridge }
}

