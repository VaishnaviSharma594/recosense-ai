from app.core.security import hash_password, verify_password


def test_password_hashing_is_salted_and_verifiable():
    h1, h2 = hash_password("Secret123"), hash_password("Secret123")
    assert h1 != h2 and h1.startswith("$2")
    assert verify_password("Secret123", h1) and not verify_password("wrong", h1)


def test_register_login_me(client):
    r = client.post("/api/auth/register", json={"email": "A@B.io", "password": "Passw0rd!", "full_name": "Ann"})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "a@b.io" and body["user"]["role"] == "customer"
    assert "hashed_password" not in body["user"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["full_name"] == "Ann"


def test_register_validation_and_duplicates(client):
    assert client.post("/api/auth/register", json={"email": "x@y.io", "password": "short", "full_name": "X"}).status_code == 422
    assert client.post("/api/auth/register", json={"email": "x@y.io", "password": "lettersonly", "full_name": "X"}).status_code == 422
    ok = {"email": "x@y.io", "password": "Letters123", "full_name": "X Y"}
    assert client.post("/api/auth/register", json=ok).status_code == 201
    assert client.post("/api/auth/register", json=ok).status_code == 409


def test_login_rejects_bad_credentials(client):
    assert client.post("/api/auth/login", json={"email": "admin@test.io", "password": "nope"}).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_password_reset_flow(client, customer):
    r = client.post("/api/auth/forgot-password", json={"email": "jane@test.io"})
    token = r.json()["dev_reset_link"].split("token=")[1]
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "NewPass123"}).status_code == 200
    # single use
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "Other123"}).status_code == 400
    assert client.post("/api/auth/login", json={"email": "jane@test.io", "password": "NewPass123"}).status_code == 200


def test_role_based_access(client, customer, admin):
    assert client.get("/api/admin/dashboard").status_code == 401
    assert client.get("/api/admin/dashboard", headers=customer).status_code == 403
    assert client.get("/api/admin/dashboard", headers=admin).status_code == 200
    body = {"name": "Hack", "brand": "X", "category_id": 1, "price": 10}
    assert client.post("/api/products", json=body, headers=customer).status_code == 403


def test_product_listing_filters_and_sorting(client):
    r = client.get("/api/products", params={"category": "dresses", "sort": "price_asc"})
    items = r.json()["items"]
    assert r.json()["total"] == 3
    prices = [i["final_price"] for i in items]
    assert prices == sorted(prices)
    assert client.get("/api/products", params={"max_price": 1000}).json()["total"] == 1
    assert client.get("/api/products", params={"q": "linen"}).json()["items"][0]["name"] == "Linen Maxi Dress"
    assert client.get("/api/products", params={"brand": ["Aurelle"]}).json()["total"] == 2
    assert client.get("/api/products", params={"sort": "bogus"}).status_code == 422


def test_product_detail_and_404(client):
    d = client.get("/api/products/1").json()
    assert d["final_price"] == 1999.2 and len(d["variants"]) == 2
    assert client.get("/api/products/999").status_code == 404


def test_admin_product_crud(client, admin):
    body = {"name": "New Tee", "brand": "Kora", "category_id": 2, "price": 799, "discount_percent": 10,
            "variants": [{"size": "S", "color": "Red", "stock": 3}], "image_urls": ["https://example.com/a.jpg"]}
    r = client.post("/api/products", json=body, headers=admin)
    assert r.status_code == 201
    pid = r.json()["id"]
    assert r.json()["stock"] == 3 and r.json()["final_price"] == 719.1
    body["price"] = 999
    assert client.put(f"/api/products/{pid}", json=body, headers=admin).json()["price"] == 999
    assert client.delete(f"/api/products/{pid}", headers=admin).status_code == 200
    assert client.get(f"/api/products/{pid}").status_code == 404


def test_suggestions(client):
    labels = [s["label"] for s in client.get("/api/products/suggest", params={"q": "dress"}).json()]
    assert "Dresses" in labels and "Floral Wrap Dress" in labels
