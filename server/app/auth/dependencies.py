from typing import Optional
import uuid
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.auth.security import decode_token

security_scheme = HTTPBearer(auto_error=False)


def get_or_create_local_peer(db: Session) -> User:
    """Ensures a default local device user exists for zero-registration operation."""
    user = db.scalar(select(User).order_by(User.id.asc()))
    if not user:
        user = User(
            username="local_peer",
            email="peer@local.mymusic",
            password_hash="peer_local_auth",
            display_name="Local Library",
            peer_id=str(uuid.uuid4())[:8],
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Returns authenticated user if token provided, or defaults to local peer with zero login friction."""
    if credentials:
        payload = decode_token(credentials.credentials)
        if payload and payload.get("type") == "access":
            user_id = payload.get("sub")
            if user_id:
                user = db.scalar(select(User).where(User.id == int(user_id)))
                if user and user.is_active:
                    return user

    return get_or_create_local_peer(db)


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    return get_current_user(credentials, db)


def require_role(*allowed_roles: UserRole):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        return current_user
    return role_checker


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    return current_user


def get_current_artist(current_user: User = Depends(get_current_user)) -> User:
    return current_user
