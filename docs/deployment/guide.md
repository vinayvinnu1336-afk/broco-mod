# BroCo Mod Deployment & Infrastructure Guide

## 1. Overview

BroCo Mod is packaged as container images ready for orchestrators (Docker Compose, Kubernetes, AWS ECS, GCP Cloud Run).

---

## 2. Local Multi-Container Deployment

```bash
# 1. Environment file setup
cp .env.example .env

# 2. Launch complete stack
docker compose up -d

# 3. View logs
docker compose logs -f backend
```

---

## 3. Production Deployment Architecture

In production:
1. **Ingress / Load Balancer:** AWS ALB or CloudFlare terminating TLS.
2. **Reverse Proxy:** Nginx edge containers routing `/api` to ASP.NET Core pods and `/` to Next.js pods.
3. **Database:** Managed PostgreSQL (AWS RDS or GCP Cloud SQL) with PostGIS extension enabled.
4. **Cache:** Managed Redis (AWS ElastiCache or GCP Memorystore) with replication.
5. **CI/CD Pipeline:** GitHub Actions builds images and runs tests. Automated deployment to production is intentionally gated behind manual approval tags (`release/*`).
