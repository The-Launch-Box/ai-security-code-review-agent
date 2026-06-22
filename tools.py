import os
import re
from langchain.tools import tool

@tool
def search_codebase(pattern: str, file_type: str = ".py", path: str = ".") -> str:
    """
    Grep through the entire codebase for specific patterns.
    Args:
        pattern (str): The regex pattern to search for.
        file_type (str): The file extension to include (e.g. '.py'). Defaults to '.py'.
        path (str): The directory path to search in. Defaults to current directory.
    Returns:
        str: The output showing matching lines and files.
    """
    results = []
    try:
        regex = re.compile(pattern)
    except re.error as e:
        return f"Invalid regex pattern: {e}"

    for root, _, files in os.walk(path):
        # Skip common ignored directories
        if any(ignored in root for ignored in ['.git', 'node_modules', 'venv', '__pycache__']):
            continue
            
        for file in files:
            if not file.endswith(file_type) and file_type != "*":
                continue
                
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f):
                        if regex.search(line):
                            # Provide context: filepath:line_number: content
                            results.append(f"{filepath}:{i+1}: {line.strip()}")
            except (UnicodeDecodeError, IOError):
                continue
                
    if not results:
        return f"No matches found for pattern: {pattern}"
        
    # Cap results to avoid overwhelming the LLM
    if len(results) > 100:
        return "\n".join(results[:100]) + f"\n... and {len(results)-100} more matches."
    return "\n".join(results)

@tool
def read_file(filepath: str) -> str:
    """
    Read the contents of a specific file in the project.
    Args:
        filepath (str): The path to the file to read.
    Returns:
        str: The contents of the file, or an error message if the file doesn't exist.
    """
    try:
        if not os.path.exists(filepath):
            return f"Error: File not found at {filepath}"
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"
