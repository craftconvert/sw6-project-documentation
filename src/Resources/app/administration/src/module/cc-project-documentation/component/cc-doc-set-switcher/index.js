import template from './cc-doc-set-switcher.html.twig';
import './cc-doc-set-switcher.scss';

const { Component } = Shopware;

Component.register('cc-doc-set-switcher', {
    template,

    props: {
        sets: {
            type: Object,
            required: true,
            default: () => ({}),
        },
        currentSet: {
            type: String,
            required: true,
            default: 'project',
        },
    },

    computed: {
        setOptions() {
            return Object.values(this.sets).map(set => ({
                value: set.id,
                label: this.getSetLabel(set),
                icon: set.icon,
            }));
        },

        currentSetObject() {
            return this.sets[this.currentSet] || null;
        },

        currentSetLabel() {
            if (this.currentSetObject) {
                return this.getSetLabel(this.currentSetObject);
            }
            return '';
        },

        currentSetIcon() {
            return this.currentSetObject?.icon || 'regular-book';
        },
    },

    methods: {
        onSetChange(value) {
            if (value !== this.currentSet) {
                this.$emit('change', value);
            }
        },

        getSetLabel(set) {
            const translationKey = `cc-project-documentation.sets.${set.id}`;
            const translation = this.$tc(translationKey);
            return translation !== translationKey ? translation : set.label;
        },
    },
});
