// local MQTT broker over WebSocket (stands in for the public brokers in tests): node mqsrv.cjs <port>
const aedes = require('aedes')(); const http = require('http'); const { WebSocketServer, createWebSocketStream } = require('ws');
const server = http.createServer(); const wss = new WebSocketServer({ server, path: '/mqtt' });
wss.on('connection', ws => aedes.handle(createWebSocketStream(ws)));
server.listen(+process.argv[2] || 9124, '127.0.0.1', () => console.log('mqtt ws on', server.address().port));
