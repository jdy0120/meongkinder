ENV_FILE ?= ./envs/.env
include $(ENV_FILE)
export

.PHONY: dev prod up down network

COMPOSE_FILE ?= ci/docker-composes/docker-compose.dev.yaml

# dev 환경: .env.dev 사용
dev:
	@$(MAKE) up ENV_FILE=./envs/.env.dev COMPOSE_FILE=ci/docker-composes/docker-compose.dev.yaml

# prod 환경: .env.prod 사용
prod:
	@$(MAKE) up ENV_FILE=./envs/.env.prod COMPOSE_FILE=ci/docker-composes/docker-compose.prod.yaml

# 네트워크 생성 및 실행
network:
	@docker network inspect $(NETWORK_NAME) >/dev/null 2>&1 || \
	docker network create $(NETWORK_NAME)
up: network
	docker-compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d --build
# 모든 컨테이너 종료 및 볼륨 삭제
down:
	@$(MAKE) down-env ENV_FILE=./envs/.env.dev COMPOSE_FILE=ci/docker-composes/docker-compose.dev.yaml
	@$(MAKE) down-env ENV_FILE=./envs/.env.prod COMPOSE_FILE=ci/docker-composes/docker-compose.prod.yaml
down-env:
	docker-compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) down -v