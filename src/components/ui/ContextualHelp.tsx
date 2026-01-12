import { useState } from 'react';
import { Button } from './button';
import { ScrollArea } from './scroll-area';
import { X, HelpCircle, Lightbulb, Zap } from 'lucide-react';
import { helpContent, type ViewHelp } from '@/config/helpContent';
import type { ViewMode } from '@/types';

interface Props {
  view: ViewMode;
}

export function ContextualHelp({ view }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // Skip help for relationships view for now (has its own)
  if (view === 'explorer') return null;

  const content: ViewHelp | undefined = helpContent.views[view as keyof typeof helpContent.views];

  if (!content) return null;

  return (
    <>
      {/* Help Button - Floating */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg flex items-center justify-center z-40 transition-all hover:scale-110"
        title="Get Help"
      >
        <HelpCircle className="w-6 h-6 text-white" />
      </button>

      {/* Help Panel */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-900 border-l border-zinc-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-zinc-100">{content.title}</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-6 py-4">
              {/* Description */}
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{content.description}</p>

              {/* Tips */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">Tips & Tricks</h3>
                </div>
                <ul className="space-y-2">
                  {content.tips.map((tip, idx) => (
                    <li key={idx} className="text-sm text-zinc-400 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-emerald-400">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Quick Actions */}
              {content.quickActions && content.quickActions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-zinc-200">Quick Actions</h3>
                  </div>
                  <div className="space-y-3">
                    {content.quickActions.map((action, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50"
                      >
                        <div className="font-medium text-sm text-zinc-200 mb-1">
                          {action.label}
                        </div>
                        <div className="text-xs text-zinc-500">{action.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-800">
              <Button
                onClick={() => setIsOpen(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                Got it!
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
