<?php
/**
 * Router — Maps ?action= to handler classes and sub-actions.
 *
 * Action format: action=handler:subaction
 * Examples:
 *   action=pages:get
 *   action=blocks:reorder
 *   action=items:add
 *   action=export:export
 */

class Router
{
    private array $handlers = [
        'pages'  => Handlers\PagesHandler::class,
        'blocks' => Handlers\BlocksHandler::class,
        'items'  => Handlers\ItemsHandler::class,
        'export' => Handlers\ExportHandler::class,
    ];

    /**
     * Parse the action string and dispatch to the appropriate handler.
     */
    public function dispatch(string $actionRaw): void
    {
        // Support both "handler:subaction" and legacy "subaction" formats
        if (str_contains($actionRaw, ':')) {
            [$handlerName, $subAction] = explode(':', $actionRaw, 2);
        } else {
            // Legacy: try to find which handler has this action
            $handlerName = null;
            $subAction = $actionRaw;
            foreach ($this->handlers as $name => $class) {
                $instance = new $class();
                if (method_exists($instance, $subAction)) {
                    $handlerName = $name;
                    break;
                }
            }
            if ($handlerName === null) {
                $this->jsonError('Unknown action: ' . $actionRaw, 404);
                return;
            }
        }

        $handlerClass = $this->handlers[$handlerName] ?? null;
        if ($handlerClass === null) {
            $this->jsonError('Unknown handler: ' . $handlerName, 404);
            return;
        }

        $handler = new $handlerClass();
        if (!method_exists($handler, $subAction)) {
            $this->jsonError("Unknown action '{$subAction}' on '{$handlerName}'", 404);
            return;
        }

        $handler->$subAction();
    }

    /**
     * Send a JSON response and exit.
     */
    private function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Send a JSON error response and exit.
     */
    private function jsonError(string $message, int $status = 400): never
    {
        $this->json(['error' => $message], $status);
    }
}

// Helper: send JSON from handlers
function apiResponse(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function apiError(string $message, int $status = 400): never
{
    apiResponse(['error' => $message], $status);
}
