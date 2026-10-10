.PHONY: dev test burp docker

dev:
	uvicorn app.main:app --reload --port 8080

test:
	python -m pytest -q

burp:
	mvn -B -f burp-extension/pom.xml clean package

docker:
	docker build -t star-cyber-ai-x:local .
