import { useState } from 'react';
import { Button } from './button';
import { ScrollArea } from './scroll-area';
import { X, Code2, ChevronRight, ChevronDown } from 'lucide-react';
import { devGuide } from '@/config/devGuide';

export function DevGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  const toggleSection = (idx: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <>
      {/* Dev/Techie Button - Floating (opposite corner from help) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 w-12 h-12 bg-violet-600 hover:bg-violet-700 rounded-full shadow-lg flex items-center justify-center z-40 transition-all hover:scale-110"
        title="Developer Guide"
      >
        <Code2 className="w-6 h-6 text-white" />
      </button>

      {/* Dev Guide Panel */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel - Left Side, Wider */}
          <div
            className="fixed left-0 top-0 bottom-0 w-full max-w-3xl bg-zinc-900 border-r border-zinc-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-violet-400" />
                  <h2 className="text-lg font-semibold text-zinc-100">Developer Guide</h2>
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
              <p className="text-sm text-zinc-400">
                Technical deep-dive by{' '}
                <a
                  href="https://linkedin.com/in/pedrocardoso"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300 underline"
                >
                  Pedro Cardoso
                </a>{' '}
                (@dataninja)
              </p>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-3">
                {devGuide.map((section, idx) => (
                  <div
                    key={idx}
                    className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-800/30"
                  >
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(idx)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                    >
                      <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                        {section.title}
                      </h3>
                      {expandedSections.has(idx) ? (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>

                    {/* Section Content */}
                    {expandedSections.has(idx) && (
                      <div className="px-4 pb-4">
                        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line mb-3">
                          {section.content}
                        </div>

                        {/* Code Block */}
                        {section.code && (
                          <div className="mt-3 bg-zinc-950 border border-zinc-700 rounded-lg p-4 overflow-x-auto">
                            <pre className="text-xs text-emerald-300 font-mono leading-relaxed">
                              <code>{section.code}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer Note */}
              <div className="mt-6 p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                <p className="text-xs text-violet-300 leading-relaxed">
                  <strong className="block mb-1">Want to contribute?</strong>
                  This is open source! Fork the repo, add features, fix bugs, improve docs. Pull
                  requests welcome.
                  <br />
                  <a
                    href="https://github.com/DATAiMatters/DataExplorer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline mt-1 inline-block"
                  >
                    github.com/DATAiMatters/DataExplorer
                  </a>
                </p>
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </>
  );
}
