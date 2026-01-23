import template from './cc-doc-search.html.twig';
import './cc-doc-search.scss';

const { Component, Utils } = Shopware;

Component.register('cc-doc-search', {
    template,

    props: {
        results: {
            type: Array,
            required: false,
            default: () => [],
        },
        isLoading: {
            type: Boolean,
            required: false,
            default: false,
        },
    },

    data() {
        return {
            searchTerm: '',
            showResults: false,
        };
    },

    computed: {
        hasResults() {
            return this.results.length > 0;
        },
    },

    watch: {
        searchTerm: Utils.debounce(function(value) {
            this.$emit('search', value);
            this.showResults = value.length >= 2;
        }, 300),
    },

    methods: {
        onFocus() {
            if (this.searchTerm.length >= 2) {
                this.showResults = true;
            }
        },

        onBlur() {
            // Delay hiding to allow click events on results
            setTimeout(() => {
                this.showResults = false;
            }, 200);
        },

        onSelect(path) {
            this.$emit('select', path);
            this.searchTerm = '';
            this.showResults = false;
        },

        clearSearch() {
            this.searchTerm = '';
            this.showResults = false;
            this.$emit('search', '');
        },
    },
});
