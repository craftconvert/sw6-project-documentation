<?php declare(strict_types=1);

namespace CraftConvert\ProjectDocumentation\Documentation;

use Shopware\Core\Framework\Plugin\KernelPluginLoader\KernelPluginLoader;
use Symfony\Component\HttpKernel\KernelInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

class DocumentationScanner
{
    private const CACHE_KEY = 'cc_project_documentation_tree';
    private const CACHE_TTL = 3600;
    private const DEFAULT_SET = 'project';
    private const EXTERNAL_SOURCE_PREFIX = 'external_';

    public function __construct(
        private readonly KernelInterface $kernel,
        private readonly KernelPluginLoader $pluginLoader,
        private readonly CacheInterface $cache,
        private readonly array $documentationSets = []
    ) {
    }

    public function getAvailableSets(): array
    {
        $sets = [];

        foreach ($this->documentationSets as $setId => $setConfig) {
            $sets[$setId] = [
                'id' => $setId,
                'label' => $setConfig['label'] ?? ucfirst($setId),
                'icon' => $setConfig['icon'] ?? 'regular-book',
            ];
        }

        return $sets;
    }

    public function getNavigationTree(string $locale, string $set = self::DEFAULT_SET): array
    {
        $cacheKey = self::CACHE_KEY . '_' . $locale . '_' . $set;

        return $this->cache->get($cacheKey, function (ItemInterface $item) use ($locale, $set) {
            $item->expiresAfter(self::CACHE_TTL);

            return $this->buildNavigationTree($locale, $set);
        });
    }

    public function getImagePath(string $locale, string $imagePath, string $set = self::DEFAULT_SET, string $pluginContext = ''): ?string
    {
        $sources = $this->getDocumentationSources($locale, $set);

        // If plugin context is provided, try that plugin first
        if ($pluginContext !== '' && $this->isPluginSource($pluginContext)) {
            if (isset($sources[$pluginContext])) {
                $filePath = $sources[$pluginContext] . '/' . $imagePath;

                if (file_exists($filePath) && $this->isValidImageFile($filePath)) {
                    return $filePath;
                }
            }
        }

        // Check if path starts with a plugin slug
        $pathParts = explode('/', $imagePath, 2);
        if (count($pathParts) === 2) {
            $potentialSlug = $pathParts[0];
            $remainingPath = $pathParts[1];

            // Find matching plugin source by slug
            foreach ($sources as $sourceName => $docsPath) {
                if ($this->isPluginSource($sourceName) && $this->toKebabCase($sourceName) === $potentialSlug) {
                    $filePath = $docsPath . '/' . $remainingPath;

                    if (file_exists($filePath) && $this->isValidImageFile($filePath)) {
                        return $filePath;
                    }
                }
            }
        }

        // Fallback: search external sources without prefix
        foreach ($sources as $sourceName => $docsPath) {
            if (!$this->isPluginSource($sourceName)) {
                $filePath = $docsPath . '/' . $imagePath;

                if (file_exists($filePath) && $this->isValidImageFile($filePath)) {
                    return $filePath;
                }
            }
        }

        return null;
    }

    private function isValidImageFile(string $filePath): bool
    {
        $allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        if (!in_array($extension, $allowedExtensions, true)) {
            return false;
        }

        // Ensure path doesn't escape docs directory (security check)
        $realPath = realpath($filePath);
        if ($realPath === false) {
            return false;
        }

        return true;
    }

    public function getDocument(string $locale, string $path, string $set = self::DEFAULT_SET): ?array
    {
        $sources = $this->getDocumentationSources($locale, $set);

        // Check if path starts with a plugin slug
        $pathParts = explode('/', $path, 2);
        if (count($pathParts) === 2) {
            $potentialSlug = $pathParts[0];
            $remainingPath = $pathParts[1];

            // Find matching plugin source by slug
            foreach ($sources as $sourceName => $docsPath) {
                if ($this->isPluginSource($sourceName) && $this->toKebabCase($sourceName) === $potentialSlug) {
                    $filePath = $docsPath . '/' . $remainingPath . '.md';

                    if (file_exists($filePath)) {
                        $content = file_get_contents($filePath);
                        $lastModified = filemtime($filePath);

                        return [
                            'content' => $content,
                            'path' => $path,
                            'pluginName' => $sourceName,
                            'filePath' => $filePath,
                            'lastModified' => $lastModified,
                            'set' => $set,
                        ];
                    }
                }
            }
        }

        // Fallback: search external sources without prefix
        foreach ($sources as $sourceName => $docsPath) {
            if (!$this->isPluginSource($sourceName)) {
                $filePath = $docsPath . '/' . $path . '.md';

                if (file_exists($filePath)) {
                    $content = file_get_contents($filePath);
                    $lastModified = filemtime($filePath);

                    return [
                        'content' => $content,
                        'path' => $path,
                        'pluginName' => $sourceName,
                        'filePath' => $filePath,
                        'lastModified' => $lastModified,
                        'set' => $set,
                    ];
                }
            }
        }

        return null;
    }

    public function getAllDocuments(string $locale, string $set = self::DEFAULT_SET): array
    {
        $documents = [];
        $sources = $this->getDocumentationSources($locale, $set);

        foreach ($sources as $sourceName => $docsPath) {
            $documents = array_merge(
                $documents,
                $this->scanDirectory($docsPath, $sourceName, $locale, '', $set)
            );
        }

        return $documents;
    }

    private function buildNavigationTree(string $locale, string $set): array
    {
        $sources = $this->getDocumentationSources($locale, $set);
        $trees = [];

        foreach ($sources as $sourceName => $docsPath) {
            // Find all sidebar files in this source
            $sidebarFiles = $this->findSidebarFiles($docsPath);

            foreach ($sidebarFiles as $sidebarFile) {
                if (file_exists($sidebarFile)) {
                    $sidebarContent = file_get_contents($sidebarFile);
                    $sidebar = json_decode($sidebarContent, true);

                    if ($sidebar) {
                        // Check if this sidebar belongs to the requested set
                        $sidebarSet = $sidebar['set'] ?? self::DEFAULT_SET;

                        if ($sidebarSet === $set) {
                            $sidebar['pluginName'] = $sourceName;

                            // Auto-prefix paths for plugin sources
                            if ($this->isPluginSource($sourceName)) {
                                $sidebar = $this->prefixSidebarPaths($sidebar, $this->toKebabCase($sourceName));
                            }

                            $trees[] = $sidebar;
                        }
                    }
                }
            }
        }

        // Sort by position ascending (lower position = higher in list, like Shopware admin menu)
        usort($trees, fn($a, $b) => ($a['position'] ?? 100) <=> ($b['position'] ?? 100));

        return $trees;
    }

    /**
     * Find all sidebar files in a docs path.
     * Supports: _sidebar.json (legacy) and _sidebar-{set}.json patterns
     * Convention: Use _sidebar-project.json, _sidebar-developer.json, etc.
     */
    private function findSidebarFiles(string $docsPath): array
    {
        $sidebarFiles = [];

        if (!is_dir($docsPath)) {
            return $sidebarFiles;
        }

        $files = scandir($docsPath);

        foreach ($files as $file) {
            // Match _sidebar.json (legacy) or _sidebar-{set}.json
            if (preg_match('/^_sidebar(-[a-z]+)?\.json$/', $file)) {
                $sidebarFiles[] = $docsPath . '/' . $file;
            }
        }

        return $sidebarFiles;
    }

    private function getDocumentationSources(string $locale, string $set): array
    {
        $sources = [];

        // First, add external paths configured for this set
        $sources = array_merge($sources, $this->getExternalPaths($locale, $set));

        // Then, add plugin docs paths
        $sources = array_merge($sources, $this->getPluginsWithDocs($locale, $set));

        return $sources;
    }

    private function getExternalPaths(string $locale, string $set): array
    {
        $paths = [];

        if (!isset($this->documentationSets[$set]['paths'])) {
            return $paths;
        }

        foreach ($this->documentationSets[$set]['paths'] as $basePath) {
            $localePath = $basePath . '/' . $locale;

            if (is_dir($localePath)) {
                // Use a unique key for external paths
                $sourceName = 'external_' . $set . '_' . md5($basePath);
                $paths[$sourceName] = $localePath;
            }
        }

        return $paths;
    }

    private function getPluginsWithDocs(string $locale, string $set): array
    {
        $plugins = [];
        $activePlugins = $this->pluginLoader->getPluginInstances()->getActives();

        foreach ($activePlugins as $plugin) {
            $pluginPath = $plugin->getPath();
            $docsPath = $pluginPath . '/Resources/docs/' . $set . '/' . $locale;

            if (is_dir($docsPath)) {
                $plugins[$plugin->getName()] = $docsPath;
            }
        }

        return $plugins;
    }

    private function scanDirectory(string $directory, string $sourceName, string $locale, string $prefix = '', string $set = self::DEFAULT_SET): array
    {
        $documents = [];

        if (!is_dir($directory)) {
            return $documents;
        }

        $files = scandir($directory);

        foreach ($files as $file) {
            if ($file === '.' || $file === '..' || $file === '_sidebar.json') {
                continue;
            }

            $fullPath = $directory . '/' . $file;

            if (is_dir($fullPath)) {
                $documents = array_merge(
                    $documents,
                    $this->scanDirectory($fullPath, $sourceName, $locale, $prefix . $file . '/', $set)
                );
            } elseif (str_ends_with($file, '.md')) {
                $path = $prefix . pathinfo($file, PATHINFO_FILENAME);

                // Prefix path with plugin slug for plugin sources
                if ($this->isPluginSource($sourceName)) {
                    $path = $this->toKebabCase($sourceName) . '/' . $path;
                }

                $content = file_get_contents($fullPath);
                $lastModified = filemtime($fullPath);

                $documents[] = [
                    'path' => $path,
                    'pluginName' => $sourceName,
                    'filePath' => $fullPath,
                    'content' => $content,
                    'lastModified' => $lastModified,
                    'set' => $set,
                ];
            }
        }

        return $documents;
    }

    private function isPluginSource(string $sourceName): bool
    {
        return !str_starts_with($sourceName, self::EXTERNAL_SOURCE_PREFIX);
    }

    private function toKebabCase(string $string): string
    {
        return strtolower(preg_replace('/(?<!^)[A-Z]/', '-$0', $string));
    }

    private function prefixSidebarPaths(array $sidebar, string $prefix): array
    {
        if (isset($sidebar['items'])) {
            $sidebar['items'] = $this->prefixItemPaths($sidebar['items'], $prefix);
        }

        return $sidebar;
    }

    private function prefixItemPaths(array $items, string $prefix): array
    {
        foreach ($items as &$item) {
            if (isset($item['path'])) {
                $item['path'] = $prefix . '/' . $item['path'];
            }

            if (isset($item['children'])) {
                $item['children'] = $this->prefixItemPaths($item['children'], $prefix);
            }
        }

        return $items;
    }
}
