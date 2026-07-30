import requests

BASE = "http://localhost:8000"

# Login
r = requests.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "ChangeMe123!"})
data = r.json()
print("Login status:", r.status_code)
print("Login data:", data)
token = data.get("access_token")
print("Token len:", len(token) if token else 0)

h = {"Authorization": f"Bearer {token}"}

# /auth/me
r2 = requests.get(f"{BASE}/api/auth/me", headers=h)
print("\n/auth/me status:", r2.status_code)
print("/auth/me body:", r2.json())

# Create user
r3 = requests.post(f"{BASE}/api/admin/users", json={"email": "test@test.com", "username": "testuser"}, headers=h)
print("\nCreate user status:", r3.status_code)
print("Create user body:", r3.json())

# List users
r4 = requests.get(f"{BASE}/api/admin/users", headers=h)
print("\nList users status:", r4.status_code)
print("List users body:", r4.json())

# Price lists
r5 = requests.get(f"{BASE}/api/admin/price-lists", headers=h)
print("\nPrice lists status:", r5.status_code)
print("Price lists body:", r5.json())
