
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Bold, Italic, Underline, Heading, List, CheckSquare, Quote } from 'lucide-react';
import { ScratchpadConfig } from '../types';

interface BlockEditorProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    minHeight?: string;
    onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
    className?: string;
    fontFamily?: string;
    fontSize?: number;
    style?: React.CSSProperties; 
    showToolbar?: boolean;
    config?: Partial<ScratchpadConfig>;
    readOnly?: boolean;
    transparent?: boolean; // Removes background/border
    chromeless?: boolean; // Removes all padding/decorations for pure text feel
}

// Default Configuration to fallback (Matches CharacterView aesthetic)
const DEFAULT_CONFIG: Partial<ScratchpadConfig> = {
    h1Color: '#f5a623',
    h2Color: '#22c55e',
    boldColor: '#f5a623',
    italicColor: '#cccccc',
    listMarkerColor: '#f5a623',
    calloutBackground: 'rgba(245, 166, 35, 0.05)',
    calloutBorder: '#f5a623',
    todoBorder: '#555',
    todoCheckColor: '#f5a623',
    fontSize: 14,
    h1FontSize: 20,
    h2FontSize: 16,
    listMarkerSize: 100,
    listMarkerTopOffset: 0,
    checkboxSize: 12,
    checkboxTopOffset: 0
};

export const BlockEditor: React.FC<BlockEditorProps> = ({ 
    value, onChange, placeholder, minHeight = "150px", onFocus, 
    className, fontFamily, fontSize, style, showToolbar = true,
    config, readOnly = false, transparent = false, chromeless = false
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isLocked = useRef(false);
    const [isFocused, setIsFocused] = useState(false);
    
    const scopeId = useMemo(() => `be-${Math.random().toString(36).substr(2, 9)}`, []);

    useEffect(() => {
        if (editorRef.current && !isLocked.current) {
            if (editorRef.current.innerHTML !== value) {
                const isHtml = /<[a-z][\s\S]*>/i.test(value);
                if (!value || value.trim() === '') {
                    editorRef.current.innerHTML = `<div class="nl-block"><br></div>`;
                } else if (!isHtml) {
                    editorRef.current.innerHTML = value.split('\n').map((line: string) => `<div class="nl-block">${line || '<br>'}</div>`).join('');
                } else {
                    editorRef.current.innerHTML = value;
                }
            }
        }
    }, [value]);

    const emitChange = () => {
        if (editorRef.current && !readOnly) {
            isLocked.current = true; 
            onChange(editorRef.current.innerHTML);
            setTimeout(() => isLocked.current = false, 0);
        }
    };

    const handleFocusInternal = (e: React.FocusEvent<HTMLDivElement>) => {
        if (readOnly) return;
        setIsFocused(true);
        if (onFocus) onFocus(e);
    };

    const handleBlurInternal = (e: React.FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsFocused(false);
        }
    };

    // --- TOOLBAR ACTIONS ---
    const format = (cmd: string, arg?: string) => {
        document.execCommand(cmd, false, arg);
        editorRef.current?.focus();
    };

    const toggleBlock = (cls: string) => {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        let node = sel.anchorNode;
        if (node?.nodeType === 3) node = node.parentNode;
        
        let block = node as HTMLElement;
        while (block && block !== editorRef.current && !block.classList.contains('nl-block')) {
            block = block.parentElement as HTMLElement;
        }

        if (block && block.classList.contains('nl-block')) {
            if (block.classList.contains(cls)) {
                block.className = 'nl-block';
            } else {
                block.className = `nl-block ${cls}`;
            }
            emitChange();
        }
        editorRef.current?.focus();
    };

    // --- MARKDOWN AUTO-FORMATTING ---
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (readOnly) return;

        // Enter key: Ensure new block creation preserves basic structure
        if (e.key === 'Enter') {
            const sel = window.getSelection();
            if (sel && sel.anchorNode) {
                let node = sel.anchorNode;
                if (node.nodeType === 3) node = node.parentNode;
                const el = node as HTMLElement;
                if (el.classList.contains('nl-h1') || el.classList.contains('nl-h2')) {
                    e.preventDefault();
                    document.execCommand('insertHTML', false, '<div class="nl-block"><br></div>');
                }
            }
        }

        // Space key trigger for Markdown
        if (e.key === ' ') {
            const sel = window.getSelection();
            if (!sel || !sel.isCollapsed) return;
            
            let node = sel.anchorNode;
            if (node?.nodeType === 3) node = node.parentNode;
            const element = node as HTMLElement;
            
            if (element && element.classList.contains('nl-block')) {
                const text = element.textContent || '';
                
                const patterns = [
                    { match: /^#$/, cls: 'nl-h1' },
                    { match: /^##$/, cls: 'nl-h2' },
                    { match: /^\*$/, cls: 'nl-list' },
                    { match: /^-$/, cls: 'nl-list' },
                    { match: /^1\.$/, cls: 'nl-num' },
                    { match: /^\[\]$/, cls: 'nl-check' },
                    { match: /^\[x\]$/i, cls: 'nl-check nl-checked' },
                    { match: /^>$/, cls: 'nl-quote' },
                ];

                for (const p of patterns) {
                    if (p.match.test(text)) {
                        e.preventDefault(); // Prevent the space
                        element.className = `nl-block ${p.cls}`;
                        element.innerHTML = '<br>'; // Clear trigger text
                        emitChange();
                        return;
                    }
                }
            }
        }
    };

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        if (readOnly) return;
        emitChange();
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (readOnly) return;
        const target = e.target as HTMLElement;
        if (target.classList.contains('nl-check')) {
            const rect = target.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX < 30) {
                e.preventDefault();
                e.stopPropagation();
                target.classList.toggle('nl-checked');
                emitChange();
            }
        }
    };

    // Construct dynamic CSS variables based on config prop merged with defaults
    const dynamicStyle = useMemo(() => {
        const finalConfig = { ...DEFAULT_CONFIG, ...config };
        
        return {
            ...style,
            '--sp-base-size': `${finalConfig.fontSize || 14}px`,
            '--sp-line-height': finalConfig.lineHeight || 1.6,
            '--sp-h1-size': `${finalConfig.h1FontSize || 20}px`,
            '--sp-h2-size': `${finalConfig.h2FontSize || 16}px`,
            '--sp-h1-color': finalConfig.h1Color || '#f5a623',
            '--sp-h2-color': finalConfig.h2Color || '#22c55e',
            '--sp-bold-color': finalConfig.boldColor || '#f5a623',
            '--sp-italic-color': finalConfig.italicColor || '#cccccc',
            '--sp-list-marker': finalConfig.listMarkerColor || '#f5a623',
            '--sp-marker-size': `${finalConfig.listMarkerSize || 100}%`,
            '--sp-marker-top': `${finalConfig.listMarkerTopOffset || 0}px`,
            '--sp-h1-deco': finalConfig.h1Underline ? 'underline' : 'none',
            '--sp-h2-deco': finalConfig.h2Underline ? 'underline' : 'none',
            '--sp-h1-style': finalConfig.h1Italic ? 'italic' : 'normal',
            '--sp-h2-style': finalConfig.h2Italic ? 'italic' : 'normal',
            '--sp-callout-bg': finalConfig.calloutBackground || 'rgba(245, 166, 35, 0.05)',
            '--sp-callout-border': finalConfig.calloutBorder || '#f5a623',
            '--sp-todo-border': finalConfig.todoBorder || '#555',
            '--sp-todo-check': finalConfig.todoCheckColor || '#f5a623',
            '--sp-checkbox-size': `${finalConfig.checkboxSize || 12}px`,
            '--sp-checkbox-top': `${finalConfig.checkboxTopOffset || 0}px`,
        } as React.CSSProperties;
    }, [config, style]);

    const activeFont = config?.fontFamily || fontFamily || 'inherit';
    const activeSize = config?.fontSize || fontSize || 14;

    // --- CONDITIONAL CLASSES ---
    const isClean = transparent || chromeless;
    const containerClasses = isClean 
        ? `w-full bg-transparent border-none ${className}` 
        : `w-full bg-[#0a0a0a] rounded border border-[#222] hover:border-[#333] transition-all flex flex-col overflow-hidden focus-within:border-[#f5a623] focus-within:shadow-[0_0_15px_rgba(245,166,35,0.1)] ${className}`;
    
    const contentClasses = chromeless
        ? `flex-1 p-0 outline-none custom-scrollbar relative z-10 block-editor-content`
        : `flex-1 p-4 outline-none custom-scrollbar relative z-10 block-editor-content`;

    const placeholderTop = chromeless ? '0px' : (showToolbar && isFocused ? '32px' : '0px');
    const placeholderClasses = chromeless
        ? `absolute inset-0 p-0 text-gray-600 font-sans leading-relaxed pointer-events-none italic select-none`
        : `absolute inset-0 p-4 text-gray-600 font-sans leading-relaxed pointer-events-none italic select-none`;

    return (
        <div 
            className={`flex flex-col group relative ${scopeId} ${containerClasses}`} 
            style={{ minHeight, ...dynamicStyle }}
            onBlur={handleBlurInternal}
        >
            <style>{`
                .${scopeId} { counter-reset: nl-num; }
                .${scopeId} .nl-block { 
                    position: relative; 
                    min-height: 1.5em; 
                    margin-bottom: 2px; 
                    padding: 2px 4px;
                    border-radius: 2px;
                    color: #e5e5e5; 
                    font-size: var(--sp-base-size, ${activeSize}px); 
                    line-height: var(--sp-line-height, 1.6);
                }
                .${scopeId} .nl-block:focus { outline: none; background: rgba(255,255,255,0.05); }
                
                /* MARKDOWN STYLES */
                .${scopeId} .nl-h1 { 
                    font-size: var(--sp-h1-size, 20px); 
                    color: var(--sp-h1-color); 
                    font-weight: 900; 
                    border-bottom: 1px solid #333; 
                    margin-top: 0.5em;
                    margin-bottom: 0.2em;
                    text-decoration: var(--sp-h1-deco); 
                    font-style: var(--sp-h1-style); 
                }
                .${scopeId} .nl-h2 { 
                    font-size: var(--sp-h2-size, 16px); 
                    color: var(--sp-h2-color); 
                    font-weight: 700; 
                    margin-top: 0.5em; 
                    text-decoration: var(--sp-h2-deco); 
                    font-style: var(--sp-h2-style); 
                }
                .${scopeId} .nl-quote { 
                    border-left: 3px solid var(--sp-callout-border); 
                    background: var(--sp-callout-bg); 
                    padding-left: 10px; 
                    font-style: italic; 
                    color: #bbb; 
                }
                .${scopeId} .nl-list { padding-left: 1.5em; }
                .${scopeId} .nl-list::before { 
                    content: '•'; position: absolute; left: 0.5em; 
                    color: var(--sp-list-marker); font-weight: bold; font-size: var(--sp-marker-size, 100%);
                    top: var(--sp-marker-top, 0px);
                }
                .${scopeId} .nl-num { padding-left: 1.5em; counter-increment: nl-num; }
                .${scopeId} .nl-num::before { 
                    content: counter(nl-num) "."; position: absolute; left: 0.5em; 
                    color: #3b82f6; font-weight: bold; font-size: 0.8em; 
                    top: calc(2px + var(--sp-marker-top, 0px)); 
                }
                .${scopeId} .nl-check { padding-left: 1.8em; position: relative; }
                .${scopeId} .nl-check::before { 
                    content: ''; position: absolute; left: 0.5em; top: calc(0.4em + var(--sp-checkbox-top, 0px)); 
                    width: var(--sp-checkbox-size, 12px); height: var(--sp-checkbox-size, 12px); 
                    border: 1px solid var(--sp-todo-border); border-radius: 3px; cursor: pointer;
                }
                .${scopeId} .nl-check.nl-checked::after {
                    content: '✓'; position: absolute; left: 0.5em; top: calc(0.1em + var(--sp-checkbox-top, 0px));
                    font-size: var(--sp-checkbox-size, 12px); font-weight: bold; color: var(--sp-todo-check); pointer-events: none;
                }
                .${scopeId} .nl-check.nl-checked { text-decoration: line-through; opacity: 0.6; }
            `}</style>
            
            {showToolbar && !readOnly && !isClean && (
                <div className={`flex items-center gap-0.5 bg-[#151515] border-b border-[#222] px-1 py-1 transition-all duration-200 overflow-hidden ${isFocused ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0 border-none py-0'}`}>
                    <button onMouseDown={(e) => { e.preventDefault(); format('bold'); }} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-white" title="Bold"><Bold size={12}/></button>
                    <button onMouseDown={(e) => { e.preventDefault(); format('italic'); }} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-white" title="Italic"><Italic size={12}/></button>
                    <button onMouseDown={(e) => { e.preventDefault(); format('underline'); }} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-white" title="Underline"><Underline size={12}/></button>
                    <div className="w-px h-3 bg-[#333] mx-1"></div>
                    <button onMouseDown={(e) => { e.preventDefault(); toggleBlock('nl-h1'); }} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-[#f5a623]" title="Heading 1"><Heading size={12}/></button>
                    <button onMouseDown={(e) => { e.preventDefault(); toggleBlock('nl-h2'); }} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-[#22c55e]" title="Heading 2"><Heading size={10}/></button>
                    <div className="w-px h-3 bg-[#333] mx-1"></div>
                    <button onMouseDown={(e) => { e.preventDefault(); toggleBlock('nl-list'); }} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-white" title="Bullet List"><List size={12}/></button>
                    <button onMouseDown={(e) => { e.preventDefault(); toggleBlock('nl-check'); }} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-white" title="To-Do"><CheckSquare size={12}/></button>
                    <button onMouseDown={(e) => { e.preventDefault(); toggleBlock('nl-quote'); }} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-white" title="Callout"><Quote size={12}/></button>
                </div>
            )}

            {(!value || value === '<div class="nl-block"><br></div>') && placeholder && !isFocused && (
                <div className={placeholderClasses} style={{fontSize: activeSize + 'px', top: placeholderTop}}>
                    {placeholder}
                </div>
            )}

            <div 
                ref={editorRef}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onClick={handleClick}
                onFocus={handleFocusInternal}
                className={contentClasses}
                style={{ backgroundColor: 'transparent', fontFamily: activeFont }}
            />
        </div>
    );
};
