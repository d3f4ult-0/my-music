from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.artist import Artist
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    UserProfileResponse,
    UserUpdateRequest,
)
from app.auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.auth.dependencies import get_current_user

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)


def _format_user_profile(user: User) -> UserProfileResponse:
    artist_id = user.artist_profile.id if user.artist_profile else None
    artist_name = user.artist_profile.name if user.artist_profile else None
    return UserProfileResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name or user.username,
        avatar_url=user.avatar_url,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        artist_id=artist_id,
        artist_name=artist_name,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(request: UserRegisterRequest, db: Session = Depends(get_db)):
    # Check if username or email is already taken
    existing_user = db.scalar(
        select(User).where(
            or_(User.username == request.username.strip(), User.email == request.email.lower().strip())
        )
    )
    if existing_user:
        if existing_user.username == request.username.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered",
        )

    # Create new user
    user = User(
        username=request.username.strip(),
        email=request.email.lower().strip(),
        password_hash=hash_password(request.password),
        display_name=request.display_name or request.username.strip(),
        role=request.role,
    )
    db.add(user)
    db.flush()

    # If role is ARTIST, create an Artist profile
    if request.role == UserRole.ARTIST or request.artist_name:
        artist_name = (request.artist_name or user.display_name or user.username).strip()
        # Check if artist name exists or create
        existing_artist = db.scalar(select(Artist).where(Artist.name == artist_name))
        if existing_artist:
            if existing_artist.user_id is None:
                existing_artist.user_id = user.id
                if request.bio:
                    existing_artist.bio = request.bio
            else:
                artist_name = f"{artist_name} ({user.username})"
                new_artist = Artist(user_id=user.id, name=artist_name, bio=request.bio)
                db.add(new_artist)
        else:
            new_artist = Artist(user_id=user.id, name=artist_name, bio=request.bio)
            db.add(new_artist)

    db.commit()
    db.refresh(user)

    token_data = {"sub": str(user.id), "username": user.username, "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=_format_user_profile(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(request: UserLoginRequest, db: Session = Depends(get_db)):
    identity = request.username_or_email.strip()
    user = db.scalar(
        select(User).where(
            or_(User.username == identity, User.email == identity.lower())
        )
    )

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token_data = {"sub": str(user.id), "username": user.username, "role": user.role.value}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=_format_user_profile(user),
    )


@router.post("/refresh", response_model=RefreshTokenResponse)
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    payload = decode_token(request.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    user = db.scalar(select(User).where(User.id == int(user_id)))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    token_data = {"sub": str(user.id), "username": user.username, "role": user.role.value}
    new_access_token = create_access_token(token_data)

    return RefreshTokenResponse(
        access_token=new_access_token,
        token_type="bearer",
    )


@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return _format_user_profile(current_user)


@router.patch("/me", response_model=UserProfileResponse)
def update_current_user_profile(
    update_data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if update_data.display_name is not None:
        current_user.display_name = update_data.display_name
    if update_data.avatar_url is not None:
        current_user.avatar_url = update_data.avatar_url
    if update_data.bio is not None and current_user.artist_profile:
        current_user.artist_profile.bio = update_data.bio

    db.commit()
    db.refresh(current_user)
    return _format_user_profile(current_user)
