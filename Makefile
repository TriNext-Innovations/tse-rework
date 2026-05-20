# TSE Online — ops Makefile
# Run from /opt/tse-ui on the Vultr JHB server.
# Usage: make <target> [s=<service>]   e.g.  make logs s=medusa

COMPOSE = docker compose
BACKUP_DIR ?= /opt/backups/tse

.PHONY: help ps status logs logs-all deploy migrate build \
        restart stop backup cert-renew shell disk

# ── Default: print help ────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "  TSE Online — ops commands"
	@echo ""
	@echo "  Status"
	@echo "    make ps              docker compose ps (all services)"
	@echo "    make status          same as ps"
	@echo "    make disk            host disk usage + docker volume sizes"
	@echo ""
	@echo "  Logs"
	@echo "    make logs            tail last 50 lines of all services"
	@echo "    make logs s=medusa   tail a specific service"
	@echo "    make logs-all        full log dump (no follow)"
	@echo ""
	@echo "  Deploy"
	@echo "    make deploy          git pull → build → migrate → up"
	@echo "    make migrate         run medusa-migrate only (foreground)"
	@echo "    make build           rebuild medusa + web images"
	@echo "    make restart s=web   restart a specific service"
	@echo "    make stop            stop all services (data volumes preserved)"
	@echo ""
	@echo "  Database"
	@echo "    make backup          pg_dump to $(BACKUP_DIR)/tse_YYYY-MM-DD.sql.gz"
	@echo "    make shell s=postgres  exec into any service container"
	@echo ""
	@echo "  Certs"
	@echo "    make cert-renew      stop nginx → certbot renew → start nginx"
	@echo ""

# ── Status ─────────────────────────────────────────────────────────────────────

ps status:
	$(COMPOSE) ps

disk:
	@echo "=== Host disk ===" && df -h /
	@echo ""
	@echo "=== Docker volumes ===" && docker system df -v | grep -E 'VOLUME|tse-ui'

# ── Logs ───────────────────────────────────────────────────────────────────────

logs:
ifdef s
	$(COMPOSE) logs -f --tail=50 $(s)
else
	$(COMPOSE) logs -f --tail=50
endif

logs-all:
ifdef s
	$(COMPOSE) logs --no-color $(s)
else
	$(COMPOSE) logs --no-color
endif

# ── Deploy ─────────────────────────────────────────────────────────────────────

deploy:
	git pull origin main
	$(COMPOSE) build medusa web
	$(COMPOSE) up medusa-migrate
	$(COMPOSE) up -d medusa web
	$(COMPOSE) ps

migrate:
	$(COMPOSE) up medusa-migrate

build:
	$(COMPOSE) build medusa web

restart:
ifdef s
	$(COMPOSE) restart $(s)
else
	@echo "Usage: make restart s=<service>"
	@exit 1
endif

stop:
	$(COMPOSE) stop

# ── Database backup ────────────────────────────────────────────────────────────

backup:
	mkdir -p $(BACKUP_DIR)
	$(COMPOSE) exec -T postgres pg_dump -U postgres -d tse_medusa --no-owner --clean \
	  | gzip > $(BACKUP_DIR)/tse_$$(date +%F).sql.gz
	@echo "Backup written to $(BACKUP_DIR)/tse_$$(date +%F).sql.gz"
	@ls -lh $(BACKUP_DIR)

# ── Shell into a service ───────────────────────────────────────────────────────

shell:
ifdef s
	$(COMPOSE) exec $(s) sh
else
	@echo "Usage: make shell s=<service>   e.g.  make shell s=postgres"
	@exit 1
endif

# ── Cert renewal ───────────────────────────────────────────────────────────────

cert-renew:
	$(COMPOSE) stop nginx
	docker run --rm -p 80:80 \
	  -v tse-ui_certbot_certs:/etc/letsencrypt \
	  -v tse-ui_certbot_www:/var/www/certbot \
	  certbot/certbot renew
	$(COMPOSE) up -d nginx
	@echo "Cert renewal done. nginx restarted."
