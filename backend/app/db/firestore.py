import os

from google.auth.credentials import AnonymousCredentials
from google.cloud import firestore as gcf

from app.core.config import settings

_client: gcf.Client | None = None


def get_db() -> gcf.Client:
    """Returns a Firestore client.

    Emulator mode (FIRESTORE_EMULATOR_HOST set) uses anonymous credentials so
    this runs with zero GCP setup. Real Firestore requires
    GOOGLE_APPLICATION_CREDENTIALS to point at a service-account key.
    """
    global _client
    if _client is not None:
        return _client

    if settings.firestore_emulator_host:
        os.environ["FIRESTORE_EMULATOR_HOST"] = settings.firestore_emulator_host
        _client = gcf.Client(
            project=settings.firebase_project_id,
            credentials=AnonymousCredentials(),
        )
    else:
        _client = gcf.Client(project=settings.firebase_project_id)

    return _client
