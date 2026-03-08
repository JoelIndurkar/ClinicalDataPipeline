"""
API endpoint tests. All assertions use the known test CSV data from conftest.py.

Test data summary:
  5 subjects, 10 samples, 50 cell count rows
  Mel+PBMC+miraclib responders (response=yes): smp1, smp2, smp5, smp6
  Mel+PBMC+miraclib non-responders (response=no): smp3, smp4
  Mel+PBMC+miraclib+time=0: smp1(prj1,M,yes), smp3(prj1,F,no), smp5(prj2,M,yes)
  avg b_cells for M+responder+time=0: (1000+3000)/2 = 2000.0
"""

def test_schema_info_200(client):
    resp = client.get("/api/schema-info")
    assert resp.status_code == 200

def test_schema_info_three_tables(client):
    data = client.get("/api/schema-info").json()
    assert len(data["tables"]) == 3
    names = [t["name"] for t in data["tables"]]
    assert names == ["subjects", "samples", "cell_counts"]

def test_schema_info_row_counts(client):
    data = client.get("/api/schema-info").json()
    counts = {t["name"]: t["row_count"] for t in data["tables"]}
    assert counts["subjects"] == 5
    assert counts["samples"] == 10
    assert counts["cell_counts"] == 50

def test_schema_info_content_type(client):
    resp = client.get("/api/schema-info")
    assert "application/json" in resp.headers["content-type"]

def test_summary_200(client):
    resp = client.get("/api/summary")
    assert resp.status_code == 200

def test_summary_row_count(client):
    # 10 samples x 5 populations = 50 rows
    data = client.get("/api/summary").json()
    assert len(data) == 50

def test_summary_fields(client):
    data = client.get("/api/summary").json()
    row = data[0]
    assert "sample" in row
    assert "total_count" in row
    assert "population" in row
    assert "count" in row
    assert "percentage" in row

def test_summary_percentages_sum_to_100(client):
    data = client.get("/api/summary").json()
    # group by sample and sum percentages - should be ~100 per sample
    from collections import defaultdict
    totals = defaultdict(float)
    for row in data:
        totals[row["sample"]] += row["percentage"]
    for sample, total in totals.items():
        assert abs(total - 100.0) < 0.1, f"{sample} percentages sum to {total}"

def test_summary_content_type(client):
    resp = client.get("/api/summary")
    assert "application/json" in resp.headers["content-type"]

def test_boxplot_data_200(client):
    resp = client.get("/api/boxplot-data")
    assert resp.status_code == 200

def test_boxplot_data_all_populations(client):
    data = client.get("/api/boxplot-data").json()
    expected = {"b_cell", "cd4_t_cell", "cd8_t_cell", "nk_cell", "monocyte"}
    assert set(data.keys()) == expected

def test_boxplot_data_has_responder_and_non_responder(client):
    data = client.get("/api/boxplot-data").json()
    for pop, groups in data.items():
        assert "responder" in groups, f"{pop} missing responder"
        assert "non_responder" in groups, f"{pop} missing non_responder"
        # test data has 4 responders and 2 non-responders for mel+PBMC+miraclib
        assert len(groups["responder"]) == 4
        assert len(groups["non_responder"]) == 2

def test_boxplot_data_b_cell_responder_values(client):
    # smp1: 1000/8000=12.5, smp2: 1100/8500~12.94, smp5: 3000/15000=20.0, smp6: 3100/15500=20.0
    data = client.get("/api/boxplot-data").json()
    respVals = sorted(data["b_cell"]["responder"])
    assert 12.5 in respVals
    assert 20.0 in respVals

def test_boxplot_data_custom_params(client):
    # filter to carcinoma+PBMC+phauximab -> smp7 only (1 non-responder, 0 responders)
    resp = client.get("/api/boxplot-data?condition=carcinoma&sample_type=PBMC&treatment=phauximab")
    assert resp.status_code == 200
    data = resp.json()
    # smp7 is carcinoma+PBMC+phauximab+response=no so non_responder arrays have 1 item
    for pop, groups in data.items():
        assert len(groups["non_responder"]) == 1
        assert len(groups["responder"]) == 0

def test_boxplot_data_no_match_returns_empty(client):
    resp = client.get("/api/boxplot-data?condition=nonexistent&sample_type=PBMC&treatment=miraclib")
    assert resp.status_code == 200
    assert resp.json() == {}

def test_boxplot_data_content_type(client):
    resp = client.get("/api/boxplot-data")
    assert "application/json" in resp.headers["content-type"]

def test_stats_200(client):
    resp = client.get("/api/stats")
    assert resp.status_code == 200

def test_stats_five_entries(client):
    data = client.get("/api/stats").json()
    assert len(data) == 5

def test_stats_fields(client):
    data = client.get("/api/stats").json()
    entry = data[0]
    assert "population" in entry
    assert "u_statistic" in entry
    assert "p_value" in entry
    assert "significant" in entry


def test_stats_significant_is_boolean(client):
    data = client.get("/api/stats").json()
    for entry in data:
        assert isinstance(entry["significant"], bool)

def test_stats_significant_matches_p_value(client):
    data = client.get("/api/stats").json()
    for entry in data:
        expected = entry["p_value"] < 0.05
        assert entry["significant"] == expected

def test_stats_populations_sorted(client):
    data = client.get("/api/stats").json()
    pops = [e["population"] for e in data]
    assert pops == sorted(pops)

def test_stats_content_type(client):
    resp = client.get("/api/stats")
    assert "application/json" in resp.headers["content-type"]

def test_subset_200(client):
    resp = client.get("/api/subset")
    assert resp.status_code == 200

def test_subset_fields(client):
    data = client.get("/api/subset").json()
    assert "samples_per_project" in data
    assert "responder_count" in data
    assert "non_responder_count" in data
    assert "male_count" in data
    assert "female_count" in data
    assert "avg_b_cells" in data

def test_subset_avg_b_cells_is_float(client):
    data = client.get("/api/subset").json()
    assert isinstance(data["avg_b_cells"], float)

def test_subset_exact_values(client):
    # mel+PBMC+miraclib+time=0: smp1(prj1,M,yes), smp3(prj1,F,no), smp5(prj2,M,yes)
    data = client.get("/api/subset").json()
    assert data["samples_per_project"] == {"prj1": 2, "prj2": 1}
    assert data["responder_count"] == 2
    assert data["non_responder_count"] == 1
    assert data["male_count"] == 2
    assert data["female_count"] == 1
    # avg b_cells for M+responder: (smp1=1000 + smp5=3000) / 2 = 2000.0
    assert data["avg_b_cells"] == 2000.0

def test_subset_content_type(client):
    resp = client.get("/api/subset")
    assert "application/json" in resp.headers["content-type"]
