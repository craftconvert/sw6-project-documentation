<?php declare(strict_types=1);

namespace CraftConvert\ProjectDocumentation\Api\Controller;

use CraftConvert\ProjectDocumentation\Documentation\DocumentationScanner;
use CraftConvert\ProjectDocumentation\Documentation\MarkdownParser;
use CraftConvert\ProjectDocumentation\Documentation\SearchIndexer;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class DocumentationController extends AbstractController
{
    private const DEFAULT_SET = 'project';

    public function __construct(
        private readonly DocumentationScanner $scanner,
        private readonly MarkdownParser $parser,
        private readonly SearchIndexer $searchIndexer,
        private readonly ?string $dashboardImage = null
    ) {
    }

    #[Route(
        path: '/api/_action/cc/project-documentation/config',
        name: 'api.action.cc.project_documentation.config',
        defaults: ['_routeScope' => ['api'], '_acl' => ['cc_project_documentation:read']],
        methods: ['GET']
    )]
    public function getConfig(): JsonResponse
    {
        return new JsonResponse([
            'success' => true,
            'data' => [
                'dashboardImage' => $this->dashboardImage,
            ],
        ]);
    }

    #[Route(
        path: '/api/_action/cc/project-documentation/sets',
        name: 'api.action.cc.project_documentation.sets',
        defaults: ['_routeScope' => ['api'], '_acl' => ['cc_project_documentation:read']],
        methods: ['GET']
    )]
    public function getSets(): JsonResponse
    {
        $sets = $this->scanner->getAvailableSets();

        return new JsonResponse([
            'success' => true,
            'data' => $sets,
        ]);
    }

    #[Route(
        path: '/api/_action/cc/project-documentation/tree',
        name: 'api.action.cc.project_documentation.tree',
        defaults: ['_routeScope' => ['api'], '_acl' => ['cc_project_documentation:read']],
        methods: ['GET']
    )]
    public function getTree(Request $request): JsonResponse
    {
        $locale = $request->query->getString('locale', 'en-GB');
        $set = $request->query->getString('set', self::DEFAULT_SET);
        $tree = $this->scanner->getNavigationTree($locale, $set);

        return new JsonResponse([
            'success' => true,
            'data' => $tree,
        ]);
    }

    #[Route(
        path: '/api/_action/cc/project-documentation/document/{path}',
        name: 'api.action.cc.project_documentation.document',
        defaults: ['_routeScope' => ['api'], '_acl' => ['cc_project_documentation:read']],
        methods: ['GET'],
        requirements: ['path' => '.+']
    )]
    public function getDocument(Request $request, string $path): JsonResponse
    {
        $locale = $request->query->getString('locale', 'en-GB');
        $set = $request->query->getString('set', self::DEFAULT_SET);
        $document = $this->scanner->getDocument($locale, $path, $set);

        if ($document === null) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Document not found',
            ], 404);
        }

        $toc = $this->parser->extractTableOfContents($document['content']);
        $title = $this->parser->extractTitle($document['content']);

        return new JsonResponse([
            'success' => true,
            'data' => [
                'path' => $document['path'],
                'pluginName' => $document['pluginName'],
                'content' => $document['content'],
                'title' => $title,
                'toc' => $toc,
                'lastModified' => $document['lastModified'],
                'set' => $document['set'],
                'locale' => $locale,
            ],
        ]);
    }

    #[Route(
        path: '/api/_action/cc/project-documentation/image/{path}',
        name: 'api.action.cc.project_documentation.image',
        defaults: ['_routeScope' => ['api'], '_acl' => ['cc_project_documentation:read']],
        methods: ['GET'],
        requirements: ['path' => '.+']
    )]
    public function getImage(Request $request, string $path): Response
    {
        $locale = $request->query->getString('locale', 'en-GB');
        $set = $request->query->getString('set', self::DEFAULT_SET);

        $imagePath = $this->scanner->getImagePath($locale, $path, $set);

        if ($imagePath === null) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Image not found',
            ], 404);
        }

        $content = file_get_contents($imagePath);
        $extension = strtolower(pathinfo($imagePath, PATHINFO_EXTENSION));

        $mimeTypes = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml',
        ];

        $contentType = $mimeTypes[$extension] ?? 'application/octet-stream';

        return new Response($content, 200, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    #[Route(
        path: '/api/_action/cc/project-documentation/search',
        name: 'api.action.cc.project_documentation.search',
        defaults: ['_routeScope' => ['api'], '_acl' => ['cc_project_documentation:read']],
        methods: ['GET']
    )]
    public function search(Request $request): JsonResponse
    {
        $locale = $request->query->getString('locale', 'en-GB');
        $query = $request->query->getString('query', '');
        $limit = $request->query->getInt('limit', 20);
        $set = $request->query->getString('set', self::DEFAULT_SET);

        if (strlen($query) < 2) {
            return new JsonResponse([
                'success' => true,
                'data' => [],
            ]);
        }

        $results = $this->searchIndexer->search($locale, $query, $limit, $set);

        return new JsonResponse([
            'success' => true,
            'data' => $results,
        ]);
    }
}
