from __future__ import annotations

import os
from dataclasses import dataclass


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_env: str
    app_public_url: str
    api_public_url: str
    auth_mode: str
    persistence_mode: str
    database_url: str
    supabase_url: str | None
    supabase_anon_key_configured: bool
    supabase_service_role_configured: bool
    supabase_jwt_secret: str | None
    jwt_secret: str | None
    allowed_origins: list[str]
    allowed_hosts: list[str]
    force_https: bool
    readiness_token: str | None
    readiness_token_configured: bool
    signed_url_ttl_seconds: int
    storage_mode: str
    s3_endpoint: str | None
    s3_region: str
    s3_bucket: str
    s3_access_key_id: str | None
    s3_secret_access_key: str | None
    s3_access_key_id_configured: bool
    s3_secret_access_key_configured: bool
    s3_create_bucket_if_missing: bool
    monthly_cost_cap_eur: float
    monthly_gpu_cap_seconds: int
    storage_eur_per_gb_month: float
    platform_event_eur: float
    retention_days: int
    sentry_dsn: str | None
    sentry_dsn_configured: bool
    sentry_traces_sample_rate: float
    sentry_profiles_sample_rate: float
    structured_logs: bool
    rate_limit_window_seconds: int
    rate_limit_requests: int
    cost_alert_threshold_eur: float
    gpu_provider: str
    gpu_provider_api_key_configured: bool
    gcp_project_id: str | None
    gcp_region: str
    gcp_tasks_queue: str | None
    gcp_tasks_location: str | None
    gcp_tasks_service_account: str | None
    tribe_worker_mode: str
    tribe_worker_endpoint_url: str | None
    tribe_worker_endpoint_configured: bool
    tribe_worker_bearer_token: str | None
    tribe_worker_bearer_token_configured: bool
    allow_mock_worker_in_production_gate: bool
    tribe_worker_image: str
    tribe_output_bucket: str
    tribe_output_prefix: str
    tribe_expected_vertices: int
    tribe_run_timeout_seconds: int
    tribe_run_poll_seconds: int
    tribe_run_max_retries: int
    tribe_gpu_eur_per_second: float
    tribe_callback_url: str | None
    tribe_callback_secret: str | None
    tribe_callback_secret_configured: bool
    huggingface_token_configured: bool
    tribe_model_id: str
    preprocessing_worker_mode: str
    preprocessing_temp_dir: str
    whisper_provider: str
    whisper_model: str
    whisper_device: str
    whisper_compute_type: str
    openai_api_key_configured: bool
    openai_base_url: str
    openai_timeout_seconds: int
    llm_interpreter_model: str
    llm_writer_model: str
    llm_writer_reasoning_effort: str
    llm_prompt_version: str
    llm_json_max_retries: int
    llm_input_eur_per_1k: float
    llm_output_eur_per_1k: float
    report_renderer_mode: str
    report_renderer_timeout_seconds: int


def load_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "local")
    app_public_url = os.getenv("APP_PUBLIC_URL", "http://localhost:5173")
    api_public_url = os.getenv("API_PUBLIC_URL", "http://localhost:8000")
    allowed_origins = _csv(os.getenv("CORS_ALLOWED_ORIGINS", app_public_url))
    allowed_hosts = _csv(os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0,testserver"))
    return Settings(
        app_env=app_env,
        app_public_url=app_public_url,
        api_public_url=api_public_url,
        auth_mode=os.getenv("AUTH_MODE", "local" if app_env == "local" else "supabase"),
        persistence_mode=os.getenv("PERSISTENCE_MODE", "memory" if app_env == "local" else "db"),
        database_url=os.getenv("DATABASE_URL", "postgresql://neuroimpact:neuroimpact@localhost:5432/neuroimpact"),
        supabase_url=os.getenv("SUPABASE_URL") or None,
        supabase_anon_key_configured=bool(os.getenv("SUPABASE_ANON_KEY", "")),
        supabase_service_role_configured=bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")),
        supabase_jwt_secret=os.getenv("SUPABASE_JWT_SECRET") or None,
        jwt_secret=os.getenv("JWT_SECRET") or None,
        allowed_origins=allowed_origins,
        allowed_hosts=allowed_hosts,
        force_https=os.getenv("FORCE_HTTPS", "false").lower() == "true",
        readiness_token=os.getenv("READINESS_TOKEN") or None,
        readiness_token_configured=bool(os.getenv("READINESS_TOKEN", "")),
        signed_url_ttl_seconds=int(os.getenv("SIGNED_URL_TTL_SECONDS", "900")),
        storage_mode=os.getenv("STORAGE_MODE", "auto").lower(),
        s3_endpoint=os.getenv("S3_ENDPOINT") or None,
        s3_region=os.getenv("S3_REGION", "auto"),
        s3_bucket=os.getenv("S3_BUCKET", f"praevia-neuroimpact-{app_env}"),
        s3_access_key_id=os.getenv("S3_ACCESS_KEY_ID") or None,
        s3_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY") or None,
        s3_access_key_id_configured=bool(os.getenv("S3_ACCESS_KEY_ID", "")),
        s3_secret_access_key_configured=bool(os.getenv("S3_SECRET_ACCESS_KEY", "")),
        s3_create_bucket_if_missing=os.getenv("S3_CREATE_BUCKET_IF_MISSING", "true" if app_env == "local" else "false").lower() == "true",
        monthly_cost_cap_eur=float(os.getenv("MONTHLY_COST_CAP_EUR", "350")),
        monthly_gpu_cap_seconds=int(os.getenv("MONTHLY_GPU_CAP_SECONDS", "7200")),
        storage_eur_per_gb_month=float(os.getenv("STORAGE_EUR_PER_GB_MONTH", "0.015")),
        platform_event_eur=float(os.getenv("PLATFORM_EVENT_EUR", "0.015")),
        retention_days=int(os.getenv("RETENTION_DAYS", "30")),
        sentry_dsn=os.getenv("SENTRY_DSN") or None,
        sentry_dsn_configured=bool(os.getenv("SENTRY_DSN", "")),
        sentry_traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
        sentry_profiles_sample_rate=float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.0")),
        structured_logs=os.getenv("STRUCTURED_LOGS", "true").lower() == "true",
        rate_limit_window_seconds=int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")),
        rate_limit_requests=int(os.getenv("RATE_LIMIT_REQUESTS", "120")),
        cost_alert_threshold_eur=float(os.getenv("COST_ALERT_THRESHOLD_EUR", "0")),
        gpu_provider=os.getenv("GPU_PROVIDER", "runpod_serverless"),
        gpu_provider_api_key_configured=bool(os.getenv("GPU_PROVIDER_API_KEY", "") or os.getenv("RUNPOD_API_KEY", "")),
        gcp_project_id=os.getenv("GCP_PROJECT_ID") or None,
        gcp_region=os.getenv("GCP_REGION", "europe-west1"),
        gcp_tasks_queue=os.getenv("GCP_TASKS_QUEUE") or None,
        gcp_tasks_location=os.getenv("GCP_TASKS_LOCATION") or os.getenv("GCP_REGION") or None,
        gcp_tasks_service_account=os.getenv("GCP_TASKS_SERVICE_ACCOUNT") or None,
        tribe_worker_mode=os.getenv("TRIBE_WORKER_MODE", "mock"),
        tribe_worker_endpoint_url=os.getenv("TRIBE_WORKER_ENDPOINT_URL") or None,
        tribe_worker_endpoint_configured=bool(os.getenv("TRIBE_WORKER_ENDPOINT_URL", "")),
        tribe_worker_bearer_token=os.getenv("TRIBE_WORKER_BEARER_TOKEN") or None,
        tribe_worker_bearer_token_configured=bool(os.getenv("TRIBE_WORKER_BEARER_TOKEN", "")),
        allow_mock_worker_in_production_gate=os.getenv("ALLOW_MOCK_WORKER_IN_PRODUCTION_GATE", "false").lower() == "true",
        tribe_worker_image=os.getenv("TRIBE_WORKER_IMAGE", f"praevia/tribe-worker:{app_env}"),
        tribe_output_bucket=os.getenv("TRIBE_OUTPUT_BUCKET", os.getenv("S3_BUCKET", f"praevia-neuroimpact-{app_env}")),
        tribe_output_prefix=os.getenv("TRIBE_OUTPUT_PREFIX", "predictions"),
        tribe_expected_vertices=int(os.getenv("TRIBE_EXPECTED_VERTICES", "20484")),
        tribe_run_timeout_seconds=int(os.getenv("TRIBE_RUN_TIMEOUT_SECONDS", "900")),
        tribe_run_poll_seconds=int(os.getenv("TRIBE_RUN_POLL_SECONDS", "5")),
        tribe_run_max_retries=int(os.getenv("TRIBE_RUN_MAX_RETRIES", "2")),
        tribe_gpu_eur_per_second=float(os.getenv("TRIBE_GPU_EUR_PER_SECOND", "0.00025")),
        tribe_callback_url=os.getenv("TRIBE_CALLBACK_URL") or None,
        tribe_callback_secret=os.getenv("TRIBE_CALLBACK_SECRET") or None,
        tribe_callback_secret_configured=bool(os.getenv("TRIBE_CALLBACK_SECRET", "")),
        huggingface_token_configured=bool(os.getenv("HF_TOKEN", "")),
        tribe_model_id=os.getenv("TRIBE_MODEL_ID", "facebook/tribev2"),
        preprocessing_worker_mode=os.getenv("PREPROCESSING_WORKER_MODE", "mock").lower(),
        preprocessing_temp_dir=os.getenv("PREPROCESSING_TEMP_DIR", "/tmp/praevia-preprocessing"),
        whisper_provider=os.getenv("WHISPER_PROVIDER", "local").lower(),
        whisper_model=os.getenv("WHISPER_MODEL", "small"),
        whisper_device=os.getenv("WHISPER_DEVICE", "cpu"),
        whisper_compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        openai_api_key_configured=bool(os.getenv("OPENAI_API_KEY", "")),
        openai_base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        openai_timeout_seconds=int(os.getenv("OPENAI_TIMEOUT_SECONDS", "60")),
        llm_interpreter_model=os.getenv("LLM_INTERPRETER_MODEL", os.getenv("LLM_REPORT_MODEL", "gpt-5.5-pro")),
        llm_writer_model=os.getenv("LLM_WRITER_MODEL", "gpt-5.5-thinking"),
        llm_writer_reasoning_effort=os.getenv("LLM_WRITER_REASONING_EFFORT", "high"),
        llm_prompt_version=os.getenv("LLM_PROMPT_VERSION", "report-master-v0.1"),
        llm_json_max_retries=int(os.getenv("LLM_JSON_MAX_RETRIES", "2")),
        llm_input_eur_per_1k=float(os.getenv("LLM_INPUT_EUR_PER_1K", "0")),
        llm_output_eur_per_1k=float(os.getenv("LLM_OUTPUT_EUR_PER_1K", "0")),
        report_renderer_mode=os.getenv("REPORT_RENDERER_MODE", "playwright").lower(),
        report_renderer_timeout_seconds=int(os.getenv("REPORT_RENDERER_TIMEOUT_SECONDS", "45")),
    )


settings = load_settings()
