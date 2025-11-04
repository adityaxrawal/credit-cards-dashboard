#!/bin/bash

# Run GlitchTip database migrations on Google Cloud Run

set -e

# Load configuration
if [ -f "deployment/glitchtip/glitchtip-config.env" ]; then
    source deployment/glitchtip/glitchtip-config.env
fi

SERVICE_NAME="${SERVICE_NAME:-glitchtip}"

echo "Running database migrations for GlitchTip..."

# Run migration as a Cloud Run job
gcloud run jobs execute $SERVICE_NAME-migrate \
    --region $REGION \
    --project $PROJECT_ID \
    --wait

echo "✅ Migrations completed successfully!"
