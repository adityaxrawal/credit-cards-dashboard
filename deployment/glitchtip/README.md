# GlitchTip Local Development Setup

This directory contains the Docker Compose configuration for running GlitchTip locally for development and testing.

## Quick Start

1. **Start GlitchTip:**

   ```bash
   cd deployment/glitchtip
   docker-compose up -d
   ```

2. **Wait for services to be ready (30-60 seconds):**

   ```bash
   docker-compose logs -f web
   # Wait until you see "Booting worker with pid"
   ```

3. **Create superuser account:**

   ```bash
   docker-compose exec web ./manage.py createsuperuser
   # Follow prompts to create admin account
   ```

4. **Access GlitchTip:**
   - URL: http://localhost:8080
   - Login with the superuser credentials you just created

## Services

- **PostgreSQL** (port 5432): Database for storing error data
- **Redis** (port 6379): Cache and task queue
- **GlitchTip Web** (port 8080): Main web interface and API
- **GlitchTip Worker**: Background task processor (Celery)

## Create a Test Project

1. Login to http://localhost:8080
2. Click "Create Organization"
3. Create a new project (Node.js / Express)
4. Copy the DSN (looks like: `http://abc123@localhost:8080/1`)

## Test Error Capture

Create a test file `test-glitchtip.js`:

```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "http://YOUR_DSN_HERE@localhost:8080/1",
  environment: "development",
  tracesSampleRate: 1.0,
});

// Test error
try {
  throw new Error("Test error from Node.js!");
} catch (error) {
  Sentry.captureException(error);
}

// Flush and wait
Sentry.close(2000).then(() => {
  console.log("Error sent to GlitchTip!");
  process.exit(0);
});
```

Run it:

```bash
npm install @sentry/node
node test-glitchtip.js
```

Check http://localhost:8080 - you should see the error!

## Useful Commands

### View logs

```bash
docker-compose logs -f web     # Web server logs
docker-compose logs -f worker  # Worker logs
docker-compose logs -f         # All logs
```

### Restart services

```bash
docker-compose restart web
docker-compose restart worker
```

### Stop everything

```bash
docker-compose down
```

### Stop and remove all data

```bash
docker-compose down -v  # WARNING: Deletes database!
```

### Access Django shell

```bash
docker-compose exec web ./manage.py shell
```

### Run Django management commands

```bash
docker-compose exec web ./manage.py <command>
```

## Environment Variables

Key variables (set in docker-compose.yml):

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `SECRET_KEY`: Django secret key (change in production!)
- `GLITCHTIP_DOMAIN`: Public URL for GlitchTip
- `ENABLE_OPEN_USER_REGISTRATION`: Allow self-registration
- `EMAIL_BACKEND`: Email configuration (console for dev)

## Health Checks

- **Web**: http://localhost:8080/\_health/
- **PostgreSQL**: `docker-compose exec postgres pg_isready`
- **Redis**: `docker-compose exec redis redis-cli ping`

## Troubleshooting

### Service won't start

```bash
docker-compose ps  # Check service status
docker-compose logs web  # Check logs
```

### Database errors

```bash
# Reset database
docker-compose down -v
docker-compose up -d
docker-compose exec web ./manage.py migrate
```

### Port already in use

Edit `docker-compose.yml` and change port mappings:

```yaml
ports:
  - "8081:8080" # Use 8081 instead of 8080
```

## Next Steps

Once local testing is complete:

1. Deploy to Google Cloud Run (see `GLITCHTIP_DEPLOYMENT.md`)
2. Update monitoring module to use GlitchTip DSN
3. Test with real application services
