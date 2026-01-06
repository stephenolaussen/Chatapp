# ⚡ Quick Start Guide

## 🚀 Run Locally (Windows)

### Easiest way:
Double-click on `start.bat` - Done! 🎉

### Or manually:
```bash
npm install
npm start
```

Open http://localhost:3000

## 📤 Deploy to GitHub

1. **Install Git**: https://git-scm.com/download/win
2. **Open PowerShell** in the project folder
3. **Run these commands**:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/familie-chat.git
git push -u origin main
```

(Replace `YOUR_USERNAME` with your GitHub username)

## 🌐 Deploy to the Internet

### Vercel (Recommended - Free & Easy):
1. Go to https://vercel.com
2. Log in with GitHub
3. Click "Add New..." → "Project"
4. Select `familie-chat`
5. Click "Deploy"

**Done!** Your app is live! 🎉

## 📱 Install on Phone

### iPhone (Safari):
Share → Add to Home Screen

### Android (Chrome):
Menu (⋮) → Install app

## 📋 File Structure

```
├── index.js              # Server file
├── package.json          # Dependencies
├── views/                # HTML templates (EJS)
│   ├── index.ejs        # Home page
│   └── room.ejs         # Chat page
├── public/               # Static files
│   ├── sw.js            # Service Worker
│   ├── manifest.json    # PWA config
│   └── icons/           # Icons
└── README.md            # Full documentation
```

## 🔧 Command Reference

| Command | What it does |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm start` | Start the server |
| `node index.js` | Start the server (alternative) |
| `git status` | Check git status |
| `git add .` | Add all files |
| `git commit -m "msg"` | Make commit |
| `git push` | Push to GitHub |

## 🎯 Next Steps

1. Test the chat locally
2. Create GitHub repo
3. Deploy to Vercel
4. Share the link with your family!

## ❓ Problems?

- **Server won't start**: Check that Node.js is installed
- **Port 3000 is in use**: Use `npm start -- --port 3001`
- **Chat doesn't work**: Refresh the page, check console (F12)

---

See `README.md` for more documentation!
