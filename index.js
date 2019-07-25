var express = require('express');
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res){
  
  res.sendFile(__dirname + '/index.html');
});

app.get('/portraite', function(req, res){
  res.sendFile(__dirname + '/portraite.html');
})

io.on('connection', function(socket){
  console.log('a user connected');

  socket.on('new file', function(msg){
    console.log('new file: ' + msg);
  });

  socket.on('protrait', function(msg){
    console.log('protrait: ' + msg);
  });

  socket.on('drop', function(msg){
    console.log('drop: ' + msg);
  });
});


http.listen(3000, function(){
  console.log('listening on *:3000');
});
