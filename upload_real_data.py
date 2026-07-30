#!/usr/bin/env python3
"""Upload all 7 real Yitzhak Levy CSVs to Smart Pricing backend."""
import requests
import json
import os
import glob

os.chdir(os.path.dirname(os.path.abspath(__file__)))
BASE = "http://localhost:8000"

# Login as admin
r = requests.post(BASE + "/api/auth/login", json={"username": "admin", "password": "ChangeMe123!"})
token = r.json()["access_token"]
auth = {"Authorization": "Bearer " + token}

# Delete old test data
print("=== Cleaning old data ===")
lists = requests.get(BASE + "/api/admin/price-lists", headers=auth).json()
for pl in lists:
    r = requests.delete(BASE + f"/api/admin/price-lists/{pl['id']}", headers=auth)
    print(f"  Deleted: {pl['label']} ({r.status_code})")

# Delete old groups
groups = requests.get(BASE + "/api/user/groups", headers=auth).json()
for g in groups:
    r = requests.delete(BASE + f"/api/user/groups/{g['id']}", headers=auth)
    print(f"  Deleted group: {g['name']} ({r.status_code})")

# Upload all CSVs from the real price list folder
CSV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "מחירון 2026")
month_map = {
    "ינואר": ("ינואר", 2026),
    "פברואר": ("פברואר", 2026),
    "מרץ": ("מרץ", 2026),
    "אפריל": ("אפריל", 2026),
    "מאי": ("מאי", 2026),
    "יוני": ("יוני", 2026),
    "יולי": ("יולי", 2026),
}

csv_files = sorted(glob.glob(os.path.join(CSV_DIR, "*.csv")))
print(f"\n=== Found {len(csv_files)} CSV files ===")

for csv_file in csv_files:
    filename = os.path.basename(csv_file)
    name = filename.replace(".csv", "").replace("מחירון ", "")
    
    if name not in month_map:
        print(f"  Skipping {filename} - unknown month")
        continue
    
    month_name, year = month_map[name]
    print(f"\n  Uploading {filename}...")
    
    with open(csv_file, "rb") as f:
        r = requests.post(
            BASE + "/api/admin/upload-csv",
            headers=auth,
            files={"file": (filename, f, "text/csv")},
            data={"month": month_name, "year": year}
        )
        if r.status_code == 200:
            data = r.json()
            print(f"    OK: {data['entries_count']} entries")
        else:
            print(f"    ERROR: {r.status_code} - {r.text}")

# Verify
print("\n=== Final Price Lists ===")
lists = requests.get(BASE + "/api/admin/price-lists", headers=auth).json()
for pl in lists:
    print(f"  {pl['label']}: {pl['entries_count']} entries")

print("\n=== DONE ===")
