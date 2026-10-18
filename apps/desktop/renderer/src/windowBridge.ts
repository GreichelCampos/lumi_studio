/** Window controls are separate from the Python compilation/execution contract. */
export interface WindowControlsBridge {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<boolean>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onMaximizedChange(listener: (maximized: boolean) => void): () => void;
}

declare global {
  interface Window { lumiWindow?: WindowControlsBridge }
}
