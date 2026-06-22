import streamlit as st
import os
from dotenv import load_dotenv
from agent import build_graph

# Load environment variables
load_dotenv()

import subprocess

def get_local_ollama_models():
    try:
        import ollama
        response = ollama.list()
        if hasattr(response, 'models'):
            return [m.model for m in response.models]
        elif isinstance(response, dict) and 'models' in response:
            return [m['name'] for m in response['models']]
    except Exception:
        pass
        
    try:
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')[1:]
            models = [line.split()[0] for line in lines if line.strip()]
            if models:
                return models
    except Exception:
        pass
    return [os.getenv("OLLAMA_MODEL", "gemma4:e4b")]

st.set_page_config(page_title="AI Security Code Review Agent", page_icon="🛡️", layout="wide")

st.title("🛡️ AI Security Code Review Agent")
st.markdown("Run a multi-agent security review on your local codebase or a GitHub Pull Request.")

# Sidebar for Configuration
with st.sidebar:
    st.header("⚙️ Configuration")
    provider = st.selectbox(
        "LLM Provider",
        options=["ollama", "anthropic", "openai", "google"],
        index=["ollama", "anthropic", "openai", "google"].index(os.getenv("LLM_PROVIDER", "ollama").lower())
    )
    # Update environment variable dynamically for this session
    os.environ["LLM_PROVIDER"] = provider
    
    st.markdown("---")
    if provider == "ollama":
        available_models = get_local_ollama_models()
        default_model = os.getenv("OLLAMA_MODEL", "gemma4:e4b")
        if default_model not in available_models:
            available_models.append(default_model)
            
        ollama_model = st.selectbox("Ollama Model", options=available_models, index=available_models.index(default_model))
        os.environ["OLLAMA_MODEL"] = ollama_model
    elif provider == "anthropic":
        api_key = st.text_input("Anthropic API Key", type="password", value=os.getenv("ANTHROPIC_API_KEY", ""))
        os.environ["ANTHROPIC_API_KEY"] = api_key
    elif provider == "openai":
        api_key = st.text_input("OpenAI API Key", type="password", value=os.getenv("OPENAI_API_KEY", ""))
        os.environ["OPENAI_API_KEY"] = api_key
    elif provider == "google":
        api_key = st.text_input("Google API Key", type="password", value=os.getenv("GOOGLE_API_KEY", ""))
        os.environ["GOOGLE_API_KEY"] = api_key

# Main Content Area
scan_type = st.radio("What would you like to scan?", ["Local Directory", "GitHub Pull Request"])

if scan_type == "Local Directory":
    local_path = st.text_input("Local Repository Path", placeholder="C:\\Users\\Nikola\\projects\\tlb-financial-tools")
    
    if st.button("Start Local Scan", type="primary"):
        if not local_path:
            st.error("Please provide a local path.")
        elif not os.path.exists(local_path):
            st.error("The specified path does not exist.")
        else:
            try:
                app = build_graph()
                state = {
                    "is_github": False,
                    "repo_path": local_path,
                    "pr_number": None,
                }
                
                final_state = dict(state)
                status_container = st.status(f"Agents are currently reviewing {local_path}...", expanded=True)
                
                for output in app.stream(state):
                    for node_name, node_state in output.items():
                        status_container.write(f"✅ **Step completed:** `{node_name}`")
                        final_state.update(node_state)
                        
                        if "raw_findings" in node_state and node_name == "detect_vulnerabilities":
                            with status_container.expander("🕵️ Raw Agent Findings"):
                                st.write(node_state["raw_findings"])
                                
                status_container.update(label="Workflow Complete!", state="complete", expanded=False)
                
                st.success("Review Complete!")
                st.markdown("### Findings Report")
                st.markdown(final_state.get("final_report", "No report generated."))
            except Exception as e:
                st.error(f"An error occurred: {str(e)}")

else:
    col1, col2 = st.columns(2)
    with col1:
        github_repo = st.text_input("GitHub Repository", placeholder="username/repository")
    with col2:
        pr_number = st.number_input("Pull Request Number", min_value=1, step=1)
        
    github_token = st.text_input("GitHub Token (Optional, for private repos)", type="password", value=os.getenv("GITHUB_TOKEN", ""))
    if github_token:
        os.environ["GITHUB_TOKEN"] = github_token
        
    if st.button("Start GitHub Scan", type="primary"):
        if not github_repo:
            st.error("Please provide a repository name.")
        else:
            try:
                app = build_graph()
                state = {
                    "is_github": True,
                    "repo_path": github_repo,
                    "pr_number": int(pr_number),
                }
                
                final_state = dict(state)
                status_container = st.status(f"Agents are fetching and reviewing PR #{pr_number} from {github_repo}...", expanded=True)
                
                for output in app.stream(state):
                    for node_name, node_state in output.items():
                        status_container.write(f"✅ **Step completed:** `{node_name}`")
                        final_state.update(node_state)
                        
                        if "raw_findings" in node_state and node_name == "detect_vulnerabilities":
                            with status_container.expander("🕵️ Raw Agent Findings"):
                                st.write(node_state["raw_findings"])
                                
                status_container.update(label="Workflow Complete!", state="complete", expanded=False)
                
                st.success("Review Complete!")
                st.markdown("### Findings Report")
                st.markdown(final_state.get("final_report", "No report generated."))
            except Exception as e:
                st.error(f"An error occurred: {str(e)}")

