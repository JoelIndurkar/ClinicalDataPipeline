import sqlite3
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from scipy import stats

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "clinical_data.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # to access cols by name
    return conn

@app.get("/api/schema-info")
def get_schema_info(): # returns table names, columns, and row counts
    conn = get_db()
    try:
        tables = [
            {
                "name": "subjects",
                "columns": ["subject", "condition", "age", "sex"],
            },
            {
                "name": "samples",
                "columns": ["sample", "subject", "project", "sample_type", "time_from_treatment_start", "treatment", "response"],
            },
            {
                "name": "cell_counts",
                "columns": ["id", "sample", "population", "count"],
            },
        ]
        for t in tables:
            row = conn.execute(f"SELECT COUNT(*) AS cnt FROM {t['name']}").fetchone()
            t["row_count"] = row["cnt"]
    finally:
        conn.close()

    return {"tables": tables}


@app.get("/api/summary")
def get_summary(): # for ea sample, compute total count then ea population's count and %
    # all math done in SQL. no Python loops over rows. subquery gets totals, join computes %
    conn = get_db()
    try:
        # subquery gets per sample tots
        # join to get ea pop's share
        rows = conn.execute("""
            SELECT
                cc.sample,
                totals.total_count,
                cc.population,
                cc.count,
                ROUND(cc.count * 100.0 / totals.total_count, 2) AS percentage
            FROM cell_counts cc
            JOIN (
                SELECT sample, SUM(count) AS total_count
                FROM cell_counts
                GROUP BY sample
            ) totals ON cc.sample = totals.sample
            ORDER BY cc.sample, cc.population
        """).fetchall()
    finally:  # guarantee conn closes even if query fails
        conn.close()

    return [dict(row) for row in rows]

@app.get("/api/boxplot-data")
def get_boxplot_data(
    condition: str = Query(default="melanoma"),
    sample_type: str = Query(default="PBMC"),
    treatment: str = Query(default="miraclib"),
): # compute %/population/sample, filter by condition+sample_type+treatment - math done in SQL
    conn = get_db()
    try:
        # treatment/response from samples, condition/sex from subjects
        rows = conn.execute("""
            SELECT
                cc.population,
                s.response,
                ROUND(cc.count * 100.0 / totals.total_count, 2) AS percentage
            FROM cell_counts cc
            JOIN samples s ON cc.sample = s.sample
            JOIN subjects sub ON s.subject = sub.subject
            JOIN (
                SELECT sample, SUM(count) AS total_count
                FROM cell_counts
                GROUP BY sample
            ) totals ON cc.sample = totals.sample
            WHERE sub.condition = ?
              AND s.sample_type = ?
              AND s.treatment = ?
              AND s.response IN ('yes', 'no')  -- exclude healthy (null response)
            ORDER BY cc.population, s.response
        """, (condition, sample_type, treatment)).fetchall()
    finally:
        conn.close()

    # bucket = {population: {responder: [...], non_responder: [...]}}
    result = {}
    for row in rows:
        pop = row["population"]
        resp = "responder" if row["response"] == "yes" else "non_responder" # map yes/no to responder/non_responder for the frontend
        pct = row["percentage"]
        if pop not in result:
            result[pop] = {"responder": [], "non_responder": []}
        result[pop][resp].append(pct)

    return result

@app.get("/api/stats")
def get_stats(
    condition: str = Query(default="melanoma"),
    sample_type: str = Query(default="PBMC"),
    treatment: str = Query(default="miraclib"),
): # Mann-Whitney U per population, same filter as boxplot-data
    conn = get_db()
    try:
        # unrounded bc mannwhitneyu works on raw floats
        rows = conn.execute("""
            SELECT
                cc.population,
                s.response,
                cc.count * 100.0 / totals.total_count AS percentage
            FROM cell_counts cc
            JOIN samples s ON cc.sample = s.sample
            JOIN subjects sub ON s.subject = sub.subject
            JOIN (
                SELECT sample, SUM(count) AS total_count
                FROM cell_counts
                GROUP BY sample
            ) totals ON cc.sample = totals.sample
            WHERE sub.condition = ?
              AND s.sample_type = ?
              AND s.treatment = ?
              AND s.response IN ('yes', 'no')
            ORDER BY cc.population
        """, (condition, sample_type, treatment)).fetchall()
    finally:
        conn.close()

    groups = {}
    for row in rows:
        pop = row["population"]
        resp = "responder" if row["response"] == "yes" else "non_responder"
        if pop not in groups: # group % by pop and response
            groups[pop] = {"responder": [], "non_responder": []}
        groups[pop][resp].append(row["percentage"])

    result = []
    for pop, popData in sorted(groups.items()):
        uStat, pVal = stats.mannwhitneyu(
            popData["responder"], popData["non_responder"], alternative="two-sided"
            # explicit two-sided: scipy 1.7+ changed the default so better to be explicit
        )
        # cast from numpy types since FastAPI can't serialize them directly
        result.append({
            "population": pop,
            "u_statistic": round(float(uStat), 4),
            "p_value": round(float(pVal), 4),
            "significant": bool(pVal < 0.05),
        })

    return result

@app.get("/api/subset")
def get_subset(): # melanoma + PBMC + miraclib + time=0, Part 4 summary stats
    conn = get_db()
    try:
        # samples per project
        projRows = conn.execute("""
            SELECT s.project, COUNT(*) AS cnt
            FROM samples s
            JOIN subjects sub ON s.subject = sub.subject
            WHERE sub.condition = 'melanoma'
              AND s.sample_type = 'PBMC'
              AND s.treatment = 'miraclib'
              AND s.time_from_treatment_start = 0
            GROUP BY s.project
        """).fetchall()

        # healthy have null response so IN filters
        # responder vs non counts 
        respRows = conn.execute("""
            SELECT s.response, COUNT(*) AS cnt
            FROM samples s
            JOIN subjects sub ON s.subject = sub.subject
            WHERE sub.condition = 'melanoma'
              AND s.sample_type = 'PBMC'
              AND s.treatment = 'miraclib'
              AND s.time_from_treatment_start = 0
              AND s.response IN ('yes', 'no')
            GROUP BY s.response
        """).fetchall()

        # male vs female counts
        sexRows = conn.execute("""
            SELECT sub.sex, COUNT(*) AS cnt
            FROM samples s
            JOIN subjects sub ON s.subject = sub.subject
            WHERE sub.condition = 'melanoma'
              AND s.sample_type = 'PBMC'
              AND s.treatment = 'miraclib'
              AND s.time_from_treatment_start = 0
            GROUP BY sub.sex
        """).fetchall()

        # avg b cells for male responders only (not all samples in the subset)
        # critical to keep sample_type=PBMC and treatment=miraclib in this subquery for accuracy
        avgRow = conn.execute("""
            SELECT ROUND(AVG(cc.count), 2) AS avg_b
            FROM cell_counts cc
            JOIN samples s ON cc.sample = s.sample
            JOIN subjects sub ON s.subject = sub.subject
            WHERE sub.condition = 'melanoma'
              AND s.sample_type = 'PBMC'
              AND s.treatment = 'miraclib'
              AND s.time_from_treatment_start = 0
              AND s.response = 'yes'
              AND sub.sex = 'M'
              AND cc.population = 'b_cell'
        """).fetchone()
    finally:
        conn.close()

    samplesPerProject = {r["project"]: r["cnt"] for r in projRows}
    respCounts = {r["response"]: r["cnt"] for r in respRows}
    sexCounts = {r["sex"]: r["cnt"] for r in sexRows}

    return {
        "samples_per_project": samplesPerProject,
        "responder_count": respCounts.get("yes", 0),  # .get with default so missing group doesn't crash
        "non_responder_count": respCounts.get("no", 0),
        "male_count": sexCounts.get("M", 0),
        "female_count": sexCounts.get("F", 0),
        "avg_b_cells": avgRow["avg_b"],
    }
