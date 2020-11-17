// socket.js
// =========
'use strict';
var debug = require('debug')('CD.io');

/** Generates CD.io object */
module.exports = function (expressServer){

    var self = this;
    self.pendingConnections = {}
    self.io = require('socket.io')(expressServer);
    
    /** controllers Namespace
     * this is for socket connecetions between the CD-p2p-server and building controllers,
     * used for messaging the 
     *  
     */
    self.controllersNsp = this.io.of('/controllers');
    self.controllersNsp.on('connection', (socket)=>{
        var debug = require('debug')('CD.io.ctlNsp.soc:'+socket.id.substring(0, 5));
        debug('emitting id_request on connection.');
        socket.emit('id_request');

        socket.on('client_id',id=>{
            socket.CD=id;
            debug('incomming client id:\n%O',id);
        })

        socket.on('disconnect', ()=>{
            debug('controller disconnected..');
            debug('rooms after \n%O',self.p2pNsp.adapter.rooms);
            console.log(self.p2pNsp.adapter.rooms);
        })        

        console.log('controllersRooms after connect. (should only ever be single rooms');
        console.log(self.controllersNsp.adapter.rooms);
    })
    
    self.createRoom = (controller_id, people_id, roomName, cb)=>{//roomName is uuid
        debug('incoming request to create p2p room: ',roomName);        
        self.controllersNsp.sockets.forEach((socket)=>{
            console.log(socket.CD);
            if (socket.CD.controller_id === controller_id){
                debug('found connected controller: ',controller_id);
                debug('emitting connectionRequest for user: ',people_id);
                self.pendingConnections[roomName]={people_id:people_id,controller_id:controller_id};
                socket.emit('connectionRequest', roomName, people_id);
                cb("connection request sent.");
                return
            } else {
                return
            }
        })
        debug('controller connection not found.');
        cb("controller connection not found. request ignored.");
        return;
    }

    /** p2pClients Namespace
     * this is for socket connecetions between the CD-p2p-server and controllers,
     * used for messaging the 
     *  
     */
    self.p2pNsp = this.io.of('/p2pClients');
    const p2p = require('socket.io-p2p-server');
    self.p2pserver = p2p.Server;
    self.p2pclients = p2p.clients;

    self.p2pNsp.on('connection', (socket)=>{
        var debug = require('debug')('CD.io.p2pNsp.soc:'+socket.id.substring(0, 5));
        if (!socket.CD) socket.CD = {}; //Storage for this program
        //add a one minute timer to kill the connection if not joined/used
        debug('emmiting id_request');
        socket.emit('id_request on socket id ', socket.id);

        socket.on('client_id',id=>{
            socket.CD.uuid = id.uuid,
            socket.CD.controller_id = id.controller_id,
            socket.CD.building_name = id.building_name,
            socket.CD.building_id = id.building_id;
            socket.CD.people_id = id.people_id;
            socket.CD.controller = id.controller,
            
            debug('incomming client id:\n%O',id);
            joinRoom(socket);
        })

        function joinRoom(socket){
            //make sure the uuid exists in pendingConnections
            debug('Checking socket.CD\n%O',socket.CD);
            debug('Checking with pendingConnections\n%O',self.pendingConnections);
            if (self.pendingConnections[socket.CD.uuid] == undefined
             || self.pendingConnections[socket.CD.uuid].controller_id != socket.CD.controller_id
             || self.pendingConnections[socket.CD.uuid].people_id != socket.CD.people_id){
                console.log('client attempting to connect with invalid uuid.\n rejecting request');
                console.log('client:',socket.CD);
                if (!socket.CD.controller){
                    //If it's not a controller, kill the underlying connection
                    socket.disconnect(true);
                    console.log('USER attempting to connect with invalid uuid.\n Closing entire connection');}  
                else {
                     //else, just kill this socket
                    socket.disconnect(false);
                    console.log('CONTROLLER attempting to connect with invalid uuid.\n Closing just the p2p socket');};
                return;
            }

            debug('attempting to join room: %s', socket.CD.uuid);
            //Make sure this only runs once per socket
            debug('checking if socket has already joined.',socket.CD.joined);
            if (socket.CD.joined===true){
            console.error('peer can not join room more than once.. did it get multiple id_requests?');
            return;}  socket.CD.joined=true;
            
            const roomName  = socket.CD.uuid;

            socket.join(roomName);
            self.p2pserver(socket, null, roomName);
            
            
            socket.on('message', function (data) {
                socket.in(roomName).emit('message', data);
                debug('messaging room: %s',roomName);
                debug('=>%s',data);
                
            });

            socket.on('goPrivate', function () {
                socket.in(roomName).emit('goPrivate');
            })


            //emits to all people in the room including the current socket client
            self.p2pNsp.in(roomName).emit('headCount',
                self.p2pNsp.adapter.rooms.get(roomName).size
            );

            debug('p2p rooms after join function \n %O', self.p2pNsp.adapter.rooms);
            //console.log(self.p2pNsp.adapter.rooms);
        }        

        socket.on('error', function (err) {
            debug("Error %s", err);
        })

        socket.on('disconnect', ()=>{
            console.log('client disconnected..');
            debug('rooms after disconnect %O', self.p2pNsp.adapter.rooms);
            console.log(self.p2pNsp.adapter.rooms);
        })

        socket.emit('id_request');

        socket.on('client_id',id=>{
            socket.CD=id;
        })

        console.log('p2p rooms after connect');
        console.log(self.p2pNsp.adapter.rooms);
        //console.log(p2p.clients);

    })
    
    

}