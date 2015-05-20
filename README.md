# staticache

Express.static middleware replacement that keeps an in-memory dependency graph of all your served web assets, serves everything with a far future expires and appends a correct asset content MD5-hash to the url of each file.

The goal is to get fast reloads of pages in development mode that might have 5000+ requests to load the complete page (slow). The result should be that the initial load is equally as slow, but subsequent loads will primarily load from cache, and only the path to the updated assets will be loaded from the server.

Status: Experiment
