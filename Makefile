ENV_FILE ?= ./envs/.env
include $(ENV_FILE)
export

.PHONY: dev prod up down network clean

COMPOSE_FILE ?= ci/docker-composes/docker-compose.dev.yaml

# dev 환경: .env.dev 사용
dev:
	@$(MAKE) up ENV_FILE=./envs/.env.dev COMPOSE_FILE=ci/docker-composes/docker-compose.dev.yaml

# prod 환경: .env.prod 사용
# 외부 트래픽/TLS 는 서버 공용 엣지 프록시(ci/edge/ 참고)가 담당합니다.
prod:
	@$(MAKE) up ENV_FILE=./envs/.env.prod COMPOSE_FILE=ci/docker-composes/docker-compose.prod.yaml

# 네트워크 생성 및 실행
network:
	@docker network inspect $(NETWORK_NAME) >/dev/null 2>&1 || \
	docker network create $(NETWORK_NAME)
	@docker network inspect $(if $(EDGE_NETWORK_NAME),$(EDGE_NETWORK_NAME),edge) >/dev/null 2>&1 || \
	docker network create $(if $(EDGE_NETWORK_NAME),$(EDGE_NETWORK_NAME),edge)
up: network
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d --build
# 모든 컨테이너 종료 (볼륨은 보존 — DB 데이터·SSL 인증서 유지)
down:
	@$(MAKE) down-env ENV_FILE=./envs/.env.dev COMPOSE_FILE=ci/docker-composes/docker-compose.dev.yaml
	@$(MAKE) down-env ENV_FILE=./envs/.env.prod COMPOSE_FILE=ci/docker-composes/docker-compose.prod.yaml
down-env:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) down

# 모든 컨테이너 종료 + 볼륨 완전 삭제 (DB 데이터 포함)
# SSL 인증서는 엣지 프록시(ci/edge/)의 볼륨에 있으므로 영향받지 않습니다.
clean:
	@$(MAKE) clean-env ENV_FILE=./envs/.env.dev COMPOSE_FILE=ci/docker-composes/docker-compose.dev.yaml
	@$(MAKE) clean-env ENV_FILE=./envs/.env.prod COMPOSE_FILE=ci/docker-composes/docker-compose.prod.yaml
clean-env:
	docker compose -p $(PROJECT_NAME) --env-file $(ENV_FILE) -f $(COMPOSE_FILE) down -v