import template from './sw-dashboard-index.html.twig';
import './sw-dashboard-index.scss';

const { Component, Filter } = Shopware;

Component.override('sw-dashboard-index', {
    template,

    inject: ['acl', 'loginService'],

    data() {
        return {
            documentationEntrySet: null,
            documentationEntryPath: null,
            documentationDashboardImage: null,
            isLoadingDocumentation: false,
        };
    },

    computed: {
        assetFilter() {
            return Filter.getByName('asset');
        },

        canViewDocumentation() {
            return this.acl.can('cc_project_documentation.viewer');
        },

        httpClient() {
            return Shopware.Application.getContainer('init').httpClient;
        },

        currentLocale() {
            return Shopware.State.get('session').currentLocale || 'en-GB';
        },

        hasDashboardImage() {
            return !!this.documentationDashboardImage;
        },

        dashboardImageSrc() {
            if (!this.documentationDashboardImage) {
                return null;
            }
            return this.assetFilter(this.documentationDashboardImage);
        },
    },

    created() {
        if (this.canViewDocumentation) {
            this.loadDocumentationEntry();
        }
    },

    methods: {
        async loadDocumentationEntry() {
            this.isLoadingDocumentation = true;

            try {
                // Fetch config and sets in parallel
                const [configResponse, setsResponse] = await Promise.all([
                    this.httpClient.get(
                        '/_action/cc/project-documentation/config',
                        { headers: this.getHeaders() }
                    ),
                    this.httpClient.get(
                        '/_action/cc/project-documentation/sets',
                        { headers: this.getHeaders() }
                    ),
                ]);

                // Handle config
                if (configResponse.data.success && configResponse.data.data) {
                    this.documentationDashboardImage = configResponse.data.data.dashboardImage;
                }

                // Handle sets
                if (!setsResponse.data.success || !setsResponse.data.data) {
                    return;
                }

                const sets = setsResponse.data.data;
                const setIds = Object.keys(sets);

                if (setIds.length === 0) {
                    return;
                }

                // Use the first available set as entry
                const entrySetId = setIds[0];
                this.documentationEntrySet = entrySetId;

                // Get the navigation tree for this set to find the first document
                const treeResponse = await this.httpClient.get(
                    '/_action/cc/project-documentation/tree',
                    {
                        params: {
                            locale: this.currentLocale,
                            set: entrySetId,
                        },
                        headers: this.getHeaders(),
                    }
                );

                if (treeResponse.data.success && treeResponse.data.data) {
                    const firstPath = this.getFirstDocumentPath(treeResponse.data.data);
                    this.documentationEntryPath = firstPath;
                }
            } catch (error) {
                console.error('Failed to load documentation entry:', error);
            } finally {
                this.isLoadingDocumentation = false;
            }
        },

        getFirstDocumentPath(trees) {
            for (const tree of trees) {
                if (tree.items && tree.items.length > 0) {
                    const firstItem = tree.items[0];

                    if (firstItem.path) {
                        return firstItem.path;
                    }

                    if (firstItem.children && firstItem.children.length > 0) {
                        const firstChild = firstItem.children[0];
                        if (firstChild.path) {
                            return firstChild.path;
                        }
                    }
                }
            }

            return null;
        },

        getHeaders() {
            return {
                Accept: 'application/json',
                Authorization: `Bearer ${this.loginService.getToken()}`,
                'Content-Type': 'application/json',
            };
        },

        navigateToDocumentation() {
            const params = {};

            if (this.documentationEntrySet) {
                params.set = this.documentationEntrySet;
            }

            if (this.documentationEntryPath) {
                params.path = this.documentationEntryPath.split('/');
            }

            this.$router.push({
                name: 'cc.project.documentation.index',
                params,
            });
        },
    },
});
