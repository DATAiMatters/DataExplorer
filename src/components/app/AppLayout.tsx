import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { Sidebar } from './Sidebar';
import { BundleManager } from './BundleManager';
import { SchemaManager } from './SchemaManager';
import { Explorer } from './Explorer';
import { RelationshipManager } from './RelationshipManager';
import { AISettings } from './AISettings';
import { Journal } from './Journal';
import { WelcomeTour } from '@/components/ui/WelcomeTour';
import { ContextualHelp } from '@/components/ui/ContextualHelp';
import { DevGuide } from '@/components/ui/DevGuide';
import { FeedbackButton } from '@/components/ui/FeedbackDialog';

const WELCOME_TOUR_KEY = 'data-explorer-welcome-tour-completed';

export function AppLayout() {
  const viewMode = useAppStore((s) => s.viewMode);
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);

  useEffect(() => {
    // Check if user has seen the welcome tour
    const hasSeenTour = localStorage.getItem(WELCOME_TOUR_KEY);
    if (!hasSeenTour) {
      // Small delay to let the app render first
      setTimeout(() => setShowWelcomeTour(true), 500);
    }
  }, []);

  const handleTourComplete = () => {
    localStorage.setItem(WELCOME_TOUR_KEY, 'true');
    setShowWelcomeTour(false);
  };

  const handleTourSkip = () => {
    localStorage.setItem(WELCOME_TOUR_KEY, 'true');
    setShowWelcomeTour(false);
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden relative">
        {viewMode === 'bundles' && <BundleManager />}
        {viewMode === 'schemas' && <SchemaManager />}
        {viewMode === 'relationships' && <RelationshipManager />}
        {viewMode === 'explorer' && <Explorer />}
        {viewMode === 'journal' && <Journal />}
        {viewMode === 'ai-settings' && <AISettings />}

        {/* Contextual Help - Floating button per view */}
        <ContextualHelp view={viewMode} />

        {/* Dev/Techie Guide - Always available */}
        <DevGuide />
      </main>

      {/* Feedback Button - Always available */}
      <FeedbackButton />

      {/* Welcome Tour - First time only */}
      {showWelcomeTour && (
        <WelcomeTour onComplete={handleTourComplete} onSkip={handleTourSkip} />
      )}
    </div>
  );
}
