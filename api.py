import sqlite3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    conn.row_factory = sqlite3.Row
    return conn


@app.get("/api/summary")
def get_summary(): # for ea sample, compute total count then ea population's count and %
    conn = get_db()
    try:
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
    finally:
        conn.close()

    return [dict(row) for row in rows]


@app.get("/api/boxplot-data")
def get_boxplot_data(): # filter mel + PBMC + miraclib, compute %/population/sample
    # bucket by responder vs non_responder ->
    conn = get_db()
    try:
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
            WHERE sub.condition = 'melanoma'
              AND s.sample_type = 'PBMC'
              AND s.treatment = 'miraclib'
              AND s.response IN ('yes', 'no')
            ORDER BY cc.population, s.response
        """).fetchall()
    finally:
        conn.close()

    
    result = {}
    for row in rows:
        pop = row["population"]
        resp = "responder" if row["response"] == "yes" else "non_responder" # map yes/no to responder/non_responder for the frontend
        pct = row["percentage"]
        if pop not in result:
            result[pop] = {"responder": [], "non_responder": []}
        result[pop][resp].append(pct)

    return result
