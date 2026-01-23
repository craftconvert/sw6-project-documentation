<?php declare(strict_types=1);

namespace CraftConvert\ProjectDocumentation\Documentation;

class SearchIndexer
{
    private const DEFAULT_SET = 'project';

    public function __construct(
        private readonly DocumentationScanner $scanner
    ) {
    }

    public function search(string $locale, string $query, int $limit = 20, string $set = self::DEFAULT_SET): array
    {
        $documents = $this->scanner->getAllDocuments($locale, $set);
        $query = strtolower(trim($query));
        $queryWords = preg_split('/\s+/', $query);
        $results = [];

        foreach ($documents as $document) {
            $content = strtolower($document['content']);
            $score = $this->calculateScore($content, $query, $queryWords);

            if ($score > 0) {
                $results[] = [
                    'path' => $document['path'],
                    'pluginName' => $document['pluginName'],
                    'title' => $this->extractTitle($document['content']),
                    'excerpt' => $this->extractExcerpt($document['content'], $query),
                    'score' => $score,
                    'set' => $set,
                ];
            }
        }

        usort($results, fn($a, $b) => $b['score'] <=> $a['score']);

        return array_slice($results, 0, $limit);
    }

    private function calculateScore(string $content, string $query, array $queryWords): float
    {
        $score = 0;

        if (str_contains($content, $query)) {
            $score += 10 * substr_count($content, $query);
        }

        foreach ($queryWords as $word) {
            if (strlen($word) < 2) {
                continue;
            }

            if (str_contains($content, $word)) {
                $score += substr_count($content, $word);
            }
        }

        return $score;
    }

    private function extractTitle(string $markdown): string
    {
        $lines = explode("\n", $markdown);

        foreach ($lines as $line) {
            if (preg_match('/^#\s+(.+)$/', $line, $matches)) {
                return trim($matches[1]);
            }
        }

        return 'Untitled';
    }

    private function extractExcerpt(string $markdown, string $query, int $length = 150): string
    {
        $text = strip_tags($markdown);
        $text = preg_replace('/^#+\s+.+$/m', '', $text);
        $text = preg_replace('/\[([^\]]+)\]\([^)]+\)/', '$1', $text);
        $text = preg_replace('/[*_`#]/', '', $text);
        $text = preg_replace('/\s+/', ' ', $text);
        $text = trim($text);

        $queryPos = stripos($text, $query);

        if ($queryPos !== false) {
            $start = max(0, $queryPos - 50);
            $excerpt = substr($text, $start, $length);

            if ($start > 0) {
                $excerpt = '...' . $excerpt;
            }

            if (strlen($text) > $start + $length) {
                $excerpt .= '...';
            }

            return $excerpt;
        }

        if (strlen($text) > $length) {
            return substr($text, 0, $length) . '...';
        }

        return $text;
    }
}
