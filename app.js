// app.js
// ======
'use strict';
var debug = require('debug')('CD.app');
console.log("Starting connBroker app.js");

//Controller app script.
global.CD = {};

CD.app = new function (){
    //Construct the app..

    var self = this;
    //default settings
    self.config = {
        demo: false,
        port: 9001
    }

    //check for demo flag
    if (process.argv[2] === 'demo'){
        self.config.demo = true;
        console.log('running http demo mode');
        console.log('Visit http://127.0.0.1:'+self.config.port+'/');
    }

    //Start stuff.
    self.express = require('express');
    self.app = self.express();
    self.expressServer = self.app.listen(self.config.port);
    
    console.log('listening on port '+self.config.port);

    //If demo flag, share public folder at root
    if (self.config.demo === true){
        self.app.use(self.express.static('public') );
    } else {
        self.app.get('/', function (req, res) {
            res.send('CD-p2p-server');
        })
    }
    
    //CD.io = new setupSockets(expressServer);
    require('./src/api.js')(self.app, CD); //this is ahead because it include api key check for sockets
    const CD_io = require('./src/sockets.js');
    CD.io = new CD_io(self.expressServer); //this is ahead because it include api key check for sockets    
}

CD.turn = new function (){
    return;
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

CD.tools = {
    create_UUID: ()=>{
        var dt = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (dt + Math.random()*16)%16 | 0;
            dt = Math.floor(dt/16);
            return (c=='x' ? r :(r&0x3|0x8)).toString(16);
        });
        return uuid;
    }
}
