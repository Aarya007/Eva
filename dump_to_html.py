import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Load backend environment variables to get the service_role key (bypasses security rules)
sys.path.insert(0, str(Path(__file__).resolve().parent))
load_dotenv("app/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Accept": "application/json",
}

print("Fetching data from eva_user_state...")
r1 = httpx.get(f"{SUPABASE_URL}/rest/v1/eva_user_state?select=user_id,state,updated_at&order=updated_at.desc", headers=headers)
state_data = r1.json() if r1.status_code == 200 else [{"error": r1.text}]

print("Fetching data from eva_onboarding...")
r2 = httpx.get(f"{SUPABASE_URL}/rest/v1/eva_onboarding?select=user_id,goal,age,gender,onboarding_complete,created_at&order=created_at.desc", headers=headers)
onboarding_data = r2.json() if r2.status_code == 200 else [{"error": r2.text}]

print("Fetching data from diet_plans...")
r3 = httpx.get(f"{SUPABASE_URL}/rest/v1/diet_plans?select=user_id,plan,created_at&order=created_at.desc", headers=headers)
diet_data = r3.json() if r3.status_code == 200 else [{"error": r3.text}]

print("Fetching data from workout_plans...")
r4 = httpx.get(f"{SUPABASE_URL}/rest/v1/workout_plans?select=user_id,plan,created_at&order=created_at.desc", headers=headers)
workout_data = r4.json() if r4.status_code == 200 else [{"error": r4.text}]

# Generate basic HTML page to show the data
html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Supabase Data Viewer</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; padding: 2rem; background: #f4f4f5; }}
        h1 {{ color: #18181b; }}
        h2 {{ color: #3f3f46; margin-top: 2rem; border-bottom: 2px solid #e4e4e7; padding-bottom: 0.5rem; }}
        table {{ width: 100%; border-collapse: collapse; background: white; margin-bottom: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); table-layout: fixed; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e4e4e7; vertical-align: top; word-wrap: break-word; }}
        th {{ background: #fafafa; font-weight: 600; color: #52525b; }}
        pre {{ margin: 0; font-size: 0.85em; max-height: 250px; overflow-y: auto; background: #f8f9fa; padding: 8px; border-radius: 4px; border: 1px solid #eee; white-space: pre-wrap; word-wrap: break-word; }}
        .col-id {{ width: 20%; }}
        .col-date {{ width: 20%; }}
        .col-json {{ width: 60%; }}
    </style>
</head>
<body>
    <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1>📋 Eva Database Viewer (All Tables)</h1>
        <button onclick="downloadData()" style="padding: 10px 16px; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">⬇️ Download Data as JSON</button>
    </div>
    
    <h2>Table: eva_onboarding</h2>
    <table>
        <tr>
            <th>User ID</th>
            <th>Goal</th>
            <th>Age</th>
            <th>Gender</th>
            <th>Completed?</th>
            <th>Created At</th>
        </tr>
"""

for row in onboarding_data:
    if "error" in row:
        html_content += f"<tr><td colspan='6' style='color:red;'>Error: {row['error']}</td></tr>"
    else:
        html_content += f"<tr><td>{row.get('user_id')}</td><td>{row.get('goal')}</td><td>{row.get('age')}</td><td>{row.get('gender')}</td><td>{'✅ Yes' if row.get('onboarding_complete') else '❌ No'}</td><td>{row.get('created_at')}</td></tr>"

html_content += """
    </table>

    <h2>Table: eva_user_state (Full JSON)</h2>
    <table>
        <tr>
            <th class="col-id">User ID</th>
            <th class="col-date">Updated At</th>
            <th class="col-json">State (JSON)</th>
        </tr>
"""

import json
for row in state_data:
    if "error" in row:
        html_content += f"<tr><td colspan='3' style='color:red;'>Error: {row['error']}</td></tr>"
    else:
        state_str = json.dumps(row.get('state', {}), indent=2)
        html_content += f"<tr><td>{row.get('user_id')}</td><td>{row.get('updated_at')}</td><td><pre>{state_str}</pre></td></tr>"

html_content += """
    </table>
    
    <h2>Table: diet_plans</h2>
    <table>
        <tr>
            <th class="col-id">User ID</th>
            <th class="col-date">Created At</th>
            <th class="col-json">Diet Plan (JSON)</th>
        </tr>
"""

for row in diet_data:
    if "error" in row:
        html_content += f"<tr><td colspan='3' style='color:red;'>Error: {row['error']}</td></tr>"
    else:
        plan_str = json.dumps(row.get('plan', {}), indent=2)
        html_content += f"<tr><td>{row.get('user_id')}</td><td>{row.get('created_at')}</td><td><pre>{plan_str}</pre></td></tr>"

html_content += """
    </table>
    
    <h2>Table: workout_plans</h2>
    <table>
        <tr>
            <th class="col-id">User ID</th>
            <th class="col-date">Created At</th>
            <th class="col-json">Workout Plan (JSON)</th>
        </tr>
"""

for row in workout_data:
    if "error" in row:
        html_content += f"<tr><td colspan='3' style='color:red;'>Error: {row['error']}</td></tr>"
    else:
        plan_str = json.dumps(row.get('plan', {}), indent=2)
        html_content += f"<tr><td>{row.get('user_id')}</td><td>{row.get('created_at')}</td><td><pre>{plan_str}</pre></td></tr>"

html_content += f"""
    </table>
    
    <script>
        // Store the raw data for downloading
        const rawData = {{
            "eva_onboarding": {json.dumps(onboarding_data)},
            "eva_user_state": {json.dumps(state_data)},
            "diet_plans": {json.dumps(diet_data)},
            "workout_plans": {json.dumps(workout_data)}
        }};

        function downloadData() {{
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rawData, null, 2));
            const dlAnchorElem = document.getElementById('downloadAnchorElem');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", "eva_database_dump.json");
            dlAnchorElem.click();
        }}
    </script>
    <a id="downloadAnchorElem" style="display:none"></a>
</body>
</html>
"""

html_path = Path(__file__).parent / "db_viewer.html"
with open(html_path, "w") as f:
    f.write(html_content)

print(f"\\n✅ Done! HTML file created at: {html_path.absolute()}")
print("You can double-click this file in your file explorer to open it in a browser.")
