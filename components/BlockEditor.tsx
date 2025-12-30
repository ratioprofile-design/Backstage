
import React, { useRef, useEffect } from 'react';

interface BlockEditorProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    minHeight?: string;
    onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
    className?: string;
    fontFamily?: string;
    fontSize?: number;
    style?: React.CSSProperties; // Pass additional styles like lineHeight
}

export const BlockEditor: React.FC<BlockEditorProps> = ({ value, onChange, placeholder, minHeight = "150px", onFocus, className, fontFamily, fontSize, style }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isLocked = useRef(false);

    useEffect(() => {
        if (editorRef.current && !isLocked.current) {
            // Only update if content is genuinely different to avoid cursor jumps on re-render
            if (editorRef.current.innerHTML !== value) {
                const isHtml = /<[a-z][\s\S]*>/i.test(value);
                if (!value || value.trim() === '') {
                    editorRef.current.innerHTML = `<div class="nl-block"><br></div>`;
                } else if (!isHtml) {
                    // Convert plain text to blocks
                    editorRef.current.innerHTML = value.split('\n').map((line: string) => `<div class="nl-block">${line || '<br>'}</div>`).join('');
                } else {
                    editorRef.current.innerHTML = value;
                }
            }
        }
    }, [value]);

    const emitChange = () => {
        if (editorRef.current) {
            isLocked.current = true; 
            onChange(editorRef.current.innerHTML);
            setTimeout(() => isLocked.current = false, 0);
        }
    };

    // --- MARKDOWN LOGIC ---
    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const sel = window.getSelection();
        if (!sel || !sel.anchorNode) {
            emitChange();
            return;
        }

        let node = sel.anchorNode;
        // Ensure we are inside a block
        let block = (node.nodeType === 3 ? node.parentNode : node) as HTMLElement;
        if (!block.classList.contains('nl-block')) {
            const closest = block.closest('.nl-block');
            if (closest) block = closest as HTMLElement;
            else return emitChange(); 
        }

        const text = block.textContent || '';
        
        // Trigger on Space detection.
        let transformType = '';
        let stripLen = 0;

        // HEADING 1 (# )
        if (text.startsWith('# ') && !block.classList.contains('nl-h1')) {
            transformType = 'nl-h1';
            stripLen = 2;
        }
        // HEADING 2 (## )
        else if (text.startsWith('## ') && !block.classList.contains('nl-h2')) {
            transformType = 'nl-h2';
            stripLen = 3;
        }
        // BULLET LIST (- )
        else if ((text.startsWith('- ') || text.startsWith('* ')) && !block.classList.contains('nl-list')) {
            transformType = 'nl-list';
            stripLen = 2;
        }
        // NUMBERED LIST (1. )
        else if ((text.startsWith('1. ')) && !block.classList.contains('nl-num')) {
            transformType = 'nl-num';
            stripLen = 3;
        }
        // CHECKBOX ([] )
        else if ((text.startsWith('[] ') || text.startsWith('[ ] ')) && !block.classList.contains('nl-check')) {
            transformType = 'nl-check';
            stripLen = text.indexOf(']') + 2;
        }
        // QUOTE (> )
        else if (text.startsWith('> ') && !block.classList.contains('nl-quote')) {
            transformType = 'nl-quote';
            stripLen = 2;
        }

        // Apply Transformation
        if (transformType) {
            block.classList.add(transformType);
            
            // NON-DESTRUCTIVE STRIP: Manipulate the TextNode directly
            // This preserves the node identity so the browser doesn't lose the cursor context
            const textNode = block.firstChild;
            if (textNode && textNode.nodeType === 3) {
                // Remove the syntax characters
                (textNode as Text).deleteData(0, stripLen);
                
                // If node becomes empty, we might need to handle it to prevent collapse
                // but usually contentEditable handles a single empty text node fine if we don't touch innerHTML
                if (textNode.textContent?.length === 0) {
                    // Force a BR if empty to keep height
                    block.innerHTML = '<br>';
                    // Reset cursor to start
                    const range = document.createRange();
                    range.setStart(block, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            } else {
                // Fallback for weird edge cases
                block.innerHTML = '<br>';
                const range = document.createRange();
                range.setStart(block, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        emitChange();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            
            let block = (sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode) as HTMLElement;
            if (!block.classList.contains('nl-block')) block = block.closest('.nl-block') as HTMLElement;
            
            if (block) {
                if (e.shiftKey) {
                    block.classList.remove('nl-indent');
                } else {
                    block.classList.add('nl-indent');
                }
                emitChange();
            }
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            
            const range = sel.getRangeAt(0);
            let currentBlock = (range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer) as HTMLElement;
            if (!currentBlock.classList.contains('nl-block')) currentBlock = currentBlock.closest('.nl-block') as HTMLElement;

            // Create new block
            const newBlock = document.createElement('div');
            newBlock.className = 'nl-block';
            
            // Carry over list styles if Enter pressed in a list item
            if (currentBlock) {
                if (currentBlock.classList.contains('nl-list')) {
                    if (currentBlock.textContent?.trim() === '') {
                        currentBlock.className = 'nl-block'; // Break list on empty
                        emitChange();
                        return; 
                    }
                    newBlock.className = 'nl-block nl-list';
                } 
                else if (currentBlock.classList.contains('nl-check')) {
                    if (currentBlock.textContent?.trim() === '') {
                        currentBlock.className = 'nl-block'; 
                        emitChange();
                        return; 
                    }
                    newBlock.className = 'nl-block nl-check';
                }
                else if (currentBlock.classList.contains('nl-num')) {
                    if (currentBlock.textContent?.trim() === '') {
                        currentBlock.className = 'nl-block'; 
                        emitChange();
                        return; 
                    }
                    newBlock.className = 'nl-block nl-num';
                }
                
                // Carry Indentation
                if (currentBlock.classList.contains('nl-indent')) {
                    newBlock.classList.add('nl-indent');
                }
            }

            newBlock.innerHTML = '<br>';
            
            if (currentBlock && currentBlock.nextSibling) {
                editorRef.current?.insertBefore(newBlock, currentBlock.nextSibling);
            } else {
                editorRef.current?.appendChild(newBlock);
            }

            // Move cursor
            const newRange = document.createRange();
            newRange.setStart(newBlock, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            
            emitChange();
        } else if (e.key === 'Backspace') {
            // Check if deleting empty list item -> convert to paragraph
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
                let node = sel.anchorNode;
                // @ts-ignore
                let block = (node.nodeType === 3 ? node.parentNode : node) as HTMLElement;
                if (!block.classList.contains('nl-block')) block = block.closest('.nl-block') as HTMLElement;
                
                if (block && block.textContent?.length === 0) {
                    if (block.classList.contains('nl-indent')) {
                        block.classList.remove('nl-indent');
                        emitChange();
                        e.preventDefault();
                        return;
                    }
                    if (block.classList.contains('nl-list') || block.classList.contains('nl-num') || block.classList.contains('nl-check') || block.classList.contains('nl-h1') || block.classList.contains('nl-h2')) {
                        block.className = 'nl-block'; // Reset to paragraph
                        emitChange();
                        e.preventDefault();
                    }
                }
            }
        }
    };

    return (
        <div className={`w-full bg-[#111] rounded-none border border-white/10 hover:border-white/20 transition-all flex flex-col overflow-hidden group focus-within:border-[#f5a623] relative ${className}`} style={{ minHeight }}>
            <style>{`
                /* Base Block */
                .nl-block { 
                    position: relative; 
                    min-height: 1.5em; 
                    margin-bottom: var(--sp-block-margin, 2px); 
                    padding: 2px 6px; 
                    border-radius: 2px; 
                    color: #e5e5e5; 
                    font-size: ${fontSize || 14}px; 
                    transition: padding-left 0.1s;
                }
                .nl-block:focus { outline: none; background: rgba(255,255,255,0.05); }
                .nl-block:empty::before { content: attr(data-placeholder); color: #555; pointer-events: none; }
                
                /* INDENTATION */
                .nl-indent { 
                    margin-left: 2em; 
                    border-left: 1px solid rgba(255,255,255,0.1);
                }

                /* HEADINGS */
                .nl-h1 { 
                    font-size: 1.5em; 
                    font-weight: 900; 
                    color: var(--sp-h1-color, #fff); 
                    margin-top: 0.5em; 
                    margin-bottom: 0.3em; 
                    border-bottom: 1px solid #333; 
                    text-decoration: var(--sp-h1-deco, none);
                    font-style: var(--sp-h1-style, normal);
                }
                .nl-h2 { 
                    font-size: 1.25em; 
                    font-weight: 700; 
                    color: var(--sp-h2-color, #f5a623); 
                    margin-top: 0.4em; 
                    text-decoration: var(--sp-h2-deco, none);
                    font-style: var(--sp-h2-style, normal);
                }
                
                /* LISTS */
                .nl-list { 
                    padding-left: 1.5em; 
                    position: relative; 
                }
                .nl-list::before { 
                    content: var(--sp-bullet-char, "•"); 
                    position: absolute; 
                    left: 0.5em; 
                    top: 0;
                    color: var(--sp-list-marker, #f5a623); 
                    font-weight: bold; 
                }
                .nl-list.nl-indent::before {
                    content: "◦"; /* Hollow bullet for level 2 */
                }
                
                /* NUMBERED LIST - FIXED ALIGNMENT */
                .block-editor-content { counter-reset: top-level; }
                
                .nl-num { 
                    padding-left: 2.2em; /* Adjusted padding to prevent overlap */
                    position: relative; 
                }
                
                .nl-num:not(.nl-indent) { 
                    counter-increment: top-level; 
                    counter-reset: sub-level; 
                }
                
                .nl-num:not(.nl-indent)::before { 
                    content: counter(top-level) "."; 
                    position: absolute; 
                    left: 0.2em; 
                    top: 0;
                    width: 1.5em;
                    text-align: right;
                    color: var(--sp-list-marker, #f5a623); 
                    font-weight: bold; 
                    font-family: inherit; /* Align with text font */
                    font-size: 0.9em;
                }

                /* NUMBERED LIST - SUB LEVEL */
                .nl-num.nl-indent {
                    counter-increment: sub-level;
                }
                .nl-num.nl-indent::before {
                    content: counter(sub-level, lower-alpha) "."; 
                    position: absolute;
                    left: 0.2em;
                    top: 0;
                    width: 1.5em;
                    text-align: right;
                    color: var(--sp-list-marker, #f5a623);
                    font-weight: bold;
                    font-family: inherit;
                    font-size: 0.9em;
                }

                /* CHECKBOX */
                .nl-check { padding-left: 2em; position: relative; }
                .nl-check::before { 
                    content: ""; 
                    position: absolute; 
                    left: 0.5em; 
                    top: 0.35em;
                    width: 12px; 
                    height: 12px; 
                    border: 1px solid var(--sp-todo-border, #666); 
                    border-radius: 2px;
                    transition: all 0.2s;
                }
                .nl-check:hover::before { border-color: var(--sp-todo-check, #f5a623); background: rgba(255,255,255,0.05); }
                
                /* CALLOUT / QUOTE */
                .nl-quote { 
                    border-left: 3px solid var(--sp-callout-border, #f5a623); 
                    padding-left: 10px; 
                    font-style: italic; 
                    color: #9ca3af; 
                    background: var(--sp-callout-bg, rgba(245, 166, 35, 0.05)); 
                    border-radius: 0 4px 4px 0;
                }
            `}</style>
            
            {(!value || value === '<div class="nl-block"><br></div>') && placeholder && (
                <div className="absolute inset-0 p-4 text-gray-600 font-sans leading-relaxed pointer-events-none italic select-none" style={{fontSize: `${fontSize || 14}px`}}>
                    {placeholder}
                </div>
            )}

            <div 
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                className="flex-1 p-3 outline-none custom-scrollbar relative z-10 block-editor-content"
                style={{ backgroundColor: 'transparent', fontFamily: fontFamily || 'inherit', lineHeight: style?.lineHeight || 1.6 }}
            />
        </div>
    );
};
