# 🛡️ AI Security Code Review Agent

A highly capable, multi-agent AI system designed to perform deep, contextual security code reviews on local directories and GitHub Pull Requests. Built using **LangGraph**, **LangChain**, and **Streamlit**.

## ✨ Features

- **Multi-Agent Architecture:** Utilizes specialized agents for project analysis, deep vulnerability hunting, and strict false-positive filtering.
- **Provider Agnostic:** Easily switch between Anthropic (Claude), OpenAI, Google (Gemini), and fully local models via Ollama.
- **Diff-Aware Scanning:** Integrates with GitHub to fetch Pull Request diffs, saving tokens and providing hyper-targeted reviews.
- **Interactive UI:** Includes a beautiful Streamlit web interface for configuring the agent and viewing reports in real-time.
- **Tool-Equipped:** The reasoning agent has access to codebase search and file-reading tools to trace data flows and verify vulnerabilities before reporting them.

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- [Ollama](https://ollama.com/) (Optional, for local models)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/security-agent.git
   cd security-agent
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Setup:**
   Copy the example environment file and configure your API keys (or leave as-is for local Ollama usage).
   ```bash
   cp .env.example .env
   ```

## 💻 Usage

### Streamlit Web UI (Recommended)
Launch the interactive dashboard:
```bash
streamlit run app.py
```
This will open `http://localhost:8501` where you can select your models, input paths, and view the generated Markdown reports.

### Command Line Interface
You can also run the agent directly from your terminal:

**Scan a local directory:**
```bash
python cli.py --local /path/to/your/project
```

**Scan a GitHub Pull Request:**
```bash
python cli.py --github username/repository_name --pr 123
```

## 🛠️ Architecture

The pipeline follows a 5-stage LangGraph workflow:
1. **Input:** Fetches local code context or a GitHub PR diff.
2. **Project Analyzer:** LLM evaluates the code to determine the tech stack and primary security focus areas (e.g., React -> XSS, Django -> Auth).
3. **Detection (Reasoning Agent):** Actively hunts for vulnerabilities using `grep` and file reading tools to trace execution paths.
4. **Validation (Filter Agent):** A strict review step that aggressively filters out false positives, theoretical issues, and low-impact warnings.
5. **Reporting:** Formats the confirmed findings and optionally posts them directly back to the GitHub PR.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.
