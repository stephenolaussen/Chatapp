# ⚡ Quick Start Guide

## 🚀 Run Locally (Windows)

### Enkleste måte:
Dobbelklikk på `start.bat` - Done! 🎉

### Eller manuelt:
```bash
npm install
npm start
```

Åpne http://localhost:3000

## 📤 Legg på GitHub

1. **Installer Git**: https://git-scm.com/download/win
2. **Åpne PowerShell** i prosjekt-mappen
3. **Kjør disse kommandoene**:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/familieskatt.git
git push -u origin main
```

(Erstatt `YOUR_USERNAME` med ditt GitHub-brukernavn)

## 🌐 Deploy til internett

### Vercel (Anbefalt - Gratis & Enkel):
1. Gå til https://vercel.com
2. Logg inn med GitHub
3. Klikk "Add New..." → "Project"
4. Velg `familieskatt`
5. Klikk "Deploy"

**Ferdig!** Din app er live! 🎉

## 📱 Installer på telefon

### iPhone (Safari):
Share → Legg til på startsiden

### Android (Chrome):
Meny (⋮) → Installer app

## 📋 Filstruktur

```
├── index.js              # Server-fil
├── package.json          # Dependencies
├── views/                # HTML-templates (EJS)
│   ├── index.ejs        # Startside
│   └── room.ejs         # Chat-side
├── public/               # Statiske filer
│   ├── sw.js            # Service Worker
│   ├── manifest.json    # PWA config
│   └── icons/           # Ikoner
└── README.md            # Full dokumentasjon
```

## 🔧 Commando-referanse

| Kommando | Hva det gjør |
|----------|-------------|
| `npm install` | Installer dependencies |
| `npm start` | Start serveren |
| `node index.js` | Start serveren (alternativ) |
| `git status` | Se git-status |
| `git add .` | Legg til alle filene |
| `git commit -m "msg"` | Lag commit |
| `git push` | Push til GitHub |

## 🎯 Neste steg

1. Test chatten lokalt
2. Lag GitHub-repo
3. Deploy til Vercel
4. Del linken med familien!

## ❓ Problemer?

- **Server starter ikke**: Sjekk at Node.js er installert
- **Port 3000 er opptatt**: Bruk `npm start -- --port 3001`
- **Chatten virker ikke**: Refresh siden, sjekk console (F12)

---

Se `README.md` for mer dokumentasjon!
