var debug = require('debug')('CD.socket-p2p')
var clients = {}
module.exports.clients = clients
module.exports.Server = p2pSocket

function p2pSocket (socket, next, roomName) {
  clients[socket.id] = socket
  if (roomName) {
    var connectedClients = {};
    socket.adapter.rooms.get(roomName).forEach((x)=>{
        connectedClients[x]=clients[x];
    });
  } else {
    var connectedClients = clients
  }
  var numClients = Object.keys(connectedClients).length - 1
  //socket.adapter.nsp.to(roomName).emit('numClients', numClients)  //<-- This would send the accurate number to all clients but then the p2pready stops working
  //sending the numClients to everyone apparently messes up the 'ready' part. 
  socket.emit('numClients', numClients)

  socket.on('disconnect', function () {
    delete connectedClients[socket.id]
    delete clients[socket.id]
    Object.keys(connectedClients).forEach(function (clientId, i) {
      var client = connectedClients[clientId]
      if (client !== socket) {
        client.emit('peer-disconnect', {peerId: socket.id});
      }
    })
    debug('Client gone (id=' + socket.id + ').')
  })

  socket.on('offers', function (data) {
    // send offers to everyone else in a given room
    Object.keys(connectedClients).forEach(function (clientId, i) {
      var client = connectedClients[clientId]
      if (client !== socket) {
        var offerObj = data.offers[i];
        if (!offerObj) {
            debug('offerObj undefined.. This is an ERROR. Incomming data: %O', data);
            return;
        }
        var emittedOffer = {fromPeerId: socket.id, offerId: offerObj.offerId, offer: offerObj.offer}
        debug('From: %s', socket.id, " To: %s", clientId);
        debug('Emitting offer: %s', JSON.stringify(emittedOffer))
        client.emit('offer', emittedOffer)
      }
    })
  })

  socket.on('peer-signal', function (data) {
    var toPeerId = data.toPeerId
    debug('From: %s', socket.id, " To: %s", toPeerId);
    debug('Signal peer id %s', toPeerId);
    var client = clients[toPeerId];
    if (client) client.emit('peer-signal', data); //THIS IS NOT A FIX. SOMETHING BIGGER IS WRONG HERE...
    
    //client.emit('message', JSON.stringify(data))
  })
  typeof next === 'function' && next()
}
