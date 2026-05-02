FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    WHISPER_PROVIDER=local \
    WHISPER_MODEL=small \
    WHISPER_DEVICE=cpu \
    WHISPER_COMPUTE_TYPE=int8

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /worker

COPY worker/preprocessing/requirements.txt /worker/preprocessing/requirements.txt
RUN pip install -r /worker/preprocessing/requirements.txt

COPY worker/storage_client.py /worker/storage_client.py
COPY worker/preprocessing /worker/preprocessing

ENTRYPOINT ["python", "-m", "preprocessing.cli"]
