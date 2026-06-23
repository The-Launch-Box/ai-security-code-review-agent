from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
import json

from agent import build_graph

app = FastAPI(title="Security Agent API")

# Allow all CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The set of nodes we surface to the UI. START/END are virtual.
GRAPH_NODES = {
    "fetch_code",
    "analyze_project",
    "detect_vulnerabilities",
    "deep_audit",
    "filter_vulnerabilities",
    "generate_report",
}

# Which AgentState key each node is responsible for producing. The UI uses this
# to animate the state object filling up as the graph executes.
NODE_OUTPUT_FIELD = {
    "fetch_code": "code_content",
    "analyze_project": "tech_stack",
    "detect_vulnerabilities": "raw_findings",
    "deep_audit": "code_content",
    "filter_vulnerabilities": "confirmed_findings",
    "generate_report": "final_report",
}

# Human-readable metadata describing each node, mirrored on the frontend but
# also served here so the topology stays a single source of truth.
NODE_META = {
    "fetch_code":            {"label": "Ingest",   "caption": "load source / PR diff",   "kind": "io"},
    "analyze_project":       {"label": "Profile",  "caption": "fingerprint tech stack",  "kind": "llm"},
    "detect_vulnerabilities":{"label": "Detect",   "caption": "reason + tool-use",       "kind": "agent"},
    "deep_audit":            {"label": "Deep Audit","caption": "expand vulnerable sinks", "kind": "loop"},
    "filter_vulnerabilities":{"label": "Triage",   "caption": "kill false positives",    "kind": "llm"},
    "generate_report":       {"label": "Report",   "caption": "compose + post to PR",     "kind": "output"},
}


class ScanRequest(BaseModel):
    is_github: bool
    repo_path: str
    pr_number: int | None = None
    custom_instructions: str | None = None


def _preview(value, limit: int = 600) -> str:
    """Trim a state value into a short preview for streaming to the UI."""
    if value is None:
        return ""
    text = value if isinstance(value, str) else str(value)
    text = text.strip()
    if len(text) > limit:
        return text[:limit] + " …"
    return text


@app.get("/api/graph")
async def get_graph():
    """
    Return the structured execution graph (nodes + edges with edge types) so the
    frontend can render a live, bespoke topology instead of a static image.
    """
    compiled = build_graph()
    g = compiled.get_graph()

    nodes = []
    for node_id, node in g.nodes.items():
        meta = NODE_META.get(node_id, {})
        nodes.append({
            "id": node_id,
            "label": meta.get("label", node_id),
            "caption": meta.get("caption", ""),
            "kind": meta.get("kind", "process"),
            "output_field": NODE_OUTPUT_FIELD.get(node_id),
        })

    edges = []
    for edge in g.edges:
        edges.append({
            "source": edge.source,
            "target": edge.target,
            "conditional": bool(getattr(edge, "conditional", False)),
        })

    return {"nodes": nodes, "edges": edges}


@app.post("/api/scan")
async def scan_codebase(request: Request, body: ScanRequest):
    graph = build_graph()

    state = {
        "is_github": body.is_github,
        "repo_path": body.repo_path,
        "pr_number": body.pr_number,
        "custom_instructions": body.custom_instructions,
    }

    async def event_generator():
        def sse(event: str, payload: dict):
            return {"event": event, "data": json.dumps(payload)}

        try:
            yield sse("run_start", {
                "target": body.repo_path,
                "is_github": body.is_github,
                "pr_number": body.pr_number,
            })

            # astream_events gives us fine-grained start/end boundaries for every
            # node in the graph, which is exactly what we need to drive a live
            # topology view (node activates -> runs -> commits its state slice).
            async for event in graph.astream_events(state, version="v2"):
                if await request.is_disconnected():
                    break

                kind = event.get("event")
                name = event.get("name")
                meta = event.get("metadata") or {}
                lg_node = meta.get("langgraph_node")

                # Only emit boundaries for the node's own task (name == node id),
                # not the nested runnables (prompts, llms) inside it.
                is_node_boundary = name in GRAPH_NODES and lg_node == name

                if kind == "on_chain_start" and is_node_boundary:
                    yield sse("node_start", {"node": name})

                elif kind == "on_chain_end" and is_node_boundary:
                    output = (event.get("data") or {}).get("output") or {}
                    payload = {"node": name}

                    field = NODE_OUTPUT_FIELD.get(name)
                    if isinstance(output, dict):
                        if field and field in output:
                            payload["field"] = field
                            payload["preview"] = _preview(output[field])
                        if "iteration_count" in output:
                            payload["iteration_count"] = output["iteration_count"]
                        if name == "generate_report" and "final_report" in output:
                            payload["final_report"] = output["final_report"]
                    yield sse("node_end", payload)

                # Surface tool activity inside the detection agent as console logs.
                elif kind == "on_tool_start":
                    tool_in = (event.get("data") or {}).get("input")
                    yield sse("log", {
                        "level": "tool",
                        "text": f"tool:{name}({_preview(tool_in, 160)})",
                    })

            yield sse("run_complete", {"status": "done"})

        except Exception as e:  # noqa: BLE001 - surface any failure to the client
            yield sse("error", {"message": str(e)})

    return EventSourceResponse(event_generator())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
