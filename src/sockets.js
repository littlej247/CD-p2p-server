// socket.js
// =========
'use strict';
var debug = require('debug')('CD.io');

/** Generates CD.io object */
module.exports = function (expressServer){

    var self = this; //self is "CD.io"
    self.pendingConnections = {}
    self.io = require('socket.io')(expressServer,{
        cors:{
            origin:"https://ide.cumberlandapartments.ca"
        }});
    
    /** controllers Namespace
     * this is for constant socket connecetions between the CD-p2p-server and building controllers,
     * when '/api/connRequest' is called, which calls self.createRoom, the connections in this namespace are used to tell
     * the building controller to call in and make a new CD.io.p2pNsp.soc
     */
    self.controllersNsp = this.io.of('/controllers');
    self.controllersNsp.on('connection', (socket)=>{
        var debug = require('debug')('CD.io.ctlNsp:'+socket.id.substring(0, 5));
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

        const socket = tools.getControllerSocket(controller_id);
        if (socket === false){
            cb({"status"        :   "controller offline",
            "description"   :   "Controller connection not found"});
            return;
        }
        
        const waiting = tools.isControllerWaiting(controller_id, people_id, roomName);
        debug('waiting result', waiting);
        if ( waiting != false){
            debug('controller is waiting..');
            cb(waiting);
            return;
        }
            

        //go ahead with new room request..
        debug('emitting connectionRequest for user: ',people_id);
        self.pendingConnections[roomName]={people_id:people_id,controller_id:controller_id};
        self.pendingConnections[roomName].timeOut = setTimeout(()=>{
            debug ("pendingConnection expired. \n Removing " + roomName);
            delete self.pendingConnections[roomName];
        },120000);
        socket.emit('connectionRequest', roomName, people_id);
        cb({"status"        :   "success",
            "description"   :   "Request successfully send to controller"}
        );
    
    }

    /** p2pClients Namespace
     * this is for socket connecetions with user devices and the controller they want to connect to.
     * Controllers will have to create a socket connection in this namespace for each user were they can then be placed
     * in a room together to have all their messages relayed to each other. Controllers must have seperate connetions to this namespace because
     * this module wi
     * used for messaging the 
     *  
     */
    self.p2pNsp = this.io.of('/p2pClients');
    //const p2p = require('./socket-p2p.js');   //temporarily removing this feature
    //self.p2pserver = p2p.Server;              //temporarily removing this feature
    //self.p2pclients = p2p.clients;            //temporarily removing this feature

    self.p2pNsp.on('connection', (socket)=>{
        var debug = require('debug')('CD.io.p2pNsp:'+socket.id.substring(0, 5));
        if (!socket.CD) socket.CD = { }; //Storage for this program

        //add a one minute timer to kill the connection if not joined/used
        
        debug('emitting id_request on new connection');

        socket.on('client_id',id=>{
            socket.CD.uuid = id.uuid,
            socket.CD.controller_id = id.controller_id,
            socket.CD.building_name = id.building_name,
            socket.CD.building_id = id.building_id;
            socket.CD.people_id = id.people_id;
            socket.CD.controller = id.controller;
            
            debug('incomming client id:\n%O',id);
            joinRoom(socket);
        })

        function joinRoom(socket){      try{
            
           { //make sure the uuid exists in pendingConnections
            //debug('Checking socket.CD\n%O',socket.CD);
            /*
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
        */}
            const roomName = socket.CD.uuid;
            debug('attempting to join room: %s', roomName);

            //If room exists...
            let roomMap = self.p2pNsp.adapter.rooms.get(roomName);
            if (roomMap != undefined){
                debug('inspecting other clients in the room.');
                //itterate through clients in the room.
                for (let client_id of roomMap){
                    let client_socket = self.p2pNsp.sockets.get(client_id);
                    if (!client_socket) console.error("something fucked up.. socket:", socket, "client_socket: ",client_socket, "client_id:",client_id, "roomMap:", roomMap ,"roomName:",roomName);
                    
                    if( socket.CD.controller == true && client_socket.CD.controller == true){
                        debug("Can't have more than one controller per room. Aborting join and disconnecting socket.");
                        socket.disconnect();
                        return;
                    }

                    if( client_socket.id == socket.id){
                        debug("Can't join room more than once.. did it get multiple id_requests?");
                        return;
                    }
                }
            }

            socket.join(roomName);
            //self.p2pserver(socket, null, roomName);  //temporarily removing this feature
            
            
            socket.on('message', function (data) {
                socket.in(roomName).emit('message', data);
                debug('messaging room: %s',roomName);
                //debug('=>%s',data);                
            });

            socket.on('goPrivate', function () {
                socket.in(roomName).emit('goPrivate');
            })


            //emits to all people in the room including the current socket client
            self.p2pNsp.in(roomName).emit('headCount',
                self.p2pNsp.adapter.rooms.get(roomName).size
            );

            //When the user disconnects. 
            //socket.on('disconnecting', function(){
            
            socket.on('disconnect', ()=>{
                if (!self.p2pNsp.adapter.rooms.get(roomName)) return;   // <-- incase this person is the last to leave the room..
                debug('client disconnecting..');
                debug('That was in this room: ' + roomName);
                self.p2pNsp.in(roomName).emit('headCount',
                    self.p2pNsp.adapter.rooms.get(roomName).size
                );
            });


            debug('p2p rooms after join function \n %O', self.p2pNsp.adapter.rooms);

            /******************************************************************************/
            /***                        END OF JOIN FUNCTION                            ***/
            /******************************************************************************/
        } catch(e){
            console.error('Something went wrong in the joinRoom function\n',e);
        }}        

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
    
    const tools = {}

    //Search p2pNps for a connection from the controller
    tools.isControllerWaiting = (controller_id, people_id, uuid)=>{
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


    //Search p2pNps for a connection from the controller
    tools.noLoitering = ()=>{
        const maxChits = 3;
        //Is controller already waiting in a room for the client?
        //debug('scanning p2p for loitering...')
        for ( var cliSoc of self.p2pNsp.sockets){
            cliSoc = cliSoc[1];
            //debug('id of connection being examined:', cliSoc.id);
            
            if (!cliSoc.CD){ debug("connection missing CD {}");
                console.error('this should never happen. please investigate noLoitering()');
                continue;
            }

            if (cliSoc.CD.noLoiteringChits == undefined) cliSoc.CD.noLoiteringChits = 0;


            if ( cliSoc.CD.uuid == undefined  || cliSoc.adapter.rooms.get(cliSoc.CD.uuid) == undefined                    ){
                cliSoc.CD.noLoiteringChits++;
                debug('Socket issued noLoiteringChit for being connected without a meeting room.', 'Total: '+cliSoc.CD.noLoiteringChits );
                if ( cliSoc.CD.noLoiteringChits < 3 ) continue;  //If it has issued a chit and it hasn't hit max, continue so it doesn't issue multiple chits on the same inspection
            }
                        
            let room = CD.io.p2pNsp.adapter.rooms.get(cliSoc.CD.uuid);
            if (room.size < 2) {
                cliSoc.CD.noLoiteringChits++;
                debug('Socket issued noLoiteringChit for being in a meeting room alone.', 'Total: '+cliSoc.CD.noLoiteringChits );
                if ( cliSoc.CD.noLoiteringChits < 3 ) continue;  //If it has issued a chit and it hasn't hit max, continue so it doesn't issue multiple chits on the same inspection
            }

            if ( cliSoc.CD.noLoiteringChits >= 3 ){ cliSoc.disconnect();
                debug('Socket disconnected for exceeding max noLoiteringChits.', 'Total: '+cliSoc.CD.noLoiteringChits );
                continue;
            }            
        }
    }
    tools.noLoitering.intervalTimer = setInterval(tools.noLoitering,30000);


    //Check if controller is connected..
    tools.getControllerSocket = (controller_id)=>{
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