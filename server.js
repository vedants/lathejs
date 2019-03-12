// where the node app starts

// init project
var express = require('express');
var fs = require('fs');
var app = express();
var bodyParser = require('body-parser');
var longpoll = require("express-longpoll")(app, { DEBUG: false });

var lathe_json_data = {}; 

app.use(express.static('public'));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', parameterLimit: 100000, extended: true }));

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
  response.sendFile(__dirname + '/views/index.html');
});

app.get('/collab', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/collab.html'); 
});

app.get('/speech', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/speech.html'); 
});

app.get('/reset', function (request, response) {
  reset(); 
  response.send("Reset.");
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

app.get('/update_lathe', function(request, response) {
  console.log("updating lathe status...");
  longpoll.publish("/is_lathe_updated", "true");
  response.send("updated");
  console.log("updated lathe status.");
});

app.get('load_lathe', function(reuqest, response) {
  console.log("loading lathe..."); 
  var x = lathe_json_data.slice(0);
  response.send(x);
});


app.post('/save_lathe', function(request, response) {
  console.log("saving lathe @" + new Date().toLocaleTimeString());
  lathe_json_data = request.body; 
  response.send("closing connection."); 
  
  /*
  console.log("request"); 
  console.log(request.body);
  var suffix = Math.random();
  fs.writeFile(__dirname + "/public/models/lathe_model" + suffix + ".js", JSON.stringify(request.body), (err) => {
    if (err) {
        console.error(err);
        return;
    };
    console.log("File has been created");
  });
  response.send("file has been created.");   
  console.log(new Date().getTime() / 1000);
  */
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
