FROM python:3.12-slim
ARG AXTN_SOURCE_COMMIT
LABEL org.opencontainers.image.revision=$AXTN_SOURCE_COMMIT

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-deu poppler-utils fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.py .

USER nobody
EXPOSE 8092
CMD ["python", "server.py"]
