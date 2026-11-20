from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser
from app.ml.summarization.summarizer import summarize
from app.models import ChatbotConversation, ChatbotMessage, Product
from app.schemas.common import Message, ORMModel
from app.services.chatbot import ShoppingAssistant
from app.services.comparison import compare

router = APIRouter(prefix="/api", tags=["assistant, comparison & summaries"])


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    conversation_id: int | None = None


class ChatMessageOut(ORMModel):
    id: int
    role: str
    content: str
    payload: dict
    created_at: datetime


class ConversationOut(ORMModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessageOut] = []


class ChatOut(BaseModel):
    conversation_id: int
    user_message: ChatMessageOut
    reply: ChatMessageOut


@router.post("/chatbot/message", response_model=ChatOut)
def chat(body: ChatIn, user: CurrentUser, db: DB):
    if body.conversation_id:
        conv = db.scalar(select(ChatbotConversation).where(ChatbotConversation.id == body.conversation_id,
                                                           ChatbotConversation.user_id == user.id)
                         .options(selectinload(ChatbotConversation.messages)))
        if not conv:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    else:
        conv = ChatbotConversation(user_id=user.id, title=body.message.strip()[:80])
        db.add(conv)
        db.flush()
    history = list(conv.messages) if body.conversation_id else []
    text, payload = ShoppingAssistant(db, user.id).answer(body.message.strip(), history)
    um = ChatbotMessage(conversation_id=conv.id, role="user", content=body.message.strip(), payload={})
    am = ChatbotMessage(conversation_id=conv.id, role="assistant", content=text, payload=payload)
    db.add_all([um, am])
    conv.updated_at = datetime.now().astimezone()
    db.commit()
    return ChatOut(conversation_id=conv.id, user_message=ChatMessageOut.model_validate(um),
                   reply=ChatMessageOut.model_validate(am))


@router.get("/chatbot/history", response_model=list[ConversationOut])
def history(user: CurrentUser, db: DB, conversation_id: int | None = None, limit: int = Query(20, ge=1, le=50)):
    q = (select(ChatbotConversation).where(ChatbotConversation.user_id == user.id)
         .options(selectinload(ChatbotConversation.messages)).order_by(ChatbotConversation.updated_at.desc()))
    if conversation_id:
        q = q.where(ChatbotConversation.id == conversation_id)
    return db.scalars(q.limit(limit)).all()


@router.delete("/chatbot/history/{conversation_id}", response_model=Message)
def delete_conversation(conversation_id: int, user: CurrentUser, db: DB):
    res = db.execute(delete(ChatbotConversation).where(ChatbotConversation.id == conversation_id,
                                                       ChatbotConversation.user_id == user.id))
    db.commit()
    if not res.rowcount:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return Message(message="Conversation deleted")


@router.get("/compare")
def compare_products(db: DB, ids: str = Query(..., description="Comma-separated product ids (2-4)")):
    try:
        parsed = [int(x) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(422, "ids must be integers")
    if not 2 <= len(set(parsed)) <= 4:
        raise HTTPException(422, "Compare between 2 and 4 products")
    try:
        return compare(db, parsed)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.get("/products/{product_id}/summary")
def product_summary(product_id: int, db: DB):
    if not db.get(Product, product_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return summarize(db, product_id)
