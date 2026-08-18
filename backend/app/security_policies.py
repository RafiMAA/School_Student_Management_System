import io
import zipfile

from fastapi import HTTPException


MANAGEABLE_ROLES = {
    "Admin": {"Teacher", "Admin"},
    "Principal": {"Teacher", "Admin"},
    "Super Admin": {"Teacher", "Admin", "Super Admin"},
}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_UNCOMPRESSED_XLSX_BYTES = 25 * 1024 * 1024
MAX_XLSX_FILES = 1_000


def can_manage_role(actor_role: str, target_role: str) -> bool:
    return target_role in MANAGEABLE_ROLES.get(actor_role, set())


def would_remove_last_super_admin(
    current_role: str,
    next_role: str | None,
    other_active_super_admins: int,
) -> bool:
    """Return True when a role change/delete would leave no active Super Admin."""
    return (
        current_role == "Super Admin"
        and next_role != "Super Admin"
        and other_active_super_admins < 1
    )


def validate_upload(content: bytes, filename: str) -> None:
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Upload is limited to 5 MB")
    if not filename.lower().endswith(".xlsx"):
        return

    stream = io.BytesIO(content)
    if not zipfile.is_zipfile(stream):
        raise HTTPException(status_code=400, detail="The file is not a valid XLSX workbook")
    try:
        with zipfile.ZipFile(stream) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_XLSX_FILES:
                raise HTTPException(status_code=400, detail="XLSX workbook contains too many files")
            if sum(entry.file_size for entry in entries) > MAX_UNCOMPRESSED_XLSX_BYTES:
                raise HTTPException(status_code=413, detail="Expanded XLSX workbook is too large")
            if any(
                entry.filename.startswith(("/", "\\"))
                or ".." in entry.filename.split("/")
                for entry in entries
            ):
                raise HTTPException(status_code=400, detail="XLSX workbook contains unsafe paths")
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="The file is not a valid XLSX workbook")
