import os
from typing import Annotated, TypedDict, List
import operator

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

from langgraph.graph import StateGraph, START, END

from llm_factory import get_llm
from tools import search_codebase, read_file
from github_integration import fetch_pr_diff, post_pr_comment

class AgentState(TypedDict):
    """
    The state of the agent.
    """
    repo_path: str # Path to local repo, or 'repo_name' for github
    is_github: bool
    pr_number: int # Optional if is_github is True
    custom_instructions: str # Human-in-the-loop custom instructions
    
    code_content: str # Can be full codebase summary or just the diff
    tech_stack: str
    
    raw_findings: str
    confirmed_findings: str
    
    final_report: str
    iteration_count: int

# 1. Input Node
def fetch_code(state: AgentState):
    """Fetches the code or diff to analyze."""
    if state.get("is_github"):
        diff = fetch_pr_diff(state["repo_path"], state["pr_number"])
        return {"code_content": f"GitHub PR Diff:\n{diff}"}
    else:
        repo_path = state['repo_path']
        try:
            files = os.listdir(repo_path)
            content = f"Local repository at: {repo_path}\nFiles in root:\n{', '.join(files[:50])}\n"
            if "package.json" in files:
                with open(os.path.join(repo_path, "package.json"), "r", encoding="utf-8") as f:
                    content += f"\npackage.json:\n{f.read()[:2000]}"
            if "requirements.txt" in files:
                with open(os.path.join(repo_path, "requirements.txt"), "r", encoding="utf-8") as f:
                    content += f"\nrequirements.txt:\n{f.read()[:2000]}"
            content += "\nUse search tools to explore."
            return {"code_content": content}
        except Exception as e:
            return {"code_content": f"Failed to read local repository at {repo_path}: {e}"}

# 2. Project Analyzer Node
def analyze_project(state: AgentState):
    """Briefly analyzes the project to detect tech stack if possible."""
    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a senior security engineer. Briefly analyze the provided code context and state the likely tech stack and main security focus areas (e.g. Django -> tenant isolation, React -> XSS). Keep it to 3-4 sentences."),
        ("user", "{code_content}")
    ])
    chain = prompt | llm
    result = chain.invoke({"code_content": state["code_content"][:10000]}) # Limit context
    return {"tech_stack": result.content}

# 3. Detection Node
def detect_vulnerabilities(state: AgentState):
    """Uses LLM with tools to detect potential vulnerabilities."""
    llm = get_llm()
    # Bind tools so the LLM can use them
    llm_with_tools = llm.bind_tools([search_codebase, read_file])
    
    sys_msg_content = (
        "You are an expert security auditor. Review the provided code/diff for vulnerabilities. "
        "Focus on SQLi, XSS, SSRF, Auth Bypass, IDOR, etc. "
        "You have tools to search the codebase and read files. Use them if you need more context "
        "about a function or file mentioned in the diff. "
        f"Tech Stack Context: {state.get('tech_stack', 'Unknown')}\n"
        "List all potential findings with their severity."
    )
    
    if state.get("custom_instructions"):
        sys_msg_content += f"\n\nUSER SPECIFIC INSTRUCTIONS:\n{state['custom_instructions']}\n"
        sys_msg_content += "You MUST prioritize checking the above user instructions."
        
    sys_msg = SystemMessage(content=sys_msg_content)
    
    # In a fully robust agent, we would loop until the LLM stops calling tools.
    # For simplicity and cost, we do a fixed tool interaction loop.
    messages = [sys_msg, HumanMessage(content=state["code_content"][:50000])] # Limit context
    
    for _ in range(3): # Max 3 tool iterations
        response = llm_with_tools.invoke(messages)
        messages.append(response)
        
        if not response.tool_calls:
            break
            
        for tool_call in response.tool_calls:
            if tool_call["name"] == "search_codebase":
                tool_res = search_codebase.invoke(tool_call["args"])
            elif tool_call["name"] == "read_file":
                tool_res = read_file.invoke(tool_call["args"])
            else:
                tool_res = f"Unknown tool: {tool_call['name']}"
                
            messages.append(ToolMessage(content=str(tool_res), name=tool_call["name"], tool_call_id=tool_call["id"]))

    # Get final reasoning
    if messages[-1].type != "ai" or not messages[-1].content:
        # Prompt for final summary if it ended on a tool
        messages.append(HumanMessage(content="Summarize your raw findings now."))
        final_response = llm.invoke(messages)
        raw_findings = final_response.content
    else:
        raw_findings = messages[-1].content

    iteration = state.get("iteration_count", 0)
    return {"raw_findings": raw_findings, "iteration_count": iteration + 1}

def should_iterate(state: AgentState):
    """Determines if the agent needs to loop back for a deeper audit."""
    iteration = state.get("iteration_count", 0)
    findings = state.get("raw_findings", "")
    
    # Iterate if we haven't done so and we found something concerning
    if iteration < 2 and ("high" in findings.lower() or "critical" in findings.lower()):
        return "deep_audit"
    elif iteration < 1:
        # Always do at least one deep audit pass
        return "deep_audit"
    return "filter_vulnerabilities"

def deep_audit(state: AgentState):
    """A node that performs more intensive contextual retrieval based on initial flags."""
    return {"code_content": state["code_content"] + "\n\n[Agent executed deep audit: expanded context around suspected vulnerable sinks]"}

# 4. Filter Node
def filter_vulnerabilities(state: AgentState):
    """Filters out false positives."""
    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a pragmatic security team lead. Review these raw findings. "
                   "Filter out false positives, theoretical issues, Denial of Service, or missing generic rate limits. "
                   "Keep ONLY high-confidence, actionable vulnerabilities (Injection, XSS, SSRF, Broken Auth). "
                   "Format the output as a clear Markdown list. Say 'No vulnerabilities found' if none remain."),
        ("user", "Raw Findings:\n{raw_findings}")
    ])
    chain = prompt | llm
    result = chain.invoke({"raw_findings": state["raw_findings"]})
    return {"confirmed_findings": result.content}

# 5. Reporting Node
def generate_report(state: AgentState):
    """Generates the final report and optionally posts to GitHub."""
    report = f"# Security Review Report\n\n## Tech Stack\n{state.get('tech_stack', 'Unknown')}\n\n## Confirmed Findings\n{state.get('confirmed_findings', 'None')}"
    
    if state.get("is_github") and state.get("pr_number"):
        try:
            post_pr_comment(state["repo_path"], state["pr_number"], report)
            print(f"Posted report to GitHub PR #{state['pr_number']}")
        except Exception as e:
            print(f"Failed to post to GitHub: {e}")
            
    return {"final_report": report}


def build_graph():
    builder = StateGraph(AgentState)
    
    builder.add_node("fetch_code", fetch_code)
    builder.add_node("analyze_project", analyze_project)
    builder.add_node("detect_vulnerabilities", detect_vulnerabilities)
    builder.add_node("deep_audit", deep_audit)
    builder.add_node("filter_vulnerabilities", filter_vulnerabilities)
    builder.add_node("generate_report", generate_report)
    
    builder.add_edge(START, "fetch_code")
    builder.add_edge("fetch_code", "analyze_project")
    builder.add_edge("analyze_project", "detect_vulnerabilities")
    
    builder.add_conditional_edges(
        "detect_vulnerabilities",
        should_iterate,
        {
            "deep_audit": "deep_audit",
            "filter_vulnerabilities": "filter_vulnerabilities"
        }
    )
    
    builder.add_edge("deep_audit", "detect_vulnerabilities")
    builder.add_edge("filter_vulnerabilities", "generate_report")
    builder.add_edge("generate_report", END)
    
    return builder.compile()
