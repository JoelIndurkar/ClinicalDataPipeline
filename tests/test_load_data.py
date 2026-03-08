import os
import shutil
import runpy
import sqlite3

def conn_for(dbPath):
    conn = sqlite3.connect(dbPath)
    conn.row_factory = sqlite3.Row
    return conn

def test_db_file_created(test_db):
    import os
    assert os.path.exists(test_db)

def test_subjects_count(test_db):
    # 5 unique subjects in the test CSV (sub1-sub5)
    conn = conn_for(test_db)
    row = conn.execute("SELECT COUNT(*) AS cnt FROM subjects").fetchone()
    conn.close()
    assert row["cnt"] == 5

def test_samples_count(test_db):
    # 10 unique samples (smp1-smp10)
    conn = conn_for(test_db)
    row = conn.execute("SELECT COUNT(*) AS cnt FROM samples").fetchone()
    conn.close()
    assert row["cnt"] == 10

def test_cell_counts_count(test_db):
    # 10 samples x 5 populations = 50 rows
    conn = conn_for(test_db)
    row = conn.execute("SELECT COUNT(*) AS cnt FROM cell_counts").fetchone()
    conn.close()
    assert row["cnt"] == 50

def test_foreign_keys_samples_to_subjects(test_db):
    # every sample.subject must exist in subjects table
    conn = conn_for(test_db)
    rows = conn.execute("""
        SELECT s.sample FROM samples s
        LEFT JOIN subjects sub ON s.subject = sub.subject
        WHERE sub.subject IS NULL
    """).fetchall()
    conn.close()
    assert len(rows) == 0

def test_foreign_keys_cell_counts_to_samples(test_db):
    # every cell_count.sample must exist in samples table
    conn = conn_for(test_db)
    rows = conn.execute("""
        SELECT cc.id FROM cell_counts cc
        LEFT JOIN samples s ON cc.sample = s.sample
        WHERE s.sample IS NULL
    """).fetchall()
    conn.close()
    assert len(rows) == 0

def test_no_nulls_in_required_columns(test_db):
    # subject, condition, age, sex must never be null
    conn = conn_for(test_db)
    bad = conn.execute("""
        SELECT COUNT(*) AS cnt FROM subjects
        WHERE subject IS NULL OR condition IS NULL OR age IS NULL OR sex IS NULL
    """).fetchone()
    conn.close()
    assert bad["cnt"] == 0

def test_no_nulls_in_cell_count_columns(test_db):
    # population and count must never be null
    conn = conn_for(test_db)
    bad = conn.execute("""
        SELECT COUNT(*) AS cnt FROM cell_counts
        WHERE sample IS NULL OR population IS NULL OR count IS NULL
    """).fetchone()
    conn.close()
    assert bad["cnt"] == 0

def test_null_response_only_for_healthy(test_db):
    # smp10 is the only sample with null response (sub5 = healthy, treatment=none)
    conn = conn_for(test_db)
    rows = conn.execute("SELECT sample FROM samples WHERE response IS NULL").fetchall()
    conn.close()
    samples = [r["sample"] for r in rows]
    assert samples == ["smp10"]

def test_all_populations_per_sample(test_db):
    # every sample should have exactly 5 population rows
    conn = conn_for(test_db)
    rows = conn.execute("""
        SELECT sample, COUNT(*) AS cnt FROM cell_counts GROUP BY sample
    """).fetchall()
    conn.close()
    for row in rows:
        assert row["cnt"] == 5, f"{row['sample']} has {row['cnt']} populations"

def test_treatment_response_on_samples_not_subjects(test_db):
    # subjects table should NOT have treatment or response columns
    conn = conn_for(test_db)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(subjects)").fetchall()]
    conn.close()
    assert "treatment" not in cols
    assert "response" not in cols

def test_treatment_response_exist_on_samples(test_db):
    # samples table should have treatment and response
    conn = conn_for(test_db)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(samples)").fetchall()]
    conn.close()
    assert "treatment" in cols
    assert "response" in cols

def test_main_block(test_csv, tmp_path, monkeypatch):
    # run load_data.py as __main__ via runpy so coverage tracks the if __name__ block
    # the __main__ block calls load_data() with defaults: CSV_PATH and DB_PATH (both relative)
    # chdir to tmp and place test CSV there as cell-count.csv so defaults resolve correctly
    shutil.copy(test_csv, tmp_path / "cell-count.csv")
    monkeypatch.chdir(tmp_path)

    repoRoot = os.path.dirname(os.path.dirname(__file__))
    runpy.run_path(os.path.join(repoRoot, "load_data.py"), run_name="__main__")

    assert (tmp_path / "clinical_data.db").exists()
