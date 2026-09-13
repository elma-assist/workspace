FROM python:3.12-slim
WORKDIR /srv
COPY services/agent-worker/requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY packages/contracts ./contracts
COPY services/agent-worker/ .
RUN python worker.py download-files
ENV PYTHONUNBUFFERED=1
CMD ["python", "worker.py", "start"]
