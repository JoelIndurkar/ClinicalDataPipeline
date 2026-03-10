# Clinical Trial Analysis Pipeline
Built as a technical assessment for Teiko Bio to process and visualize immune cell count data from clinical trials.

A clinical trial dashboard built with FastAPI and React. 
Cell count data from a CSV is...
- -> parsed to populate a SQLite database
- -> statistical analysis runs against that database
- -> results are served through an API to an interactive dashboard for exploring immune cell populations across patient groups.

---

## Dashboard Screenshots

<img width="1095" height="846" alt="InitialRender" src="https://github.com/user-attachments/assets/462f7064-dec6-4108-8b11-2bc5990654ef" />

<img width="1100" height="848" alt="Table" src="https://github.com/user-attachments/assets/08bab921-27cb-446d-a4be-9e645aca4f3b" />

<img width="1100" height="849" alt="StatisticalAnalysis" src="https://github.com/user-attachments/assets/c76f033e-a981-4868-88f9-26d00d61ac17" />

<img width="654" height="477" alt="BoxPlotModal" src="https://github.com/user-attachments/assets/6103bce0-0f9e-4e0b-a40c-6b7890f51acd" />

<img width="1102" height="422" alt="SubsetAnalysis" src="https://github.com/user-attachments/assets/383a1795-653e-42cd-93f0-a9be87c80ddb" />

<img width="1106" height="846" alt="DarkMode" src="https://github.com/user-attachments/assets/46211716-42e4-4fde-a691-3930ee3ec93f" />

---

## Quick Start (Run Code, Reproduce Outputs)

**Prerequisites:** Python 3.10+, Node 20+

```bash
make setup      # install Python and Node dependencies
make pipeline   # load data into SQLite and run analysis
make dashboard  # start API server + React dev server
make test       # run frontend/backend tests (already run on push/pull)
```

**GitHub Codespaces:** both servers bind to `0.0.0.0` so forwarded ports work without any extra config.

1. `make setup` installs Python packages from `requirements.txt` and runs `npm install` in `dashboard/`.
2. `make pipeline` runs `load_data.py` to create `clinical_data.db`, then `analysis.py` to generate summary tables and boxplots in `output/`.
3. `make dashboard` starts the FastAPI server on port 8000 and the Vite dev server on port 5173 concurrently.
   - Dashboard: http://localhost:5173
   - API docs: http://localhost:8000/docs

---

## Technologies Used
- **Backend:** Python, FastAPI, SQLite, uvicorn, pandas, scipy, matplotlib, seaborn
- **Frontend:** React, TypeScript, Vite, Recharts, html2canvas
- **Testing:** pytest, pytest-cov, httpx, Vitest, React Testing Library, jsdom
- **CI:** GitHub Actions
- **Infrastructure:** Makefile, GitHub Codespaces

---

## Code Structure

```
load_data.py        parse CSV and populate SQLite
analysis.py         Parts 2-4: frequency table, stats, boxplots
api.py              FastAPI endpoints serving JSON to the dashboard
src/
  db.py             schema definition and connection helper
  stats.py          statistical utility functions
dashboard/
  src/
    App.tsx         nav, dark mode, scroll tracking
    components/     DataTable, BoxplotSection, FilterBar, SchemaOverview, SettingsPanel, SubsetAnalysis
    __tests__/      Frontend testing
output/             generated CSV tables and PNG plots (from make pipeline)
tests/              Backend testing
```

The frontend has no business logic. All aggregation and statistical computation happens in the backend. The React components handle rendering and interaction while the API handles the numbers.

Data goes into SQLite rather than staying in memory to keep the API stateless. Each request opens a connection, runs a query, and closes it. Nothing persists between requests, which makes the API straightforward to develop and test.

---

## Database Schema

Three tables:

```
subjects     subject (PK), condition, age, sex
samples      sample (PK), subject (FK), project, sample_type,
             time_from_treatment_start, treatment, response
cell_counts  id (PK), sample (FK), population, count
```

---

### Design Choices

**Schema/Data Management:**
- **3 Tables** to store `subjects`, `samples`, and `cell_counts`.
- **Treatment and response come from `samples` not `subjects`.** A subject can have samples at multiple timepoints, across projects, under different treatments. Collapsing treatment and response onto the subject row loses that variation entirely. The Part 4 query to filter by condition, sample type, treatment, and timepoint together can't be written correctly if those columns live on different tables. On `samples`, each filter is a WHERE clause against one table.
- **Cell counts stored as rows, not columns.** The source CSV has one row per sample with five population columns. Keeping that structure means a schema migration every time a new population is added. As rows in `cell_counts`, adding a population is just another entry.
- **Foreign keys enabled explicitly.** SQLite disables FK enforcement by default. The connection helper turns it on per connection to guarantee referential integrity.
- Setup allows for precise queries as opposed to general querying and additional Python computation in the backend

**Backend:**
- **FastAPI** as it autgenerates OpenAPI docs. It was my first time using but other setups seemed like overkill for a non-authenticated api only needing GET support.

**Stat Overview**
- **Mann-Whitney U** to analyze nonnormal data.
- **Checked p<0.05** to verify a significant comparison.

**Frontend:**
- **Followed the general theming and design of the Teiko dashboard**
- **React + TypeScript + Vite** has good templating to work off, has great testing support, and I have the most experience in these technologies. Personally prefer the professional look of React components, and library support opens up the doors for many UI/UX improvements.
- **Added search/filtering/csv-export to table** for part 3, to manage the large amount of data.
- **Boxplots Visualization** Tooltip on boxplot hover to show stats, larger view when boxplot is clicked that include PNG upload. Added to make the graph analysis experience smoother to view and share the data. Recharts for visualization.

**Testing:**
- **Added testing suites to CI (Github Actions)** to verify functionality of the API and frontend design and to provide a baseline for future development. 100% coverage across frontend and backend. 

---

### Scaling, if there were hundreds of projects, thousands of samples and various types of analytics to perform

The three-table structure enables scalability. The joins in the boxplot and stats queries are simple lookups on primary keys. Indexing on samples(condition, sample_type, treatment) and cell_counts(sample, population) would cover the common filter patterns once row counts get too big. New populations don't require schema changes. New analytics (cut by one or more of project, timepoint, and sex) are new queries against the same three tables. If SQLite becomes a bottleneck at large scale, the queries are standard SQL and the migration path to Postgres is mostly a connection string swap.

On the frontend side, the summary endpoint currently loads all rows client-side for pagination. At larger scale I'd implement server-side pagination with LIMIT/OFFSET queries and add API-level caching for expensive operations.

For a production system, the backend would need auth (JWT or OAuth), rate limiting, and input validation on query params. The main migration would be SQLite to Postgres for concurrent writes and connection pooling, but the queries are standard SQL so that would be straightforward. For heavier analytics, I'd add background job processing rather than computing on request.

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
/>
