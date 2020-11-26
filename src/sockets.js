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
            //console.log(self.p2pNsp.adapter.rooms);
        })        

        debug('controllersRooms after connect. (should only ever be single rooms \n%O',self.controllersNsp.adapter.rooms);
    })
    
    self.createRoom = (controller_id, people_id, roomName, cb)=>{//roomName is uuid
        debug('incoming request to create p2p room: ',roomName);

        const socket = self.tools.getControllerSocket(controller_id);
        if (socket === false){
            
            return
        }
        
        const waiting = self.tools.isControllerWaiting(controller_id, people_id, roomName);
        debug('waiting result', waiting);
        if ( waiting != false){
            debug('controller is waiting..');
            cb(waiting);
            return;
        }
            

        //go ahead with new room request..
        debug('emitting connectionRequest for user: ',people_id);
        self.pendingConnections[roomName]={people_id:people_id,controller_id:controller_id};
        socket.emit('connectionRequest', roomName, people_id);
        cb("connection request sent.");
    
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
        
        debug('emitting id_request on new connection');

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
            //debug('Checking socket.CD\n%O',socket.CD);
            debug('Checking with pendingConnections\n%O',self.pendingConnections);
            if (self.pendingConnections[socket.CD.uuid] == undefined
             || self.pendingConnections[socket.CD.uuid].controller_id != socket.CD.controller_id
             || self.pendingConnections[socket.CD.uuid].people_id != socket.CD.people_id){
                console.log('client attempting to connect with invalid uuid.\n rejecting request');
                //console.log('client:',socket.CD);
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

            const roomName  = socket.CD.uuid;
            debug('attempting to join room: %s', roomName);

            //If room exists & it's a controller, make sure there is no other controller in the room
            
            let clientsMap = self.p2pNsp.adapter.rooms.get(roomName);
            console.log('look at this thing,',clientsMap);
            if (clientsMap != undefined){
              debug('inspecting other clients in the room.');
              //itterate through clients in the room.
              for (let client_id of clientsMap){ let cliSoc = self.p2pNsp.sockets.get(client_id);
                    //for (cliSoc of self.p2pNsp.adapter.rooms.get(socket.CD.uuid)){

                    if( socket.CD.controller == true && cliSoc.CD.controller == true){
                        debug("Can't have more than one controller per room. Aborting join and disconnecting socket.");
                        socket.disconnect();
                        return;
                    }

                    if( cliSoc.id == socket.id){
                        debug("Can't join room more than once.. did it get multiple id_requests?");
                        return;
                    }
              }
            }
            
            

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
        })

        socket.emit('id_request');

        socket.on('client_id',id=>{
            socket.CD=id;
        })

        debug('p2p rooms after connect %O',self.p2pNsp.adapter.rooms);
    })
    
    self.tools = {}

    //Search p2pNps for a connection from the controller
    self.tools.isControllerWaiting = (controller_id, people_id, uuid)=>{
        //Is controller already waiting in a room for the client?
        debug('scanning p2p clients...')
        for ( var cliSoc of self.p2pNsp.sockets){
            cliSoc = cliSoc[1];
            debug('id of connection being examined:', cliSoc.id);
            
            if (!cliSoc.CD){ debug("connection missing CD data");
                console.error('this should never happen. please investigate');
                continue;
            }
            if (   cliSoc.CD.controller     === true
                && cliSoc.CD.controller_id  === controller_id
                && cliSoc.CD.people_id      === people_id)   
            {
                debug("connection belongs to a controler that is here for the same person.");
                
                if ( 
                    cliSoc.adapter.rooms.get(uuid) != undefined                    ){
                    debug("controller already has a socket in this ROOM. denied.");
                    return {status: "denied", description:"controller already has a socket in this room. denied."};
                }

                //Cycle throug all rooms this client is in.
                for (var roomName of cliSoc.rooms){
                    //ignore rooms named after the client_id. (every client gets a room named after them)
                    if (cliSoc.id == roomName) continue;
                    debug("connection in question is in this room:", roomName);//<- room name..
                    
                    let room = CD.io.p2pNsp.adapter.rooms.get(roomName);
                    if (room.size < 2) {
                        //initially this redirect might seem like a vulnrability but this api can only be called by the app with an api key and a user with permissions.
                        debug("controller is already waiting for this client in another room. redirecting client to that UUID.");
                        return {
                            status:     "redirect", 
                            description:"controller is already waiting for this client in another room. redirecting client to that UUID.", 
                            redirect:   roomName
                        };
                        
                    }
                    debug ('rooms value: %O',room); 
                }
            }
        }
        return false;
    }


    //Check it controller is connected..
    self.tools.getControllerSocket = (controller_id)=>{
        for (let socket of self.controllersNsp.sockets.values()) {

        //self.controllersNsp.sockets.forEach((socket)=>{
            if (socket.CD.controller_id === controller_id){
                debug('found connected controller: ',controller_id);
                return socket;
            }
        }
        //)
        return false;
    }

}