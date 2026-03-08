import os
import sqlite3
import pytest
from fastapi.testclient import TestClient
import api
import load_data
from src.db import get_connection, init_schema

HEADER = "subject,condition,age,sex,sample,project,sample_type,time_from_treatment_start,treatment,response,b_cell,cd8_t_cell,cd4_t_cell,nk_cell,monocyte"

def test_load_data_empty_csv(tmp_path):
    # empty CSV (headers only) should create tables with 0 rows and not crash
    csvPath = tmp_path / "empty.csv"
    csvPath.write_text(HEADER + "\n")
    dbPath = str(tmp_path / "empty.db")

    load_data.load_data(str(csvPath), dbPath)

    conn = sqlite3.connect(dbPath)
    conn.row_factory = sqlite3.Row
    assert conn.execute("SELECT COUNT(*) AS c FROM subjects").fetchone()["c"] == 0
    assert conn.execute("SELECT COUNT(*) AS c FROM samples").fetchone()["c"] == 0
    assert conn.execute("SELECT COUNT(*) AS c FROM cell_counts").fetchone()["c"] == 0
    conn.close()

def test_api_empty_db_boxplot_returns_empty(tmp_path):
    # boxplot-data with an empty DB returns {} not a 500
    dbPath = str(tmp_path / "empty.db")
    conn = get_connection(dbPath)
    init_schema(conn)
    conn.close()

    mp = pytest.MonkeyPatch()
    mp.setattr(api, "DB_PATH", dbPath)
    with TestClient(api.app) as c:
        resp = c.get("/api/boxplot-data")
    mp.undo()

    assert resp.status_code == 200
    assert resp.json() == {}

def test_api_empty_db_stats_returns_empty_list(tmp_path):
    # stats with an empty DB returns [] not a 500
    dbPath = str(tmp_path / "empty.db")
    conn = get_connection(dbPath)
    init_schema(conn)
    conn.close()

    mp = pytest.MonkeyPatch()
    mp.setattr(api, "DB_PATH", dbPath)
    with TestClient(api.app) as c:
        resp = c.get("/api/stats")
    mp.undo()

    assert resp.status_code == 200
    assert resp.json() == []

def test_api_no_matching_filter_boxplot(client):
    # query params that match zero rows -> empty dict, not a crash
    resp = client.get("/api/boxplot-data?condition=healthy&sample_type=WB&treatment=none")
    # healthy patients have null response so IN ('yes','no') excludes them
    assert resp.status_code == 200
    assert resp.json() == {}

def test_api_no_matching_filter_stats(client):
    resp = client.get("/api/stats?condition=nonexistent&sample_type=PBMC&treatment=miraclib")
    assert resp.status_code == 200
    assert resp.json() == []

def test_zero_count_summary_no_crash(tmp_path):
    # a sample with all-zero cell counts: SQLite returns NULL for 0/0 division
    # the API should return the row (with None percentage) without crashing
    dbPath = str(tmp_path / "zeros.db")
    conn = get_connection(dbPath)
    init_schema(conn)
    conn.execute("INSERT INTO subjects VALUES ('z1','melanoma',30,'M')")
    conn.execute("INSERT INTO samples VALUES ('zs1','z1','prj1','PBMC',0,'miraclib','yes')")
    for pop in ["b_cell", "cd8_t_cell", "cd4_t_cell", "nk_cell", "monocyte"]:
        conn.execute("INSERT INTO cell_counts (sample, population, count) VALUES (?,?,0)", ("zs1", pop))
    conn.commit()
    conn.close()

    mp = pytest.MonkeyPatch()
    mp.setattr(api, "DB_PATH", dbPath)
    with TestClient(api.app) as c:
        resp = c.get("/api/summary")
    mp.undo()

    assert resp.status_code == 200
    # SQLite returns NULL for 0/0, so percentage comes back as None - no crash
    data = resp.json()
    assert len(data) == 5
    for row in data:
        assert row["percentage"] is None


def test_healthy_null_response_excluded_from_boxplot(client):
    # smp10 (healthy, response=null) must not appear in boxplot-data
    # because the query filters response IN ('yes','no')
    # smp10 is healthy+PBMC+none treatment so it won't match mel+miraclib anyway,
    # but even if filters are changed to include healthy condition, null response is excluded
    resp = client.get("/api/boxplot-data?condition=healthy&sample_type=PBMC&treatment=none")
    assert resp.status_code == 200
    # null response is excluded by the SQL WHERE clause so result is empty
    assert resp.json() == {}


def test_load_data_is_idempotent(test_csv, tmp_path):
    # running load_data twice should not double the rows (it deletes before inserting)
    dbPath = str(tmp_path / "idem.db")
    load_data.load_data(test_csv, dbPath)
    load_data.load_data(test_csv, dbPath)

    conn = sqlite3.connect(dbPath)
    conn.row_factory = sqlite3.Row
    subjectCount = conn.execute("SELECT COUNT(*) AS c FROM subjects").fetchone()["c"]
    conn.close()
    assert subjectCount == 5
