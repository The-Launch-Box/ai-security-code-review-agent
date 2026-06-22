import argparse
from dotenv import load_dotenv
from agent import build_graph

def main():
    load_dotenv() # Load environment variables from .env file
    
    parser = argparse.ArgumentParser(description="AI Security Code Review Agent")
    parser.add_argument("--local", type=str, help="Path to local repository to scan")
    parser.add_argument("--github", type=str, help="GitHub repository name (e.g. anthropics/claude-code-security-review)")
    parser.add_argument("--pr", type=int, help="GitHub Pull Request number (required if --github is used)")
    
    args = parser.parse_args()
    
    if args.github and not args.pr:
        parser.error("--pr is required when --github is specified")
        
    if not args.local and not args.github:
        parser.error("Must specify either --local or --github")
        
    state = {
        "is_github": bool(args.github),
        "repo_path": args.github if args.github else args.local,
        "pr_number": args.pr,
    }
    
    print(f"Starting security review for {'GitHub PR ' + str(args.pr) + ' on ' + args.github if args.github else 'local path ' + args.local}...")
    
    app = build_graph()
    
    final_state = app.invoke(state)
    
    print("\n" + "="*50 + "\n")
    print(final_state.get("final_report", "No report generated."))
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    main()
