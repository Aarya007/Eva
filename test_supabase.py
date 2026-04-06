import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))

load_dotenv("app/.env")

from app.services.supabase_store import is_persistence_enabled, upsert_nested_state, upsert_onboarding_snapshot, SUPABASE_URL

print(f"URL loaded: {SUPABASE_URL}")
print(f"Persistence enabled: {is_persistence_enabled()}")

test_user = "test-user-id-123"
print("\nTesting eva_user_state upsert...")
try:
    upsert_nested_state(test_user, {"basic_info": {"goal": "test"}})
    print("✅ eva_user_state SUCCESS")
except Exception as e:
    print(f"❌ eva_user_state FAILED: {repr(e)}")
    if hasattr(e, 'response_text'):
        print(f"Response: {e.response_text}")

print("\nTesting eva_onboarding upsert...")
try:
    upsert_onboarding_snapshot(test_user, {"goal": "test", "onboarding_complete": True})
    print("✅ eva_onboarding SUCCESS")
except Exception as e:
    print(f"❌ eva_onboarding FAILED: {repr(e)}")
    if hasattr(e, 'response_text'):
        print(f"Response: {e.response_text}")
