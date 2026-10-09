#!/bin/bash
# Build the web app against the live API and publish it on AWS Amplify Hosting.
# Usage: backend/deploy-web.sh        (run from anywhere; needs the AWS CLI signed in)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="us-west-2"
STACK="neemu"
APP_NAME="neemu"
BRANCH="main"

API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)

APP_ID=$(aws amplify list-apps --region "$REGION" --query "apps[?name=='$APP_NAME'].appId | [0]" --output text)
if [ "$APP_ID" = "None" ] || [ -z "$APP_ID" ]; then
  APP_ID=$(aws amplify create-app --name "$APP_NAME" --region "$REGION" --platform WEB --query app.appId --output text)
  aws amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" >/dev/null
fi
APP_URL="https://$BRANCH.$APP_ID.amplifyapp.com"

cd "$ROOT/web"
[ -d node_modules ] || npm ci
VITE_API_URL="$API_URL" VITE_APP_URL="$APP_URL" npm run build

ZIP="$(mktemp -d)/site.zip"
(cd dist && zip -qr "$ZIP" .)

read -r JOB_ID UPLOAD_URL < <(aws amplify create-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" \
  --query '[jobId, zipUploadUrl]' --output text)
curl -sS --fail -X PUT -H "Content-Type: application/zip" --data-binary "@$ZIP" "$UPLOAD_URL" >/dev/null
aws amplify start-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" --region "$REGION" >/dev/null

until STATUS=$(aws amplify get-job --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" --region "$REGION" \
  --query job.summary.status --output text) && [ "$STATUS" != "PENDING" ] && [ "$STATUS" != "RUNNING" ]; do sleep 3; done

echo "$STATUS  $APP_URL  (API $API_URL, commit $(git -C "$ROOT" rev-parse --short HEAD))"
[ "$STATUS" = "SUCCEED" ]
