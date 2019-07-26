var express = require('express');
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
require('socket.io-stream')(io);
var fs = require('fs');
var path = require('path');
var dl = require('delivery');


app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {

  res.sendFile(__dirname + '/index.html');
});

app.get('/portraite', function (req, res) {
  res.sendFile(__dirname + '/portraite.html');
})

app.get('/test', function (req, res) {
  res.sendFile(__dirname + '/portraite2.html');
})

io.on('connection', function (socket) {
  console.log('a user connected');

  socket.on('new file', function (msg) {
    console.log('new file: ' + msg);
    io.emit('new file', msg);
    // io.emit(fs.createReadStream(msg));

    var writer = fs.createWriteStream(path.resolve(__dirname, './public/' + msg.name), { encoding: 'base64' });
    writer.write(msg.data);
    writer.end();
    writer.on('finish', function () {
      socket.emit('new file', {
        name: '/public/' + msg.name
      });
    });
  });

  socket.on('protrait', function (msg) {
    console.log('protrait: ' + msg);
  });
  
  socket.on('drop', function (msg) {
    console.log('drop: ' + msg);
  });

});

http.listen(process.env.PORT || 3000, function () {
  console.log('listening on *:3000');
});
