
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { generateTamilSuggestions } from '../services/tamilUtils';
import { useProject } from '../context/ProjectContext';

export interface ScriptEditorHandle {
  executeFormat: (type: string) => void;
  focus: () => void;
}

interface ScriptEditorProps {
  id?: string;
  initialHtml: string;
  onSave: (html: string) => void;
  onSaveImmediate?: (html: string) => void; // New prop for immediate saves
  className?: string;
  suggestions: string[]; // Characters
  onActiveFormatChange?: (format: string) => void;
  readOnly?: boolean;
  onFocus?: () => void;
  isActive?: boolean;
}

const TRANSITIONS = [
  'CUT TO:', 'FADE IN:', 'FADE OUT:', 'DISSOLVE TO:', 
  'SMASH CUT TO:', 'MATCH CUT TO:', 'JUMP CUT TO:', 'TIME CUT:', 'FADE TO BLACK:'
];

const CHARACTER_EXTENSIONS = [
  '(V.O.)', '(O.S.)', '(CONT\'D)', '(ON PHONE)', '(PRE-LAP)', '(FILTERED)'
];

export const ScriptEditor = forwardRef<ScriptEditorHandle, ScriptEditorProps>(({ 
    id, initialHtml, onSave, onSaveImmediate, className, suggestions, onActiveFormatChange, readOnly = false, onFocus, isActive = true
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const { isTamilMode, isOsInputMode, osInputShortcut, userDictionary, learnTamilWord } = useProject();
  
  // Character/Transition Autocomplete State
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [acPosition, setAcPosition] = useState({ top: 0, left: 0 });
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [acIndex, setAcIndex] = useState(0);

  // Preview State
  const originalTextRef = useRef<string>('');
  const isPreviewingRef = useRef<boolean>(false);

  // Tamil Transliteration State
  const [showTransliteration, setShowTransliteration] = useState(false);
  const [transCandidates, setTransCandidates] = useState<string[]>([]);
  const [currentTypingWord, setCurrentTypingWord] = useState('');
  
  // OS Input Logic
  const lastBlockWasTargetRef = useRef<boolean>(false);

  useImperativeHandle(ref, () => ({
      executeFormat: (type: string) => executeFormat(type),
      focus: () => editorRef.current?.focus()
  }));

  // Sync content from props ONLY if not focused
  useEffect(() => {
    if (
      editorRef.current && 
      editorRef.current.innerHTML !== initialHtml && 
      document.activeElement !== editorRef.current
    ) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  // Clear active bounds if not active scene
  useEffect(() => {
    if (!isActive && editorRef.current) {
        editorRef.current.querySelectorAll('.sc-active-block').forEach(el => {
            el.classList.remove('sc-active-block');
        });
    }
  }, [isActive]);

  const dispatchShortcut = () => {
    if (!osInputShortcut || readOnly) return;
    const parts = osInputShortcut.split('+');
    const code = parts.pop();
    if (!code) return;
    const modifiers = new Set(parts);
    const event = new KeyboardEvent('keydown', {
      key: code, code: code,
      altKey: modifiers.has('Alt'), ctrlKey: modifiers.has('Ctrl'), metaKey: modifiers.has('Meta'), shiftKey: modifiers.has('Shift'),
      bubbles: true, cancelable: true, view: window
    });
    document.dispatchEvent(event);
  };

  const highlightActiveBlock = (block: HTMLElement) => {
      // Clear previous active blocks within this editor
      if (editorRef.current) {
          editorRef.current.querySelectorAll('.sc-active-block').forEach(el => {
              if (el !== block) el.classList.remove('sc-active-block');
          });
      }
      // Add to current
      if (!block.classList.contains('sc-active-block')) {
          block.classList.add('sc-active-block');
      }
  };

  const detectFormat = () => {
    const block = getCurrentBlock();
    if (block) {
        highlightActiveBlock(block); // Apply Visual Highlight

        if (onActiveFormatChange) {
            if (block.classList.contains('sc-action')) onActiveFormatChange('action');
            else if (block.classList.contains('sc-character')) onActiveFormatChange('character');
            else if (block.classList.contains('sc-dialogue')) onActiveFormatChange('dialogue');
            else if (block.classList.contains('sc-parenthetical')) onActiveFormatChange('parenthetical');
            else if (block.classList.contains('sc-transition')) onActiveFormatChange('transition');
            else if (block.classList.contains('sc-shot')) onActiveFormatChange('shot');
            else if (block.classList.contains('sc-lyrics')) onActiveFormatChange('lyrics');
        }

        const isTargetBlock = block.classList.contains('sc-action') || block.classList.contains('sc-dialogue');
        if (isOsInputMode && !readOnly) {
            if (isTargetBlock && !lastBlockWasTargetRef.current) dispatchShortcut();
            else if (!isTargetBlock && lastBlockWasTargetRef.current) dispatchShortcut();
            lastBlockWasTargetRef.current = isTargetBlock;
        }
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (readOnly) return;
    
    // Detect deletion to prevent auto-preview fighting backspace
    const nativeEvent = e.nativeEvent as any;
    const isDelete = nativeEvent.inputType && nativeEvent.inputType.includes('delete');

    // If input happens, preview state is invalidated/consumed
    if (isPreviewingRef.current) {
        isPreviewingRef.current = false;
    }
    
    onSave(e.currentTarget.innerHTML);
    detectFormat();

    const block = getCurrentBlock();
    if (!block) return;

    if (block.classList.contains('sc-character') || block.classList.contains('sc-transition')) {
        setShowTransliteration(false);
        checkAutocomplete(!isDelete);
    } else if (block.classList.contains('sc-action') || block.classList.contains('sc-dialogue') || block.classList.contains('sc-lyrics')) {
        setShowAutocomplete(false);
        if (isTamilMode) checkTransliteration(block);
        else setShowTransliteration(false);
    } else {
        setShowAutocomplete(false);
        setShowTransliteration(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    
    // Use insertText command to paste plain text while preserving undo history
    const success = document.execCommand('insertText', false, text);
    
    if (!success) {
        // Fallback for browsers that might not support it
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        
        // Move caret
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Trigger manual update since execCommand usually triggers input event but this fallback might not be enough for react state
        if (editorRef.current) {
            onSave(editorRef.current.innerHTML);
            detectFormat();
        }
    }
  };

  const handleBlur = () => {
    if (readOnly) return;
    if (editorRef.current) {
        const content = editorRef.current.innerHTML;
        // Prioritize immediate save if provided to bypass debounce
        if (onSaveImmediate) {
            onSaveImmediate(content);
        } else {
            onSave(content);
        }
    }
    // Delayed hide to allow click events on the popup to fire
    setTimeout(() => { 
        setShowAutocomplete(false); 
        setShowTransliteration(false); 
        isPreviewingRef.current = false;
    }, 200);
  };

  const handleFocusEvent = () => {
      if(onFocus) onFocus();
      detectFormat(); // Highlight active block immediately on focus
  };

  const handleMouseUp = () => {
    detectFormat();
    setShowAutocomplete(false);
    setShowTransliteration(false);
    isPreviewingRef.current = false;
  };

  const getCurrentBlock = () => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return null;
    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;
    let block = node as HTMLElement;
    while (block && block !== editorRef.current && !block.classList.contains('sc-line')) {
        if(block.parentElement === editorRef.current) break;
        block = block.parentElement as HTMLElement;
    }
    return block;
  };

  const checkContd = (block: HTMLElement) => {
    if (!block.classList.contains('sc-character')) return;
    let rawText = block.textContent || '';
    
    // Don't interrupt if user is typing an extension (has unclosed parenthesis)
    const openCount = (rawText.match(/\(/g) || []).length;
    const closeCount = (rawText.match(/\)/g) || []).length;
    if (openCount > closeCount) return;

    // Check previous speaker for ABAB pattern
    const contdRegex = /\s*\(\s*(?:CONT['’.]?D\.?|CONTINUED)\s*\)/gi;
    const extensionRegex = /\s*\([^)]+\)/g;

    // Extract root name by removing CONT'D and any extensions (V.O., O.S.)
    const temp = rawText.replace(contdRegex, '');
    const currentRootName = temp.replace(extensionRegex, '').trim().toUpperCase();
    
    if (!currentRootName) return;

    let prev = block.previousElementSibling;
    let prevRootName = '';
    while (prev) {
        if (prev.classList.contains('sc-character')) {
             const pText = (prev as HTMLElement).textContent || '';
             const pTemp = pText.replace(contdRegex, '');
             prevRootName = pTemp.replace(extensionRegex, '').trim().toUpperCase();
             break;
        }
        prev = prev.previousElementSibling;
    }

    if (prevRootName && prevRootName === currentRootName) {
        // Needs CONT'D. But let's verify ordering.
        const finalString = reorderCharacterString(rawText + " (CONT'D)");
        if (rawText.trim() !== finalString) {
            block.textContent = finalString;
            moveCursorToEnd(block);
        }
    } else {
        // Remove CONT'D if it shouldn't be there, but keep other extensions
        const cleaned = reorderCharacterString(rawText.replace(contdRegex, ''));
        if (rawText.trim() !== cleaned) {
            block.textContent = cleaned;
            moveCursorToEnd(block);
        }
    }
  };

  const reorderCharacterString = (text: string) => {
    // 1. Extract (CONT'D)
    const contdRegex = /\s*\(\s*(?:CONT['’.]?D\.?|CONTINUED)\s*\)/gi;
    const hasContd = contdRegex.test(text);
    let clean = text.replace(contdRegex, '');

    // 2. Extract other extensions like (V.O.), (O.S.)
    const extRegex = /\s*\([^)]+\)/g;
    const extensions = clean.match(extRegex) || [];
    
    // 3. Get Base Name
    let name = clean.replace(extRegex, '').trim();

    // 4. Reconstruct: Name + Extensions + (CONT'D)
    let result = name;
    if (extensions.length > 0) {
        // Join extensions, ensuring single spaces
        result += ' ' + extensions.map(e => e.trim()).join(' ');
    }
    if (hasContd) {
        // If extensions exist, attach (CONT'D) directly (tight). 
        // If just Name, add space before (CONT'D).
        if (extensions.length > 0) {
            result += "(CONT'D)";
        } else {
            result += " (CONT'D)";
        }
    }
    return result.toUpperCase();
  };

  // Looks for ABAB pattern to predict next speaker
  const predictNextSpeaker = (currentBlock: HTMLElement): string | null => {
    let prev = currentBlock.previousElementSibling;
    const speakers: string[] = [];
    
    // Look back for last 2 unique speakers
    while (prev && speakers.length < 2) {
        if (prev.classList.contains('sc-character')) {
            const name = prev.textContent?.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
            if (name && !speakers.includes(name)) {
                speakers.push(name);
            }
        }
        prev = prev.previousElementSibling;
    }
    
    if (speakers.length === 2) {
        // Return the one who spoke before the last speaker (Conversation partner)
        return speakers[1];
    }
    return null;
  };

  const checkAutocomplete = (allowAutoPreview: boolean = true) => {
    const block = getCurrentBlock();
    if (!block) { setShowAutocomplete(false); return; }

    let list: string[] = [];
    let text = block.innerText.toUpperCase();
    // Do not trim immediately so we can detect trailing space

    const enablePreview = (suggestions: string[]) => {
        updatePopupPosition();
        setFilteredSuggestions(suggestions);
        setAcIndex(0);
        setShowAutocomplete(true);
        
        if (allowAutoPreview && suggestions.length > 0) {
            // Save what user literally typed before we mess with it
            originalTextRef.current = block.innerText;
            isPreviewingRef.current = true;
            
            // Preview it, select all
            previewSuggestion(suggestions[0], true);
        }
    };

    if (block.classList.contains('sc-character')) {
        // --- 1. EXTENSION MODE (Parenthesis) ---
        if (text.includes('(')) {
            const parts = text.split('(');
            const extTyped = parts[parts.length-1] || ''; // Last part
            
            // Don't show if already closed
            if (!text.trim().endsWith(')')) {
                const matches = CHARACTER_EXTENSIONS.filter(ext => 
                    ext.replace(/[()]/g, '').startsWith(extTyped.replace(/[()]/g, '')) 
                );
                if (matches.length > 0) {
                    enablePreview(matches);
                    return;
                }
            }
        } 
        // --- 2. EXTENSION MODE (Space Trigger) ---
        else if (text.endsWith(' ') && !text.includes('(')) {
             // User typed "NAME ", show extensions
             enablePreview(CHARACTER_EXTENSIONS);
             return;
        }
        
        // --- 3. PREDICTION MODE (Empty Block) ---
        else if (text.trim().length === 0) {
            const predicted = predictNextSpeaker(block);
            if (predicted) {
                const otherSuggestions = suggestions.filter(s => s !== predicted);
                const predictionList = [predicted, ...otherSuggestions];
                enablePreview(predictionList.slice(0, 5));
                return;
            } else if (suggestions.length > 0) {
                enablePreview(suggestions.slice(0, 5));
                return;
            }
        }

        // --- 4. STANDARD AUTOCOMPLETE ---
        else {
            list = suggestions;
            const cleanText = text.trim();
            if (list.length > 0) {
                const matches = list.filter(s => s.startsWith(cleanText) && s !== cleanText).slice(0, 5);
                if (matches.length > 0) {
                    enablePreview(matches);
                    return;
                }
            }
        }
    } 
    else if (block.classList.contains('sc-transition')) {
        list = TRANSITIONS;
        const cleanText = text.trim();
        if (cleanText.length > 0) {
            const matches = list.filter(s => s.startsWith(cleanText) && s !== cleanText).slice(0, 5);
            if (matches.length > 0) {
                enablePreview(matches);
                return;
            }
        }
    }

    setShowAutocomplete(false);
  };

  const previewSuggestion = (val: string, selectFull: boolean = false) => {
    const block = getCurrentBlock();
    if (block) {
        const typed = originalTextRef.current;
        let newText = val;
        
        // Handle Extensions: Replace only the part after last '(' or append if space
        if (block.classList.contains('sc-character')) {
            if (typed.includes('(')) {
                const lastOpenParenIndex = typed.lastIndexOf('(');
                const base = typed.substring(0, lastOpenParenIndex).trim();
                newText = `${base} ${val}`;
            } else if (typed.endsWith(' ')) {
                // Space trigger case
                newText = `${typed.trim()} ${val}`;
            }
        }

        block.innerText = newText;
        
        // Highlight the predicted part or full text
        const sel = window.getSelection();
        if (sel && block.firstChild) {
            const range = document.createRange();
            
            if (block.classList.contains('sc-character') && (typed.includes('(') || typed.endsWith(' '))) {
                 // For extension mode, select only the extension part
                 const matchStart = newText.lastIndexOf(val);
                 if (matchStart >= 0) {
                     range.setStart(block.firstChild, matchStart);
                     range.setEnd(block.firstChild, newText.length);
                 } else {
                     moveCursorToEnd(block);
                 }
            } else {
                 // Standard Name Autocomplete
                 // Select only the suggested suffix so typing continues
                 if (newText.toUpperCase().startsWith(typed.toUpperCase())) {
                     // Ensure the text node exists and has content
                     if (block.firstChild && block.firstChild.nodeType === 3) {
                         const startPos = Math.min(typed.length, newText.length);
                         range.setStart(block.firstChild, startPos);
                         range.setEnd(block.firstChild, newText.length);
                     } else {
                         range.selectNodeContents(block);
                     }
                 } else {
                     range.selectNodeContents(block);
                 }
            }
            
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            moveCursorToEnd(block);
        }
    }
  };

  const applySuggestion = (val: string, moveNext: boolean = false) => {
    const block = getCurrentBlock();
    if (block) {
        let finalText = val;
        const typed = originalTextRef.current;

        if (block.classList.contains('sc-character')) {
             if (typed.includes('(')) {
                 const lastOpenParenIndex = typed.lastIndexOf('(');
                 const base = typed.substring(0, lastOpenParenIndex).trim();
                 finalText = `${base} ${val}`;
             } else if (typed.endsWith(' ')) {
                 finalText = `${typed.trim()} ${val}`;
             }
        }

        block.innerText = finalText;
        
        checkContd(block); // This will handle reordering if needed
        moveCursorToEnd(block);
        
        setShowAutocomplete(false);
        isPreviewingRef.current = false;
        
        onSave(editorRef.current?.innerHTML || '');

        if (moveNext) {
            handleEnter(block);
        }
    }
  };

  const checkTransliteration = (block: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== 3) { setShowTransliteration(false); return; }
    
    const textContent = textNode.textContent || '';
    const caretPos = range.startOffset;
    const textBefore = textContent.slice(0, caretPos);
    const lastSpaceIndex = Math.max(textBefore.lastIndexOf(' '), textBefore.lastIndexOf('\n'), textBefore.lastIndexOf('\u00A0'));
    const currentWord = textBefore.slice(lastSpaceIndex + 1);

    if (currentWord.length > 0 && /[a-zA-Z]/.test(currentWord)) {
        const variants = generateTamilSuggestions(currentWord, userDictionary);
        if (variants.length > 0) {
            setCurrentTypingWord(currentWord);
            setTransCandidates(variants);
            updatePopupPosition(); // Use cursor based positioning
            setShowTransliteration(true);
        } else {
            setShowTransliteration(false);
        }
    } else {
        setShowTransliteration(false);
    }
  };

  const applyTransliteration = (selectedTamil: string) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    if (currentTypingWord) learnTamilWord(currentTypingWord, selectedTamil);

    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    const textContent = textNode.textContent || '';
    const caretPos = range.startOffset;
    const textBefore = textContent.slice(0, caretPos);
    const lastSpaceIndex = Math.max(textBefore.lastIndexOf(' '), textBefore.lastIndexOf('\n'), textBefore.lastIndexOf('\u00A0'));
    const wordStart = lastSpaceIndex + 1;
    const newText = textContent.slice(0, wordStart) + selectedTamil + textContent.slice(caretPos);
    textNode.textContent = newText;

    const newCaretPos = wordStart + selectedTamil.length;
    const newRange = document.createRange();
    newRange.setStart(textNode, newCaretPos);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setShowTransliteration(false);
    onSave(editorRef.current?.innerHTML || '');
  };

  // Uses Selection API to get screen coordinates of the cursor
  const updatePopupPosition = () => {
     const sel = window.getSelection();
     if (!sel || !sel.rangeCount) return;
     const range = sel.getRangeAt(0);
     const rect = range.getBoundingClientRect();
     
     // Fallback if rect is all zeros (e.g. empty line sometimes)
     if (rect.top === 0 && rect.left === 0) {
         const block = getCurrentBlock();
         if (block) {
             const blockRect = block.getBoundingClientRect();
             setAcPosition({ top: blockRect.bottom, left: blockRect.left });
         }
     } else {
         setAcPosition({ top: rect.bottom + 5, left: rect.left });
     }
  };

  const moveCursorToEnd = (element: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const executeFormat = (type: string) => {
    if (readOnly) return;
    const block = getCurrentBlock();
    if (block) {
        // Clear all sc- classes
        block.className = `sc-line sc-${type}`;
        
        // Add active class back if it was active
        highlightActiveBlock(block);

        let didModifyText = false;
        let createdEmptyParenthetical = false;

        // Specific logic
        if (type === 'parenthetical') {
            const currentText = block.textContent || '';
            const trimmed = currentText.trim();
            
            if (trimmed === '' || trimmed === '()') {
                block.innerText = '()';
                didModifyText = true;
                createdEmptyParenthetical = true;
            } else if (!trimmed.startsWith('(')) {
                block.innerText = `(${currentText})`;
                didModifyText = true;
            }
        } else if (type === 'shot') {
            block.style.textTransform = 'uppercase'; // Force visuals
        } else if (type === 'character' || type === 'transition') {
            if (block.innerText !== block.innerText.toUpperCase()) {
                block.innerText = block.innerText.toUpperCase();
                didModifyText = true;
            }
        }
        
        // Clean parens if leaving parenthetical
        if (type !== 'parenthetical') {
            const currentText = block.innerText;
            if (currentText.trim().startsWith('(') && currentText.trim().endsWith(')')) {
                block.innerText = currentText.replace(/^\(|\)$/g, '');
                didModifyText = true;
            }
        }

        if (onActiveFormatChange) onActiveFormatChange(type);
        onSave(editorRef.current?.innerHTML || '');
        editorRef.current?.focus(); // Ensure focus remains
        
        if (createdEmptyParenthetical && block.firstChild) {
            const range = document.createRange();
            const textNode = block.firstChild;
            const safeIdx = Math.min(1, (textNode.textContent || '').length);
            range.setStart(textNode, safeIdx); 
            range.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
        } else if (didModifyText) {
            moveCursorToEnd(block);
        }
        
        // If switching TO character, try prediction immediately
        if (type === 'character') {
            setTimeout(checkAutocomplete, 10);
        }
    }
  };

  // Separated logic to create new line
  const handleEnter = (block: HTMLElement) => {
        let nextType = 'action';
        
        // Check for empty block using textContent for better reliability
        const text = block.textContent || '';
        if (text.trim() === '') {
             if (block.classList.contains('sc-character')) {
                 executeFormat('action');
                 return;
             }
        }

        // Reorder if Character
        if (block.classList.contains('sc-character')) { 
            const reordered = reorderCharacterString(block.innerText);
            if (block.innerText !== reordered) block.innerText = reordered;
            
            checkContd(block); 
            nextType = 'dialogue'; 
        }
        else if (block.classList.contains('sc-parenthetical')) {
            nextType = 'dialogue';
        }
        else if (block.classList.contains('sc-dialogue')) {
            nextType = 'character'; 
        }
        else if (block.classList.contains('sc-transition')) {
            nextType = 'action'; 
        }
        else if (block.classList.contains('sc-shot')) {
            nextType = 'action';
        }
        else if (block.classList.contains('sc-lyrics')) {
            nextType = 'lyrics';
        }
        else if (block.classList.contains('sc-action')) {
            nextType = 'action';
        }

        const newDiv = document.createElement('div');
        newDiv.className = `sc-line sc-${nextType}`;
        newDiv.innerHTML = '<br>';
        if (block) block.after(newDiv);
        else editorRef.current?.appendChild(newDiv);

        const range = document.createRange();
        range.setStart(newDiv, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        
        newDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        detectFormat();
        onSave(editorRef.current?.innerHTML || '');
        
        if (nextType === 'character') {
            setTimeout(checkAutocomplete, 10);
        }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly) return;

    // --- SHORTCUTS (Alt/Option + 1-7) ---
    // Moved to very top with explicit stopPropagation to prevent OS symbols
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const code = e.code;
        // Normalize Key Code (Digit or Numpad)
        let formatType = '';
        if (code === 'Digit1' || code === 'Numpad1') formatType = 'action';
        else if (code === 'Digit2' || code === 'Numpad2') formatType = 'character';
        else if (code === 'Digit3' || code === 'Numpad3') formatType = 'dialogue';
        else if (code === 'Digit4' || code === 'Numpad4') formatType = 'parenthetical';
        else if (code === 'Digit5' || code === 'Numpad5') formatType = 'transition';
        else if (code === 'Digit6' || code === 'Numpad6') formatType = 'shot';
        else if (code === 'Digit7' || code === 'Numpad7') formatType = 'lyrics';

        if (formatType) {
            e.preventDefault();
            e.stopPropagation();
            executeFormat(formatType);
            return;
        }
    }

    // --- PRIORITY TAB for CHARACTER -> TRANSITION ---
    // User request: Tab on Character should always switch to Transition, ignoring autocomplete
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const block = getCurrentBlock();
        if (block && block.classList.contains('sc-character')) {
             e.preventDefault();
             e.stopPropagation();
             
             // If we were previewing a suggestion, revert it before switching
             // This ensures we keep what the user literally typed instead of the suggestion
             if (isPreviewingRef.current && originalTextRef.current) {
                 block.innerText = originalTextRef.current;
                 moveCursorToEnd(block); 
             }

             setShowAutocomplete(false);
             setShowTransliteration(false);
             isPreviewingRef.current = false;
             
             executeFormat('transition');
             return;
        }
    }

    // --- CTRL+ENTER / CMD+ENTER (Force Action) ---
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const block = getCurrentBlock();
        const newDiv = document.createElement('div');
        newDiv.className = 'sc-line sc-action';
        newDiv.innerHTML = '<br>';
        
        if (block) {
            block.after(newDiv);
        } else {
            editorRef.current?.appendChild(newDiv);
        }

        const range = document.createRange();
        range.setStart(newDiv, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        
        newDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        detectFormat();
        onSave(editorRef.current?.innerHTML || '');
        
        // Close menus if open
        setShowAutocomplete(false);
        setShowTransliteration(false);
        isPreviewingRef.current = false;
        return;
    }

    if (showAutocomplete) {
        // --- PREVIEW LOGIC (ARROWS CYCLING) ---
        // Removed Tab from cycling logic
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            
            // Start preview session if not active
            if (!isPreviewingRef.current) {
                const block = getCurrentBlock();
                if (block) originalTextRef.current = block.innerText; // Captures current state (which might be fully selected suggestion if previously auto-previewed?)
                isPreviewingRef.current = true;
            }

            let newIndex = acIndex;
            if (e.key === 'ArrowDown') {
                newIndex = (acIndex + 1) % filteredSuggestions.length;
            } else { // ArrowUp
                newIndex = (acIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length;
            }
            
            setAcIndex(newIndex);
            // Re-preview, selecting suffix or full text
            previewSuggestion(filteredSuggestions[newIndex], true);
            return; 
        }

        // --- CONFIRM SELECTION (ENTER + TAB) ---
        // Added Tab here to act as selection confirmation (stops cycling)
        if (e.key === 'Enter' || e.key === 'Tab') { 
            e.preventDefault(); 
            e.stopPropagation(); // Ensure bubbling stops so no other Tab handler runs
            // Confirm and Move Next if it's Enter/Tab
            applySuggestion(filteredSuggestions[acIndex], true); 
            return; 
        }
        
        if (e.key === 'Escape') { 
            e.preventDefault(); 
            e.stopPropagation(); 
            
            // Revert preview if active
            if (isPreviewingRef.current) {
                const block = getCurrentBlock();
                if (block) {
                    block.innerText = originalTextRef.current;
                    moveCursorToEnd(block);
                }
            }
            
            setShowAutocomplete(false);
            isPreviewingRef.current = false;
            return; 
        }
    }

    if (showTransliteration && isTamilMode) {
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= 9) {
            e.preventDefault();
            const index = num - 1;
            if (index < transCandidates.length) applyTransliteration(transCandidates[index]);
            return;
        }
        if (e.key === 'Enter' || e.key === 'Tab' || e.key === ' ') { e.preventDefault(); applyTransliteration(transCandidates[0] + (e.key === ' ' ? ' ' : '')); return; }
        if (['.', ',', '?', '!'].includes(e.key)) { e.preventDefault(); applyTransliteration(transCandidates[0] + e.key); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setShowTransliteration(false); return; }
    }

    // --- TAB CYCLE (Standard Script Element Cycle - Only if Autocomplete Closed) ---
    if (e.key === 'Tab') {
      const block = getCurrentBlock();
      if (block) {
         e.preventDefault();

         const text = block.innerText;
         // SPECIAL LOGIC: Split multi-line Dialogue on Tab -> Parenthetical
         // Only if it actually has content (non-empty) AND newlines
         if (block.classList.contains('sc-dialogue') && text.trim().length > 0 && text.includes('\n')) {
             const sel = window.getSelection();
             if (sel && sel.rangeCount) {
                 const range = sel.getRangeAt(0);
                 const preRange = document.createRange();
                 preRange.selectNodeContents(block);
                 preRange.setEnd(range.endContainer, range.endOffset);
                 const preText = preRange.toString();
                 
                 const lineIndex = (preText.match(/\n/g) || []).length;
                 const lines = text.split('\n');
                 
                 const beforeText = lines.slice(0, lineIndex).join('\n');
                 const targetText = lines[lineIndex];
                 const afterText = lines.slice(lineIndex + 1).join('\n');

                 let targetBlock: HTMLElement = block;

                 if (beforeText) {
                     block.innerText = beforeText;
                     const newBlock = document.createElement('div');
                     newBlock.className = 'sc-line sc-parenthetical';
                     newBlock.innerText = targetText.startsWith('(') ? targetText : `(${targetText})`;
                     block.after(newBlock);
                     targetBlock = newBlock;
                 } else {
                     block.className = 'sc-line sc-parenthetical';
                     block.innerText = targetText.startsWith('(') ? targetText : `(${targetText})`;
                 }

                 if (afterText) {
                     const afterBlock = document.createElement('div');
                     afterBlock.className = 'sc-line sc-dialogue';
                     afterBlock.innerText = afterText;
                     targetBlock.after(afterBlock);
                 }

                 moveCursorToEnd(targetBlock);
                 onSave(editorRef.current?.innerHTML || '');
                 return;
             }
         }

         const classes = block.classList;
         
         // Character Tab Logic: Switch to Transition (Handled by priority check above, but keep as fallback)
         if (classes.contains('sc-character')) {
             executeFormat('transition');
             return;
         }

         // Standard Cycle
         let nextType = 'action';
         
         if (classes.contains('sc-action')) nextType = 'character';
         // sc-character case handled above
         else if (classes.contains('sc-transition')) nextType = 'action'; 
         
         else if (classes.contains('sc-dialogue')) nextType = 'parenthetical';
         else if (classes.contains('sc-parenthetical')) nextType = 'dialogue';
         else if (classes.contains('sc-shot')) nextType = 'action';
         else if (classes.contains('sc-lyrics')) nextType = 'action';
         
         executeFormat(nextType);
      }
    }

    // --- ENTER LOGIC ---
    if (e.key === 'Enter') {
        if (e.shiftKey) { return; }

        e.preventDefault();
        const block = getCurrentBlock();
        
        if (block) {
            handleEnter(block);
        }
    }
  };

  const handleKeyUp = () => detectFormat();

  return (
    <>
        <div
            id={id}
            ref={editorRef}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className={`outline-none w-full whitespace-pre-wrap ${className} ${readOnly ? 'cursor-default' : ''}`}
            onBlur={handleBlur}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onMouseUp={handleMouseUp}
            onPaste={handlePaste}
            onFocus={handleFocusEvent}
        />
        
        {!readOnly && showAutocomplete && createPortal(
            <div 
                className="fixed bg-white border border-gray-300 shadow-xl rounded z-[99999] w-48 max-h-40 overflow-y-auto font-sans" 
                style={{ top: acPosition.top, left: acPosition.left }}
            >
                {filteredSuggestions.map((s, i) => (
                    <div 
                        key={s} 
                        className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${i === acIndex ? 'bg-orange-100 text-orange-800' : 'text-gray-700 hover:bg-gray-100'}`} 
                        onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                    >
                        {s}
                    </div>
                ))}
            </div>,
            document.body
        )}

        {!readOnly && showTransliteration && isTamilMode && createPortal(
            <div 
                className="fixed bg-[#222] border border-[#444] shadow-2xl rounded z-[99999] flex flex-row items-center overflow-hidden font-sans" 
                style={{ top: acPosition.top, left: acPosition.left }}
            >
                <div className="bg-[#333] px-2 py-2 text-[10px] text-[#888] border-r border-[#444] uppercase font-bold flex items-center">{currentTypingWord}</div>
                <div className="flex flex-row">
                    {transCandidates.map((s, i) => (
                        <div key={s} className="px-3 py-2 text-sm font-medium cursor-pointer transition-colors text-gray-200 hover:bg-[#333] hover:text-[#f5a623] border-r border-[#333] last:border-0 flex gap-2 items-center" onMouseDown={(e) => { e.preventDefault(); applyTransliteration(s); }}>
                            <span className="text-[10px] text-gray-500 font-bold bg-black/30 px-1 rounded">{i+1}</span>
                            <span>{s}</span>
                        </div>
                    ))}
                </div>
            </div>,
            document.body
        )}
    </>
  );
});
