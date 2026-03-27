# Shared in-memory pipeline cache — lives for the server session.
# Keyed by URL; value is the dict returned by run_pipeline().
pipeline_cache: dict[str, dict] = {}
