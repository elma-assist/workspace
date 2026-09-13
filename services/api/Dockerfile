FROM python:3.12-slim
WORKDIR /srv
COPY services/api/requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY packages/contracts ./contracts
COPY services/api/app ./app
COPY services/api/migrations ./migrations
COPY services/api/tests ./tests
ENV PYTHONUNBUFFERED=1
