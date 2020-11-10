'use strict';
console.log("Starting connBroker app.js");

//Controller app script.
global.CD = {
    app: {
        init: ()=>{

            //Construct the app..
            const express = require('express');
            const app = express();
            const expressServer = app.listen(9001);

            app.use(express.static('public') );


            CD.sockets = new setupSockets(expressServer);
        }
    }
}



    function setupSockets(expressServer){
        this.io = require('socket.io')(expressServer);

        
        const controllerDataNsp = this.io.of('/controllerData');
        ((io)=>{
            global.nsp = io;  //for interacting with the namespace from consel.

            const m = require('socket.io-p2p-server');
            
            global.p2pserver = m.Server;
            global.p2pclients = m.clients

            global.rooms = [];
            global.clients = {};

            console.log('rooms at setup: ', + io.adapter.rooms.size);

            io.on('connection', (socket)=>{
                console.log('room count on connection start ', socket.id)
                console.log(io.adapter.rooms.size);
                for (let [key, value] of io.adapter.rooms) {
                   console.log(value)
                }
                
                socket.to('some room').on('message',(data)=>{console.log(data);});




                clients[socket.id] = socket
                var room = findOrCreateRoom()
                socket.join(room.name);
                //sending to all clients in the room INCLUDING the sender..
                //io.in(room.name).emit('message','you are now in room ' + room.name);
                socket.emit('message','you are now in room ' + room.name);
                room.playerCount++
                room.players.push(socket)

                socket.on('error', function (err) {
                    console.log("Error %s", err);
                })

                p2pserver(socket, null, room);
                

                socket.on('disconnect', function () {
                    room.players.splice(room.players.indexOf(socket), 1)
                    removeRoom(room)
                    io.to(room.name).emit('message',"user disconnected...");

                    // Move opponents to new rooms
                    // var opponents = findOpponents(room.name, socket)
                    console.log('user disconnected. ', socket.id);
                    Object.keys(room.players).forEach(function (clientId, i) {
                        room = findReadyRoom()
                        if (clients[clientId] && room) {
                            clients[clientId].join(room.name)
                        }
                    })
                    console.log('rooms after disconnect');
                    console.log(io.adapter.rooms);
                })

                socket.on('message', function (data) {
                    var players = room.players.filter(function (player) {
                        return player !== socket
                    })
                    players.forEach(function (player) {
                        player.emit('message', data);
                        console.log('message from room: ', socket.room);
                        console.log('message: ', data);
                    })
                })

                    console.log('rooms after connect');
                    console.log(io.adapter.rooms);

                if (room.playerCount === 1) {
                    console.log("Waiting for someone to join..");
                    socket.emit('message','waiting for someone to join..')
                } else {
                    //sending to all clients in the room INCLUDING the sender..
                    io.in(room.name).emit('message', 'This should be everone in the room...');
                
                
                }
            })

            function findOrCreateRoom () {
            var lastRoom = findReadyRoom ()
            if (!lastRoom || lastRoom.full) {
                var room = {players: [], playerCount: 0, name: create_UUID()}
                return addRoom(room)
            }
            return lastRoom
            }

            function findReadyRoom () {
            return rooms.filter(function(room) { return room.playerCount === 1 })[0];
            }

            function removeRoom (room) {
            room.playerCount--
            if (room.playerCount === 0) rooms.splice(rooms.indexOf(room), 1)
            }

            function addRoom (room) {
            return rooms[rooms.push(room) - 1]
            }










        })(controllerDataNsp);
        
        

        
        

        
    }

function create_UUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}

CD.app.init();