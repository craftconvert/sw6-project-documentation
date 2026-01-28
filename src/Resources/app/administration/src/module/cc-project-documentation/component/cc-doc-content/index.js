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

    inject: ['repositoryFactory'],

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

    data() {
        return {
            loadedImages: new Map(),
        };
    },

    computed: {
        httpClient() {
            return Shopware.Application.getContainer('init').httpClient;
        },

        renderedContent() {
            if (!this.document || !this.document.content) {
                return '';
            }

            const locale = this.document.locale || 'en-GB';
            const set = this.document.set || 'project';

            return this.parseMarkdown(this.document.content, locale, set);
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
                this.loadDocumentImages();
            });
        },
    },

    mounted() {
        loadHighlightJs().then(() => {
            this.highlightCode();
        });
        this.$nextTick(() => {
            this.loadDocumentImages();
        });
    },

    methods: {
        parseMarkdown(markdown, locale = 'en-GB', set = 'project') {
            let html = markdown;

            // Normalize line endings
            html = html.replace(/\r\n/g, '\n');

            // Parse screenshot tags first (before code blocks to avoid conflicts)
            html = this.parseScreenshots(html, locale, set);

            // Parse regular images
            html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
                return this.buildImageTag(src, alt, locale, set);
            });

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
            html = this.parseTables(html, locale, set);

            // Headers with IDs for TOC anchoring
            html = html.replace(/^######\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h6 id="${id}">${this.parseInline(text, locale, set)}</h6>`;
            });
            html = html.replace(/^#####\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h5 id="${id}">${this.parseInline(text, locale, set)}</h5>`;
            });
            html = html.replace(/^####\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h4 id="${id}">${this.parseInline(text, locale, set)}</h4>`;
            });
            html = html.replace(/^###\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h3 id="${id}">${this.parseInline(text, locale, set)}</h3>`;
            });
            html = html.replace(/^##\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h2 id="${id}">${this.parseInline(text, locale, set)}</h2>`;
            });
            html = html.replace(/^#\s+(.+)$/gm, (match, text) => {
                const id = this.generateSlug(text);
                return `<h1 id="${id}">${this.parseInline(text, locale, set)}</h1>`;
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
                return `<blockquote>${this.parseInline(content, locale, set)}</blockquote>\n`;
            });

            // Lists - proper handling
            html = this.parseLists(html, locale, set);

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
                        result.push(`<p>${this.parseInline(paragraphContent.join(' '), locale, set)}</p>`);
                        paragraphContent = [];
                        inParagraph = false;
                    }
                    continue;
                }

                // Check if line is already an HTML element
                if (/^<(h[1-6]|ul|ol|li|blockquote|hr|table|div|pre|p|%%CODEBLOCK)/.test(trimmed) ||
                    /^%%CODEBLOCK/.test(trimmed)) {
                    if (inParagraph && paragraphContent.length > 0) {
                        result.push(`<p>${this.parseInline(paragraphContent.join(' '), locale, set)}</p>`);
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
                result.push(`<p>${this.parseInline(paragraphContent.join(' '), locale, set)}</p>`);
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

        parseInline(text, locale, set) {
            let result = text;

            // Bold and italic (order matters)
            result = result.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
            result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

            // Images (must be before links to prevent ![alt](src) matching as link)
            result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
                return this.buildImageTag(src, alt, locale, set);
            });

            // Links
            result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="doc-link" target="_blank" rel="noopener">$1</a>');

            return result;
        },

        parseTables(markdown, locale, set) {
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
                        result.push(this.buildTable(tableRows, hasHeader, locale, set));
                        tableRows = [];
                        inTable = false;
                        hasHeader = false;
                    }
                    result.push(lines[i]);
                }
            }

            // Handle table at end of content
            if (inTable && tableRows.length > 0) {
                result.push(this.buildTable(tableRows, hasHeader, locale, set));
            }

            return result.join('\n');
        },

        buildTable(rows, hasHeader, locale, set) {
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
                        html += `<th>${this.parseInline(cell, locale, set)}</th>`;
                    });
                    html += '</tr></thead><tbody>';
                } else {
                    if (index === 0) html += '<tbody>';
                    html += '<tr>';
                    cells.forEach(cell => {
                        html += `<td>${this.parseInline(cell, locale, set)}</td>`;
                    });
                    html += '</tr>';
                }
            });

            html += '</tbody></table></div>';
            return html;
        },

        parseLists(markdown, locale, set) {
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
                        result.push(`<${listType}><li>${this.parseInline(content, locale, set)}`);
                        listStack.push({ type: listType, indent });
                    } else if (listStack[listStack.length - 1].type === listType) {
                        // Continue same list type
                        result.push(`</li><li>${this.parseInline(content, locale, set)}`);
                    } else {
                        // Different list type at same level - close old, start new
                        const closed = listStack.pop();
                        result.push(`</li></${closed.type}>`);
                        result.push(`<${listType}><li>${this.parseInline(content, locale, set)}`);
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

        parseScreenshots(html, locale, set) {
            // Match <screenshot ...>![alt](src)</screenshot>
            // Supports: url="...", scroll (boolean), height="..."
            const screenshotRegex = /<screenshot([^>]*)>\s*!\[([^\]]*)\]\(([^)]+)\)\s*<\/screenshot>/g;

            return html.replace(screenshotRegex, (match, attrs, alt, src) => {
                // Parse attributes
                const urlMatch = attrs.match(/url=["']([^"']+)["']/);
                const url = urlMatch ? urlMatch[1] : '';

                const hasScroll = /\bscroll\b/.test(attrs);

                const heightMatch = attrs.match(/height=["']([^"']+)["']/);
                const height = heightMatch ? heightMatch[1] : '300px';

                const imageTag = this.buildImageTag(src, alt, locale, set);
                const scrollClass = hasScroll ? ' cc-screenshot--scroll' : '';
                const contentStyle = hasScroll ? ` style="height: ${this.escapeHtml(height)}"` : '';

                // Build the lock icon SVG (single line to avoid paragraph wrapping)
                const lockIcon = '<svg class="lock-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

                // Return as single line to prevent markdown parser from adding <p> tags
                return `<div class="cc-screenshot${scrollClass}"><div class="cc-screenshot__titlebar"><div class="cc-screenshot__controls"><span class="close"></span><span class="minimize"></span><span class="maximize"></span></div><div class="cc-screenshot__urlbar">${lockIcon}<span class="url-text">${this.escapeHtml(url)}</span></div></div><div class="cc-screenshot__content"${contentStyle}>${imageTag}</div></div>`;
            });
        },

        buildImageTag(src, alt, locale, set) {
            const escapedAlt = this.escapeHtml(alt);

            // If absolute URL (starts with http:// or https://), use directly
            if (/^https?:\/\//.test(src)) {
                return `<img src="${src}" alt="${escapedAlt}" loading="lazy">`;
            }

            // For relative paths, use data attributes for async loading via httpClient
            return `<img data-doc-src="${this.escapeHtml(src)}" data-doc-locale="${this.escapeHtml(locale)}" data-doc-set="${this.escapeHtml(set)}" alt="${escapedAlt}" loading="lazy" class="cc-doc-image-loading">`;
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

        loadDocumentImages() {
            if (!this.$el) return;

            const images = this.$el.querySelectorAll('img[data-doc-src]');

            images.forEach((img) => {
                const src = img.getAttribute('data-doc-src');
                const locale = img.getAttribute('data-doc-locale');
                const set = img.getAttribute('data-doc-set');

                if (!src) return;

                // Check if already loaded
                if (img.src && !img.classList.contains('cc-doc-image-loading')) {
                    return;
                }

                // Build API path (without /api prefix - httpClient adds it)
                const encodedPath = src.split('/').map(segment => encodeURIComponent(segment)).join('/');
                const apiUrl = `/_action/cc/project-documentation/image/${encodedPath}`;

                // Get auth token from loginService
                const loginService = Shopware.Service('loginService');
                const headers = {
                    Authorization: `Bearer ${loginService.getToken()}`,
                };

                // Fetch image via httpClient
                this.httpClient.get(apiUrl, {
                    params: { locale, set },
                    responseType: 'blob',
                    headers,
                }).then((response) => {
                    const blob = new Blob([response.data], { type: response.headers['content-type'] });
                    const objectUrl = URL.createObjectURL(blob);

                    img.src = objectUrl;
                    img.classList.remove('cc-doc-image-loading');
                    img.removeAttribute('data-doc-src');
                    img.removeAttribute('data-doc-locale');
                    img.removeAttribute('data-doc-set');
                }).catch((error) => {
                    console.error('Failed to load documentation image:', src, error);
                    img.classList.remove('cc-doc-image-loading');
                    img.classList.add('cc-doc-image-error');
                });
            });
        },
    },
});
