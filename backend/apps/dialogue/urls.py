from django.urls import path

from .views import SessionDetailView, ideal_answer, retry_stage, send_message, start_session, synthesize_message


urlpatterns = [
    path("scenarios/<int:scenario_id>/sessions/", start_session, name="session-start"),
    path("sessions/<int:pk>/", SessionDetailView.as_view(), name="session-detail"),
    path("sessions/<int:session_id>/messages/", send_message, name="session-message"),
    path("sessions/<int:session_id>/retry/", retry_stage, name="session-retry"),
    path("sessions/<int:session_id>/ideal-answer/", ideal_answer, name="session-ideal-answer"),
    path("messages/<int:message_id>/speech/", synthesize_message, name="message-speech"),
]
