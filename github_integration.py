import os
import requests
from github import Github

def get_github_client():
    token = os.getenv("GITHUB_TOKEN")
    if token:
        return Github(token)
    return Github() # Public only

def fetch_pr_diff(repo_name: str, pr_number: int) -> str:
    """
    Fetches the patch/diff of a pull request.
    """
    gh = get_github_client()
    repo = gh.get_repo(repo_name)
    pr = repo.get_pull(pr_number)
    
    # Get the diff URL and fetch the raw diff
    diff_url = pr.diff_url
    headers = {}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
        
    response = requests.get(diff_url, headers=headers)
    if response.status_code == 200:
        return response.text
    else:
        raise Exception(f"Failed to fetch PR diff: {response.status_code} {response.text}")

def post_pr_comment(repo_name: str, pr_number: int, body: str):
    """
    Posts a comment on a pull request.
    """
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        print("GITHUB_TOKEN not set. Cannot post comment to GitHub. Outputting here instead:")
        print("---")
        print(body)
        print("---")
        return
        
    gh = get_github_client()
    repo = gh.get_repo(repo_name)
    pr = repo.get_pull(pr_number)
    pr.create_issue_comment(body)
