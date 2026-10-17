import React from 'react';

export interface LumiSpeechBubbleProps {
  message: string;
}

/**
 * Bocadillo de diálogo de Lumi con efecto de cristal translúcido y flecha indicadora.
 */
export const LumiSpeechBubble: React.FC<LumiSpeechBubbleProps> = ({ message }) => {
  return (
    <div
      id="lumi-speech-bubble"
      key={message}
      className="mr-3.5 relative glass-bubble text-[var(--ide-text,#f3ebd6)] text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-2xl flex items-center max-w-[280px] sm:max-w-[380px] md:max-w-[480px] animate-chat-popup font-medium select-text border border-[var(--ide-panel-border,rgba(243,235,214,0.25))] bg-[var(--ide-panel-solid,#082016)]/95"
    >
      <span className="break-words leading-snug tracking-wide">{message}</span>
      {/* Puntero triangular hacia Lumi */}
      <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-[var(--ide-panel-solid,#082016)]/95 backdrop-blur-md border-t border-r border-[var(--ide-panel-border,rgba(243,235,214,0.4))] rotate-45 shadow-[2px_-2px_4px_rgba(0,0,0,0.35)]" />
    </div>
  );
};
