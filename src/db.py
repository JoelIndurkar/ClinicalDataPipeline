import sqlite3

DB_PATH = "clinical_data.db"
POPULATIONS = ["b_cell", "cd8_t_cell", "cd4_t_cell", "nk_cell", "monocyte"]

def get_connection(db_path: str = DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_schema(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS subjects (
            subject TEXT PRIMARY KEY,
            condition TEXT,
            age INTEGER,
            sex TEXT
        );

        CREATE TABLE IF NOT EXISTS samples (
            sample TEXT PRIMARY KEY,
            subject TEXT NOT NULL,
            project TEXT,
            sample_type TEXT,
            time_from_treatment_start INTEGER,
            treatment TEXT,
            response TEXT,
            FOREIGN KEY (subject) REFERENCES subjects(subject)
        );

        CREATE TABLE IF NOT EXISTS cell_counts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sample TEXT NOT NULL,
            population TEXT,
            count INTEGER,
            FOREIGN KEY (sample) REFERENCES samples(sample)
        );
    """)
    conn.commit()
