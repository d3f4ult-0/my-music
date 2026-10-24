from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.report import Report, ReportStatus, ReportReason
from app.models.song import Song
from app.models.user import User, UserRole
from app.schemas.music import ReportCreateRequest, ReportResponse
from app.auth.dependencies import get_current_user, get_current_admin

router = APIRouter(
    prefix="/api/v1/reports",
    tags=["Reports & Moderation"],
)


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    request: ReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    song = db.scalar(select(Song).where(Song.id == request.song_id))
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    report = Report(
        reporter_id=current_user.id,
        song_id=request.song_id,
        reason=request.reason.value,
        description=request.description,
        status=ReportStatus.PENDING,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return ReportResponse(
        id=report.id,
        song_id=song.id,
        song_title=song.title,
        reporter_id=current_user.id,
        reporter_username=current_user.username,
        reason=report.reason,
        description=report.description,
        status=report.status,
        created_at=report.created_at,
        resolved_at=report.resolved_at,
    )


@router.get("", response_model=List[ReportResponse])
def get_reports(
    status_filter: Optional[ReportStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = (
        select(Report)
        .options(selectinload(Report.song), selectinload(Report.reporter))
        .order_by(Report.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        query = query.where(Report.status == status_filter)

    reports = db.scalars(query).all()
    return [
        ReportResponse(
            id=r.id,
            song_id=r.song_id,
            song_title=r.song.title if r.song else "Deleted Track",
            reporter_id=r.reporter_id,
            reporter_username=r.reporter.username if r.reporter else "Unknown",
            reason=r.reason,
            description=r.description,
            status=r.status,
            created_at=r.created_at,
            resolved_at=r.resolved_at,
        )
        for r in reports
    ]


@router.patch("/{report_id}/resolve", response_model=ReportResponse)
def resolve_report(
    report_id: int,
    action: str = Query(..., pattern="^(resolve|dismiss)$"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    report = db.scalar(
        select(Report)
        .options(selectinload(Report.song), selectinload(Report.reporter))
        .where(Report.id == report_id)
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = ReportStatus.RESOLVED if action == "resolve" else ReportStatus.DISMISSED
    report.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)

    return ReportResponse(
        id=report.id,
        song_id=report.song_id,
        song_title=report.song.title if report.song else "Deleted Track",
        reporter_id=report.reporter_id,
        reporter_username=report.reporter.username if report.reporter else "Unknown",
        reason=report.reason,
        description=report.description,
        status=report.status,
        created_at=report.created_at,
        resolved_at=report.resolved_at,
    )
