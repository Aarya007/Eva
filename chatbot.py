#!/usr/bin/env python3
"""Simple chatbot using Gemini API. Reads GEMINI_API_KEY_1 from .env"""
from pathlib import Path
from dotenv import load_dotenv
import os

# Load .env from app/api/
load_dotenv(Path(__file__).resolve().parent / "app" / "api" / ".env")
api_key = os.getenv("GEMINI_API_KEY_1")

if not api_key:
    print("Error: GEMINI_API_KEY_1 not found in app/api/.env")
    exit(1)

from google import genai

client = genai.Client(api_key=api_key)
print("Chatbot ready. Type your question (or 'quit' to exit).\n")

while True:
    try:
        question = input("You: ").strip()
        if not question:
            continue
        if question.lower() in ("quit", "exit", "q"):
            print("Bye!")
            break

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=question,
            config={"temperature": 0.7},
        )
        answer = response.text or "(No response)"
        print(f"\nGemini: {answer}\n")
    except KeyboardInterrupt:
        print("\nBye!")
        break
    except Exception as e:
        print(f"\nError: {e}\n")
