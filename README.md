# Teiko Clinical Trial Analysis

A clinical trial dashboard built with FastAPI and React. Cell count data from a CSV gets loaded into a normalized SQLite database, statistical analysis runs against that database, and the results are served through an API to an interactive dashboard for exploring immune cell populations across patient cohorts.

**Dashboard:** http://localhost:5173

---

## Quick Start

**Prerequisites:** Python 3.10+, Node 20+

```bash
make setup      # install Python and Node dependencies
make pipeline   # load data into SQLite and run analysis
make dashboard  # start API server + React dev server
```

**GitHub Codespaces:** both servers bind to `0.0.0.0` so the forwarded ports work without any extra configuration.

1. `make setup` installs Python packages from `requirements.txt` and runs `npm install` in `dashboard/`.
2. `make pipeline` runs `load_data.py` to create `clinical_data.db`, then `analysis.py` to generate summary tables and boxplots in `output/`.
3. `make dashboard` starts the FastAPI server on port 8000 and the Vite dev server on port 5173 concurrently.
   - Dashboard: http://localhost:5173
   - API docs: http://localhost:8000/docs

---

## Database Schema

Three tables:

```
subjects     subject (PK), condition, age, sex
samples      sample (PK), subject (FK), project, sample_type,
             time_from_treatment_start, treatment, response
cell_counts  id (PK), sample (FK), population, count
```

### Design

**Treatment and response live on `samples`, not `subjects`.** A subject can have samples at multiple timepoints, across projects, under different treatments. Collapsing treatment and response onto the subject row loses that variation entirely. The Part 4 query - filter by condition, sample type, treatment, and timepoint simultaneously - can't be written correctly if those columns live on different tables. Keeping them on `samples` means every filter is a WHERE clause against one table.

**Cell counts are stored as rows, not columns.** The source CSV has one row per sample with five population columns. Keeping that structure means a schema migration every time a new population is added. As rows in `cell_counts`, adding a population is just new data.

**Foreign keys are enabled explicitly.** SQLite disables FK enforcement by default. The connection helper turns it on per connection so referential integrity is actually guaranteed, not assumed.

### Scaling

The three-table structure holds up well at scale. The joins in the boxplot and stats queries are straightforward lookups on primary keys. Adding indexes on `samples(condition, sample_type, treatment)` and `cell_counts(sample, population)` would cover the common filter patterns once row counts get large enough to matter. New populations don't require schema changes. New analytics - cut by project, timepoint, sex, or any combination - are new queries against the same three tables. If SQLite becomes a bottleneck at millions of rows, the queries are standard SQL and the migration path to Postgres is mostly a connection string swap.

---

## Code Structure

```
load_data.py        ingest CSV into SQLite (idempotent, safe to re-run)
analysis.py         Parts 2-4: frequency table, Mann-Whitney stats, boxplots
api.py              FastAPI endpoints serving JSON to the dashboard
src/
  db.py             schema definition and connection helper
  stats.py          statistical utility functions
dashboard/
  src/
    App.tsx         nav, dark mode, scroll tracking
    components/     DataTable, BoxplotSection, FilterBar, etc.
output/             generated CSV tables and PNG plots (from make pipeline)
```

The pipeline and the API are intentionally separate. `load_data.py` and `analysis.py` run once to build the database and write static outputs. The API reads from that database at request time. This separation allows the dashboard to support dynamic filtering - changing condition, treatment, or sample type - without re-running the analysis.

The frontend has no business logic. All aggregation and statistical computation happens in the backend. The React components handle rendering and interaction; the API handles the numbers.

Data goes into SQLite rather than staying in memory because it keeps the API stateless. Each request opens a connection, runs a query, and closes it. Nothing persists between requests, which makes the API straightforward to reason about and test.

---

## Testing

**Backend** (pytest with coverage):
```bash
python3 -m pytest tests/ -v --cov=. --cov-report=term-missing
```

**Frontend** (vitest with coverage):
```bash
cd dashboard && npm run test:coverage
```

- The backend achieves 100% coverage on `api.py`, `load_data.py`, and `src/db.py`.
- The frontend sits at 99.5% statements and 100% lines and functions across all components.
- CI runs on every push and pull request to `main` with GitHub Actions.
