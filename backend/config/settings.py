from pathlib import Path
import os

import dj_database_url


BASE_DIR = Path(__file__).resolve().parent.parent


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(BASE_DIR.parent / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "apps.scenarios",
    "apps.negotiation_graph",
    "apps.dialogue",
    "apps.vocabulary",
    "apps.ai_services",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://negotiation_user:negotiation_password@localhost:5432/negotiation_trainer",
)

DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
        engine="django.db.backends.postgresql",
    )
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "apps.ai_services.exception_handler.ai_exception_handler",
}

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
CORS_ALLOWED_ORIGINS = sorted(
    {
        FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }
)
CORS_ALLOW_CREDENTIALS = False

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "mlx")
LLM_MODEL = os.getenv("LLM_MODEL", "mlx-community/Qwen3.5-9B-OptiQ-4bit")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.2"))
LLM_TOP_P = float(os.getenv("LLM_TOP_P", "0.9"))
LLM_TOP_K = int(os.getenv("LLM_TOP_K", "20"))

STT_PROVIDER = os.getenv("STT_PROVIDER", "mlx")
STT_MODEL = os.getenv("STT_MODEL", "Qwen/Qwen3-ASR-0.6B")
STT_LANGUAGE = os.getenv("STT_LANGUAGE", "English")
STT_CONTEXT = os.getenv(
    "STT_CONTEXT",
    "negotiation sales procurement budget price ROI pilot contract discount commitment",
)

TTS_PROVIDER = os.getenv("TTS_PROVIDER", "mlx")
TTS_MODEL = os.getenv("TTS_MODEL", "mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16")
TTS_VOICE = os.getenv("TTS_VOICE", "Aiden")
TTS_LANGUAGE = os.getenv("TTS_LANGUAGE", "en")
TTS_INSTRUCT = os.getenv("TTS_INSTRUCT", "Speak in a calm, professional negotiation partner tone.")
