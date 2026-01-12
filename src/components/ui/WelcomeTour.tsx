import { useState, useEffect } from 'react';
import { Button } from './button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { helpContent } from '@/config/helpContent';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

export function WelcomeTour({ onComplete, onSkip }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const steps = helpContent.welcome.steps;
  const totalSteps = steps.length;
  const step = steps[currentStep];

  useEffect(() => {
    // Fade in animation
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleSkipClick = () => {
    setIsVisible(false);
    setTimeout(onSkip, 300);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleSkipClick}
      />

      {/* Tour Card */}
      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl transition-all duration-300 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">{step.title}</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Step {currentStep + 1} of {totalSteps}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkipClick}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="prose prose-invert prose-sm max-w-none">
              <div
                className="text-zinc-300 leading-relaxed whitespace-pre-line"
                dangerouslySetInnerHTML={{
                  __html: step.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-400">$1</strong>')
                    .replace(/^\- (.*?)$/gm, '<li class="ml-4">$1</li>')
                    .replace(/<li/g, '<ul><li')
                    .replace(/<\/li>(?![\s\S]*<li)/g, '</li></ul>'),
                }}
              />
            </div>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center gap-2 px-6 pb-4">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? 'bg-emerald-400 w-8'
                    : idx < currentStep
                    ? 'bg-emerald-600/50'
                    : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 bg-zinc-800/50 border-t border-zinc-800">
            <Button variant="ghost" onClick={handleSkipClick} className="text-zinc-400">
              Skip Tour
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="border-zinc-700"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleNext} className="bg-emerald-600 hover:bg-emerald-700">
                {currentStep === totalSteps - 1 ? (
                  'Get Started'
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
