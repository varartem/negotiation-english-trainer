from django.urls import path

from .views import (
    SessionDetailView,
    SessionListView,
    SessionPublicDetailView,
    ideal_answer,
    retry_stage,
    send_message,
    send_message_progress,
    start_session,
    synthesize_message,
    synthesize_message_progress,
)


urlpatterns = [
    path("sessions/", SessionListView.as_view(), name="session-list"),
    path("scenarios/<int:scenario_id>/sessions/", start_session, name="session-start"),
    path("sessions/<int:pk>/", SessionDetailView.as_view(), name="session-detail"),
    path("sessions/by-public-id/<uuid:public_id>/", SessionPublicDetailView.as_view(), name="session-public-detail"),
    path("sessions/<int:session_id>/messages/", send_message, name="session-message"),
    path("sessions/<int:session_id>/messages/progress/", send_message_progress, name="session-message-progress"),
    path("sessions/<int:session_id>/retry/", retry_stage, name="session-retry"),
    path("sessions/<int:session_id>/ideal-answer/", ideal_answer, name="session-ideal-answer"),
    path("messages/<int:message_id>/speech/", synthesize_message, name="message-speech"),
    path("messages/<int:message_id>/speech/progress/", synthesize_message_progress, name="message-speech-progress"),
]
