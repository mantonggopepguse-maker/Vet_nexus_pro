# VetNexus Pro Deployment Script - Cost Optimized
# Project: vetnexuspro-truecopy
# Project Number: 180033031286

$PROJECT_ID = "vetnexuspro-truecopy"
$REGION = "us-central1"
$SERVICE_NAME = "vetnexus"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "Starting deployment for $SERVICE_NAME to project $PROJECT_ID..." -ForegroundColor Cyan

# 1. Set Project
Write-Host "Setting GCP project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# 2. Enable APIs
Write-Host "Enabling required APIs..."
gcloud services enable run.googleapis.com containerregistry.googleapis.com cloudbuild.googleapis.com

# 3. Synchronize Database Schema
Write-Host "Synchronizing database schema..."
Set-Location server
npx prisma db push --accept-data-loss
Set-Location ..

# 4. Build & Push using Cloud Build
Write-Host "Building and pushing container image via Cloud Build..."
gcloud builds submit --config cloudbuild.yaml .

# 5. Deploy to Cloud Run with COST OPTIMIZATIONS
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_NAME `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --set-env-vars "NODE_ENV=production,DATABASE_URL=postgresql://postgres.suzggpvxwzxovdhwrmeu:GiQuJtyw3ZkSJjEG@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true,DIRECT_URL=postgresql://postgres.suzggpvxwzxovdhwrmeu:GiQuJtyw3ZkSJjEG@aws-1-eu-west-1.pooler.supabase.com:5432/postgres,JWT_SECRET=purple-vets-super-secret-jwt-key-2026-change-in-production,JWT_EXPIRES_IN=7d,GEMINI_API_KEY=AIzaSyD6tSSozqStWk7FrVATP7l6sL9JVlT5YBc,SUPABASE_URL=https://suzggpvxwzxovdhwrmeu.supabase.co,SUPABASE_ANON_KEY=sb_publishable_D0OcEwyIc48UpFsTzI0CnQ_LWKNWAX7,FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-661748bb0d55db32433fb588952f7f67-X,FLUTTERWAVE_SECRET_KEY=FLWSECK-4cd02f41094d22358c6871fe83fcb31d-19adf9e1cf9vt-X,FLUTTERWAVE_SECRET_HASH=4cd02f41094d105d439f523c,FLUTTERWAVE_ENV=staging,FLUTTERWAVE_MONTHLY_PLAN_ID=153767,FLUTTERWAVE_YEARLY_PLAN_ID=153768,SMTP_HOST=purplevets.vetnexuspro.com,SMTP_PORT=465,SMTP_USER=drmantonggopep@gmail.com,SMTP_PASS=@$SB12doctor12,SMTP_FROM_NAME=Purple vets" `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 3 `
    --concurrency 80 `
    --timeout 60s `
    --cpu-throttling `
    --no-cpu-boost

Write-Host "Deployment complete!" -ForegroundColor Green
