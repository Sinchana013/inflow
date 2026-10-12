import React, { createContext, useContext, useState, useCallback } from 'react';
import { SelectedObjectContext } from '../types';

interface ContextSelectionContextType {
  selectedObject: SelectedObjectContext | null;
  setSelectedObject: (obj: SelectedObjectContext | null) => void;
  clearSelectedObject: () => void;
  askAboutObject: (obj: SelectedObjectContext, prompt?: string) => void;
}

const ContextSelectionContext = createContext<ContextSelectionContextType | undefined>(undefined);

export const ContextSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedObject, setSelectedObject] = useState<SelectedObjectContext | null>(null);

  const clearSelectedObject = useCallback(() => {
    setSelectedObject(null);
  }, []);

  const askAboutObject = useCallback((obj: SelectedObjectContext, prompt?: string) => {
    setSelectedObject(obj);
    window.dispatchEvent(
      new CustomEvent('insightflow-ask-ai', {
        detail: { object: obj, prompt }
      })
    );
  }, []);

  return (
    <ContextSelectionContext.Provider
      value={{
        selectedObject,
        setSelectedObject,
        clearSelectedObject,
        askAboutObject
      }}
    >
      {children}
    </ContextSelectionContext.Provider>
  );
};

export const useContextSelection = (): ContextSelectionContextType => {
  const context = useContext(ContextSelectionContext);
  if (!context) {
    throw new Error('useContextSelection must be used within a ContextSelectionProvider');
  }
  return context;
};
