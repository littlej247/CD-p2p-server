# CD-p2p-server

This is my no means a finished product. Just playing around with a p2p service based on passing a uuid string. So far it's working fine except having trouble getting it to work with NAT and a TURN server. Setting this down for a bit while I play with other stuff. Don't know to many technical people to help me with this stuff so going to do some reading.

## Install

1. $ git clong https://github.com/littlej247/CD-p2p-server.git

2. $ CD CD-p2p-server

3. $ npm install

## Usage

1. $ npm run demo

2. Navigate two tabs to http://localhost:9001. Click 'Start Script' in one and copy the UUID.

3. Past it in the other, click 'Start Script', and then enjoy a conversation with yourself.

Then when the conversation gets serious click 'upgrade' to switch the routing to P2P without interruption.


## Other

Uses other people libraries, check the package.json for dependencies.