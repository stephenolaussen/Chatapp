const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });
const path = require('path');
const pkg = require('./package.json');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
var fs = require('fs');

app.get('/', (req, res) => {
    const roomsForDisplay = rooms.map(r => typeof r === 'string' ? r : r.name);
    res.render('index', {rooms: roomsForDisplay});
});

// These routes are now handled dynamically below
// Keeping them for backwards compatibility if needed

app.get('/version', (req, res) => {
    res.json({ version: pkg.version });
});

let rooms = JSON.parse(fs.readFileSync('./rooms.json', 'utf-8'));

// Normalize rooms to support both string and object format
rooms = rooms.map(room => {
    if (typeof room === 'string') {
        return { name: room };
    }
    return room;
});

// Helper function to get messages file path for a room
function getMessagesFilePath(room) {
    return path.join(__dirname, `room_messages_${room.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
}

// Helper function to load messages for a room
function loadRoomMessages(room) {
    try {
        const filePath = getMessagesFilePath(room);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch(e) {
        console.log(`Error loading messages for room ${room}:`, e);
    }
    return [];
}

// Helper function to save a message for a room
function saveRoomMessage(room, message) {
    try {
        const filePath = getMessagesFilePath(room);
        let messages = loadRoomMessages(room);
        messages.push(message);
        fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
    } catch(e) {
        console.log(`Error saving message for room ${room}:`, e);
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
    app.get('/' + encodeURIComponent(roomName), (req, res) => {
        const messages = loadRoomMessages(roomName);
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
        app.get('/' + encodeURIComponent(roomName), (req, res) => {
            const messages = loadRoomMessages(roomName);
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
    socket.on('join', (data) => {
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
            const messages = loadRoomMessages(data.room);
            messages.forEach(msg => {
                socket.emit('chat message', {
                    text: msg.text,
                    sender: msg.sender || 'User',
                    color: msg.color || '#667eea',
                    timestamp: msg.timestamp
                });
            });
        } catch(e) {
            // File doesn't exist or is empty
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

    socket.on('chat message', (data) => {
        // Handle system messages (like highscores)
        if (data.isSystemMessage) {
            // Don't save system messages to file, just broadcast them
            admin.in(data.room).emit('chat message', {
                text: data.msg,
                sender: data.sender || 'System',
                color: data.color || '#FFD700',
                isSystemMessage: true,
                timestamp: new Date()
            });
        } else {
            // Save regular message for all rooms
            const messageData = {
                text: data.msg,
                sender: data.sender || 'User',
                color: data.color || '#667eea',
                timestamp: new Date()
            };
            
            saveRoomMessage(data.room, messageData);
            
            // Emit the message to all clients in the room
            admin.in(data.room).emit('chat message', messageData);
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