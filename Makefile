.PHONY: dev test burp docker

dev:
	uvicorn app.main:app --reload --port 8080

test:
	pytest -q

burp:
	gradle -p burp-extension clean jar

docker:
	docker build -t star-cyber-ai-x:local .
