# CloudFlare Setup Guide

## Prerequisites
1. Domain registered with CloudFlare (or DNS managed by CloudFlare)
2. Frontend deployed to S3 via CDK

## Setup Steps

### 1. Deploy Frontend Stack

```bash
cd backend
npm run deploy
```

After deployment, note the **WebsiteEndpoint** output. It will look like:
```
guess-game-frontend-123456789.s3-website-us-east-1.amazonaws.com
```

### 2. Configure CloudFlare DNS

Go to CloudFlare Dashboard → DNS → Records

**Add a CNAME record:**

| Type  | Name             | Target                                          | Proxy Status |
|-------|------------------|-------------------------------------------------|--------------|
| CNAME | guessgame        | {your-s3-website-endpoint}                      | Proxied (🟠) |

Example:
- **Type**: CNAME
- **Name**: `guessgame` (for guessgame.sdrdhlab.xyz)
- **Target**: `guess-game-frontend-123456789.s3-website-us-east-1.amazonaws.com`
- **Proxy status**: Proxied (orange cloud) ✅

### 3. CloudFlare Settings (Recommended)

#### SSL/TLS
- Go to **SSL/TLS** → **Overview**
- Set to **Full** (not Flexible, not Full Strict)

#### Page Rules (Optional but Recommended)
Create a page rule for cache:
- URL: `guessgame.sdrdhlab.xyz/*`
- Settings:
  - Cache Level: Standard
  - Browser Cache TTL: 4 hours
  - Edge Cache TTL: 2 hours

#### Security
CloudFlare provides automatic:
- ✅ Free SSL certificate
- ✅ DDoS protection
- ✅ WAF (Web Application Firewall)
- ✅ Bot protection

### 4. Test Your Site

Visit: `https://guessgame.sdrdhlab.xyz`

The site should load with:
- ✅ HTTPS enabled (CloudFlare SSL)
- ✅ Fast loading (CloudFlare CDN)
- ✅ CloudFlare security features active

## Troubleshooting

### "Too many redirects"
- Set SSL/TLS to **Full** (not Flexible)

### "Site not loading"
- Check CNAME target matches S3 website endpoint exactly
- Ensure Proxy is ON (orange cloud)
- Wait a few minutes for DNS propagation

### "403 Forbidden"
- Verify S3 bucket has public read access
- Check bucket website hosting is enabled

## Update Deployment

When you update the frontend:

```bash
cd backend
npm run deploy:frontend
```

CloudFlare automatically clears cache, so changes appear immediately!

## Cost

- **S3**: ~$0.50/month for 1GB storage + transfer
- **CloudFlare**: FREE (even with SSL, CDN, and security)
- **Total**: ~$0.50/month 🎉

No CloudFront charges!
