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

// Create routes for all rooms from rooms.json
rooms.forEach(room => {
    app.get('/' + encodeURIComponent(room), (req, res) => {
        res.render('room', {room: room, messages: []});
    });
});

app.post('/newroom', jsonParser, (req, res) => {
    const room = req.body.room;
    
    if(!rooms.includes(room)) {
        rooms.push(room);
        
        // Create new route for this room
        app.get('/' + encodeURIComponent(room), (req, res) => {
            res.render('room', {room: room, messages: []});
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

        // Send previous messages for "Felles rom"
        if(data.room === 'Felles rom') {
            try {
                const messages = JSON.parse(fs.readFileSync('./messages.json', 'utf-8'));
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
        // Check if the message is from "Felles rom"
        if(data.room === 'Felles rom') {
            // Read current messages from messages.json
            let messages = JSON.parse(fs.readFileSync('./messages.json', 'utf-8'));
            // Add the new message to the array
            const newMessages = messages.concat([{
                text: data.msg,
                sender: data.sender || 'User',
                color: data.color || '#667eea',
                timestamp: new Date()
            }]);
            // Write updated messages back to messages.json
            fs.writeFileSync("./messages.json", JSON.stringify(newMessages));
        }
        // Emit the message to all clients in the room
        admin.in(data.room).emit('chat message', {
            text: data.msg,
            sender: data.sender || 'User',
            color: data.color || '#667eea',
            timestamp: new Date()
        });
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