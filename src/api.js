// api.js
// ============
'use strict';
var debug = require('debug')('CD.api');

//Extend the app
module.exports = (app, CD)=>{
    const bodyParser = require('body-parser');
    const cors = require('cors');

    app.use(cors());
    app.use('/api/*',          checkKey    );      //API key is not sent on cors pre-flight tests, so cors must be before checkKey
    app.use(bodyParser.json());    
    app.use('/api/connRequest', connRequest );
}


function checkKey(req, res, next){
    const keys = require("./../keys.json");
    debug('key check running');
    debug('keys %O',keys);
    try{
        if ( !req.headers["x-api-key"] ){
            res.send('missing api key');
            console.log('missing api key')
            return;
        }
        if ( !keys[req.headers["x-api-key"]] ){
            res.send('api key invalid/disabled');
            console.log('API Key not found in keys.json')
            return;
        }
        if( !keys[req.headers["x-api-key"]].enabled ) {
            res.send('api key invalid/disabled');
            console.log('API Key disabled..')
            return;
        }
        //add checks if key is valid for provided controller.

    } catch (e){
        console.error(e);
        return;
    }

    //add the key info to the req obj for future reference.
    req.cd_id = keys[req.headers["x-api-key"]];
    
    next();
};

function connRequest(req, res, next){
    
    //console.log('after processing..' ,req.body);
    
    debug('incomming connRequest. Body:%O',req.body);
    CD.io.createRoom(req.body.controller_id,req.body.people_id,req.body.uuid, 
        (result)=>{
        res.send(result);
        next();
    });    

};
