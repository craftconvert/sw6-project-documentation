import template from './cc-doc-content.html.twig';
import './cc-doc-content.scss';

const { Component } = Shopware;

// Load highlight.js dynamically if not available
let hljsLoaded = false;
const loadHighlightJs = () => {
    if (hljsLoaded || typeof hljs !== 'undefined') {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
        script.onload = () => {
            hljsLoaded = true;
            // Load common languages
            const languages = ['javascript', 'typescript', 'php', 'sql', 'bash', 'json', 'xml', 'css', 'scss'];
            let loaded = 0;
            languages.forEach(lang => {
                const langScript = document.createElement('script');
                langScript.src = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/${lang}.min.js`;
                langScript.onload = () => {
                    loaded++;
                    if (loaded === languages.length) {
                        resolve();
                    }
                };
                langScript.onerror = () => {
                    loaded++;
                    if (loaded === languages.length) {
                        resolve();
                    }
                };
                document.head.appendChild(langScript);
            });
        };
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
};

Component.register('cc-doc-content', {
    template,

    props: {
        document: {
            type: Object,
            required: false,
            default: null,
        },
        isLoading: {
            type: Boolean,
            required: false,
            default: false,
        },
    },

    computed: {
        renderedContent() {
            if (!this.document || !this.document.content) {
                return '';
            }

            return this.parseMarkdown(this.document.content);
        },

        formattedDate() {
            if (!this.document || !this.document.lastModified) {
                return '';
            }

            const date = new Date(this.document.lastModified * 1000);
            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        },

        dateFilter() {
            return Shopware.Filter.getByName('date');
        },
    },

    watch: {
        renderedContent() {
            this.$nextTick(() => {
                this.highlightCode();
            });
        },
    },

    mounted() {
        loadHighlightJs().then(() => {
            this.highlightCode();
        });
    },

    methods: {
        parseMarkdown(markdown) {
            let html = markdown;

            // Normalize line endings
            html = html.replace(/\r\n/g, '\n');

            // Extract and placeholder code blocks to protect them
            const codeBlocks = [];
            html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                const index = codeBlocks.length;
                const langClass = lang ? ` class="language-${lang}"` : '';
                const dataLang = lang ? ` data-language="${lang}"` : '';
                const escapedCode = this.escapeHtml(code.trim());
                codeBlocks.push(`<div class="code-block"${dataLang}><pre><code${langClass}>${escapedCode}</code></pre></div>`);
                return `\n%%CODEBLOCK_${index}%%\n`;
            });

            // Extract and placeholder inline code
            const inlineCodes = [];
            html = html.replace(/`([^`]+)`/g, (match, code) => {
                const index = inlineCodes.length;
                const escapedCode = this.escapeHtml(code);
                inlineCodes.push(`<code class="inline-code">${escapedCode}</code>`);
                return `%%INLINECODE_${index}%%`;
            });

            // Tables - parse before other elements
            html = this.parseTables(html);

            // Headers with IDs for TOC anchoring
            html = html.replace(/^######\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h6 id="${id}">${this.parseInline(text)}</h6>`;
            });
            html = html.replace(/^#####\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h5 id="${id}">${this.parseInline(text)}</h5>`;
            });
            html = html.replace(/^####\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h4 id="${id}">${this.parseInline(text)}</h4>`;
            });
            html = html.replace(/^###\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h3 id="${id}">${this.parseInline(text)}</h3>`;
            });
            html = html.replace(/^##\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h2 id="${id}">${this.parseInline(text)}</h2>`;
            });
            html = html.replace(/^#\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h1 id="${id}">${this.parseInline(text)}</h1>`;
            });

            // Horizontal rule (before lists to avoid conflicts)
            html = html.replace(/^---$/gm, '<hr>');

            // Blockquotes - handle multi-line
            html = html.replace(/(^>\s+.+$\n?)+/gm, (match) => {
                const content = match
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => line.replace(/^>\s+/, ''))
                    .join('<br>');
                return `<blockquote>${this.parseInline(content)}</blockquote>\n`;
            });

            // Lists - proper handling
            html = this.parseLists(html);

            // Paragraphs - wrap remaining text lines
            const lines = html.split('\n');
            const result = [];
            let inParagraph = false;
            let paragraphContent = [];

            for (const line of lines) {
                const trimmed = line.trim();

                // Skip empty lines
                if (!trimmed) {
                    if (inParagraph && paragraphContent.length > 0) {
                        result.push(`<p>${this.parseInline(paragraphContent.join(' '))}</p>`);
                        paragraphContent = [];
                        inParagraph = false;
                    }
                    continue;
                }

                // Check if line is already an HTML element
                if (/^<(h[1-6]|ul|ol|li|blockquote|hr|table|div|pre|p|%%CODEBLOCK)/.test(trimmed) ||
                    /^%%CODEBLOCK/.test(trimmed)) {
                    if (inParagraph && paragraphContent.length > 0) {
                        result.push(`<p>${this.parseInline(paragraphContent.join(' '))}</p>`);
                        paragraphContent = [];
                        inParagraph = false;
                    }
                    result.push(line);
                } else {
                    inParagraph = true;
                    paragraphContent.push(trimmed);
                }
            }

            // Close any remaining paragraph
            if (paragraphContent.length > 0) {
                result.push(`<p>${this.parseInline(paragraphContent.join(' '))}</p>`);
            }

            html = result.join('\n');

            // Restore code blocks
            codeBlocks.forEach((block, index) => {
                html = html.replace(`%%CODEBLOCK_${index}%%`, block);
                html = html.replace(`<p>%%CODEBLOCK_${index}%%</p>`, block);
            });

            // Restore inline code
            inlineCodes.forEach((code, index) => {
                html = html.replace(new RegExp(`%%INLINECODE_${index}%%`, 'g'), code);
            });

            // Clean up empty paragraphs and extra whitespace
            html = html.replace(/<p>\s*<\/p>/g, '');
            html = html.replace(/\n{3,}/g, '\n\n');

            return html;
        },

        parseInline(text) {
            let result = text;

            // Bold and italic (order matters)
            result = result.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
            result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

            // Links
            result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="doc-link" target="_blank" rel="noopener">$1</a>');

            return result;
        },

        parseTables(markdown) {
            const lines = markdown.split('\n');
            const result = [];
            let inTable = false;
            let tableRows = [];
            let hasHeader = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Check if this is a table row (starts and ends with |, or has | in middle)
                if (line.match(/^\|.*\|$/) || line.match(/^[^|]+\|[^|]+/)) {
                    if (!inTable) {
                        inTable = true;
                        tableRows = [];
                        hasHeader = false;
                    }

                    // Check if this is a separator row (|---|---|)
                    if (line.match(/^\|?\s*[-:]+\s*\|/)) {
                        hasHeader = true;
                        continue;
                    }

                    tableRows.push(line);
                } else {
                    if (inTable && tableRows.length > 0) {
                        result.push(this.buildTable(tableRows, hasHeader));
                        tableRows = [];
                        inTable = false;
                        hasHeader = false;
                    }
                    result.push(lines[i]);
                }
            }

            // Handle table at end of content
            if (inTable && tableRows.length > 0) {
                result.push(this.buildTable(tableRows, hasHeader));
            }

            return result.join('\n');
        },

        buildTable(rows, hasHeader) {
            if (rows.length === 0) return '';

            let html = '<div class="table-wrapper"><table>';

            rows.forEach((row, index) => {
                const cells = row
                    .split('|')
                    .map(cell => cell.trim())
                    .filter(cell => cell !== '');

                if (index === 0 && hasHeader) {
                    html += '<thead><tr>';
                    cells.forEach(cell => {
                        html += `<th>${this.parseInline(cell)}</th>`;
                    });
                    html += '</tr></thead><tbody>';
                } else {
                    if (index === 0) html += '<tbody>';
                    html += '<tr>';
                    cells.forEach(cell => {
                        html += `<td>${this.parseInline(cell)}</td>`;
                    });
                    html += '</tr>';
                }
            });

            html += '</tbody></table></div>';
            return html;
        },

        parseLists(markdown) {
            const lines = markdown.split('\n');
            const result = [];
            let listStack = []; // Stack of { type: 'ul'|'ol', indent: number }

            for (const line of lines) {
                // Match unordered list items
                const ulMatch = line.match(/^(\s*)-\s+(.+)$/);
                // Match ordered list items
                const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

                if (ulMatch || olMatch) {
                    const indent = (ulMatch || olMatch)[1].length;
                    const content = (ulMatch || olMatch)[2];
                    const listType = ulMatch ? 'ul' : 'ol';

                    // Close lists that are at higher indent levels
                    while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
                        const closed = listStack.pop();
                        result.push(`</li></${closed.type}>`);
                    }

                    // Check if we need to start a new list or continue
                    if (listStack.length === 0 || listStack[listStack.length - 1].indent < indent) {
                        // Start a new nested list
                        result.push(`<${listType}><li>${this.parseInline(content)}`);
                        listStack.push({ type: listType, indent });
                    } else if (listStack[listStack.length - 1].type === listType) {
                        // Continue same list type
                        result.push(`</li><li>${this.parseInline(content)}`);
                    } else {
                        // Different list type at same level - close old, start new
                        const closed = listStack.pop();
                        result.push(`</li></${closed.type}>`);
                        result.push(`<${listType}><li>${this.parseInline(content)}`);
                        listStack.push({ type: listType, indent });
                    }
                } else {
                    // Not a list item - close all open lists
                    while (listStack.length > 0) {
                        const closed = listStack.pop();
                        result.push(`</li></${closed.type}>`);
                    }
                    result.push(line);
                }
            }

            // Close any remaining open lists
            while (listStack.length > 0) {
                const closed = listStack.pop();
                result.push(`</li></${closed.type}>`);
            }

            return result.join('\n');
        },

        escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
            };
            return text.replace(/[&<>]/g, m => map[m]);
        },

        generateSlug(text) {
            return text
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/[\s_]+/g, '-')
                .replace(/-+/g, '-')
                .trim();
        },

        highlightCode() {
            loadHighlightJs().then(() => {
                this.$nextTick(() => {
                    if (typeof hljs !== 'undefined') {
                        this.$el.querySelectorAll('pre code').forEach((block) => {
                            // Only highlight if not already done
                            if (!block.classList.contains('hljs')) {
                                hljs.highlightElement(block);
                            }
                        });
                    }
                });
            });
        },
    },
});
