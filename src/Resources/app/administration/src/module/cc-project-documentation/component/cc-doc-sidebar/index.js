import template from './cc-doc-sidebar.html.twig';
import './cc-doc-sidebar.scss';

const { Component } = Shopware;

Component.register('cc-doc-sidebar', {
    template,

    props: {
        navigationTree: {
            type: Array,
            required: true,
            default: () => [],
        },
        currentPath: {
            type: String,
            required: false,
            default: '',
        },
    },

    data() {
        return {
            expandedSections: {},
        };
    },

    created() {
        this.expandCurrentPath();
    },

    watch: {
        currentPath() {
            this.expandCurrentPath();
        },
    },

    methods: {
        expandCurrentPath() {
            this.navigationTree.forEach((tree, treeIndex) => {
                if (tree.items) {
                    tree.items.forEach((item, itemIndex) => {
                        if (item.children) {
                            const hasCurrentPath = item.children.some(
                                child => child.path === this.currentPath
                            );
                            if (hasCurrentPath) {
                                this.$set(this.expandedSections, `${treeIndex}-${itemIndex}`, true);
                            }
                        }
                    });
                }
            });
        },

        toggleSection(key) {
            this.$set(this.expandedSections, key, !this.expandedSections[key]);
        },

        isExpanded(key) {
            return !!this.expandedSections[key];
        },

        isActive(path) {
            return this.currentPath === path;
        },

        onNavigate(path) {
            this.$emit('navigate', path);
        },

        getIcon(tree) {
            return tree.icon || 'regular-file-alt';
        },
    },
});
