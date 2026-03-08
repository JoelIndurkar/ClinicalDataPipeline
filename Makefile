.PHONY: setup pipeline dashboard test

setup:
	pip install -r requirements.txt
	cd dashboard && npm install

pipeline:
	python3 load_data.py
	python3 analysis.py

dashboard:
	(python3 -m uvicorn api:app --host 0.0.0.0 --port 8000 & cd dashboard && npm run dev -- --host 0.0.0.0)

test:
	python3 -m pytest tests/ -v --cov=. --cov-report=term-missing
