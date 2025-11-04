# GlitchTip Deployment to Google Cloud Run

Complete guide for deploying self-hosted GlitchTip to Google Cloud.

## Architecture Overview

```
Internet → Cloud Load Balancer (SSL) → Cloud Run (GlitchTip) → Cloud SQL (PostgreSQL)
                                                              → Upstash Redis (existing)
```

## Prerequisites

- Google Cloud Project with billing enabled
- `gcloud` CLI installed and configured
- Docker installed locally
- Existing Upstash Redis instance (reuse from current setup)

## Step 1: Set Up Google Cloud Resources

### 1.1 Set Environment Variables

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export SERVICE_NAME="glitchtip"
export DB_INSTANCE_NAME="glitchtip-db"
export DB_NAME="glitchtip"
export DB_USER="glitchtip"
export DB_PASSWORD="$(openssl rand -base64 32)"  # Generate secure password
export SECRET_KEY="$(openssl rand -base64 50)"   # Generate Django secret key

# Set project
gcloud config set project $PROJECT_ID
```

### 1.2 Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  servicenetworking.googleapis.com
```

### 1.3 Create Cloud SQL PostgreSQL Instance

```bash
# Create instance (db-f1-micro for cost optimization)
gcloud sql instances create $DB_INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --root-password="$DB_PASSWORD" \
  --backup \
  --backup-start-time=03:00 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=04 \
  --maintenance-release-channel=production

# Create database
gcloud sql databases create $DB_NAME \
  --instance=$DB_INSTANCE_NAME

# Create user
gcloud sql users create $DB_USER \
  --instance=$DB_INSTANCE_NAME \
  --password="$DB_PASSWORD"

# Get connection name
export CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME \
  --format='value(connectionName)')

echo "Connection Name: $CONNECTION_NAME"
```

### 1.4 Save Configuration

```bash
# Save to file for later use
cat > glitchtip-config.env << EOF
PROJECT_ID=$PROJECT_ID
REGION=$REGION
SERVICE_NAME=$SERVICE_NAME
DB_INSTANCE_NAME=$DB_INSTANCE_NAME
CONNECTION_NAME=$CONNECTION_NAME
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
SECRET_KEY=$SECRET_KEY
REDIS_URL=your-upstash-redis-url
GLITCHTIP_DOMAIN=https://glitchtip.yourdomain.com
EOF

chmod 600 glitchtip-config.env
echo "Configuration saved to glitchtip-config.env"
```

## Step 2: Build and Deploy GlitchTip Container

### 2.1 Create Dockerfile

```dockerfile
# deployment/glitchtip/Dockerfile
FROM glitchtip/glitchtip:latest

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:\${PORT:-8080}/_health/ || exit 1

# Use PORT environment variable from Cloud Run
ENV PORT=8080
EXPOSE 8080

# Start with Cloud Run PORT
CMD gunicorn --bind :"${PORT}" --workers 2 --threads 4 --worker-class gthread glitchtip.wsgi
```

### 2.2 Build and Push to Container Registry

```bash
# Build container
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  -f deployment/glitchtip/Dockerfile .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest
```

### 2.3 Deploy to Cloud Run

```bash
# Source configuration
source deployment/glitchtip/glitchtip-config.env

# Deploy
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars="DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$CONNECTION_NAME" \
  --set-env-vars="REDIS_URL=$REDIS_URL" \
  --set-env-vars="SECRET_KEY=$SECRET_KEY" \
  --set-env-vars="GLITCHTIP_DOMAIN=$GLITCHTIP_DOMAIN" \
  --set-env-vars="ENVIRONMENT=production" \
  --set-env-vars="ENABLE_OPEN_USER_REGISTRATION=False" \
  --set-env-vars="DEFAULT_FROM_EMAIL=noreply@yourdomain.com" \
  --set-env-vars="EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend" \
  --set-env-vars="EMAIL_HOST=smtp.gmail.com" \
  --set-env-vars="EMAIL_PORT=587" \
  --set-env-vars="EMAIL_USE_TLS=True" \
  --set-cloudsql-instances=$CONNECTION_NAME \
  --service-account=$SERVICE_NAME@$PROJECT_ID.iam.gserviceaccount.com

# Get service URL
export SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format='value(status.url)')

echo "GlitchTip deployed to: $SERVICE_URL"
```

## Step 3: Run Database Migrations

```bash
# Run migrations via Cloud Run job
gcloud run jobs create $SERVICE_NAME-migrate \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION \
  --command "./manage.py" \
  --args "migrate" \
  --set-env-vars="DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$CONNECTION_NAME" \
  --set-env-vars="SECRET_KEY=$SECRET_KEY" \
  --set-cloudsql-instances=$CONNECTION_NAME \
  --service-account=$SERVICE_NAME@$PROJECT_ID.iam.gserviceaccount.com

# Execute migration
gcloud run jobs execute $SERVICE_NAME-migrate --region $REGION --wait
```

## Step 4: Create Superuser Account

```bash
# Method 1: Via Cloud Shell
gcloud run services proxy $SERVICE_NAME --region $REGION &
PROXY_PID=$!
sleep 5

# Access the container
gcloud run services exec $SERVICE_NAME \
  --region $REGION \
  --command "./manage.py createsuperuser"

kill $PROXY_PID

# Method 2: Via Django command (automated)
gcloud run jobs create $SERVICE_NAME-createsuperuser \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION \
  --command "python" \
  --args "manage.py,createsuperuser,--noinput,--email=admin@yourdomain.com" \
  --set-env-vars="DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$CONNECTION_NAME" \
  --set-env-vars="SECRET_KEY=$SECRET_KEY" \
  --set-env-vars="DJANGO_SUPERUSER_PASSWORD=your-secure-password" \
  --set-cloudsql-instances=$CONNECTION_NAME

gcloud run jobs execute $SERVICE_NAME-createsuperuser --region $REGION --wait
```

## Step 5: Set Up Custom Domain (Optional)

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service $SERVICE_NAME \
  --domain glitchtip.yourdomain.com \
  --region $REGION

# Follow instructions to configure DNS records
# GlitchTip will automatically provision SSL certificate
```

## Step 6: Deploy Background Worker

GlitchTip needs a Celery worker for background tasks:

```bash
# Deploy worker as separate Cloud Run service
gcloud run deploy $SERVICE_NAME-worker \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --platform managed \
  --region $REGION \
  --no-allow-unauthenticated \
  --min-instances 1 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1 \
  --command "./bin/run-celery-with-beat.sh" \
  --set-env-vars="DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$CONNECTION_NAME" \
  --set-env-vars="REDIS_URL=$REDIS_URL" \
  --set-env-vars="SECRET_KEY=$SECRET_KEY" \
  --set-env-vars="CELERY_WORKER_AUTOSCALE=1,3" \
  --set-cloudsql-instances=$CONNECTION_NAME \
  --service-account=$SERVICE_NAME@$PROJECT_ID.iam.gserviceaccount.com
```

## Step 7: Verify Deployment

```bash
# Check service status
gcloud run services describe $SERVICE_NAME --region $REGION

# Check logs
gcloud run services logs read $SERVICE_NAME --region $REGION --limit=50

# Test health endpoint
curl $SERVICE_URL/_health/

# Should return: {"status": "ok"}
```

## Step 8: Get DSN for Your Application

1. Open GlitchTip: `$SERVICE_URL`
2. Login with superuser account
3. Create Organization → Create Project
4. Copy DSN (format: `https://KEY@glitchtip.yourdomain.com/PROJECT_ID`)
5. Use this DSN in your application's environment variables

## Cost Optimization

### Current Configuration
- Cloud SQL (db-f1-micro): ~$7/month
- Cloud Run (web): ~$5/month (scales to zero)
- Cloud Run (worker): ~$3/month (1 instance)
- Load Balancer: ~$5/month
- **Total: ~$20/month**

### Further Optimization
```bash
# Reduce Cloud SQL to minimum
gcloud sql instances patch $DB_INSTANCE_NAME \
  --tier=db-f1-micro \
  --backup-start-time=03:00

# Use Cloud Run min instances = 0 for web
gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --min-instances 0
```

## Monitoring and Maintenance

### Set Up Monitoring

```bash
# Create uptime check
gcloud monitoring uptime-check-configs create glitchtip-health \
  --display-name="GlitchTip Health Check" \
  --resource-type=uptime-url \
  --monitored-resource-spec="url=$SERVICE_URL/_health/"
```

### Backup Database

```bash
# Manual backup
gcloud sql backups create \
  --instance=$DB_INSTANCE_NAME \
  --description="Pre-migration backup"

# Automated backups are already configured
```

### Update GlitchTip

```bash
# Pull latest image
docker pull glitchtip/glitchtip:latest

# Tag and push
docker tag glitchtip/glitchtip:latest gcr.io/$PROJECT_ID/$SERVICE_NAME:latest
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# Redeploy
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --region $REGION
```

## Troubleshooting

### View Logs
```bash
gcloud run services logs read $SERVICE_NAME --region $REGION --limit=100
```

### Access Container Shell
```bash
gcloud run services proxy $SERVICE_NAME --region $REGION
```

### Database Connection Issues
```bash
# Test connection
gcloud sql connect $DB_INSTANCE_NAME --user=$DB_USER
```

### Rollback Deployment
```bash
# List revisions
gcloud run revisions list --service=$SERVICE_NAME --region=$REGION

# Rollback to previous
gcloud run services update-traffic $SERVICE_NAME \
  --region=$REGION \
  --to-revisions=REVISION_NAME=100
```

## Security Checklist

- [ ] Strong SECRET_KEY generated
- [ ] Database password is strong and secure
- [ ] ENABLE_OPEN_USER_REGISTRATION=False in production
- [ ] SSL/TLS enabled via custom domain
- [ ] Cloud SQL has automated backups
- [ ] IAM service account with minimal permissions
- [ ] Environment variables not exposed in logs
- [ ] Regular updates scheduled

## Next Steps

After deployment:
1. Update application monitoring module with new DSN
2. Test error capture from development environment
3. Deploy to production
4. Monitor for 48 hours
5. Disable old Sentry integration
