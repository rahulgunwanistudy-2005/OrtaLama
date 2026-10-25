FROM node:24.19.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv python3-pip postgresql git make curl ca-certificates tar zstd build-essential && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 1001 ortalama && mkdir -p /app && chown ortalama:ortalama /app
WORKDIR /app
COPY --chown=ortalama:ortalama . .
RUN mkdir -p /app/.runtime /app/.tools/ollama/models /app/.tools/downloads && chown -R ortalama:ortalama /app/.runtime /app/.tools
USER ortalama
ENV ORTALAMA_WEB_HOST=0.0.0.0 ORTALAMA_WEB_PORT=5173
EXPOSE 5173
CMD ["make","demo-host"]
