up:
	docker compose -f compose.yaml up -d --build

logs:
	docker compose -f compose.yaml logs -f --tail 200

down:
	docker compose -f compose.yaml down --remove-orphans

down-volumes:
	docker compose -f compose.yaml down -v --remove-orphans

ps:
	docker compose -f compose.yaml ps
