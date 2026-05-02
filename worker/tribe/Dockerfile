FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/models/huggingface
ENV MODEL_CACHE_DIR=/models/tribe
ENV TRIBE_MODEL_ID=facebook/tribev2

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ffmpeg build-essential ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/tribe-worker

COPY worker/tribe/requirements.txt /opt/tribe-worker/requirements.txt
RUN pip install --no-cache-dir -r /opt/tribe-worker/requirements.txt

RUN git clone --depth 1 https://github.com/facebookresearch/tribev2.git /opt/tribev2 \
  && pip install --no-cache-dir -e /opt/tribev2

COPY worker/storage_client.py /opt/tribe-worker/storage_client.py
COPY worker/tribe/tribe_worker /opt/tribe-worker/tribe_worker

CMD ["python", "-m", "tribe_worker.entrypoint"]
