import template from './cc-doc-toc.html.twig';
import './cc-doc-toc.scss';

const { Component } = Shopware;

Component.register('cc-doc-toc', {
    template,

    props: {
        toc: {
            type: Array,
            required: false,
            default: () => [],
        },
    },

    data() {
        return {
            activeId: null,
        };
    },

    computed: {
        filteredToc() {
            // Only show h2 and h3 in TOC
            return this.toc.filter(item => item.level >= 2 && item.level <= 3);
        },
    },

    mounted() {
        this.setupScrollSpy();
    },

    beforeDestroy() {
        this.removeScrollSpy();
    },

    methods: {
        setupScrollSpy() {
            this.scrollHandler = this.onScroll.bind(this);
            const contentEl = document.querySelector('.cc-project-documentation-index__main');
            if (contentEl) {
                contentEl.addEventListener('scroll', this.scrollHandler);
            }
        },

        removeScrollSpy() {
            const contentEl = document.querySelector('.cc-project-documentation-index__main');
            if (contentEl && this.scrollHandler) {
                contentEl.removeEventListener('scroll', this.scrollHandler);
            }
        },

        onScroll() {
            const contentEl = document.querySelector('.cc-project-documentation-index__main');
            if (!contentEl) return;

            const headings = contentEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
            let currentId = null;

            headings.forEach((heading) => {
                const rect = heading.getBoundingClientRect();
                const containerRect = contentEl.getBoundingClientRect();

                if (rect.top <= containerRect.top + 100) {
                    currentId = heading.id;
                }
            });

            this.activeId = currentId;
        },

        scrollToHeading(id) {
            const contentEl = document.querySelector('.cc-project-documentation-index__main');
            if (!contentEl) return;

            const heading = contentEl.querySelector(`#${id}`);
            if (heading) {
                heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        },

        isActive(id) {
            return this.activeId === id;
        },

        getIndentClass(level) {
            return `cc-doc-toc__item--level-${level}`;
        },
    },
});
