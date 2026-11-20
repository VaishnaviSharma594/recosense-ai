CHECKOUT = {"shipping_name": "Jane Doe", "shipping_phone": "+91 98765 43210", "shipping_address": "12 MG Road",
            "shipping_city": "Chandigarh", "shipping_postal_code": "160001"}


def test_wishlist_persistence(client, customer):
    assert client.post("/api/wishlist", json={"product_id": 1}, headers=customer).status_code == 201
    assert client.post("/api/wishlist", json={"product_id": 1}, headers=customer).json()["message"] == "Already in wishlist"
    assert [w["product"]["id"] for w in client.get("/api/wishlist", headers=customer).json()] == [1]
    assert client.delete("/api/wishlist/1", headers=customer).status_code == 200
    assert client.get("/api/wishlist", headers=customer).json() == []
    assert client.delete("/api/wishlist/1", headers=customer).status_code == 404


def test_cart_totals_and_validation(client, customer):
    assert client.post("/api/cart", json={"product_id": 1}, headers=customer).status_code == 422  # size required
    cart = client.post("/api/cart", json={"product_id": 1, "variant_id": 1, "quantity": 2}, headers=customer).json()
    assert cart["subtotal"] == 4998.0 and cart["discount"] == 999.6 and cart["shipping_fee"] == 0
    assert cart["total"] == 3998.4
    item_id = cart["items"][0]["id"]
    cart = client.put(f"/api/cart/{item_id}", json={"quantity": 1}, headers=customer).json()
    assert cart["total"] == 1999.2
    cart = client.post("/api/cart", json={"product_id": 4, "variant_id": 7, "quantity": 1}, headers=customer).json()
    assert cart["item_count"] == 2
    cart = client.delete(f"/api/cart/{item_id}", headers=customer).json()
    assert cart["total"] == 599 + 99  # below free-shipping threshold


def test_unavailable_items_block_checkout(client, customer, admin):
    client.post("/api/cart", json={"product_id": 2, "variant_id": 3, "quantity": 5}, headers=customer)
    assert not client.get("/api/cart", headers=customer).json()["has_unavailable"]
    # admin deactivates the product after it was added to the cart
    body = {"name": "Linen Maxi Dress", "brand": "Linen Society", "category_id": 1, "price": 3299, "is_active": False,
            "variants": [{"size": "M", "color": "Sand", "stock": 6}]}
    assert client.put("/api/products/2", json=body, headers=admin).status_code == 200
    cart = client.get("/api/cart", headers=customer).json()
    assert cart["has_unavailable"] and cart["items"][0]["issue"] == "This product is no longer available"
    assert cart["total"] == 0
    assert client.post("/api/orders", json=CHECKOUT, headers=customer).status_code == 409


def test_checkout_creates_order_and_decrements_stock(client, customer):
    client.post("/api/cart", json={"product_id": 3, "variant_id": 5, "quantity": 2}, headers=customer)
    r = client.post("/api/orders", json=CHECKOUT, headers=customer)
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["status"] == "confirmed" and order["items"][0]["quantity"] == 2
    assert client.get("/api/cart", headers=customer).json()["items"] == []
    variants = client.get("/api/products/3").json()["variants"]
    assert variants[0]["stock"] == 4
    assert len(client.get("/api/orders", headers=customer).json()) == 1
    assert client.get(f"/api/orders/{order['id']}", headers=customer).status_code == 200
    cancelled = client.post(f"/api/orders/{order['id']}/cancel", headers=customer).json()
    assert cancelled["status"] == "cancelled"
    assert client.get("/api/products/3").json()["variants"][0]["stock"] == 6


def test_checkout_validation(client, customer):
    assert client.post("/api/orders", json=CHECKOUT, headers=customer).status_code == 400  # empty cart
    bad = {**CHECKOUT, "shipping_phone": "abc"}
    assert client.post("/api/orders", json=bad, headers=customer).status_code == 422


def test_orders_are_private(client, customer):
    client.post("/api/cart", json={"product_id": 3, "variant_id": 5}, headers=customer)
    oid = client.post("/api/orders", json=CHECKOUT, headers=customer).json()["id"]
    r = client.post("/api/auth/register", json={"email": "bob@test.io", "password": "Secret123", "full_name": "Bob"})
    bob = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get(f"/api/orders/{oid}", headers=bob).status_code == 404


def test_preferences(client, customer):
    r = client.put("/api/auth/preferences", json={"preferred_categories": ["dresses"], "min_price": 500,
                                                  "max_price": 3000}, headers=customer)
    assert r.status_code == 200 and r.json()["onboarding_completed"]
    bad = client.put("/api/auth/preferences", json={"min_price": 5000, "max_price": 100}, headers=customer)
    assert bad.status_code == 422
