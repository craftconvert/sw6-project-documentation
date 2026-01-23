<?php declare(strict_types=1);

namespace CraftConvert\ProjectDocumentation\Documentation;

class MarkdownParser
{
    public function extractTableOfContents(string $markdown): array
    {
        $toc = [];
        $lines = explode("\n", $markdown);

        foreach ($lines as $line) {
            if (preg_match('/^(#{1,6})\s+(.+)$/', $line, $matches)) {
                $level = strlen($matches[1]);
                $text = trim($matches[2]);
                $id = $this->generateSlug($text);

                $toc[] = [
                    'level' => $level,
                    'text' => $text,
                    'id' => $id,
                ];
            }
        }

        return $toc;
    }

    public function extractTitle(string $markdown): ?string
    {
        $lines = explode("\n", $markdown);

        foreach ($lines as $line) {
            if (preg_match('/^#\s+(.+)$/', $line, $matches)) {
                return trim($matches[1]);
            }
        }

        return null;
    }

    public function extractExcerpt(string $markdown, int $length = 200): string
    {
        $text = strip_tags($markdown);
        $text = preg_replace('/^#+\s+.+$/m', '', $text);
        $text = preg_replace('/\[([^\]]+)\]\([^)]+\)/', '$1', $text);
        $text = preg_replace('/[*_`#]/', '', $text);
        $text = preg_replace('/\s+/', ' ', $text);
        $text = trim($text);

        if (strlen($text) > $length) {
            $text = substr($text, 0, $length) . '...';
        }

        return $text;
    }

    private function generateSlug(string $text): string
    {
        $text = strtolower($text);
        $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
        $text = preg_replace('/[\s_]+/', '-', $text);
        $text = preg_replace('/-+/', '-', $text);
        $text = trim($text, '-');

        return $text;
    }
}
