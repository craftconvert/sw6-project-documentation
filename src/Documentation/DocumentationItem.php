<?php declare(strict_types=1);

namespace CraftConvert\ProjectDocumentation\Documentation;

class DocumentationItem
{
    public function __construct(
        public readonly string $path,
        public readonly string $label,
        public readonly string $pluginName,
        public readonly string $filePath,
        public readonly ?int $lastModified = null
    ) {
    }

    public function toArray(): array
    {
        return [
            'path' => $this->path,
            'label' => $this->label,
            'pluginName' => $this->pluginName,
            'filePath' => $this->filePath,
            'lastModified' => $this->lastModified,
        ];
    }
}
