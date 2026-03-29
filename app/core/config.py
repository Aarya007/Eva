import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root or app/api/
base = Path(__file__).resolve().parent.parent
load_dotenv(base.parent / ".env")  # Eva/.env
load_dotenv(base / "api" / ".env")  # app/api/.env

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY_1")