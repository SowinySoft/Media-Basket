"""
Standardized API Response Format
Consistent response format across all endpoints
"""
from typing import Optional, Any
from pydantic import BaseModel
from datetime import datetime


class APIResponse(BaseModel):
    """Standard API response"""
    success: bool = True
    data: Optional[Any] = None
    error: Optional[str] = None
    message: Optional[str] = None
    timestamp: datetime = datetime.utcnow()
    request_id: Optional[str] = None


class PaginatedResponse(BaseModel):
    """Paginated API response"""
    success: bool = True
    data: list = []
    total: int = 0
    page: int = 1
    page_size: int = 50
    has_more: bool = False
    timestamp: datetime = datetime.utcnow()


class ErrorResponse(BaseModel):
    """Error API response"""
    success: bool = False
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None
    timestamp: datetime = datetime.utcnow()


def success_response(data: Any = None, message: str = None) -> dict:
    """Create a success response"""
    return {
        "success": True,
        "data": data,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
    }


def error_response(error: str, detail: str = None, code: str = None) -> dict:
    """Create an error response"""
    return {
        "success": False,
        "error": error,
        "detail": detail,
        "code": code,
        "timestamp": datetime.utcnow().isoformat(),
    }


def paginated_response(
    data: list,
    total: int,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """Create a paginated response"""
    return {
        "success": True,
        "data": data,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": (page * page_size) < total,
        "timestamp": datetime.utcnow().isoformat(),
    }
