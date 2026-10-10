#!/bin/bash
# Build the web app against the live API and publish it on AWS Amplify Hosting.
# Usage: backend/deploy-web.sh        (run from anywhere; needs the AWS CLI signed in)
set -euo pipefail

# WEB_ROOT: a different checkout to build from (default: this one).
# AMPLIFY_BRANCH: publish to a preview address instead of the main one, e.g. AMPLIFY_BRANCH=preview.
ROOT="${WEB_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
REGION="us-west-2"
STACK="neemu"
APP_NAME="neemu"
BRANCH="${AMPLIFY_BRANCH:-main}"

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
API_URL=$(output ApiUrl)
SIGN_IN_DOMAIN=$(output SignInDomain)
WEB_CLIENT_ID=$(output WebClientId)

APP_ID=$(aws amplify list-apps --region "$REGION" --query "apps[?name=='$APP_NAME'].appId | [0]" --output text)
if [ "$APP_ID" = "None" ] || [ -z "$APP_ID" ]; then
  APP_ID=$(aws amplify create-app --name "$APP_NAME" --region "$REGION" --platform WEB --query app.appId --output text)
fi
aws amplify get-branch --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" >/dev/null 2>&1 \
  || aws amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" >/dev/null
APP_URL="https://$BRANCH.$APP_ID.amplifyapp.com"

cd "$ROOT/web"
[ -d node_modules ] || npm ci
VITE_API_URL="$API_URL" VITE_APP_URL="$APP_URL" \
  VITE_COGNITO_DOMAIN="$SIGN_IN_DOMAIN" VITE_COGNITO_CLIENT_ID="$WEB_CLIENT_ID" npm run build

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
