// Dedicated Companion Inspector Window Service
// Manages a docked, phone-sized popup window (490px x 840px)
// Keeps user logged into Instagram, stays pinned beside Backstage,
// and re-uses a single named window reference so tabs don't pile up.

let inspectorWindow: Window | null = null;

export interface CompanionInspectorOptions {
  width?: number;
  height?: number;
  focus?: boolean;
}

/**
 * Opens or focuses the docked Instagram Companion Inspector window.
 * If targetUrl is provided, navigates the inspector window to that actor's profile.
 */
export function openCompanionInspector(targetUrl?: string, options: CompanionInspectorOptions = {}): Window | null {
  const url = targetUrl || 'https://www.instagram.com/';
  const width = options.width || 490;
  const height = options.height || Math.min(window.screen.availHeight - 80, 880);
  
  // Dock cleanly to the right edge of the screen
  const left = Math.max(window.screen.availWidth - width - 20, 40);
  const top = 40;

  try {
    if (inspectorWindow && !inspectorWindow.closed) {
      if (targetUrl) {
        inspectorWindow.location.href = url;
      }
      if (options.focus !== false) {
        inspectorWindow.focus();
      }
      return inspectorWindow;
    }

    inspectorWindow = window.open(
      url,
      'BackstageTalentInspector',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes`
    );

    if (inspectorWindow && options.focus !== false) {
      inspectorWindow.focus();
    }

    return inspectorWindow;
  } catch (err) {
    console.warn('Failed to open companion inspector window:', err);
    // Fallback: regular tab
    window.open(url, '_blank', 'noopener,noreferrer');
    return null;
  }
}

/**
 * Returns true if the companion window is currently active/open.
 */
export function isCompanionInspectorOpen(): boolean {
  return !!(inspectorWindow && !inspectorWindow.closed);
}
