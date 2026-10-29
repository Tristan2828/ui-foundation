"""Web Push's table (foundation_backend.push): the devices a user allowed
reminders on. Apart from models.py (#247), so it reaches `SQLModel.metadata`
only for an app that uses push: importing push, its router or this module
puts it there. Its migration is the reference copy 0015 in `migrations/`.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel

# users, the table its user_id points at.
import foundation_backend.models  # noqa: F401


class PushSubscription(SQLModel, table=True):
    """One device a user allowed reminders on (foundation_backend.push): where its push
    service takes messages for it, and the keys to encrypt them to."""

    __tablename__ = "push_subscriptions"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    # The push service's URL for this device. Unique: the same device
    # subscribing again (or under another account) replaces its row.
    endpoint: str = Field(max_length=2048, unique=True)
    # The browser's P-256 public key and auth secret, base64url.
    p256dh: str = Field(max_length=100)
    auth: str = Field(max_length=32)
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
