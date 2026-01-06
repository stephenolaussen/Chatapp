# 💬 Familie Chat - Family Chat App

A simple, fun and modern chat app designed specifically for your family. Features modern design, emoji support, and the ability to install directly on your phone as a PWA.

## ✨ Features

- 💬 **Real-time chat** with Socket.io
- 👤 **User identification** - Choose name and color
- 😊 **Emoji picker** with popular emojis
- 📱 **PWA (Progressive Web App)** - Can be installed on phone
- 🔄 **Service Worker** - Offline support and auto-update via version number
- 🎨 **Modern design** - Responsive layout for all devices
- 🏠 **Room system** - Create different chat rooms for different topics
- 💾 **Persistent data** - Messages are saved (for main room)

## 🚀 Quick Start

### Requirements
- Node.js >= 18.0.0
- npm

### Installation

1. Clone or download the repository
```bash
git clone https://github.com/yourusername/familie-chat.git
cd familie-chat
```

2. Install dependencies
```bash
npm install
```

3. Run the app
```bash
npm start
```

4. Open your browser to `http://localhost:3000`

## 📱 Install on Phone

### iPhone (iOS)
1. Open the app in Safari
2. Tap the "Share" button
3. Select "Add to Home Screen"
4. Tap "Add"

### Android
1. Open the app in Chrome
2. Tap the menu (⋮)
3. Select "Install app" or "Add to Home Screen"
4. Confirm

## 🌐 Deploy

### Vercel (Recommended)
Easiest way to deploy - free and automatic deployment from GitHub!

1. Go to [vercel.com](https://vercel.com)
2. Log in with GitHub
3. Select this repository
4. Click "Deploy"
5. Your app is live!

### Railway
1. Go to [railway.app](https://railway.app)
2. Connect to GitHub
3. Select the repository
4. Click "Deploy"

### Heroku
```bash
heroku create your-app-name
git push heroku main
```

## 📖 Usage

### Create a Room
1. From the home page, enter the room name
2. Choose whether to save the room permanently
3. Click "Create"

### Chat
1. Choose your name and color when you first enter
2. Type messages in the input field
3. Use the emoji button to select emojis
4. Your messages will be displayed in your chosen color

### Edit Profile
Click your username in the top right corner to change your name and color

## 🔄 Versioning & Updates

The app uses a service worker that caches files locally. To trigger an update:

1. Update the `version` in `package.json`
2. Push the changes to GitHub
3. The app will automatically notify users of the new version

For PWA: Users will see an update notification and can choose to update.

## 📁 Folder Structure

```
familie-chat/
├── index.js                 # Main server file
├── package.json            # Dependencies and version
├── views/
│   ├── index.ejs          # Home page
│   └── room.ejs           # Chat room page
├── public/
│   ├── sw.js              # Service Worker
│   ├── manifest.json      # PWA manifest
│   └── icons/             # App icons
├── messages.json          # Saved messages
└── rooms.json            # Saved rooms
```

## 🛠️ Technology

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io
- **Template**: EJS
- **PWA**: Service Worker, Web Manifest
- **Hosting**: Vercel/Railway/Heroku

## 📝 License

MIT

## 🤝 Contributing

Feel free to send pull requests or create issues for improvements!

## 💡 Future Features

- [ ] File/Image sharing
- [ ] Typing indicator ("X is typing...")
- [ ] Private messages
- [ ] User online status
- [ ] Message reactions
- [ ] Voice messages
- [ ] Dark mode

---

**Built with ❤️ for your family!**
