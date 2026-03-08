"""
Tests for analysis.py. Matplotlib already uses the Agg backend (set at module top)
so all of this runs headless with no display needed.
"""
import os
import sys
import shutil
import runpy
import pandas as pd
import pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from src.db import get_connection
import analysis


@pytest.fixture(scope="session")
def analysis_df(test_db):
    conn = get_connection(test_db)
    df = analysis.get_data(conn)
    conn.close()
    return df

def test_get_data_returns_dataframe(analysis_df):
    assert isinstance(analysis_df, pd.DataFrame)

def test_get_data_row_count(analysis_df):
    assert len(analysis_df) == 50 # 10 samples x 5 populations = 50 rows

def test_get_data_columns(analysis_df):
    expected = {
        "sample", "subject", "project", "sample_type",
        "time_from_treatment_start", "treatment", "response",
        "condition", "age", "sex", "population", "count",
    }
    assert expected.issubset(set(analysis_df.columns))

def test_part2_row_count(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    result = analysis.part2(analysis_df)
    assert len(result) == 50 # one row per sample+population combo

def test_part2_has_percentage_column(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    result = analysis.part2(analysis_df)
    assert "percentage" in result.columns

def test_part2_percentages_sum_to_100(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    result = analysis.part2(analysis_df)
    totals = result.groupby("sample")["percentage"].sum()
    for sample, total in totals.items():
        assert abs(total - 100.0) < 0.01, f"{sample} sums to {total}"

def test_part2_writes_csv(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    analysis.part2(analysis_df)
    assert os.path.exists("output/part2_summary.csv")

def test_part3_stats_has_five_populations(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    _, statsDf = analysis.part3(analysis_df)
    assert len(statsDf) == 5

def test_part3_stats_columns(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    _, statsDf = analysis.part3(analysis_df)
    for col in ["population", "u_statistic", "p_value", "n_responders", "n_non_responders"]:
        assert col in statsDf.columns

def test_part3_filtered_has_percentage(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    filtered, _ = analysis.part3(analysis_df)
    assert "percentage" in filtered.columns

def test_part3_writes_csv_and_png(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    analysis.part3(analysis_df)
    assert os.path.exists("output/part3_stats.csv")
    assert os.path.exists("output/part3_boxplots.png")

def test_part3_single_population_branch(analysis_df, tmp_path, monkeypatch):
    # when only 1 population exists, plt.subplots returns single Axes array
    # line: if len(populations) == 1 then axes = [axes]
    # pass a df filtered to b_cell only so part3 ends up with 1 population
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    singlePopDf = analysis_df[analysis_df["population"] == "b_cell"].copy()
    _, statsDf = analysis.part3(singlePopDf)
    assert len(statsDf) == 1
    assert statsDf.iloc[0]["population"] == "b_cell"


def test_part4_returns_dataframe(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    result = analysis.part4(analysis_df)
    assert isinstance(result, pd.DataFrame)


def test_part4_filters_to_time_zero(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    result = analysis.part4(analysis_df)
    assert (result["time_from_treatment_start"] == 0).all()


def test_part4_writes_csv(analysis_df, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    analysis.part4(analysis_df)
    assert os.path.exists("output/part4_subset.csv")


def test_main_block(test_db, tmp_path, monkeypatch):
    # run analysis.py as __main__ via runpy so coverage tracks the if __name__ block
    # __main__ calls get_connection() which connects to "clinical_data.db" in cwd
    shutil.copy(test_db, tmp_path / "clinical_data.db")
    (tmp_path / "output").mkdir()
    monkeypatch.chdir(tmp_path)

    repoRoot = os.path.dirname(os.path.dirname(__file__))
    runpy.run_path(os.path.join(repoRoot, "analysis.py"), run_name="__main__")

    assert (tmp_path / "output" / "part2_summary.csv").exists()
    assert (tmp_path / "output" / "part3_boxplots.png").exists()
    assert (tmp_path / "output" / "part4_subset.csv").exists()


def test_part4_avg_b_cells_correct(analysis_df, tmp_path, monkeypatch):
    # mel+PBMC+miraclib+time=0+M+responder, smp1(b_cell=1000) smp5(b_cell=3000)
    # avg = 2000.0
    monkeypatch.chdir(tmp_path)
    os.makedirs("output")
    filtered = analysis.part4(analysis_df)
    avgBCell = filtered[
        (filtered["population"] == "b_cell") &
        (filtered["sex"] == "M") &
        (filtered["response"] == "yes")
    ]["count"].mean()
    assert avgBCell == 2000.0
