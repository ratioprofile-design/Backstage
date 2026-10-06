import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { ProductionDocument } from '../../types';
import { DocumentTwoColumnEditor } from './DocumentTwoColumnEditor';

export interface TamilLeftRightStudioViewProps {
  initialDocument?: ProductionDocument | null;
  initialRawText?: string;
  initialTitle?: string;
  onBackToVault: () => void;
  onSaveToVault?: (doc: ProductionDocument) => void;
  onNavigateToView?: (view: any) => void;
}

export const TamilLeftRightStudioView: React.FC<TamilLeftRightStudioViewProps> = ({
  initialDocument,
  initialRawText,
  initialTitle,
  onBackToVault,
  onSaveToVault,
}) => {
  const projectContext = useProject();
  const { appTheme } = projectContext;
  const isLight =
    appTheme === 'light' ||
    (appTheme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches);

  // Construct a fallback document if none is passed
  const doc: ProductionDocument = initialDocument || {
    id: `doc-${Date.now()}`,
    title: initialTitle || 'பைலட் ரங்கா',
    textContent: initialRawText || '',
    category: 'SCRIPT',
    format: 'DOCX',
    fileType: 'docx',
    dateAdded: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <DocumentTwoColumnEditor
        document={doc}
        onSave={(updatedDoc) => {
          if (onSaveToVault) {
            onSaveToVault(updatedDoc);
          }
        }}
        onClose={onBackToVault}
        isLight={isLight}
      />
    </div>
  );
};
