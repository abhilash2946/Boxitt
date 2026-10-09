# 🔧 Deployment Guide

## Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Build succeeds without errors
- [ ] No console errors in dev mode
- [ ] Environment variables configured
- [ ] Admin credentials updated (if needed)
- [ ] Database migrations applied (if Supabase)

---

## Build Process

### 1. Production Build
```bash
npm run build
```

**Output**: `dist/` folder with optimized code
- JavaScript minified
- CSS optimized
- Assets optimized
- Build size: ~139 KB (gzipped)

### 2. Build Verification
```bash
npm run preview
```

Tests the production build locally at `http://localhost:4173`

---

## Deployment Platforms

### Option 1: Vercel (Recommended)

#### Setup
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project" → Select GitHub repo
4. Framework: Vite
5. Root: `/`
6. Build Command: `npm run build`
7. Output Directory: `dist`

#### Environment Variables
Go to Settings → Environment Variables:
```
VITE_API_KEY=your_gemini_key
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_KEY=your_key
```

#### Deploy
- Automatic on git push to main
- Or manually: Click "Deploy"
- Domain: `boxitt.vercel.app`

---

### Option 2: Netlify

#### Setup
1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "New site from Git" → Select GitHub repo
4. Build Command: `npm run build`
5. Publish Directory: `dist`

#### Environment Variables
Site settings → Environment:
```
VITE_API_KEY=your_gemini_key
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_KEY=your_key
```

#### Deploy
- Automatic on git push
- Or drag & drop `dist` folder
- Domain: `boxitt-app.netlify.app`

---

### Option 3: Docker

#### Create Dockerfile
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

#### Build & Run
```bash
# Build image
docker build -t boxitt:latest .

# Run container
docker run -p 3000:3000 boxitt:latest
```

#### Push to Docker Hub
```bash
docker tag boxitt:latest yourusername/boxitt:latest
docker push yourusername/boxitt:latest
```

---

### Option 4: Traditional Server (Node.js)

#### Prerequisites
- Node.js installed on server
- npm/yarn installed
- Process manager (PM2 recommended)

#### Install PM2
```bash
npm install -g pm2
```

#### Deploy Steps
```bash
# SSH into server
ssh user@your-server.com

# Clone repository
git clone <your-repo> boxitt
cd boxitt

# Install dependencies
npm install

# Build
npm run build

# Install PM2
npm install -g pm2

# Start with PM2
pm2 start "npm run preview" --name "boxitt"
pm2 save

# Setup auto-restart
pm2 startup
```

#### Setup Reverse Proxy (Nginx)
```nginx
server {
  listen 80;
  server_name boxitt.com;

  location / {
    proxy_pass http://localhost:4173;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

---

## Environment Configuration

### Development
```bash
npm run dev
```
Uses values from `.env`

### Production
```bash
npm run build && npm run preview
```
Uses production environment variables

### Variables Needed

```env
# Gemini AI
VITE_API_KEY=your_gemini_api_key

# Supabase (optional, for cloud features)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_anon_key

# App Settings
VITE_APP_NAME=Boxitt
VITE_APP_VERSION=1.0.0
```

---

## Post-Deployment

### 1. Test Live Site
- [ ] Home page loads
- [ ] Login works
- [ ] Can browse locations
- [ ] Can create booking
- [ ] Admin panel accessible
- [ ] Scorer works
- [ ] QR scanner works
- [ ] No console errors

### 2. Monitoring
- Check error logs
- Monitor performance
- Track API usage
- Verify database backups

### 3. Update DNS (if custom domain)
```
A record: your-ip-address
CNAME: @ → vercel.app (if Vercel)
```

---

## Rollback Procedure

### Vercel
1. Go to Deployments
2. Find previous successful deployment
3. Click "..." → "Redeploy"

### Netlify
1. Go to Deploys
2. Find previous deployment
3. Click "Publish deploy"

### Traditional Server
```bash
git revert <commit-hash>
npm run build
pm2 restart boxitt
```

---

## Performance Optimization

### Compression
Enable gzip on server:
```nginx
gzip on;
gzip_types text/plain text/css application/javascript;
```

### Caching
```nginx
location ~* \.(js|css|png|jpg)$ {
  expires 30d;
  add_header Cache-Control "public, immutable";
}
```

### CDN
- Use Vercel/Netlify (built-in)
- Or Cloudflare for custom domains

---

## SSL Certificate

### Vercel/Netlify
- Automatic HTTPS (Let's Encrypt)
- Automatic renewal

### Traditional Server
```bash
# Using Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Database Backup (Supabase)

### Automatic Backups
Supabase provides automatic daily backups.

### Manual Backup
```bash
# Export data
pg_dump "postgresql://..." > backup.sql

# Restore data
psql "postgresql://..." < backup.sql
```

---

## Monitoring & Logging

### Vercel Analytics
- Deployment dashboard
- Performance metrics
- Error tracking

### Sentry Integration (optional)
```bash
npm install @sentry/react
```

### Custom Logging
All errors logged to `errorHandler` service.

---

## Scaling Considerations

### Database
- Add read replicas for high traffic
- Implement caching layer (Redis)

### Frontend
- Enable Service Worker offline mode
- Implement infinite scroll

### Backend
- Use serverless functions for API
- Scale database horizontally

---

## Security Checklist

- [ ] HTTPS enabled
- [ ] Admin credentials changed
- [ ] API keys secured
- [ ] Database backups enabled
- [ ] Access logs enabled
- [ ] Rate limiting configured
- [ ] Input validation enabled
- [ ] CORS properly configured

---

## Troubleshooting

### Build Fails
```bash
# Clear cache
rm -rf node_modules dist
npm install
npm run build
```

### Port Already in Use
```bash
# Change port
npm run dev -- --port 3001
```

### Out of Memory
```bash
# Increase Node memory
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

### Database Connection Issues
- Check VITE_SUPABASE_URL
- Verify VITE_SUPABASE_KEY
- Check network connectivity

---

## Maintenance

### Regular Tasks
- Check error logs weekly
- Review analytics monthly
- Update dependencies quarterly
- Run security audits monthly

### Update Dependencies
```bash
npm outdated          # Check for updates
npm update            # Update packages
npm audit fix         # Fix vulnerabilities
```

---

## Support

For deployment issues:
1. Check build logs
2. Review error handler logs
3. Check browser console
4. Review server logs
5. Contact hosting provider support
