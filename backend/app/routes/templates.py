"""
Content Templates API
Pre-built templates for common post types
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from app.routes.auth import get_current_user
from app.core.api_response import success_response, paginated_response
from app.core.database import get_db

router = APIRouter()


class TemplateCreate(BaseModel):
    name: str
    content: str
    variables: Optional[dict] = None
    category: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[dict] = None
    category: Optional[str] = None


@router.get("")
async def list_templates(
    category: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """List all templates"""
    from sqlalchemy import select
    from app.models.models import Template
    
    org_id = current_user["org_id"]
    query = select(Template).where(Template.org_id == org_id)
    
    if category:
        query = query.where(Template.category == category)
    
    query = query.order_by(Template.created_at.desc())
    result = await db.execute(query)
    templates = result.scalars().all()
    
    data = [
        {
            "id": str(t.id),
            "name": t.name,
            "content": t.content,
            "variables": t.variables,
            "category": t.category,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in templates
    ]
    
    return paginated_response(data=data, total=len(data), page=page, page_size=page_size)


@router.post("", status_code=201)
async def create_template(
    request: TemplateCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Create a new template"""
    from app.models.models import Template
    
    org_id = current_user["org_id"]
    
    template = Template(
        org_id=org_id,
        created_by=current_user["member_id"],
        name=request.name,
        content=request.content,
        variables=request.variables or {},
        category=request.category,
    )
    
    db.add(template)
    await db.flush()
    await db.refresh(template)
    
    return success_response(
        data={
            "id": str(template.id),
            "name": template.name,
            "content": template.content,
            "variables": template.variables,
            "category": template.category,
        },
        message="Template created"
    )


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    request: TemplateUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Update a template"""
    from sqlalchemy import select, update
    from app.models.models import Template
    
    org_id = current_user["org_id"]
    
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    
    if update_data:
        await db.execute(
            update(Template)
            .where(Template.id == template_id, Template.org_id == org_id)
            .values(**update_data)
        )
    
    return success_response(message="Template updated")


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete a template"""
    from sqlalchemy import delete
    from app.models.models import Template
    
    org_id = current_user["org_id"]
    
    await db.execute(
        delete(Template)
        .where(Template.id == template_id, Template.org_id == org_id)
    )
    
    return success_response(message="Template deleted")


@router.post("/{template_id}/render")
async def render_template(
    template_id: str,
    variables: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Render a template with variables"""
    from sqlalchemy import select
    from app.models.models import Template
    
    org_id = current_user["org_id"]
    
    result = await db.execute(
        select(Template)
        .where(Template.id == template_id, Template.org_id == org_id)
    )
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Render template with variables
    content = template.content
    for key, value in variables.items():
        content = content.replace(f"{{{{{key}}}}}", str(value))
    
    return success_response(data={"rendered_content": content})
