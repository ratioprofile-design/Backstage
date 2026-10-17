/**
 * Professional Markdown Engine for Notion / Google Docs hybrid editing.
 * Handles bidirectional Markdown <-> HTML conversion, slash command parsing,
 * callouts, interactive task lists, tables, and statistics.
 */

export interface DocStats {
  words: number;
  characters: number;
  readingTimeMinutes: number;
  lines: number;
}

export function calculateDocStats(markdownOrText: string): DocStats {
  if (!markdownOrText) {
    return { words: 0, characters: 0, readingTimeMinutes: 0, lines: 0 };
  }
  const clean = markdownOrText.replace(/<[^>]+>/g, ' ').trim();
  const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  const characters = clean.length;
  const lines = markdownOrText.split('\n').length;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
  return { words, characters, readingTimeMinutes, lines };
}

/**
 * Convert standard Markdown to rich, styled HTML for Notion/Docs canvas
 */
export function markdownToHtml(md: string): string {
  if (!md) return '';

  let html = md;

  // 1. Normalize line endings
  html = html.replace(/\r\n/g, '\n');

  // 2. Fenced Code Blocks (```lang\n...\n```)
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre class="notion-code-block my-4 p-4 rounded-xl bg-zinc-900 border border-zinc-700/60 font-mono text-xs overflow-x-auto text-amber-200/90 shadow-inner" data-lang="${lang || 'text'}"><code>${escaped}</code></pre>`;
  });

  // 3. Callout blocks (> [!NOTE] or > [!TIP] or > 💡)
  html = html.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*?)(?=\n\n|$)/gm, (_match, type, content) => {
    const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
      NOTE: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)', text: '#60a5fa', icon: 'ℹ️' },
      TIP: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399', icon: '💡' },
      IMPORTANT: { bg: 'rgba(245, 166, 35, 0.08)', border: 'rgba(245, 166, 35, 0.3)', text: '#f5a623', icon: '⭐' },
      WARNING: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171', icon: '⚠️' },
      CAUTION: { bg: 'rgba(217, 70, 239, 0.08)', border: 'rgba(217, 70, 239, 0.3)', text: '#e879f9', icon: '🚨' },
    };
    const c = colorMap[type] || colorMap.NOTE;
    return `<div class="notion-callout my-4 p-4 rounded-xl flex items-start gap-3 border" style="background: ${c.bg}; border-color: ${c.border}; color: inherit;">
      <span class="text-lg leading-none select-none">${c.icon}</span>
      <div class="flex-1 text-sm leading-relaxed">${content.trim()}</div>
    </div>`;
  });

  // 4. Blockquotes (> ...)
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="notion-quote my-3 pl-4 border-l-3 border-[#f5a623] italic opacity-85 text-sm leading-relaxed">$1</blockquote>');

  // 5. Headings
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="text-base font-bold tracking-tight mt-5 mb-2">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="text-lg font-bold tracking-tight mt-6 mb-2.5">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="text-xl font-bold tracking-tight mt-7 mb-3 pb-1 border-b border-zinc-200/20">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight mt-8 mb-4">$1</h1>');

  // 6. Horizontal Rules / Dividers
  html = html.replace(/^(?:---|\*\*\*|___)$/gm, '<hr class="notion-divider my-6 border-t border-zinc-300 dark:border-zinc-700/60" />');

  // 7. Checkboxes / Task list items (- [ ] or - [x])
  html = html.replace(/^-\s+\[ \]\s+(.+)$/gm, `<div class="notion-task-item flex items-center gap-2.5 my-1.5 text-sm">
    <input type="checkbox" class="notion-checkbox rounded cursor-pointer w-4 h-4 accent-[#f5a623]" />
    <span>$1</span>
  </div>`);
  html = html.replace(/^-\s+\[[xX]\]\s+(.+)$/gm, `<div class="notion-task-item flex items-center gap-2.5 my-1.5 text-sm opacity-60 line-through">
    <input type="checkbox" checked class="notion-checkbox rounded cursor-pointer w-4 h-4 accent-[#f5a623]" />
    <span>$1</span>
  </div>`);

  // 8. Bullet Lists (- item or * item)
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li class="ml-5 list-disc my-1 text-sm leading-relaxed">$1</li>');

  // 9. Numbered Lists (1. item)
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-5 list-decimal my-1 text-sm leading-relaxed">$1</li>');

  // 10. Tables (| a | b |\n|---|---|\n| c | d |)
  html = html.replace(/((?:^\|.+?\|\s*(?:\n|$))+)/gm, (tableMatch) => {
    const lines = tableMatch.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return tableMatch;

    const parseRow = (line: string) =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim());

    const header = parseRow(lines[0]);
    // Check if line 1 is separator
    const isSep = lines[1].replace(/[\s|:-]/g, '').length === 0;
    const bodyRows = (isSep ? lines.slice(2) : lines.slice(1)).map(parseRow);

    let tbl = '<div class="my-4 overflow-x-auto"><table class="notion-table w-full border-collapse border border-zinc-300 dark:border-zinc-700 text-xs text-left">';
    tbl += '<thead><tr class="bg-zinc-100 dark:bg-zinc-800/80">';
    header.forEach((h) => {
      tbl += `<th class="border border-zinc-300 dark:border-zinc-700 p-2 font-bold">${h}</th>`;
    });
    tbl += '</tr></thead><tbody>';
    bodyRows.forEach((r, idx) => {
      const zebra = idx % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/30';
      tbl += `<tr class="${zebra}">`;
      r.forEach((cell) => {
        tbl += `<td class="border border-zinc-300 dark:border-zinc-700 p-2">${cell}</td>`;
      });
      tbl += '</tr>';
    });
    tbl += '</tbody></table></div>';
    return tbl;
  });

  // 11. Inline styles: Bold, Italic, Strikethrough, Code, Links
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-700 font-mono text-[11.5px] text-[#f5a623]">$1</code>');
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-amber-500 hover:underline font-medium">$1</a>');

  // 12. Paragraphs (wrap standalone text lines that aren't already wrapped in block elements)
  const paragraphs = html.split('\n\n');
  const wrapped = paragraphs.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('<h1') ||
      trimmed.startsWith('<h2') ||
      trimmed.startsWith('<h3') ||
      trimmed.startsWith('<h4') ||
      trimmed.startsWith('<pre') ||
      trimmed.startsWith('<div') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('<hr') ||
      trimmed.startsWith('<table') ||
      trimmed.startsWith('<li')
    ) {
      return trimmed;
    }
    // Simple line breaks inside paragraph
    const withBreaks = trimmed.replace(/\n/g, '<br/>');
    return `<p class="my-2.5 text-sm leading-relaxed">${withBreaks}</p>`;
  });

  return wrapped.filter(Boolean).join('\n');
}

/**
 * Convert HTML back to clean, portable Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');

  // Code blocks
  md = md.replace(/<pre[^>]*data-lang="([^"]*)"[^>]*><code>([\s\S]*?)<\/code><\/pre>/gi, (_match, lang, code) => {
    const unescaped = code
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    return `\`\`\`${lang || ''}\n${unescaped}\n\`\`\`\n\n`;
  });
  md = md.replace(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/gi, (_match, code) => {
    const unescaped = code
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    return `\`\`\`\n${unescaped}\n\`\`\`\n\n`;
  });

  // Callouts
  md = md.replace(/<div class="notion-callout[^"]*"[^>]*>[\s\S]*?<div class="[^"]*">([\s\S]*?)<\/div>\s*<\/div>/gi, '> [!NOTE] $1\n\n');

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');

  // Checkboxes
  md = md.replace(/<div class="notion-task-item[^"]*"[^>]*>[\s\S]*?<input type="checkbox"[^>]*checked[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>\s*<\/div>/gi, '- [x] $1\n');
  md = md.replace(/<div class="notion-task-item[^"]*"[^>]*>[\s\S]*?<input type="checkbox"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>\s*<\/div>/gi, '- [ ] $1\n');

  // Dividers
  md = md.replace(/<hr[^>]*\/?>/gi, '---\n\n');

  // Lists
  md = md.replace(/<li class="[^"]*list-decimal[^"]*"[^>]*>([\s\S]*?)<\/li>/gi, '1. $1\n');
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

  // Inlines
  md = md.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*');
  md = md.replace(/<del>([\s\S]*?)<\/del>/gi, '~~$1~~');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Paragraphs & Line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n');

  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  // Clean extra blank lines
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

export interface SlashCommandItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'BASIC' | 'MEDIA' | 'ADVANCED';
  template: string;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'h1',
    title: 'Heading 1',
    description: 'Big section heading',
    icon: 'H1',
    category: 'BASIC',
    template: '# '
  },
  {
    id: 'h2',
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    category: 'BASIC',
    template: '## '
  },
  {
    id: 'h3',
    title: 'Heading 3',
    description: 'Small subsection heading',
    icon: 'H3',
    category: 'BASIC',
    template: '### '
  },
  {
    id: 'bullet',
    title: 'Bulleted List',
    description: 'Create a simple bulleted list',
    icon: '•',
    category: 'BASIC',
    template: '- '
  },
  {
    id: 'number',
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: '1.',
    category: 'BASIC',
    template: '1. '
  },
  {
    id: 'todo',
    title: 'To-do List',
    description: 'Track tasks with a checklist',
    icon: '☑',
    category: 'BASIC',
    template: '- [ ] '
  },
  {
    id: 'quote',
    title: 'Quote',
    description: 'Capture a quote or statement',
    icon: '“',
    category: 'BASIC',
    template: '> '
  },
  {
    id: 'callout',
    title: 'Callout Box',
    description: 'Highlight key notes and takeaways',
    icon: '💡',
    category: 'ADVANCED',
    template: '> [!NOTE]\n> Write important notice here...\n\n'
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Visually divide blocks of content',
    icon: '—',
    category: 'BASIC',
    template: '\n---\n\n'
  },
  {
    id: 'code',
    title: 'Code Block',
    description: 'Capture a code snippet',
    icon: '</>',
    category: 'ADVANCED',
    template: '```typescript\n// write code here\n```\n\n'
  },
  {
    id: 'table',
    title: 'Table',
    description: 'Add a simple markdown table',
    icon: '⊞',
    category: 'ADVANCED',
    template: '| Item | Department | Notes |\n| :--- | :--- | :--- |\n| Prop 1 | Art | Active |\n\n'
  },
  {
    id: 'slugline',
    title: 'Scene Heading',
    description: 'Screenplay scene slugline (INT/EXT)',
    icon: '🎬',
    category: 'ADVANCED',
    template: '\n**INT. SCENE LOCATION - DAY**\n\n'
  }
];

export const DOCUMENT_EMOJIS = [
  '📄', '📝', '🎬', '💡', '📌', '🎯', '🚀', '📚', '⚡', '🎨', '🔍', '📖', '🏷️', '💬', '📊', '☕', '🧠', '✨'
];
