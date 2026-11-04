import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingFallbackProps {
  message?: string;
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = 'Loading workspace view...',
}) => {
  return (
    <div className="flex min-h-[300px] w-full items-center justify-center p-8 text-slate-400">
      <div className="flex flex-col items-center space-y-3 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        <p className="text-xs font-semibold text-slate-500 tracking-wide">{message}</p>
      </div>
    </div>
  );
};
