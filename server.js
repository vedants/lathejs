var express = require('express');
var fs = require('fs');
var ws = require('ws');
var app = express();
var bodyParser = require('body-parser');
var longpoll = require("express-longpoll")(app, { DEBUG: false });
var WebSocketServer = require('ws').Server;

app.use(express.static('public'));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', parameterLimit: 100000, extended: true }));


var wss = new WebSocketServer({port: 40510});
var connections = []; 

wss.on('connection', function (ws) {
  var connection = ws;
  connections.push(connection);

  ws.on('message', function (message) {
    console.log('received: %s', message); 
    //send the received message to all of the connections in the connection array
    for(var i = 0; i < connections.length; i++) {
      if (connections.readyState != 3){
        //socket is not closed
        connections[i].send(message);  
      }
    }
  });
});

var is_changed; 
var segmentFactors = []; //stores the server view of the segmentFactors
var _totalLinks = 10; //number of axial divisions on the lathe. 

function reset() {
  is_changed = false;
  segmentFactors = [];
  for (var i = 0; i < _totalLinks; i++) {
    segmentFactors.push(1); 
  }  
}

app.get('/', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/index_menu.html');
});

app.get('/old', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/index.html');
});

app.get('/collab', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/collab.html'); 
});

app.get('/draw', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/draw.html'); 
});


app.get('/speech', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/speech.html'); 
});

app.post('/cut', function(request, response) {
  console.log("got cut signal @ " + new Date().toLocaleTimeString());
  var segmentNumber = request.body['segmentNumber'];
  var segmentPressure = request.body['segmentPressure'];
  if (segmentFactors[segmentNumber] != segmentPressure && segmentPressure > 0) {
    is_changed = true;
    segmentFactors[segmentNumber] = segmentPressure;  
    longpoll.publish("/is_cut_poll", {segmentFactors});
  }
  response.send("got cut.");
});

app.post('/save_lathe', function(request, response) {
  console.log("saving lathe @" + new Date().toLocaleTimeString());
  lathe_json_data = request.body; 
  response.send("closing connection."); 
});

//checks if the lathe has been cut by the hand wheels. 
//triggered by lathe, listener in main.js
longpoll.create("/is_cut_poll"); 

//checks if the lathe geometry has been updated. 
//triggered by main.js, listener in collab.js
longpoll.create("/is_lathe_updated");//checks if the geometry has been 

// listen for requests
var listener = app.listen(8000, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});