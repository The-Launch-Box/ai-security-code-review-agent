import os
from langchain_core.language_models.chat_models import BaseChatModel

def get_llm(temperature: float = 0.0) -> BaseChatModel:
    """
    Returns an LLM instance based on the LLM_PROVIDER environment variable.
    Defaults to 'ollama'.
    Supports:
    - ollama (requires OLLAMA_MODEL)
    - anthropic (requires ANTHROPIC_API_KEY)
    - openai (requires OPENAI_API_KEY)
    - google (requires GOOGLE_API_KEY)
    """
    provider = os.getenv("LLM_PROVIDER", "ollama").lower()
    
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model="claude-3-5-sonnet-20240620", 
            temperature=temperature
        )
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model="gpt-4o", 
            temperature=temperature
        )
    elif provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model="gemini-1.5-pro", 
            temperature=temperature
        )
    elif provider == "ollama":
        from langchain_ollama import ChatOllama
        ollama_model = os.getenv("OLLAMA_MODEL", "gemma4:e4b")
        return ChatOllama(
            model=ollama_model, 
            temperature=temperature
        )
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")
