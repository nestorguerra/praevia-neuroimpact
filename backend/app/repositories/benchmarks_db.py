from __future__ import annotations

from uuid import UUID

from app.auth import CurrentUser
from app.repositories.db import assert_org_member, connection, jsonb
from app.schemas.benchmarks import (
    BenchmarkCreate,
    BenchmarkItemCreate,
    BenchmarkItemRead,
    BenchmarkRead,
    BenchmarkSnapshotRead,
    ExternalKpiCreate,
    ExternalKpiRead,
)


def _uuid_or_none(value: str):
    return value or None


class BenchmarksDbRepository:
    def create_benchmark(self, payload: BenchmarkCreate, user: CurrentUser) -> BenchmarkRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.benchmarks (
                  organization_id, name, category, sector, channel, duration_label,
                  language, owner_name, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                returning *
                """,
                (
                    payload.organization_id,
                    payload.name,
                    payload.category,
                    payload.sector,
                    payload.channel,
                    payload.duration_label,
                    payload.language,
                    payload.owner_name,
                    user.id,
                ),
            ).fetchone()
            conn.commit()
            return BenchmarkRead(**row)

    def create_item(self, payload: BenchmarkItemCreate, user: CurrentUser) -> BenchmarkItemRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.benchmark_items (
                  organization_id, benchmark_id, scoring_result_id, asset_name, source_label, scores, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s)
                returning *
                """,
                (
                    payload.organization_id,
                    payload.benchmark_id,
                    _uuid_or_none(payload.scoring_result_id),
                    payload.asset_name,
                    payload.source_label,
                    jsonb(payload.scores),
                    user.id,
                ),
            ).fetchone()
            conn.commit()
            return BenchmarkItemRead(
                id=row["id"],
                organization_id=row["organization_id"],
                benchmark_id=row["benchmark_id"],
                asset_name=row["asset_name"],
                scoring_result_id=str(row["scoring_result_id"] or ""),
                source_label=row["source_label"],
                scores=row["scores"] or {},
                created_at=row["created_at"],
            )

    def create_kpi(self, payload: ExternalKpiCreate, user: CurrentUser) -> ExternalKpiRead:
        with connection() as conn:
            assert_org_member(conn, payload.organization_id, user)
            row = conn.execute(
                """
                insert into public.external_kpis (
                  organization_id, benchmark_id, benchmark_item_id, kpi_type, value, unit,
                  source, period, notes, created_by
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                returning *
                """,
                (
                    payload.organization_id,
                    payload.benchmark_id,
                    payload.benchmark_item_id,
                    payload.kpi_type,
                    payload.value,
                    payload.unit,
                    payload.source,
                    payload.period,
                    payload.notes,
                    user.id,
                ),
            ).fetchone()
            conn.commit()
            return ExternalKpiRead(
                id=row["id"],
                organization_id=row["organization_id"],
                benchmark_id=row["benchmark_id"],
                benchmark_item_id=row["benchmark_item_id"],
                kpi_type=row["kpi_type"],
                value=float(row["value"]),
                unit=row["unit"],
                source=row["source"],
                period=row["period"] or "",
                notes=row["notes"] or "",
                created_at=row["created_at"],
            )

    def snapshot(self, organization_id: UUID, user: CurrentUser) -> BenchmarkSnapshotRead:
        with connection() as conn:
            assert_org_member(conn, organization_id, user)
            benchmarks = conn.execute(
                "select * from public.benchmarks where organization_id = %s order by created_at desc",
                (organization_id,),
            ).fetchall()
            items = conn.execute(
                "select * from public.benchmark_items where organization_id = %s order by created_at desc",
                (organization_id,),
            ).fetchall()
            kpis = conn.execute(
                "select * from public.external_kpis where organization_id = %s order by created_at desc",
                (organization_id,),
            ).fetchall()
            return BenchmarkSnapshotRead(
                organization_id=organization_id,
                benchmarks=[BenchmarkRead(**row) for row in benchmarks],
                benchmark_items=[
                    BenchmarkItemRead(
                        id=row["id"],
                        organization_id=row["organization_id"],
                        benchmark_id=row["benchmark_id"],
                        asset_name=row["asset_name"],
                        scoring_result_id=str(row["scoring_result_id"] or ""),
                        source_label=row["source_label"],
                        scores=row["scores"] or {},
                        created_at=row["created_at"],
                    )
                    for row in items
                ],
                external_kpis=[
                    ExternalKpiRead(
                        id=row["id"],
                        organization_id=row["organization_id"],
                        benchmark_id=row["benchmark_id"],
                        benchmark_item_id=row["benchmark_item_id"],
                        kpi_type=row["kpi_type"],
                        value=float(row["value"]),
                        unit=row["unit"],
                        source=row["source"],
                        period=row["period"] or "",
                        notes=row["notes"] or "",
                        created_at=row["created_at"],
                    )
                    for row in kpis
                ],
            )


benchmarks_db_repository = BenchmarksDbRepository()

