# ChaiToke API — Deployment Guide

Deploy the API to your server at `team8.105app.site` using Docker.

---

## Step 1: SSH into the Server

```bash
ssh root@team8.105app.site
```

Enter the password when prompted.

---

## Step 2: Install Docker (if not already installed)

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

Verify it's working:

```bash
docker --version
```

---

## Step 3: Install Git and Clone the Repo

```bash
apt update && apt install git -y

git clone https://github.com/BaseZ-code/AI-For-Thai-Hackathon.git
cd AI-For-Thai-Hackathon
```

> If re-deploying, remove the old clone first:
> ```bash
> rm -rf /root/AI-For-Thai-Hackathon
> ```

---

## Step 4: Build the Docker Image

```bash
docker build -t chaitoke-api .
```

This will take 1–3 minutes on first run (downloads Python + installs dependencies).

---

## Step 5: Run the Container

```bash
docker run -d \
  -p 80:8000 \
  --restart unless-stopped \
  --name chaitoke \
  chaitoke-api
```

This maps **port 80** (public HTTP) to **port 8000** (inside the container).

---

## Step 6: Verify

Check the container is running:

```bash
docker ps
```

You should see `chaitoke` in the list with status `Up`.

Test the health endpoint:

```bash
curl http://localhost/v1/health
```

Expected response:

```json
{"status":"healthy","version":"0.1.0","llm_reachable":true}
```

From your local machine, test it publicly:

```bash
curl http://team8.105app.site/v1/health
```

---

## Updating the Deployment

When you push new code and want to redeploy:

```bash
ssh root@team8.105app.site

cd /root/AI-For-Thai-Hackathon
git pull origin main

docker rm -f chaitoke
docker build -t chaitoke-api .
docker run -d \
  -p 80:8000 \
  --restart unless-stopped \
  --name chaitoke \
  chaitoke-api
```

---

## Quick Reference

| Item | Value |
|------|-------|
| **Server** | `team8.105app.site` |
| **API Base URL** | `http://team8.105app.site/v1` |
| **Health check** | `GET http://team8.105app.site/v1/health` |
| **Extraction** | `POST http://team8.105app.site/v1/extractions` |
| **Swagger docs** | `http://team8.105app.site/docs` |
| **Container name** | `chaitoke` |
| **View logs** | `docker logs -f chaitoke` |
| **Stop** | `docker rm -f chaitoke` |
| **Restart** | `docker restart chaitoke` |

---

## Troubleshooting

**Container won't start:**
```bash
docker logs chaitoke
```

**Port 80 already in use:**
```bash
# Find what's using port 80
lsof -i :80
# Kill it, or use a different port:
docker run -d -p 8080:8000 --name chaitoke chaitoke-api
```

**Pull latest code and rebuild:**
```bash
cd /root/AI-For-Thai-Hackathon && git pull origin main
docker rm -f chaitoke
docker build --no-cache -t chaitoke-api .
docker run -d -p 80:8000 --restart unless-stopped --name chaitoke chaitoke-api
```
