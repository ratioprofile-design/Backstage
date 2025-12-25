
import * as pdfjsLib from 'pdfjs-dist';

// Handle potentially different import structure (CommonJS vs ESM via CDN)
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Set worker
if (pdfjs && pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

/**
 * Extracts raw text from a PDF file.
 * We no longer parse structure here; we hand the raw text to AI.
 */
export const extractRawTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = "";

    // Iterate through all pages
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Sort items by Y (top to bottom) then X (left to right) to ensure reading order
        // PDF coordinates: (0,0) is usually bottom-left.
        const items = textContent.items.map((item: any) => {
            return {
                str: item.str,
                x: item.transform[4],
                y: item.transform[5], // Bottom-left Y
                hasEOL: item.hasEOL
            };
        });

        // Sort: Higher Y first (Top of page), then Lower X (Left of page)
        items.sort((a: any, b: any) => {
            if (Math.abs(a.y - b.y) > 5) { 
                return b.y - a.y; // Top to Bottom
            }
            return a.x - b.x; // Left to Right
        });

        // Reconstruct text
        let pageText = "";
        let lastY = -1;

        items.forEach((item: any) => {
            if (lastY !== -1 && Math.abs(item.y - lastY) > 5) {
                pageText += "\n"; // New line
            } else if (pageText.length > 0 && !pageText.endsWith(" ") && !pageText.endsWith("\n")) {
                pageText += " "; // Space between words on same line
            }
            pageText += item.str;
            lastY = item.y;
        });

        fullText += pageText + "\n\n";
    }

    return fullText;
};
