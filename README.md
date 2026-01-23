# Craft Convert Project Documentation

A Shopware 6 plugin that provides an integrated documentation portal within the administration panel. Write documentation in Markdown files, and the plugin renders them with sidebar navigation, search, and table of contents.

## Features

- Markdown-based documentation stored alongside code
- Sidebar navigation with collapsible sections
- Full-text search across all documents
- Auto-generated table of contents with scroll spy
- Multi-language support (locale-based folders)
- Previous/Next page navigation
- Mobile-responsive layout
- ACL-protected access
- Multi-plugin support (other plugins can contribute docs)

## Installation

```bash
lando php bin/console plugin:refresh
lando php bin/console plugin:install --activate CraftConvertProjectDocumentation
lando php bin/console assets:install
lando php bin/console theme:compile
lando php bin/console cache:clear
```

## Access Control

Users need the `cc_project_documentation.viewer` privilege to access the documentation portal.

Assign this in: **Settings > Users & permissions > Roles > [Role] > Additional permissions**

## Documentation Sources

The plugin supports two documentation sources:

1. **Project documentation** - General project docs stored in a configured folder
2. **Plugin documentation** - Each plugin can contribute its own docs

### Project Documentation

Store general project documentation in a dedicated folder outside of plugins. By default, the plugin looks for docs in:

```
custom/docs/project/{locale}/
```

You can customize this path by creating `config/packages/cc_project_documentation.yaml`:

```yaml
parameters:
    cc.project_documentation.sets:
        project:
            label: 'Project'
            icon: 'regular-book-user'
            paths:
                - '%kernel.project_dir%/custom/docs/project'
```

You can also define multiple documentation sets (e.g., for different audiences):

```yaml
parameters:
    cc.project_documentation.sets:
        project:
            label: 'Project'
            icon: 'regular-book-user'
            paths:
                - '%kernel.project_dir%/custom/docs/project'
        developer:
            label: 'Developer'
            icon: 'regular-code'
            paths:
                - '%kernel.project_dir%/custom/docs/developer'
```

### Plugin Documentation

Any plugin can contribute documentation by adding a `Resources/docs/{locale}/` folder.

### Directory Structure

```
YourPlugin/
└── src/
    └── Resources/
        └── docs/
            ├── en-GB/
            │   ├── _sidebar.json
            │   ├── getting-started.md
            │   └── features/
            │       └── overview.md
            └── nl-BE/
                ├── _sidebar.json
                └── ...
```

### Sidebar Configuration

Create a `_sidebar.json` file to define the navigation:

```json
{
    "label": "Your Plugin",
    "icon": "regular-puzzle",
    "position": 50,
    "items": [
        {
            "path": "getting-started",
            "label": "Getting Started"
        },
        {
            "label": "Features",
            "children": [
                {
                    "path": "features/overview",
                    "label": "Overview"
                }
            ]
        }
    ]
}
```

| Property | Description |
|----------|-------------|
| `label` | Section name displayed in the sidebar |
| `icon` | Shopware icon name (e.g., `regular-book`) |
| `position` | Sort order (lower numbers appear first) |
| `items` | Array of navigation items |
| `path` | Relative path to `.md` file (without extension) |
| `children` | Nested items for collapsible subsections |

### Position Guidelines

| Range | Purpose |
|-------|---------|
| 0-9 | Welcome/Introduction |
| 10-29 | Core integrations |
| 30-49 | Theme and major features |
| 50-79 | Feature plugins |
| 80-99 | Utility plugins |
| 100+ | Minor plugins |

### Markdown Syntax

Standard Markdown is supported:

```markdown
# Page Title

## Section Heading

Paragraph text with **bold** and *italic*.

- Unordered list
- Another item

1. Ordered list
2. Second item

[Link text](https://example.com)

`inline code`

​```php
// Code block
$example = true;
​```

| Column 1 | Column 2 |
|----------|----------|
| Data     | Data     |

> Blockquote
```

### Caching

Documentation is cached for 1 hour. Clear the cache after making changes:

```bash
lando php bin/console cache:clear
```

## API Endpoints

All endpoints require `cc_project_documentation:read` ACL permission.

| Endpoint | Description |
|----------|-------------|
| `GET /api/_action/cc/project-documentation/tree?locale=en-GB` | Navigation tree |
| `GET /api/_action/cc/project-documentation/document/{path}?locale=en-GB` | Document content |
| `GET /api/_action/cc/project-documentation/search?locale=en-GB&query=term` | Search documents |

## Troubleshooting

**Menu not visible**: Ensure plugin is active and user has the `cc_project_documentation.viewer` privilege.

**Documents not appearing**: Check that `_sidebar.json` paths match your markdown files and clear the cache.

**Changes not showing**: Clear cache after modifying documentation or rebuild admin assets after JS/SCSS changes.
