<?php
/**
 * App — Application bootstrap and service container.
 */

class App
{
    private Router $router;
    private Render $render;

    public function __construct()
    {
        $this->router = new Router();
        $this->render = new Render();
    }

    /**
     * Bootstrap the application: run migrations, check access, dispatch.
     */
    public function run(): void
    {
        // Run pending migrations
        $migration = new Migration();
        $migration->run();

        // Check IP whitelist
        Middleware::checkIp();

        // Dispatch request
        $action = $_GET['action'] ?? null;
        if ($action !== null && $action !== '') {
            $this->router->dispatch($action);
        } else {
            $this->render->page();
        }
    }
}
