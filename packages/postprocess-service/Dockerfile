FROM python:3.12-slim

RUN set -eux; \
  if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
    sed -i 's|http://deb.debian.org/debian|https://mirrors.aliyun.com/debian|g' /etc/apt/sources.list.d/debian.sources; \
    sed -i 's|http://security.debian.org/debian-security|https://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources; \
  fi; \
  apt-get -o Acquire::Retries=5 update; \
  apt-get install -y --no-install-recommends ffmpeg ca-certificates; \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY packages/postprocess-service/app.py ./app.py

ENV MEDIA_ROOT=/app/packages/api/output
EXPOSE 8010

CMD ["sh", "-c", "POSTPROCESS_SERVICE_PORT=${PORT:-8010} python app.py"]
