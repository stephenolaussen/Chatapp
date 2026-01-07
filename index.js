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
    res.render('index', {rooms: rooms});
  });

// These routes are now handled dynamically below
// Keeping them for backwards compatibility if needed

app.get('/version', (req, res) => {
    res.json({ version: pkg.version });
});

let rooms = JSON.parse(fs.readFileSync('./rooms.json', 'utf-8'));

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

// Create routes for all rooms from rooms.json
rooms.forEach(room => {
    app.get('/' + encodeURIComponent(room), (req, res) => {
        const messages = loadRoomMessages(room);
        res.render('room', {room: room, messages: messages});
    });
});

app.post('/newroom', jsonParser, (req, res) => {
    const room = req.body.room;
    
    if(!rooms.includes(room)) {
        rooms.push(room);
        
        // Create new route for this room
        app.get('/' + encodeURIComponent(room), (req, res) => {
            const messages = loadRoomMessages(room);
            res.render('room', {room: room, messages: messages});
        });
        
        if(req.body.save) {
            let roomsFromFile = JSON.parse(fs.readFileSync('./rooms.json', 'utf-8'));
            const newRooms = roomsFromFile.concat([room]);
            fs.writeFileSync("./rooms.json", JSON.stringify(newRooms));
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
        // Save message for all rooms
        const messageData = {
            text: data.msg,
            sender: data.sender || 'User',
            color: data.color || '#667eea',
            timestamp: new Date()
        };
        
        saveRoomMessage(data.room, messageData);
        
        // Emit the message to all clients in the room
        admin.in(data.room).emit('chat message', messageData);
    });

    socket.on('edit message', (data) => {
        // Broadcast edited message to all clients in the room
        admin.in(data.room).emit('message edited', {
            sender: data.sender,
            newText: data.newText
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