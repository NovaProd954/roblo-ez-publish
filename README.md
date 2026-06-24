# Roblo-ez Publish

Roblo-ez Publish is a lightweight white-mode frontend for Roblox publishing workflows. It keeps the original universe/place creation concept, but cleans up the UI and adds a separate free 3D model search/import flow.

## What changed

- Cleaner minimal white interface
- Better mobile layout
- Dedicated 3D model tab
- Search-first model workflow instead of local uploads
- Safer cookie handling in the UI
- A worker template for the backend integration points
- A Colab script for unzipping the project and pushing it to a brand-new GitHub repo

## 3D model workflow

The frontend is built around a worker contract:

- `searchModels` returns free 3D model results
- `importModel` sends the selected result plus the user's `.ROBLOSECURITY` cookie to the Roblox-side import endpoint

The repo includes a worker template named `worker-template.js`. It is intentionally configurable because providers and endpoint shapes can differ. Point it at the free-model search endpoint you choose and the Roblox import endpoint you already use.

## Files

- `index.html` — redesigned white-mode frontend
- `worker-template.js` — configurable worker proxy/template
- `colab_push.py` — Colab-ready helper to unzip and push to a new GitHub repo
- `LICENSE` — AGPLv3 retained from the original project

## Colab push helper

Use `colab_push.py` inside Colab with:

- `ZIP_PATH` set to the uploaded zip path
- `GITHUB_TOKEN` set to a token with repo creation and push access
- optional `REPO_NAME`, `REPO_PRIVATE`, and `REPO_DESCRIPTION`

The helper will:

1. unzip the archive,
2. create a new GitHub repository through the GitHub API,
3. initialize a local git repo,
4. commit the files,
5. push to the new remote.

## Security

Keep the worker allowlist strict. The frontend wipes cookie fields on unload, on page hide, and immediately after a publish action begins.

## License

AGPLv3, inherited from the original repository.
