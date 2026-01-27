# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-01-27

### Changed

- **Breaking:** Plugin documentation path structure changed from `Resources/docs/{locale}/` to `Resources/docs/{set}/{locale}/` for consistency with external documentation paths
- Plugin-based documentation URLs now include a kebab-case plugin prefix (e.g., `my-plugin/getting-started`) to prevent collisions when multiple plugins use the same filename

### Removed

- Unused `clearCache()` method with hardcoded locales from DocumentationScanner

## [1.0.0] - 2026-01-24

### Added

- Initial release
- Display project documentation in Shopware administration area
