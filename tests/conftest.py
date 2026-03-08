import os
import sys
import sqlite3
import pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__))) # make sure repo root is on the path so we can import load_data, api, src.db
import load_data
import api
from fastapi.testclient import TestClient

TEST_CSV_ROWS = [
    "sub1,melanoma,45,M,smp1,prj1,PBMC,0,miraclib,yes,1000,2000,3000,500,1500",
    "sub1,melanoma,45,M,smp2,prj1,PBMC,7,miraclib,yes,1100,2100,3100,600,1600",
    "sub1,melanoma,45,M,smp9,prj1,WB,0,miraclib,yes,700,1700,2700,350,1350",
    "sub2,melanoma,38,F,smp3,prj1,PBMC,0,miraclib,no,800,1800,2800,400,1400",
    "sub2,melanoma,38,F,smp4,prj1,PBMC,7,miraclib,no,900,1900,2900,450,1450",
    "sub3,melanoma,52,M,smp5,prj2,PBMC,0,miraclib,yes,3000,4000,5000,1000,2000",
    "sub3,melanoma,52,M,smp6,prj2,PBMC,14,miraclib,yes,3100,4100,5100,1100,2100",
    "sub4,carcinoma,29,F,smp7,prj2,PBMC,0,phauximab,no,500,1000,1500,200,800",
    "sub4,carcinoma,29,F,smp8,prj2,WB,0,phauximab,no,600,1100,1600,300,900",
    "sub5,healthy,25,F,smp10,prj1,PBMC,0,none,,200,500,800,100,400",
]

HEADER = "subject,condition,age,sex,sample,project,sample_type,time_from_treatment_start,treatment,response,b_cell,cd8_t_cell,cd4_t_cell,nk_cell,monocyte"

@pytest.fixture(scope="session")
def test_csv(tmp_path_factory):
    d = tmp_path_factory.mktemp("data")
    csvPath = d / "test.csv"
    csvPath.write_text(HEADER + "\n" + "\n".join(TEST_CSV_ROWS) + "\n")
    return str(csvPath)

@pytest.fixture(scope="session")
def test_db(test_csv, tmp_path_factory):
    d = tmp_path_factory.mktemp("db")
    dbPath = str(d / "test.db")
    load_data.load_data(test_csv, dbPath)
    return dbPath

@pytest.fixture(scope="session")
def client(test_db):
    mp = pytest.MonkeyPatch() # patch the module-level DB_PATH so all endpoints hit the test DB
    mp.setattr(api, "DB_PATH", test_db)
    with TestClient(api.app) as c:
        yield c
    mp.undo()
