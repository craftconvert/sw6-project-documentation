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

    public function getDocument(string $locale, string $path, string $set = self::DEFAULT_SET): ?array
    {
        $sources = $this->getDocumentationSources($locale, $set);

        foreach ($sources as $sourceName => $docsPath) {
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

        // Then, add plugin docs paths (plugins determine their set via _sidebar.json)
        $sources = array_merge($sources, $this->getPluginsWithDocs($locale));

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

    private function getPluginsWithDocs(string $locale): array
    {
        $plugins = [];
        $activePlugins = $this->pluginLoader->getPluginInstances()->getActives();

        foreach ($activePlugins as $plugin) {
            $pluginPath = $plugin->getPath();
            $docsPath = $pluginPath . '/Resources/docs/' . $locale;

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

    public function clearCache(): void
    {
        $locales = ['en-GB', 'nl-BE', 'nl-NL'];
        $sets = array_keys($this->documentationSets);

        if (empty($sets)) {
            $sets = [self::DEFAULT_SET];
        }

        foreach ($locales as $locale) {
            foreach ($sets as $set) {
                $this->cache->delete(self::CACHE_KEY . '_' . $locale . '_' . $set);
            }
        }
    }
}
