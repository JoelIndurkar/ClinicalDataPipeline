.PHONY: setup pipeline dashboard

setup:
	pip install -r requirements.txt
	cd dashboard && npm install

pipeline:
	python load_data.py
	python analysis.py

dashboard:
	(python -m uvicorn api:app --host 0.0.0.0 --port 8000 & cd dashboard && npm run dev -- --host 0.0.0.0)
