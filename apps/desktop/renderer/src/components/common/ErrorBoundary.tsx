import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[var(--ide-bg,#02110c)] text-[var(--ide-text,#f5ede0)]">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-3">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-[var(--ide-text)] mb-1">
            {this.props.fallbackTitle || 'Se produjo un problema al renderizar este panel'}
          </h3>
          <p className="text-xs text-[var(--ide-text-muted)] max-w-md mb-4 font-mono">
            {this.state.error?.message || 'Error desconocido'}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold glass-btn border-[var(--ide-panel-border)] hover:border-[var(--ide-accent)] transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
