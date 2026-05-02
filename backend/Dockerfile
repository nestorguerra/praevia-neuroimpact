FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PREPROCESSING_WORKER_MODE=mock \
    REPORT_RENDERER_MODE=playwright \
    WHISPER_PROVIDER=local \
    WHISPER_MODEL=small \
    WHISPER_DEVICE=cpu \
    WHISPER_COMPUTE_TYPE=int8

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY backend/pyproject.toml /app/backend/pyproject.toml
COPY backend/app /app/backend/app
RUN pip install ".[preprocessing]" \
    && python -m playwright install --with-deps chromium

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
