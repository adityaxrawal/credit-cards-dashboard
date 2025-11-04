# GlitchTip Dockerfile for Google Cloud Run
# Based on official GlitchTip image with Cloud Run optimizations

FROM glitchtip/glitchtip:latest

# Set maintainer
LABEL maintainer="Credit Card Dashboard Team"
LABEL description="Self-hosted GlitchTip for error tracking and monitoring"

# Cloud Run uses PORT environment variable
ENV PORT=8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/_health/ || exit 1

# Expose port
EXPOSE 8080

# Start GlitchTip with Gunicorn
# Cloud Run will set PORT, we bind to it
CMD gunicorn --bind :${PORT} \
  --workers 2 \
  --threads 4 \
  --worker-class gthread \
  --timeout 300 \
  --access-logfile - \
  --error-logfile - \
  glitchtip.wsgi
