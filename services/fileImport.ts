
/**
 * Service to handle importing raw text from various screenplay formats.
 * Primarily handles:
 * 1. Final Draft (.fdx) - XML parsing
 * 2. Fountain/Text (.fountain, .txt, .md) - Direct text reading
 */

export const extractTextFromFdx = async (file: File): Promise<string> => {
    const text = await file.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    
    const paragraphs = xmlDoc.getElementsByTagName("Paragraph");
    let scriptText = "";

    for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        const type = p.getAttribute("Type") || "Action";
        
        // Extract text nodes (handling styling tags inside like <Bold>, <Underline>)
        let content = "";
        const textNodes = p.getElementsByTagName("Text");
        
        for (let j = 0; j < textNodes.length; j++) {
            content += textNodes[j].textContent || "";
        }

        content = content.trim();
        if (!content) continue;

        // Simple formatting to help the AI recognizer later
        switch (type) {
            case "Scene Heading":
                scriptText += `\n\n${content.toUpperCase()}\n`;
                break;
            case "Character":
                scriptText += `\n${content.toUpperCase()}\n`;
                break;
            case "Parenthetical":
                scriptText += `${content}\n`;
                break;
            case "Dialogue":
                scriptText += `${content}\n`;
                break;
            case "Transition":
                scriptText += `\n${content.toUpperCase()}\n`;
                break;
            default: // Action, General
                scriptText += `${content}\n`;
                break;
        }
    }

    return scriptText;
};

export const extractTextFromTextFile = async (file: File): Promise<string> => {
    return await file.text();
};

export const detectAndReadScriptFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'fdx') {
        return await extractTextFromFdx(file);
    } else if (['fountain', 'txt', 'md', 'spmd'].includes(ext || '')) {
        return await extractTextFromTextFile(file);
    } 
    
    // Attempt to read generic XML/JSON or other text formats as raw text
    // The AI is robust enough to handle unstructured text often.
    try {
        const text = await file.text();
        // Basic heuristic: if it contains null bytes, it's binary (like .fadein zip), ignore it
        if (text.indexOf('\0') !== -1) {
            throw new Error("Binary file detected");
        }
        return text;
    } catch (e) {
        console.warn("Could not read file as text", e);
        return null;
    }
};
