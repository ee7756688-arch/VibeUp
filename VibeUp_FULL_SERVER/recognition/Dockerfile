FROM python:3.13-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --upgrade pip && python -m pip install --no-cache-dir --only-binary=shazamio-core -r requirements.txt
COPY recognition_service.py ./
EXPOSE 8765
CMD ["uvicorn","recognition_service:app","--host","0.0.0.0","--port","8765"]
