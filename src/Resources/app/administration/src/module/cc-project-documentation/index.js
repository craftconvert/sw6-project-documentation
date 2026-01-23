import './page/cc-project-documentation-index';
import './component/cc-doc-sidebar';
import './component/cc-doc-content';
import './component/cc-doc-search';
import './component/cc-doc-toc';
import './component/cc-doc-set-switcher';

import enGB from './snippet/en-GB.json';
import nlNL from './snippet/nl-NL.json';
import nlBE from './snippet/nl-BE.json';

Shopware.Module.register('cc-project-documentation', {
    type: 'core',
    name: 'cc-project-documentation',
    title: 'cc-project-documentation.general.title',
    description: 'cc-project-documentation.general.description',
    color: '#9AA8B5',
    icon: 'regular-book-user',

    snippets: {
        'en-GB': enGB,
        'nl-NL': nlNL,
        'nl-BE': nlBE,
    },

    routes: {
        index: {
            component: 'cc-project-documentation-index',
            path: 'index/:set/:path*',
            meta: {
                privilege: 'cc_project_documentation.viewer',
            },
        },
    },

    navigation: [{
        id: 'cc-project-documentation',
        label: 'cc-project-documentation.general.title',
        icon: 'regular-book-user',
        path: 'cc.project.documentation.index',
        params: { set: 'project' },
        position: 90,
        privilege: 'cc_project_documentation.viewer',
    }],
});
