#!/bin/bash
# CHIMERA Deployment Script
# Sets up Google Cloud resources and deploys the application

set -e

# Configuration
PROJECT_ID="chimera-v4"
REGION="europe-west1"
SERVICE_NAME="chimera-lay-backend"
BETFAIR_APP_KEY="JCZbQsjmX87BDsWa"

echo "=== CHIMERA Deployment Script ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed"
    exit 1
fi

# Set project
echo "Setting GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com

# Create Artifact Registry repository (if not exists)
echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create chimera \
    --repository-format=docker \
    --location=$REGION \
    --description="CHIMERA container images" \
    2>/dev/null || echo "Repository already exists"

# Build and push image
echo "Building Docker image..."
cd backend
gcloud builds submit \
    --tag $REGION-docker.pkg.dev/$PROJECT_ID/chimera/$SERVICE_NAME:latest

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $REGION-docker.pkg.dev/$PROJECT_ID/chimera/$SERVICE_NAME:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "BETFAIR_APP_KEY=$BETFAIR_APP_KEY" \
    --memory 512Mi \
    --cpu 1 \
    --timeout 120 \
    --max-instances 5 \
    --min-instances 0

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region $REGION \
    --format 'value(status.url)')

echo ""
echo "=== Deployment Complete ==="
echo "Backend URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "1. Update frontend/.env.local with VITE_API_URL=$SERVICE_URL"
echo "2. Deploy frontend to Cloudflare Pages"
echo "3. Set BACKEND_URL secret in GitHub repository"
