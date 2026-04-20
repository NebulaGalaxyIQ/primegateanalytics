from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4
from urllib.parse import quote

from fastapi import HTTPException, UploadFile, status
from jinja2 import BaseLoader, Environment, select_autoescape
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.byproducts import (
    ByproductReportTemplate,
    ByproductTemplateFormat,
    ByproductTemplateType,
)
from app.schemas.byproducts import (
    ByproductGenerateReportDocumentRequest,
    ByproductGeneratedDocumentResponse,
    ByproductReportTemplateCreate,
    ByproductReportTemplateFilter,
    ByproductReportTemplateListResponse,
    ByproductReportTemplateRead,
    ByproductReportTemplateUpdate,
    MessageResponse,
)
from app.services.byproducts_report_service import build_template_context

try:
    from docxtpl import DocxTemplate
except Exception:  # pragma: no cover
    DocxTemplate = None

try:
    from weasyprint import HTML
except Exception:  # pragma: no cover
    HTML = None

try:
    from docx2pdf import convert as docx2pdf_convert
except Exception:  # pragma: no cover
    docx2pdf_convert = None

try:
    import pythoncom
    import win32com.client as win32_client
except Exception:  # pragma: no cover
    pythoncom = None
    win32_client = None


BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_TEMPLATE_ROOT = BASE_DIR / "storage" / "byproducts" / "templates"
DEFAULT_OUTPUT_ROOT = BASE_DIR / "storage" / "byproducts" / "generated"

# This matches the router download endpoint you should expose.
GENERATED_DOWNLOAD_ROUTE = "/byproducts/generated/download"

PLACEHOLDER_PATTERN = re.compile(r"{{\s*([a-zA-Z0-9_.\-\[\]]+)\s*}}")
WORD_PDF_FILE_FORMAT = 17


# =============================================================================
# BASIC HELPERS
# =============================================================================


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _http_404(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _http_400(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _http_409(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _normalize_upper(value: str | None) -> str | None:
    value = _normalize_text(value)
    return value.upper() if value else None


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "file"


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _coerce_path(value: str | Path | None) -> Path:
    if isinstance(value, Path):
        return value
    raw = str(value or "").strip()
    return Path(raw.replace("\\", "/"))


def _resolve_disk_path(value: str | Path | None, *, base_dir: Path = BASE_DIR) -> Path:
    path = _coerce_path(value)
    if path.is_absolute():
        return path.resolve()
    return (base_dir / path).resolve()


def _to_storage_path_string(value: str | Path, *, base_dir: Path = BASE_DIR) -> str:
    path = _resolve_disk_path(value, base_dir=base_dir)
    try:
        return path.relative_to(base_dir.resolve()).as_posix()
    except ValueError:
        return str(path)


def _delete_file_safely(path: str | Path | None) -> None:
    if not path:
        return
    try:
        resolved = _resolve_disk_path(path)
        if resolved.exists():
            resolved.unlink()
    except Exception:
        pass


def _detect_mime_type_by_extension(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if ext == ".html":
        return "text/html"
    if ext == ".pdf":
        return "application/pdf"
    return "application/octet-stream"


def _safe_output_name(base_name: str, suffix: str) -> str:
    stamp = _utcnow().strftime("%Y%m%d-%H%M%S")
    return f"{_slugify(base_name)}-{stamp}.{suffix}"


def _template_storage_dir(
    template_type: ByproductTemplateType,
    root: Path | None = None,
) -> Path:
    root_path = _resolve_disk_path(root) if root else DEFAULT_TEMPLATE_ROOT
    return _ensure_dir(root_path / template_type.value)


def _output_storage_dir(root: Path | None = None) -> Path:
    root_path = _resolve_disk_path(root) if root else DEFAULT_OUTPUT_ROOT
    return _ensure_dir(root_path)


def _read_text_file(path: Path) -> str:
    encodings = ("utf-8", "utf-8-sig", "latin-1")
    for encoding in encodings:
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="ignore")


def _extract_placeholders_from_text(text: str) -> list[str]:
    matches = PLACEHOLDER_PATTERN.findall(text or "")
    return sorted(set(m.strip() for m in matches if m and m.strip()))


def _extract_placeholders_from_docx(path: Path) -> list[str]:
    if not path.exists():
        return []

    placeholders: set[str] = set()

    try:
        with zipfile.ZipFile(path, "r") as archive:
            for name in archive.namelist():
                if not name.startswith("word/") or not name.endswith(".xml"):
                    continue
                try:
                    xml_text = archive.read(name).decode("utf-8", errors="ignore")
                except Exception:
                    continue

                for match in PLACEHOLDER_PATTERN.findall(xml_text):
                    placeholder = match.strip()
                    if placeholder:
                        placeholders.add(placeholder)
    except zipfile.BadZipFile:
        return []

    return sorted(placeholders)


def _extract_placeholders(
    file_path: str | Path,
    template_format: ByproductTemplateFormat,
) -> list[str]:
    path = _resolve_disk_path(file_path)
    if not path.exists():
        return []

    if template_format == ByproductTemplateFormat.DOCX:
        return _extract_placeholders_from_docx(path)

    if template_format == ByproductTemplateFormat.HTML:
        return _extract_placeholders_from_text(_read_text_file(path))

    return []


def _build_placeholder_meta(
    file_path: str | Path,
    template_format: ByproductTemplateFormat,
) -> dict[str, Any]:
    return {"placeholders": _extract_placeholders(file_path, template_format)}


def _serialize_template(obj: ByproductReportTemplate) -> ByproductReportTemplateRead:
    return ByproductReportTemplateRead.model_validate(obj)


def _template_exists_by_code(
    db: Session,
    template_code: str,
    *,
    exclude_id: UUID | None = None,
) -> bool:
    q = db.query(ByproductReportTemplate).filter(
        ByproductReportTemplate.template_code == template_code
    )
    if exclude_id:
        q = q.filter(ByproductReportTemplate.id != exclude_id)
    return q.first() is not None


def _template_exists_by_path(
    db: Session,
    file_path: str | Path,
    *,
    exclude_id: UUID | None = None,
) -> bool:
    target_path = _resolve_disk_path(file_path)

    q = db.query(ByproductReportTemplate)
    if exclude_id:
        q = q.filter(ByproductReportTemplate.id != exclude_id)

    for row in q.all():
        try:
            if _resolve_disk_path(row.file_path) == target_path:
                return True
        except Exception:
            if row.file_path == _to_storage_path_string(target_path):
                return True

    return False


def _get_template_or_404(
    db: Session,
    template_id: UUID,
    *,
    include_deleted: bool = False,
) -> ByproductReportTemplate:
    q = db.query(ByproductReportTemplate).filter(
        ByproductReportTemplate.id == template_id
    )
    if not include_deleted:
        q = q.filter(ByproductReportTemplate.is_deleted.is_(False))

    obj = q.first()
    if not obj:
        raise _http_404("Byproduct report template not found")
    return obj


def _get_template_by_code(
    db: Session,
    template_code: str,
    *,
    include_deleted: bool = False,
) -> ByproductReportTemplate | None:
    q = db.query(ByproductReportTemplate).filter(
        ByproductReportTemplate.template_code == _normalize_upper(template_code)
    )
    if not include_deleted:
        q = q.filter(ByproductReportTemplate.is_deleted.is_(False))
    return q.first()


def _apply_create_audit(obj, actor_id: UUID | None) -> None:
    obj.created_by_id = actor_id
    obj.updated_by_id = actor_id


def _apply_update_audit(obj, actor_id: UUID | None) -> None:
    obj.updated_by_id = actor_id


def _apply_soft_delete(obj, actor_id: UUID | None) -> None:
    obj.is_active = False
    obj.is_deleted = True
    obj.deleted_at = _utcnow()
    obj.deleted_by_id = actor_id
    obj.updated_by_id = actor_id


def _apply_restore(obj, actor_id: UUID | None) -> None:
    obj.is_deleted = False
    obj.deleted_at = None
    obj.deleted_by_id = None
    obj.updated_by_id = actor_id


def _set_default_for_type(
    db: Session,
    target: ByproductReportTemplate,
    *,
    actor_id: UUID | None = None,
) -> None:
    (
        db.query(ByproductReportTemplate)
        .filter(
            ByproductReportTemplate.template_type == target.template_type,
            ByproductReportTemplate.id != target.id,
            ByproductReportTemplate.is_deleted.is_(False),
            ByproductReportTemplate.is_default.is_(True),
        )
        .update(
            {
                ByproductReportTemplate.is_default: False,
                ByproductReportTemplate.updated_by_id: actor_id,
            },
            synchronize_session=False,
        )
    )
    target.is_default = True
    target.updated_by_id = actor_id


def _ensure_existing_file_or_400(file_path: str | Path, *, label: str) -> Path:
    resolved = _resolve_disk_path(file_path)
    if not resolved.exists():
        raise _http_400(f"{label} does not exist on disk: {resolved}")
    return resolved


def _build_generated_download_url(file_name: str) -> str:
    return f"{GENERATED_DOWNLOAD_ROUTE}?file_name={quote(file_name)}"


def _build_generated_response(path: Path) -> ByproductGeneratedDocumentResponse:
    resolved = path.resolve()
    return ByproductGeneratedDocumentResponse(
        file_name=resolved.name,
        file_path=_to_storage_path_string(resolved),
        download_url=_build_generated_download_url(resolved.name),
        mime_type=_detect_mime_type_by_extension(resolved),
        size_bytes=resolved.stat().st_size if resolved.exists() else None,
    )


# =============================================================================
# FILE STORAGE HELPERS
# =============================================================================


def save_uploaded_template_file(
    upload: UploadFile,
    *,
    template_type: ByproductTemplateType,
    template_format: ByproductTemplateFormat,
    storage_root: Path | None = None,
) -> dict[str, Any]:
    if upload is None or not upload.filename:
        raise _http_400("A template file is required")

    extension = Path(upload.filename).suffix.lower()
    expected_extension = f".{template_format.value}"

    if extension != expected_extension:
        raise _http_400(
            f"Uploaded file extension '{extension}' does not match template_format '{template_format.value}'"
        )

    target_dir = _template_storage_dir(template_type, storage_root)
    stored_name = f"{uuid4().hex}-{_slugify(Path(upload.filename).stem)}{extension}"
    stored_path = target_dir / stored_name

    try:
        if hasattr(upload.file, "seek"):
            upload.file.seek(0)
    except Exception:
        pass

    with stored_path.open("wb") as output_stream:
        shutil.copyfileobj(upload.file, output_stream)

    return {
        "file_name": upload.filename,
        "file_path": _to_storage_path_string(stored_path),
        "mime_type": upload.content_type or _detect_mime_type_by_extension(stored_path),
        "file_size_bytes": stored_path.stat().st_size,
        "placeholders_meta": _build_placeholder_meta(stored_path, template_format),
    }


# =============================================================================
# CRUD SERVICES
# =============================================================================


def create_template(
    db: Session,
    payload: ByproductReportTemplateCreate,
    *,
    actor_id: UUID | None = None,
) -> ByproductReportTemplateRead:
    template_code = _normalize_upper(payload.template_code)
    if not template_code:
        raise _http_400("template_code is required")

    if _template_exists_by_code(db, template_code):
        raise _http_409("A byproducts template with this template code already exists")

    file_path = _normalize_text(payload.file_path)
    if not file_path:
        raise _http_400("file_path is required")

    resolved_path = _ensure_existing_file_or_400(file_path, label="Template file_path")
    normalized_file_path = _to_storage_path_string(resolved_path)

    if _template_exists_by_path(db, normalized_file_path):
        raise _http_409("A byproducts template with this file path already exists")

    placeholders_meta = (
        payload.placeholders_meta.model_dump()
        if payload.placeholders_meta is not None
        else _build_placeholder_meta(resolved_path, payload.template_format)
    )

    obj = ByproductReportTemplate(
        name=payload.name,
        template_code=template_code,
        template_type=payload.template_type,
        template_format=payload.template_format,
        file_name=payload.file_name,
        file_path=normalized_file_path,
        mime_type=payload.mime_type or _detect_mime_type_by_extension(resolved_path),
        file_size_bytes=payload.file_size_bytes or resolved_path.stat().st_size,
        is_default=payload.is_default,
        placeholders_meta=placeholders_meta,
        notes=payload.notes,
        is_active=payload.is_active,
        is_deleted=False,
    )
    _apply_create_audit(obj, actor_id)

    db.add(obj)
    db.flush()

    if payload.is_default:
        _set_default_for_type(db, obj, actor_id=actor_id)

    db.commit()
    db.refresh(obj)
    return _serialize_template(obj)


def create_template_from_upload(
    db: Session,
    *,
    upload: UploadFile,
    name: str,
    template_code: str,
    template_type: ByproductTemplateType,
    template_format: ByproductTemplateFormat,
    is_default: bool = False,
    notes: str | None = None,
    is_active: bool = True,
    storage_root: Path | None = None,
    actor_id: UUID | None = None,
) -> ByproductReportTemplateRead:
    saved = save_uploaded_template_file(
        upload,
        template_type=template_type,
        template_format=template_format,
        storage_root=storage_root,
    )

    payload = ByproductReportTemplateCreate(
        name=name,
        template_code=template_code,
        template_type=template_type,
        template_format=template_format,
        file_name=saved["file_name"],
        file_path=saved["file_path"],
        mime_type=saved["mime_type"],
        file_size_bytes=saved["file_size_bytes"],
        is_default=is_default,
        placeholders_meta=saved["placeholders_meta"],
        notes=notes,
        is_active=is_active,
    )

    try:
        return create_template(db, payload, actor_id=actor_id)
    except Exception:
        _delete_file_safely(saved["file_path"])
        raise


def get_template(db: Session, template_id: UUID) -> ByproductReportTemplateRead:
    return _serialize_template(_get_template_or_404(db, template_id))


def list_templates(
    db: Session,
    filters: ByproductReportTemplateFilter | None = None,
    *,
    skip: int = 0,
    limit: int = 100,
) -> ByproductReportTemplateListResponse:
    filters = filters or ByproductReportTemplateFilter()
    q = db.query(ByproductReportTemplate)

    if not filters.include_deleted:
        q = q.filter(ByproductReportTemplate.is_deleted.is_(False))

    if filters.search:
        term = f"%{filters.search}%"
        q = q.filter(
            or_(
                ByproductReportTemplate.name.ilike(term),
                ByproductReportTemplate.template_code.ilike(term),
                ByproductReportTemplate.file_name.ilike(term),
                ByproductReportTemplate.notes.ilike(term),
            )
        )

    if filters.template_type:
        q = q.filter(ByproductReportTemplate.template_type == filters.template_type)

    if filters.template_format:
        q = q.filter(ByproductReportTemplate.template_format == filters.template_format)

    if filters.is_default is not None:
        q = q.filter(ByproductReportTemplate.is_default.is_(filters.is_default))

    if filters.is_active is not None:
        q = q.filter(ByproductReportTemplate.is_active.is_(filters.is_active))

    total = q.count()
    items = (
        q.order_by(
            ByproductReportTemplate.template_type.asc(),
            ByproductReportTemplate.is_default.desc(),
            ByproductReportTemplate.name.asc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

    return ByproductReportTemplateListResponse(
        items=[_serialize_template(item) for item in items],
        total=total,
    )


def update_template(
    db: Session,
    template_id: UUID,
    payload: ByproductReportTemplateUpdate,
    *,
    actor_id: UUID | None = None,
) -> ByproductReportTemplateRead:
    obj = _get_template_or_404(db, template_id)

    if payload.template_code is not None:
        template_code = _normalize_upper(payload.template_code)
        if not template_code:
            raise _http_400("template_code cannot be empty")
        if template_code != obj.template_code and _template_exists_by_code(
            db,
            template_code,
            exclude_id=obj.id,
        ):
            raise _http_409("A byproducts template with this template code already exists")
        obj.template_code = template_code

    if payload.name is not None:
        obj.name = payload.name

    if payload.template_type is not None:
        obj.template_type = payload.template_type

    if payload.template_format is not None:
        obj.template_format = payload.template_format

    if payload.file_name is not None:
        obj.file_name = payload.file_name

    if payload.file_path is not None:
        file_path = _normalize_text(payload.file_path)
        if not file_path:
            raise _http_400("file_path cannot be empty")

        resolved_path = _ensure_existing_file_or_400(file_path, label="Updated file_path")
        normalized_file_path = _to_storage_path_string(resolved_path)

        if normalized_file_path != obj.file_path and _template_exists_by_path(
            db,
            normalized_file_path,
            exclude_id=obj.id,
        ):
            raise _http_409("Another byproducts template already uses this file_path")

        obj.file_path = normalized_file_path
        obj.placeholders_meta = _build_placeholder_meta(resolved_path, obj.template_format)
        obj.file_size_bytes = resolved_path.stat().st_size
        obj.mime_type = _detect_mime_type_by_extension(resolved_path)

    elif payload.template_format is not None and obj.file_path:
        existing_path = _ensure_existing_file_or_400(
            obj.file_path,
            label="Template file_path",
        )
        obj.placeholders_meta = _build_placeholder_meta(existing_path, obj.template_format)
        obj.file_size_bytes = existing_path.stat().st_size
        obj.mime_type = _detect_mime_type_by_extension(existing_path)

    if payload.mime_type is not None:
        obj.mime_type = payload.mime_type

    if payload.file_size_bytes is not None:
        obj.file_size_bytes = payload.file_size_bytes

    if payload.notes is not None:
        obj.notes = payload.notes

    if payload.placeholders_meta is not None:
        obj.placeholders_meta = payload.placeholders_meta.model_dump()

    if payload.is_active is not None:
        obj.is_active = payload.is_active

    if payload.is_default is not None:
        if payload.is_default:
            _set_default_for_type(db, obj, actor_id=actor_id)
        else:
            obj.is_default = False

    _apply_update_audit(obj, actor_id)
    db.commit()
    db.refresh(obj)
    return _serialize_template(obj)


def replace_template_file(
    db: Session,
    template_id: UUID,
    *,
    upload: UploadFile,
    storage_root: Path | None = None,
    actor_id: UUID | None = None,
) -> ByproductReportTemplateRead:
    obj = _get_template_or_404(db, template_id)

    saved = save_uploaded_template_file(
        upload,
        template_type=obj.template_type,
        template_format=obj.template_format,
        storage_root=storage_root,
    )

    old_path = obj.file_path

    try:
        obj.file_name = saved["file_name"]
        obj.file_path = saved["file_path"]
        obj.mime_type = saved["mime_type"]
        obj.file_size_bytes = saved["file_size_bytes"]
        obj.placeholders_meta = saved["placeholders_meta"]

        _apply_update_audit(obj, actor_id)
        db.commit()
        db.refresh(obj)
    except Exception:
        _delete_file_safely(saved["file_path"])
        raise

    if old_path and old_path != obj.file_path:
        _delete_file_safely(old_path)

    return _serialize_template(obj)


def delete_template(
    db: Session,
    template_id: UUID,
    *,
    actor_id: UUID | None = None,
    delete_file_from_disk: bool = False,
) -> MessageResponse:
    obj = _get_template_or_404(db, template_id)
    file_path = obj.file_path

    _apply_soft_delete(obj, actor_id)
    obj.is_default = False
    db.commit()

    if delete_file_from_disk:
        _delete_file_safely(file_path)

    return MessageResponse(message="Byproducts report template deleted successfully")


def restore_template(
    db: Session,
    template_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> ByproductReportTemplateRead:
    obj = _get_template_or_404(db, template_id, include_deleted=True)

    _apply_restore(obj, actor_id)
    obj.is_active = True

    db.commit()
    db.refresh(obj)
    return _serialize_template(obj)


def set_default_template(
    db: Session,
    template_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> ByproductReportTemplateRead:
    obj = _get_template_or_404(db, template_id)
    _set_default_for_type(db, obj, actor_id=actor_id)
    db.commit()
    db.refresh(obj)
    return _serialize_template(obj)


def refresh_template_placeholders(
    db: Session,
    template_id: UUID,
    *,
    actor_id: UUID | None = None,
) -> ByproductReportTemplateRead:
    obj = _get_template_or_404(db, template_id)
    file_path = _ensure_existing_file_or_400(obj.file_path, label="Template file")

    obj.placeholders_meta = _build_placeholder_meta(file_path, obj.template_format)
    obj.file_size_bytes = file_path.stat().st_size
    obj.mime_type = _detect_mime_type_by_extension(file_path)
    _apply_update_audit(obj, actor_id)

    db.commit()
    db.refresh(obj)
    return _serialize_template(obj)


# =============================================================================
# CONTEXT HELPERS
# =============================================================================


def _rows_to_pipe_text(rows: list[dict[str, Any]]) -> str:
    lines: list[str] = []

    for row in rows:
        values = [
            str(row.get("no", "") or ""),
            str(row.get("customer_name", "") or ""),
            str(row.get("transaction_name", "") or ""),
            str(row.get("byproduct_name", "") or ""),
            str(row.get("quantity", "") or ""),
            str(row.get("unit_price", "") or ""),
            str(row.get("line_total", "") or ""),
        ]
        lines.append(" | ".join(values))

    return "\n".join(lines)


def _grouped_rows_to_pipe_text(rows: list[dict[str, Any]]) -> str:
    lines: list[str] = []

    for row in rows:
        values = [
            str(row.get("group_label", "") or ""),
            str(row.get("quantity_total", "") or ""),
            str(row.get("amount_total", "") or ""),
            str(row.get("transaction_count", "") or ""),
        ]
        lines.append(" | ".join(values))

    return "\n".join(lines)


def _sanitize_render_context(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _sanitize_render_context(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_render_context(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_sanitize_render_context(v) for v in value)
    if isinstance(value, Path):
        return str(value)
    return value


def _build_convenience_context(base_context: dict[str, Any]) -> dict[str, Any]:
    report_date_from = base_context.get("report_date_from")
    report_date_to = base_context.get("report_date_to")
    same_day = report_date_from == report_date_to

    rows = base_context.get("rows", []) or []
    grouped_rows = base_context.get("grouped_rows", []) or []
    table_total_row = base_context.get("table_total_row", {}) or {}
    table_rows_with_total = base_context.get("table_rows_with_total", []) or rows
    totals = base_context.get("totals", {}) or {}

    selected_customer_name = (
        base_context.get("selected_customer_name")
        or base_context.get("report_scope_label")
        or "All Customers"
    )
    is_single_customer_report = bool(base_context.get("is_single_customer_report"))

    report_scope_title = (
        f"Customer: {selected_customer_name}"
        if is_single_customer_report and selected_customer_name
        else "All Customers"
    )

    return {
        **base_context,
        "report_date": report_date_from if same_day else None,
        "report_period": (
            report_date_from if same_day else f"{report_date_from} to {report_date_to}"
        ),
        "rows_count": len(rows),
        "grouped_rows_count": len(grouped_rows),
        "rows_text": _rows_to_pipe_text(rows),
        "grouped_rows_text": _grouped_rows_to_pipe_text(grouped_rows),
        "table_rows_text": _rows_to_pipe_text(table_rows_with_total),
        "daily_offal_sales_rows": table_rows_with_total,
        "daily_offal_sales_total_row": table_total_row,
        "customer_summary_rows": grouped_rows,
        "include_top_totals_table": bool(base_context.get("show_top_totals_table", True)),
        "include_customer_summary": bool(base_context.get("show_customer_summary", True)),
        "include_total_footer_row": bool(base_context.get("show_total_footer_row", False)),
        "selected_customer_name": selected_customer_name,
        "report_scope_title": report_scope_title,
        "total_quantity": totals.get("total_quantity"),
        "subtotal_amount": totals.get("subtotal_amount"),
        "discount_amount": totals.get("discount_amount"),
        "adjustment_amount": totals.get("adjustment_amount"),
        "total_amount": totals.get("total_amount"),
        "amount_paid": totals.get("amount_paid"),
        "balance_due": totals.get("balance_due"),
        "transaction_count": totals.get("transaction_count"),
        "line_count": totals.get("line_count"),
        "customer_count": totals.get("customer_count"),
        "byproduct_count": totals.get("byproduct_count"),
    }


def build_report_render_context(
    db: Session,
    request: ByproductGenerateReportDocumentRequest,
    *,
    company_name: str | None = None,
    company_address: str | None = None,
    company_phone: str | None = None,
    report_title: str | None = None,
) -> dict[str, Any]:
    base_context = build_template_context(
        db,
        request.report_filter,
        company_name=company_name,
        company_address=company_address,
        company_phone=company_phone,
        report_title=report_title,
    )
    context = _build_convenience_context(base_context)
    return _sanitize_render_context(context)


# =============================================================================
# RENDER HELPERS
# =============================================================================


def _render_docx_template(
    template_path: Path,
    output_path: Path,
    context: dict[str, Any],
) -> None:
    if DocxTemplate is None:
        raise _http_400(
            "DOCX template rendering requires 'docxtpl'. Install it before rendering DOCX templates."
        )

    _ensure_dir(output_path.parent)
    doc = DocxTemplate(str(template_path.resolve()))
    doc.render(context)
    doc.save(str(output_path.resolve()))


def _render_html_template(
    template_path: Path,
    output_path: Path,
    context: dict[str, Any],
) -> None:
    text = _read_text_file(template_path)
    env = Environment(
        loader=BaseLoader(),
        autoescape=select_autoescape(enabled_extensions=("html", "xml")),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.from_string(text)
    rendered = template.render(**context)

    _ensure_dir(output_path.parent)
    output_path.write_text(rendered, encoding="utf-8")


def _render_pdf_from_html(html_path: Path, pdf_path: Path) -> None:
    if HTML is None:
        raise _http_400(
            "PDF generation from HTML requires 'weasyprint'. Install it before generating PDF output."
        )

    _ensure_dir(pdf_path.parent)
    HTML(filename=str(html_path.resolve())).write_pdf(str(pdf_path.resolve()))


# =============================================================================
# DOCX -> PDF CONVERSION HELPERS
# =============================================================================


def _common_libreoffice_candidates() -> list[Path]:
    system = platform.system().lower()
    candidates: list[Path] = []

    if "windows" in system:
        program_files = [
            os.environ.get("PROGRAMFILES"),
            os.environ.get("PROGRAMFILES(X86)"),
            r"C:\Program Files",
            r"C:\Program Files (x86)",
        ]
        for base in program_files:
            if base:
                candidates.append(Path(base) / "LibreOffice" / "program" / "soffice.exe")
                candidates.append(Path(base) / "LibreOffice" / "program" / "swriter.exe")
    elif "darwin" in system:
        candidates.extend(
            [
                Path("/Applications/LibreOffice.app/Contents/MacOS/soffice"),
                Path("/Applications/OpenOffice.app/Contents/MacOS/soffice"),
            ]
        )
    else:
        candidates.extend(
            [
                Path("/usr/bin/soffice"),
                Path("/usr/bin/libreoffice"),
                Path("/usr/local/bin/soffice"),
                Path("/usr/local/bin/libreoffice"),
                Path("/snap/bin/libreoffice"),
            ]
        )

    return candidates


def _find_libreoffice_binary() -> str | None:
    for name in ("soffice", "libreoffice"):
        found = shutil.which(name)
        if found:
            return found

    for candidate in _common_libreoffice_candidates():
        if candidate.exists():
            return str(candidate)

    return None


def _convert_docx_to_pdf_via_docx2pdf(
    rendered_docx_path: Path,
    output_pdf_path: Path,
) -> tuple[bool, str]:
    if docx2pdf_convert is None:
        return False, "docx2pdf is not installed in the active Python environment."

    try:
        docx2pdf_convert(
            str(rendered_docx_path.resolve()),
            str(output_pdf_path.resolve()),
        )
        if output_pdf_path.exists():
            return True, ""
        return False, "docx2pdf completed but did not create the PDF file."
    except Exception as exc:
        return False, f"docx2pdf failed: {exc}"


def _convert_docx_to_pdf_via_word_com(
    rendered_docx_path: Path,
    output_pdf_path: Path,
) -> tuple[bool, str]:
    if platform.system().lower() != "windows":
        return False, "Microsoft Word COM conversion is only available on Windows."
    if win32_client is None:
        return False, "pywin32 / win32com is not available in the active Python environment."

    word = None
    document = None

    try:
        if pythoncom is not None:
            pythoncom.CoInitialize()

        word = win32_client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0

        document = word.Documents.Open(str(rendered_docx_path.resolve()))
        document.SaveAs(str(output_pdf_path.resolve()), FileFormat=WORD_PDF_FILE_FORMAT)
        document.Close(False)
        document = None

        word.Quit()
        word = None

        if output_pdf_path.exists():
            return True, ""
        return False, "Microsoft Word opened the DOCX but did not create the PDF file."
    except Exception as exc:
        try:
            if document is not None:
                document.Close(False)
        except Exception:
            pass

        try:
            if word is not None:
                word.Quit()
        except Exception:
            pass

        return False, f"Microsoft Word COM conversion failed: {exc}"
    finally:
        if pythoncom is not None:
            try:
                pythoncom.CoUninitialize()
            except Exception:
                pass


def _convert_docx_to_pdf_via_libreoffice(
    rendered_docx_path: Path,
    output_pdf_path: Path,
) -> tuple[bool, str]:
    soffice_bin = _find_libreoffice_binary()
    if not soffice_bin:
        return False, "LibreOffice / soffice was not found on this machine."

    temp_profile_dir = Path(tempfile.mkdtemp(prefix="lo-profile-"))
    expected_pdf = output_pdf_path.parent / f"{rendered_docx_path.stem}.pdf"

    try:
        cmd = [
            soffice_bin,
            "--headless",
            f"-env:UserInstallation={temp_profile_dir.as_uri()}",
            "--convert-to",
            "pdf:writer_pdf_Export",
            "--outdir",
            str(output_pdf_path.parent.resolve()),
            str(rendered_docx_path.resolve()),
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
        )

        if result.returncode != 0:
            error_text = (result.stderr or result.stdout or "").strip()
            return False, (
                f"LibreOffice conversion failed: "
                f"{error_text or f'process exited with code {result.returncode}'}"
            )

        if expected_pdf.exists() and expected_pdf != output_pdf_path:
            if output_pdf_path.exists():
                output_pdf_path.unlink()
            expected_pdf.replace(output_pdf_path)

        if output_pdf_path.exists():
            return True, ""

        return False, "LibreOffice finished but did not create the expected PDF file."
    except Exception as exc:
        return False, f"LibreOffice conversion failed: {exc}"
    finally:
        shutil.rmtree(temp_profile_dir, ignore_errors=True)


def _convert_docx_to_pdf(rendered_docx_path: Path, output_pdf_path: Path) -> None:
    rendered_docx_path = rendered_docx_path.resolve()
    output_pdf_path = output_pdf_path.resolve()

    if not rendered_docx_path.exists():
        raise _http_400(
            f"Rendered DOCX file does not exist on disk: {rendered_docx_path}"
        )

    attempts = [
        _convert_docx_to_pdf_via_docx2pdf,
        _convert_docx_to_pdf_via_word_com,
        _convert_docx_to_pdf_via_libreoffice,
    ]

    errors: list[str] = []

    for converter in attempts:
        success, message = converter(rendered_docx_path, output_pdf_path)
        if success:
            return
        if message:
            errors.append(message)

    if errors:
        raise _http_400("DOCX to PDF conversion failed. " + " | ".join(errors))

    raise _http_400(
        "DOCX to PDF conversion is not available on this server. "
        "Install one of these options and restart the app: "
        "1) LibreOffice and ensure 'soffice' is accessible, "
        "2) docx2pdf with Microsoft Word available, or "
        "3) pywin32 with Microsoft Word on Windows."
    )


# =============================================================================
# TEMPLATE RESOLUTION
# =============================================================================


def _resolve_template_for_render(
    db: Session,
    request: ByproductGenerateReportDocumentRequest,
) -> ByproductReportTemplate:
    template = None

    if request.template_id:
        template = _get_template_or_404(db, request.template_id)
    elif request.template_code:
        template = _get_template_by_code(db, request.template_code)
        if template is None:
            raise _http_404("Byproducts report template not found")
    else:
        raise _http_400("Either template_id or template_code must be provided")

    if template.is_deleted or not template.is_active:
        raise _http_400("Selected byproducts report template is inactive or deleted")

    _ensure_existing_file_or_400(template.file_path, label="Selected template file")
    return template


# =============================================================================
# GENERATE DOCUMENT SERVICE
# =============================================================================


def generate_report_document(
    db: Session,
    request: ByproductGenerateReportDocumentRequest,
    *,
    output_root: Path | None = None,
    company_name: str | None = None,
    company_address: str | None = None,
    company_phone: str | None = None,
    report_title: str | None = None,
) -> ByproductGeneratedDocumentResponse:
    template = _resolve_template_for_render(db, request)
    output_root = _output_storage_dir(output_root)

    context = build_report_render_context(
        db,
        request,
        company_name=company_name,
        company_address=company_address,
        company_phone=company_phone,
        report_title=report_title or template.name,
    )

    template_path = _ensure_existing_file_or_400(
        template.file_path,
        label="Selected template file",
    )
    output_format = request.output_format.lower().strip()
    base_name = f"{template.name}-{context.get('report_type', 'report')}"

    if template.template_format == ByproductTemplateFormat.DOCX:
        if output_format == "docx":
            output_path = output_root / _safe_output_name(base_name, "docx")
            _render_docx_template(template_path, output_path, context)
            return _build_generated_response(output_path)

        if output_format == "pdf":
            rendered_docx_path = output_root / _safe_output_name(base_name, "docx")
            output_pdf_path = output_root / _safe_output_name(base_name, "pdf")

            _render_docx_template(template_path, rendered_docx_path, context)

            try:
                _convert_docx_to_pdf(rendered_docx_path, output_pdf_path)
            finally:
                _delete_file_safely(rendered_docx_path)

            return _build_generated_response(output_pdf_path)

        raise _http_400("DOCX templates support output_format 'docx' and 'pdf' only")

    if template.template_format == ByproductTemplateFormat.HTML:
        rendered_html_path = output_root / _safe_output_name(base_name, "html")
        _render_html_template(template_path, rendered_html_path, context)

        if output_format == "html":
            return _build_generated_response(rendered_html_path)

        if output_format == "pdf":
            output_pdf_path = output_root / _safe_output_name(base_name, "pdf")
            try:
                _render_pdf_from_html(rendered_html_path, output_pdf_path)
            finally:
                _delete_file_safely(rendered_html_path)

            return _build_generated_response(output_pdf_path)

        raise _http_400("HTML templates support output_format 'html' and 'pdf' only")

    raise _http_400("Unsupported byproducts template format")


# =============================================================================
# QUICK UTILITIES
# =============================================================================


def get_default_template_for_type(
    db: Session,
    template_type: ByproductTemplateType,
) -> ByproductReportTemplateRead | None:
    obj = (
        db.query(ByproductReportTemplate)
        .filter(
            ByproductReportTemplate.template_type == template_type,
            ByproductReportTemplate.is_default.is_(True),
            ByproductReportTemplate.is_active.is_(True),
            ByproductReportTemplate.is_deleted.is_(False),
        )
        .first()
    )
    return _serialize_template(obj) if obj else None


def preview_template_placeholders(db: Session, template_id: UUID) -> dict[str, Any]:
    obj = _get_template_or_404(db, template_id)
    file_path = _ensure_existing_file_or_400(obj.file_path, label="Template file")

    placeholders_meta = _build_placeholder_meta(file_path, obj.template_format)
    placeholders = placeholders_meta.get("placeholders", [])

    return {
        "template_id": str(obj.id),
        "template_code": obj.template_code,
        "template_name": obj.name,
        "template_format": obj.template_format.value,
        "placeholders": placeholders,
        "count": len(placeholders),
    }