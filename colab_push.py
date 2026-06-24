#!/usr/bin/env python3
"""
Roblo-ez Publish Colab helper.

Usage in Colab:
1) Upload the source zip to /content
2) Set GITHUB_TOKEN in a cell or environment variable
3) Run this script

Environment variables:
- ZIP_PATH: path to the uploaded zip file
- GITHUB_TOKEN: GitHub token with permission to create repositories and push
- REPO_NAME: optional repo name, default roblo-ez-publish
- REPO_PRIVATE: "true" or "false", default false
- REPO_DESCRIPTION: optional repository description
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from urllib import request, error

def sh(cmd, cwd=None, check=True):
    print("+", " ".join(cmd))
    return subprocess.run(cmd, cwd=cwd, check=check)

def gh_api(method: str, url: str, token: str, payload: dict | None = None):
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = request.Request(url, data=data, headers=headers, method=method)
    with request.urlopen(req) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else {}

def main():
    zip_path = Path(os.environ.get("ZIP_PATH", "/content/ezpublish-main.zip"))
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    repo_name = os.environ.get("REPO_NAME", "roblo-ez-publish").strip()
    private = os.environ.get("REPO_PRIVATE", "false").strip().lower() == "true"
    description = os.environ.get("REPO_DESCRIPTION", "Roblo-ez Publish").strip()

    if not zip_path.exists():
        raise FileNotFoundError(f"ZIP not found: {zip_path}")
    if not token:
        raise RuntimeError("GITHUB_TOKEN is required")

    workdir = Path("/content/roblo-ez-publish-work")
    if workdir.exists():
        shutil.rmtree(workdir)
    workdir.mkdir(parents=True)

    import zipfile
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(workdir)

    root_candidates = [p for p in workdir.iterdir() if p.is_dir()]
    if len(root_candidates) == 1 and (root_candidates[0] / "index.html").exists():
        repo_root = root_candidates[0]
    else:
        repo_root = workdir

    user = gh_api("GET", "https://api.github.com/user", token)
    username = user["login"]
    print("GitHub user:", username)

    try:
        repo = gh_api(
            "POST",
            "https://api.github.com/user/repos",
            token,
            {
                "name": repo_name,
                "description": description,
                "private": private,
                "auto_init": False,
            },
        )
        print("Created repository:", repo["html_url"])
    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if e.code == 422 and "name already exists" in body.lower():
            repo = gh_api("GET", f"https://api.github.com/repos/{username}/{repo_name}", token)
            print("Repository already existed:", repo["html_url"])
        else:
            print(body)
            raise

    remote_url = f"https://{token}@github.com/{username}/{repo_name}.git"

    sh(["git", "init"], cwd=repo_root)
    sh(["git", "config", "user.name", username], cwd=repo_root)
    sh(["git", "config", "user.email", f"{username}@users.noreply.github.com"], cwd=repo_root)
    sh(["git", "add", "-A"], cwd=repo_root)
    sh(["git", "commit", "-m", "Initial Roblo-ez Publish import"], cwd=repo_root)
    sh(["git", "branch", "-M", "main"], cwd=repo_root)
    sh(["git", "remote", "add", "origin", remote_url], cwd=repo_root)
    sh(["git", "push", "-u", "origin", "main"], cwd=repo_root)

    print("\nDone.")
    print("Repo URL:", repo["html_url"])

if __name__ == "__main__":
    main()
