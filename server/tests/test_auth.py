from app.models.user import User, UserRole
from app.auth.security import verify_password


def test_health_endpoints(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    res_ready = client.get("/ready")
    assert res_ready.status_code == 200
    assert res_ready.json()["status"] == "ready"


def test_register_user_success(client, db_session):
    payload = {
        "username": "alex",
        "email": "alex@example.com",
        "password": "SuperSecretPassword123!",
        "display_name": "Alex Rivers",
        "role": "USER",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "alex"
    assert data["user"]["email"] == "alex@example.com"
    assert data["user"]["role"] == "USER"
    assert data["user"]["artist_id"] is None

    # Check password is encrypted with Argon2id in DB
    user = db_session.query(User).filter_by(username="alex").first()
    assert user is not None
    assert user.password_hash.startswith("$argon2id$")
    assert verify_password("SuperSecretPassword123!", user.password_hash)


def test_register_duplicate_username_fails(client):
    payload = {
        "username": "uniqueuser",
        "email": "first@example.com",
        "password": "Password123!",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Second registration with same username
    payload2 = {
        "username": "uniqueuser",
        "email": "second@example.com",
        "password": "Password123!",
    }
    res2 = client.post("/api/v1/auth/register", json=payload2)
    assert res2.status_code == 400
    assert "Username is already taken" in res2.json()["detail"]


def test_register_duplicate_email_fails(client):
    payload = {
        "username": "userone",
        "email": "shared@example.com",
        "password": "Password123!",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    payload2 = {
        "username": "usertwo",
        "email": "shared@example.com",
        "password": "Password123!",
    }
    res2 = client.post("/api/v1/auth/register", json=payload2)
    assert res2.status_code == 400
    assert "Email address is already registered" in res2.json()["detail"]


def test_register_artist_creates_profile(client):
    payload = {
        "username": "dj_aurora",
        "email": "aurora@soundscape.io",
        "password": "ArtistPassword123!",
        "role": "ARTIST",
        "artist_name": "Aurora Sound",
        "bio": "Ambient sound producer and electronic composer.",
    }
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["user"]["role"] == "ARTIST"
    assert data["user"]["artist_id"] is not None
    assert data["user"]["artist_name"] == "Aurora Sound"


def test_login_flow(client):
    register_payload = {
        "username": "login_user",
        "email": "login@example.com",
        "password": "ValidPassword999!",
    }
    client.post("/api/v1/auth/register", json=register_payload)

    # Login with username
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "login_user", "password": "ValidPassword999!"},
    )
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    token = data["access_token"]

    # Login with email
    login_res_email = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "login@example.com", "password": "ValidPassword999!"},
    )
    assert login_res_email.status_code == 200

    # Login with invalid password
    bad_res = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "login_user", "password": "WrongPassword!"},
    )
    assert bad_res.status_code == 401

    # Protected me endpoint
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "login_user"


def test_refresh_token(client):
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "refresh_guy",
            "email": "refresh@test.com",
            "password": "Password123!",
        },
    )
    refresh_token = reg.json()["refresh_token"]

    refresh_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_res.status_code == 200
    new_token = refresh_res.json()["access_token"]
    assert new_token is not None

    # Test me with new access token
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "refresh_guy"
