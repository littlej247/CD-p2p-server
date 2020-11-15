'use strict';
console.log("Starting connBroker app.js");

//Controller app script.
global.CD = {
    app: {
        init: ()=>{
            //Construct the app..
            
            //check for demo flag
            if (process.argv[2] === 'demo'){
                CD.app.config.demo = true;
                console.log('running http demo mode');
            }

            //Start stuff.
            const express = require('express');
            const app = express();
            const expressServer = app.listen(9001);

            //If demo flag, share public folder at root
            if (CD.app.config.demo === true){
                app.use(express.static('public') );
            } else {
                app.get('/', function (req, res) {
                    res.send('CD-p2p-server');
                })
            }
            
            //setupTurnServer();
            CD.sockets = new setupSockets(expressServer);
            
        },
        config:{
            demo: false
        }
    }
}


function setupTurnServer(){
    var Turn = require('node-turn');
    var server = new Turn({
    // set options
        authMech:       'none',
        listeningPort:  3478,
        credentials: {
            littlej247: "14d67398-b074-4179-b316-cfa1d2370a69"
        },
        externalIps: {
            default:    "184.69.231.122"  //"ide.cumberlandapartments.ca"  
        }
    });
    server.start();
}


function setupSockets(expressServer){
    this.io = require('socket.io')(expressServer);
    
    this.controllerDataNsp = this.io.of('/controllerData');
    const controllerDataNsp = this.controllerDataNsp;
    ((io)=>{

        const p2p = require('socket.io-p2p-server');
        global.p2pserver = p2p.Server;
        global.p2pclients = p2p.clients;

        io.on('connection', (socket)=>{
            
            function joinRoom(roomName){
                socket.join(roomName);
                p2pserver(socket, null, roomName);
                socket.emit('roomName', roomName);
                
                socket.on('message', function (data) {
                    socket.in(roomName).emit('message', data);
                    console.log('message from room: ', roomName);
                    console.log('message: ', data);
                });

                socket.on('goPrivate', function () {
                    socket.in(roomName).emit('goPrivate');
                })

                io.in(roomName).emit('headCount',
                    controllerDataNsp.adapter.rooms.get(roomName).size
                );

                console.log('rooms after join function');
                console.log(io.adapter.rooms);
            }

            socket.on("joinRoom",(roomName)=>{
                joinRoom(roomName);
            });
            
            socket.on('createRoom',()=>{
                const roomName = create_UUID();
                joinRoom(roomName);
            })

            socket.on('error', function (err) {
                console.log("Error %s", err);
            })

            socket.on('disconnect', ()=>{
                console.log('client disconnected..');
                console.log('rooms after disconnect');
                console.log(io.adapter.rooms);
            })

            console.log('rooms after connect');
            console.log(io.adapter.rooms);
        })


    })(this.controllerDataNsp);
}

//Will look into replacing this with a UUID library later
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