# 🚀 Syncing Your Project with Vercel

This guide explains how to push your local changes to the live website on Vercel.

## 🛠️ Method 1: Using the `deploy` script (easiest)

I've added a shortcut script to your `package.json`. It uses `npx` so you don't need to install anything globally. To sync your changes to the live production site, simply run:

```bash
npm run deploy
```

---

## 💻 Method 2: Manual CLI Commands

If you prefer using the Vercel CLI directly:

### 1. Preview Deployment
Use this to test changes on a temporary URL before making them live.
```bash
npx vercel --archive=tgz
```

### 2. Production Deployment (Live)
Use this to update your main website URL.
```bash
npx vercel --prod --archive=tgz
```

---

## 💡 Recommended: Connect to Git (Automatic Sync)

Currently, your project is not using Git. Connecting it to a GitHub, GitLab, or Bitbucket repository is the best way to sync, as it will **automatically deploy** every time you push code.

### Steps to set up Git & Automatic Sync:

1. **Initialize Git:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create a repository on GitHub** and follow their instructions to push your local code:
   ```bash
   git remote add origin https://github.com/your-username/your-repo-name.git
   git branch -M main
   git push -u origin main
   ```

3. **Link to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Find your project `boxit-name`
   - Go to **Settings > Git**
   - Connect your GitHub repository.

Now, every time you run `git push`, your website will update automatically!

---

## ❓ Troubleshooting

### Authentication Errors
If prompted, log in to your Vercel account:
```bash
npx vercel login
```
