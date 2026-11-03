FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY pyproject.toml ./
COPY agency ./agency
COPY brand ./brand
COPY migrations ./migrations
RUN pip install . \
 && useradd --system --uid 10001 agency \
 && mkdir -p /data/media && chown -R agency /data

USER agency
ENV MEDIA_DIR=/data/media
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/healthz').status==200 else 1)"
CMD ["python", "-m", "agency", "serve", "--port", "8080"]
