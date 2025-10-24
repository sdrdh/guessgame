# GitHub Actions Setup Guide

This guide explains how to configure AWS and GitHub for automated CI/CD deployment.

> **📖 For workflow details and deployment commands**, see [backend/DEVELOPMENT.md](backend/DEVELOPMENT.md#cicd-with-github-actions).

## Quick Setup Checklist

- [ ] [Create AWS OIDC Provider](#1-create-oidc-identity-provider)
- [ ] [Create IAM Role with Trust Policy](#2-create-iam-role-for-github-actions)
- [ ] [Add `AWS_ROLE_ARN` to GitHub Secrets](#1-configure-repository-secrets)
- [ ] Push to `dev` or `main` branch → automatic deployment!

---

## AWS Setup

### 1. Create OIDC Identity Provider

GitHub Actions uses OpenID Connect (OIDC) to authenticate with AWS without storing long-lived credentials.

#### Via AWS Console:

1. Go to **IAM** → **Identity providers** → **Add provider**
2. Choose **OpenID Connect**
3. Configure:
   - **Provider URL**: `https://token.actions.githubusercontent.com`
   - **Audience**: `sts.amazonaws.com`
4. Click **Add provider**

---

### 2. Create IAM Role for GitHub Actions

#### Step 1: Create Trust Policy

Create `github-actions-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/guessgame:*"
        }
      }
    }
  ]
}
```

**Replace**:
- `YOUR_ACCOUNT_ID` with your AWS account ID (find with `aws sts get-caller-identity`)
- `YOUR_GITHUB_USERNAME` with your GitHub username

#### Step 2: Create IAM Role

```bash
# Create the role
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://github-actions-trust-policy.json

# Attach AdministratorAccess policy (for full CDK deployment permissions)
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

> **⚠️ Note**: AdministratorAccess is used for simplicity. For production, use the [minimal permissions policy](#3-minimal-permissions-policy-optional) below.

#### Step 3: Get Role ARN

```bash
aws iam get-role \
  --role-name GitHubActionsDeployRole \
  --query 'Role.Arn' \
  --output text
```

**Copy this ARN** - you'll need it for GitHub Secrets in the next section.

---

### 3. Minimal Permissions Policy (Optional, Recommended for Production)

Instead of AdministratorAccess, create a custom policy with only required permissions:

<details>
<summary>Click to expand minimal permissions policy</summary>

Create `github-actions-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "dynamodb:*",
        "lambda:*",
        "cognito-idp:*",
        "appsync:*",
        "sqs:*",
        "iam:*",
        "logs:*",
        "ssm:GetParameter",
        "sts:AssumeRole",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

Attach the policy:

```bash
aws iam put-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-name CDKDeploymentPolicy \
  --policy-document file://github-actions-policy.json
```

</details>

---

## GitHub Setup

### 1. Configure Repository Secrets

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/guessgame`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add:

| Name | Value | Description |
|------|-------|-------------|
| `AWS_ROLE_ARN` | `arn:aws:iam::ACCOUNT_ID:role/GitHubActionsDeployRole` | The ARN from AWS setup step 3 |

### 2. Configure Environments (Optional but Recommended)

For additional protection (required reviewers, branch restrictions):

1. Go to **Settings** → **Environments**
2. Create two environments:

#### Environment: `prod`
- Click **New environment** → Name: `prod`
- **Deployment protection rules**:
  - ✅ Enable **Required reviewers** (optional, for approval before prod deploy)
  - ✅ **Deployment branches**: Select "Selected branches" → Add `main`

#### Environment: `dev`
- Click **New environment** → Name: `dev`
- **Deployment branches**: Select "Selected branches" → Add `dev`

---

## CloudFlare DNS Configuration

After deployment, the GitHub Actions workflow will output the S3 website endpoint. Add it as a CNAME in CloudFlare:

### For Production (`main` branch)

```
Type:    CNAME
Name:    guessgame
Target:  [S3 endpoint from workflow output, e.g., guessgame.sdrdhlab.xyz.s3-website.ap-south-1.amazonaws.com]
Proxy:   ON (orange cloud enabled)
```

### For Development (`dev` branch)

```
Type:    CNAME
Name:    guessgame.dev
Target:  [S3 endpoint from workflow output, e.g., guessgame.dev.sdrdhlab.xyz.s3-website.ap-south-1.amazonaws.com]
Proxy:   ON (orange cloud enabled)
```

---

## Verification

Test the setup:

1. **Create a test commit** on `dev` branch:
   ```bash
   git checkout dev
   echo "test" >> README.md
   git add README.md
   git commit -m "test: Verify GitHub Actions deployment"
   git push origin dev
   ```

2. **Monitor deployment**:
   - Go to GitHub → **Actions** tab
   - Watch the "Deploy GuessGame" workflow run

3. **Check outputs**:
   - Workflow will display CloudFlare CNAME configuration
   - Copy the S3 endpoint

4. **Configure CloudFlare DNS** (see section above)

5. **Visit your site**:
   - Dev: `https://guessgame.dev.sdrdhlab.xyz`
   - Prod: `https://guessgame.sdrdhlab.xyz` (after merging to main)

---

## Troubleshooting

### Issue: "No identity-based policy allows the sts:AssumeRoleWithWebIdentity action"

**Cause**: Trust policy has incorrect GitHub repository path.

**Solution**: Verify `github-actions-trust-policy.json`:
```json
"token.actions.githubusercontent.com:sub": "repo:YOUR_USERNAME/guessgame:*"
```
Ensure `YOUR_USERNAME` matches your actual GitHub username.

### Issue: "Access Denied" during CDK deployment

**Cause**: IAM role lacks necessary permissions.

**Solution**:
1. Temporarily use `AdministratorAccess` to verify workflow works
2. Review CloudFormation error messages for specific missing permissions
3. Add to custom policy or use [minimal permissions policy](#3-minimal-permissions-policy-optional)

### Issue: Frontend build fails with "Missing required outputs"

**Cause**: Backend stacks didn't deploy successfully.

**Solution**:
1. Check workflow logs for backend deployment errors
2. Ensure all 6 backend stacks deployed: Database, Queue, Compute, Auth, API, Integration
3. Verify `cdk-outputs.json` was created

### Issue: "Stack already exists" error

**Cause**: Stacks from previous deployment with different naming.

**Solutions**:
1. Delete existing stacks: `cd backend && npx cdk destroy --all`
2. Or use different environment tag: `--context environmentTag=staging`

### Issue: Workflow runs but doesn't deploy

**Cause**: Branch protection rules or environment not configured.

**Solution**:
1. Check **Settings** → **Environments** → Ensure `prod`/`dev` exist
2. Verify deployment branches are set correctly
3. Check workflow file triggers match your branch names

---

## Security Best Practices

1. ✅ **Use OIDC** instead of static AWS credentials (this guide uses OIDC)
2. ✅ **Principle of least privilege**: Use minimal permissions policy for production
3. ✅ **Environment protection**: Require reviewers for prod deployments
4. ✅ **Branch protection**: Enable on `main` branch (Settings → Branches)
5. ✅ **Audit logs**: Review GitHub Actions logs regularly
6. ⚠️ **Never commit** AWS credentials, API keys, or secrets to git
7. ⚠️ **Rotate** IAM roles if compromised

---

## Cost Considerations

Running both dev and prod environments:

| Service | Estimated Cost/Month |
|---------|---------------------|
| DynamoDB (on-demand) | $1-5 |
| Lambda invocations | $0-2 |
| S3 storage + requests | $1-3 |
| AppSync requests | $1-5 |
| Cognito (first 50K MAU free) | $0 |
| **Total** | **~$3-15/month** |

**To minimize costs**:
- Delete dev stacks when not actively developing
- Use `npx cdk destroy GuessGame-dev-*` to remove dev environment
- Monitor with AWS Cost Explorer

---

## Next Steps

1. ✅ Complete AWS OIDC and IAM role setup
2. ✅ Add `AWS_ROLE_ARN` to GitHub Secrets
3. ✅ Push to `dev` branch to test deployment
4. ✅ Configure CloudFlare DNS with S3 endpoint from workflow output
5. ✅ Verify dev site works: `https://guessgame.dev.sdrdhlab.xyz`
6. ✅ Merge to `main` for production deployment

For deployment details, workflow steps, and local deployment commands, see [backend/DEVELOPMENT.md](backend/DEVELOPMENT.md#deployment).
