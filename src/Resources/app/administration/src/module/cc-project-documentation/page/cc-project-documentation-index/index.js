import template from './cc-project-documentation-index.html.twig';
import './cc-project-documentation-index.scss';

const { Component } = Shopware;

Component.register('cc-project-documentation-index', {
    template,

    inject: ['loginService'],

    data() {
        return {
            navigationTree: [],
            currentDocument: null,
            isLoading: true,
            isLoadingDocument: false,
            searchResults: [],
            isSearching: false,
            availableSets: {},
            isLoadingSets: true,
            isMobileNavOpen: false,
        };
    },

    computed: {
        currentPath() {
            const path = this.$route.params.path;
            if (!path) {
                return null;
            }
            // Handle catch-all route param which can be an array
            if (Array.isArray(path)) {
                return path.join('/') || null;
            }
            return path;
        },

        currentSet() {
            return this.$route.params.set || 'project';
        },

        currentLocale() {
            return Shopware.State.get('session').currentLocale || 'en-GB';
        },

        httpClient() {
            return Shopware.Application.getContainer('init').httpClient;
        },

        hasMultipleSets() {
            return Object.keys(this.availableSets).length > 1;
        },

        flatDocumentList() {
            const list = [];
            this.navigationTree.forEach(tree => {
                const section = tree.label;
                if (tree.items) {
                    tree.items.forEach(item => {
                        if (item.path) {
                            list.push({ path: item.path, label: item.label, section });
                        }
                        if (item.children) {
                            item.children.forEach(child => {
                                if (child.path) {
                                    list.push({ path: child.path, label: child.label, section });
                                }
                            });
                        }
                    });
                }
            });
            return list;
        },

        currentDocumentIndex() {
            return this.flatDocumentList.findIndex(doc => doc.path === this.currentPath);
        },

        previousDocument() {
            const index = this.currentDocumentIndex;
            if (index > 0) {
                return this.flatDocumentList[index - 1];
            }
            return null;
        },

        nextDocument() {
            const index = this.currentDocumentIndex;
            if (index >= 0 && index < this.flatDocumentList.length - 1) {
                return this.flatDocumentList[index + 1];
            }
            return null;
        },

        currentDocumentLabel() {
            const doc = this.flatDocumentList.find(d => d.path === this.currentPath);
            return doc ? doc.label : '';
        },

        currentDocumentSection() {
            const doc = this.flatDocumentList.find(d => d.path === this.currentPath);
            return doc ? doc.section : '';
        },
    },

    watch: {
        currentPath: {
            immediate: true,
            handler(newPath) {
                if (newPath) {
                    this.loadDocument();
                }
            },
        },
        currentSet: {
            handler() {
                this.loadNavigationTree();
                this.currentDocument = null;
            },
        },
        currentLocale() {
            this.loadNavigationTree();
            if (this.currentPath) {
                this.loadDocument();
            }
        },
        navigationTree: {
            handler(tree) {
                // If no path is set and we have a navigation tree, navigate to the first document
                if (!this.currentPath && tree && tree.length > 0) {
                    const firstPath = this.getFirstDocumentPath(tree);
                    if (firstPath) {
                        this.$router.replace({
                            name: 'cc.project.documentation.index',
                            params: { set: this.currentSet, path: firstPath },
                        });
                    }
                }
            },
        },
    },

    created() {
        this.loadAvailableSets();
        this.loadNavigationTree();
    },

    methods: {
        async loadAvailableSets() {
            this.isLoadingSets = true;

            try {
                const response = await this.httpClient.get(
                    '/_action/cc/project-documentation/sets',
                    {
                        headers: this.getHeaders(),
                    }
                );

                if (response.data.success) {
                    this.availableSets = response.data.data;
                }
            } catch (error) {
                console.error('Failed to load documentation sets:', error);
            } finally {
                this.isLoadingSets = false;
            }
        },

        async loadNavigationTree() {
            this.isLoading = true;

            try {
                const response = await this.httpClient.get(
                    '/_action/cc/project-documentation/tree',
                    {
                        params: {
                            locale: this.currentLocale,
                            set: this.currentSet,
                        },
                        headers: this.getHeaders(),
                    }
                );

                if (response.data.success) {
                    this.navigationTree = response.data.data;
                }
            } catch (error) {
                console.error('Failed to load navigation tree:', error);
            } finally {
                this.isLoading = false;
            }
        },

        async loadDocument() {
            if (!this.currentPath) {
                return;
            }

            this.isLoadingDocument = true;

            try {
                const response = await this.httpClient.get(
                    `/_action/cc/project-documentation/document/${this.currentPath}`,
                    {
                        params: {
                            locale: this.currentLocale,
                            set: this.currentSet,
                        },
                        headers: this.getHeaders(),
                    }
                );

                if (response.data.success) {
                    this.currentDocument = response.data.data;
                } else {
                    this.currentDocument = null;
                }
            } catch (error) {
                console.error('Failed to load document:', error);
                this.currentDocument = null;
            } finally {
                this.isLoadingDocument = false;
            }
        },

        async onSearch(query) {
            if (!query || query.length < 2) {
                this.searchResults = [];
                return;
            }

            this.isSearching = true;

            try {
                const response = await this.httpClient.get(
                    '/_action/cc/project-documentation/search',
                    {
                        params: {
                            locale: this.currentLocale,
                            query: query,
                            set: this.currentSet,
                        },
                        headers: this.getHeaders(),
                    }
                );

                if (response.data.success) {
                    this.searchResults = response.data.data;
                }
            } catch (error) {
                console.error('Failed to search:', error);
            } finally {
                this.isSearching = false;
            }
        },

        onNavigate(path) {
            this.$router.push({
                name: 'cc.project.documentation.index',
                params: { set: this.currentSet, path: path },
            });
            this.searchResults = [];
        },

        onSetChange(setId) {
            this.$router.push({
                name: 'cc.project.documentation.index',
                params: { set: setId },
            });
        },

        getHeaders() {
            return {
                Accept: 'application/json',
                Authorization: `Bearer ${this.loginService.getToken()}`,
                'Content-Type': 'application/json',
            };
        },

        toggleMobileNav() {
            this.isMobileNavOpen = !this.isMobileNavOpen;
        },

        closeMobileNav() {
            this.isMobileNavOpen = false;
        },

        onMobileNavigate(path) {
            this.onNavigate(path);
            this.closeMobileNav();
        },

        getFirstDocumentPath(trees) {
            // Find the first document path from the navigation tree
            // Trees are sorted by position, so the first tree with items is the entry point
            for (const tree of trees) {
                if (tree.items && tree.items.length > 0) {
                    const firstItem = tree.items[0];

                    // If it has a path, use it
                    if (firstItem.path) {
                        return firstItem.path;
                    }

                    // If it has children, get the first child's path
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
    },
});
