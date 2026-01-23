Shopware.Service('privileges').addPrivilegeMappingEntry({
    category: 'additional_permissions',
    parent: null,
    key: 'cc_project_documentation',
    roles: {
        viewer: {
            privileges: ['cc_project_documentation:read'],
            dependencies: [],
        },
    },
});
