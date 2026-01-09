require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });
const path = require('path');
const pkg = require('./package.json');
const mongoose = require('mongoose');
const fs = require('fs');
const webpush = require('web-push');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
let mongoConnected = false;

// Set up Web Push API (optional - only if VAPID keys are configured)
let webPushEnabled = false;
const vapidPublic = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivate = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublic && vapidPrivate) {
    try {
        webpush.setVapidDetails(
            'mailto:example@example.com',
            vapidPublic,
            vapidPrivate
        );
        webPushEnabled = true;
        console.log('✅ Web Push API enabled');
    } catch (err) {
        console.warn('⚠️ Web Push setup failed:', err.message);
        webPushEnabled = false;
    }
} else {
    console.warn('⚠️ VAPID keys not configured - Web Push disabled');
}

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI).then(() => {
        console.log('✅ Connected to MongoDB');
        mongoConnected = true;
    }).catch(err => {
        console.error('❌ Failed to connect to MongoDB:', err.message);
        console.error('⚠️ Falling back to file-based storage');
        mongoConnected = false;
    });
} else {
    console.warn('⚠️ MONGODB_URI not set - using file-based storage');
    mongoConnected = false;
}

// Message Schema
const messageSchema = new mongoose.Schema({
    room: { type: String, required: true, index: true },
    text: { type: String, required: true },
    sender: { type: String, required: true },
    color: { type: String, default: '#667eea' },
    timestamp: { type: Date, default: Date.now, index: true },
    isSystemMessage: { type: Boolean, default: false }
});

const Message = mongoose.model('Message', messageSchema);

// Push Subscription Schema
const subscriptionSchema = new mongoose.Schema({
    endpoint: { type: String, required: true, unique: true },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
    },
    createdAt: { type: Date, default: Date.now }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

app.get('/', (req, res) => {
    const roomsForDisplay = rooms.map(r => typeof r === 'string' ? r : r.name);
    res.render('index', {rooms: roomsForDisplay});
});

// These routes are now handled dynamically below
// Keeping them for backwards compatibility if needed

app.get('/version', (req, res) => {
    res.json({ version: pkg.version });
});

// Get VAPID public key endpoint
app.get('/vapid-public-key', (req, res) => {
    if (!webPushEnabled) {
        return res.json({ publicKey: null, enabled: false });
    }
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY, enabled: true });
});

// Subscribe to push notifications
app.post('/subscribe', jsonParser, async (req, res) => {
    const subscription = req.body;
    
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ success: false, message: 'Invalid subscription' });
    }
    
    try {
        if (mongoConnected && Subscription) {
            // Save subscription to MongoDB
            await Subscription.updateOne(
                { endpoint: subscription.endpoint },
                { ...subscription },
                { upsert: true }
            );
        } else {
            // Fallback: Save to file
            const subscriptionsFile = path.join(__dirname, 'subscriptions.json');
            let subs = [];
            if (fs.existsSync(subscriptionsFile)) {
                subs = JSON.parse(fs.readFileSync(subscriptionsFile, 'utf-8'));
            }
            // Remove if exists, then add new
            subs = subs.filter(s => s.endpoint !== subscription.endpoint);
            subs.push(subscription);
            fs.writeFileSync(subscriptionsFile, JSON.stringify(subs, null, 2));
        }
        
        res.json({ success: true, message: 'Subscription saved' });
    } catch (err) {
        console.error('Error saving subscription:', err);
        res.status(500).json({ success: false, message: 'Error saving subscription' });
    }
});

// Helper to send push notifications to all subscribers
async function sendPushNotificationToAll(title, options) {
    if (!webPushEnabled) {
        return; // Skip if Web Push not enabled
    }
    
    try {
        let subscriptions = [];
        
        if (mongoConnected && Subscription) {
            subscriptions = await Subscription.find({});
        } else {
            // Fallback: Read from file
            const subscriptionsFile = path.join(__dirname, 'subscriptions.json');
            if (fs.existsSync(subscriptionsFile)) {
                subscriptions = JSON.parse(fs.readFileSync(subscriptionsFile, 'utf-8'));
            }
        }
        
        const promises = subscriptions.map(sub => {
            return webpush.sendNotification(sub, JSON.stringify({
                title: title,
                options: options
            })).catch(err => {
                console.error('Push failed for subscription:', err.message);
                // Remove invalid subscriptions
                if (err.statusCode === 410) {
                    if (mongoConnected && Subscription) {
                        Subscription.deleteOne({ endpoint: sub.endpoint }).catch(() => {});
                    } else {
                        const subscriptionsFile = path.join(__dirname, 'subscriptions.json');
                        if (fs.existsSync(subscriptionsFile)) {
                            let subs = JSON.parse(fs.readFileSync(subscriptionsFile, 'utf-8'));
                            subs = subs.filter(s => s.endpoint !== sub.endpoint);
                            fs.writeFileSync(subscriptionsFile, JSON.stringify(subs, null, 2));
                        }
                    }
                }
            });
        });
        
        await Promise.all(promises);
    } catch (err) {
        console.error('Error sending push notifications:', err);
    }
}

// API endpoint to get all available rooms (for Service Worker background notifications)
app.get('/api/rooms', (req, res) => {
    try {
        const roomNames = rooms.map(r => typeof r === 'string' ? r : r.name);
        res.json({
            success: true,
            rooms: roomNames
        });
    } catch (e) {
        res.json({
            success: false,
            rooms: []
        });
    }
});

// Track last message timestamp per room for notifications
const lastMessageTime = {};

// API endpoint to check for new messages (for Service Worker background sync)
app.get('/check-messages/:room', async (req, res) => {
    const room = decodeURIComponent(req.params.room);
    const user = req.query.user || 'unknown';
    
    try {
        const messages = await loadRoomMessages(room);
        if (!lastMessageTime[room]) {
            lastMessageTime[room] = 0;
        }
        
        // Get messages since last check
        const newMessages = messages.filter(msg => {
            const msgTime = new Date(msg.timestamp).getTime();
            return msgTime > lastMessageTime[room];
        });
        
        // Update last message time
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            lastMessageTime[room] = new Date(lastMsg.timestamp).getTime();
        }
        
        res.json({
            success: true,
            messages: newMessages
        });
    } catch (e) {
        res.json({
            success: false,
            messages: []
        });
    }
});

// Store active SSE connections for notifications
const sseClients = {};

// SSE endpoint for push notifications
app.get('/notify/:room', (req, res) => {
    const room = decodeURIComponent(req.params.room);
    
    // Set up SSE connection
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    
    // Add client to room's SSE listeners
    if (!sseClients[room]) {
        sseClients[room] = [];
    }
    sseClients[room].push(res);
    
    // Keep connection alive
    const keepAliveInterval = setInterval(() => {
        res.write(': keepalive\n\n');
    }, 30000);
    
    // Clean up on disconnect
    req.on('close', () => {
        clearInterval(keepAliveInterval);
        sseClients[room] = sseClients[room].filter(client => client !== res);
        if (sseClients[room].length === 0) {
            delete sseClients[room];
        }
        res.end();
    });
});

let rooms = JSON.parse(fs.readFileSync('./rooms.json', 'utf-8'));

// Normalize rooms to support both string and object format
rooms = rooms.map(room => {
    if (typeof room === 'string') {
        return { name: room };
    }
    return room;
});

// Helper function to get messages file path for a room (fallback)
function getMessagesFilePath(room) {
    return path.join(__dirname, `room_messages_${room.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
}

// Helper function to load messages for a room
async function loadRoomMessages(room) {
    try {
        if (mongoConnected && Message) {
            const messages = await Message.find({ room: room }).sort({ timestamp: 1 }).exec();
            return messages;
        } else {
            // Fallback to file-based storage
            const filePath = getMessagesFilePath(room);
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        }
    } catch(e) {
        console.log(`Error loading messages for room ${room}:`, e);
        // Try fallback if MongoDB fails
        try {
            const filePath = getMessagesFilePath(room);
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        } catch(e2) {
            console.log(`Fallback also failed for room ${room}`);
        }
    }
    return [];
}

// Helper function to save a message for a room
async function saveRoomMessage(room, message) {
    try {
        if (mongoConnected && Message) {
            const msg = new Message({
                room: room,
                text: message.text,
                sender: message.sender,
                color: message.color,
                timestamp: message.timestamp,
                isSystemMessage: message.isSystemMessage || false
            });
            await msg.save();
        } else {
            // Fallback to file-based storage
            const filePath = getMessagesFilePath(room);
            let messages = [];
            if (fs.existsSync(filePath)) {
                messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
            messages.push(message);
            fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
        }
    } catch(e) {
        console.log(`Error saving message for room ${room}:`, e);
        // Try fallback if MongoDB fails
        try {
            const filePath = getMessagesFilePath(room);
            let messages = [];
            if (fs.existsSync(filePath)) {
                messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
            messages.push(message);
            fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
        } catch(e2) {
            console.log(`Fallback also failed for room ${room}`);
        }
    }
}

// Helper function to get room info
function getRoomInfo(roomName) {
    return rooms.find(room => {
        const name = typeof room === 'string' ? room : room.name;
        return name === roomName;
    });
}

// Create routes for all rooms from rooms.json
rooms.forEach(room => {
    const roomName = typeof room === 'string' ? room : room.name;
    app.get('/' + encodeURIComponent(roomName), async (req, res) => {
        const messages = await loadRoomMessages(roomName);
        res.render('room', {room: roomName, messages: messages});
    });
});

// Password verification endpoint
app.post('/verify-password', jsonParser, (req, res) => {
    const { room, password } = req.body;
    const roomInfo = getRoomInfo(room);
    
    if (!roomInfo) {
        return res.json({ success: false, message: 'Room not found' });
    }
    
    // Check if room requires password
    if (roomInfo.password) {
        if (password === roomInfo.password) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Incorrect password' });
        }
    } else {
        // No password required
        res.json({ success: true });
    }
});

app.post('/newroom', jsonParser, (req, res) => {
    const { room, password } = req.body;
    
    if(!rooms.find(r => (typeof r === 'string' ? r : r.name) === room)) {
        const newRoom = password ? { name: room, password } : { name: room };
        rooms.push(newRoom);
        
        // Create new route for this room
        const roomName = typeof newRoom === 'string' ? newRoom : newRoom.name;
        app.get('/' + encodeURIComponent(roomName), async (req, res) => {
            const messages = await loadRoomMessages(roomName);
            res.render('room', {room: roomName, messages: messages});
        });
        
        if(req.body.save) {
            let roomsFromFile = JSON.parse(fs.readFileSync('./rooms.json', 'utf-8'));
            roomsFromFile.push(newRoom);
            fs.writeFileSync("./rooms.json", JSON.stringify(roomsFromFile, null, 2));
        }
        res.json({
            'room': room
        });
    }
    else {
        res.json({
            'error': 'room already exists'
        })
    }
})

const admin = io.of("/admin");

// Track online users per room
const roomUsers = {};

admin.on('connection', (socket) => {
    socket.on('join', async (data) => {
        socket.join(data.room);
        
        // Track user in room
        if (!roomUsers[data.room]) {
            roomUsers[data.room] = {};
        }
        roomUsers[data.room][socket.id] = {
            name: data.name || 'User',
            color: data.color || '#667eea'
        };

        // Send previous messages for all rooms
        try {
            const messages = await loadRoomMessages(data.room);
            messages.forEach(msg => {
                socket.emit('chat message', {
                    text: msg.text,
                    sender: msg.sender || 'User',
                    color: msg.color || '#667eea',
                    timestamp: msg.timestamp
                });
            });
        } catch(e) {
            // Database error - continue anyway
        }

        // Send updated user list to all in room
        const usersList = roomUsers[data.room];
        admin.in(data.room).emit('users list', usersList);
        
        // Notify others that user joined
        admin.in(data.room).emit('user joined', {
            socketId: socket.id,
            name: data.name || 'User',
            color: data.color || '#667eea'
        });
    })

    socket.on('chat message', async (data) => {
        // Handle system messages (like highscores)
        if (data.isSystemMessage) {
            // Don't save system messages to database, just broadcast them
            admin.in(data.room).emit('chat message', {
                text: data.msg,
                sender: data.sender || 'System',
                color: data.color || '#FFD700',
                isSystemMessage: true,
                timestamp: new Date()
            });
            
            // Send via SSE for background notifications
            if (sseClients[data.room]) {
                sseClients[data.room].forEach(client => {
                    client.write(`data: ${JSON.stringify({
                        type: 'system-message',
                        text: data.msg,
                        sender: data.sender
                    })}\n\n`);
                });
            }
        } else {
            // Save regular message to MongoDB
            const messageData = {
                text: data.msg,
                sender: data.sender || 'User',
                color: data.color || '#667eea',
                timestamp: new Date()
            };
            
            await saveRoomMessage(data.room, messageData);
            
            // Emit the message to all clients in the room
            admin.in(data.room).emit('chat message', messageData);
            
            // Send Web Push notification to all subscribed devices
            await sendPushNotificationToAll(
                `💬 ${data.sender} in ${data.room}`,
                {
                    body: data.msg,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    tag: `message-${data.room}`,
                    data: {
                        room: data.room,
                        sender: data.sender,
                        timestamp: Date.now()
                    }
                }
            );
            
            // Send via SSE for background notifications (only regular messages)
            if (sseClients[data.room]) {
                sseClients[data.room].forEach(client => {
                    client.write(`data: ${JSON.stringify({
                        type: 'message',
                        text: data.msg,
                        sender: data.sender
                    })}\n\n`);
                });
            }
        }
    });

    socket.on('edit message', (data) => {
        // Broadcast edited message to all clients in the room
        admin.in(data.room).emit('message edited', {
            sender: data.sender,
            newText: data.newText
        });
    });

    socket.on('alarm', (data) => {
        // Broadcast alarm to all clients in the room (including sender)
        admin.in(data.room).emit('alarm', {
            sender: data.sender,
            timestamp: data.timestamp
        });
    });

    socket.on('disconnect', () => {
        // Remove user from all rooms
        for (const room in roomUsers) {
            if (roomUsers[room][socket.id]) {
                const userData = roomUsers[room][socket.id];
                delete roomUsers[room][socket.id];
                
                // Notify remaining users
                admin.in(room).emit('user left', {
                    socketId: socket.id,
                    name: userData.name
                });
                
                // Send updated user list
                admin.in(room).emit('users list', roomUsers[room]);
            }
        }
    })
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`listening on *:${process.env.PORT || 3000}`);
});