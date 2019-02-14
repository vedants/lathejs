// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
//var longpoll = require('express-longpoll')(app);
var longpoll = require("express-longpoll")(app, { DEBUG: true });

app.use(bodyParser.json());

var is_changed;
var segmentFactors = [];
var _totalLinks = 100;

function reset() {
  is_changed = false;
  for (var i = 0; i < _totalLinks; i++) {
    segmentFactors.push(1); 
  }  
}

app.use(express.static('public'));

app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html'); //TODO: pass _totalLinks in here somehow...
});

app.get('/reset', function (request, response) {
  reset(); 
  response.send("Okay.");
});

app.post('/cut', function(request, response) {
  console.log(request.body);
  var segmentNumber = request.body['segmentNumber'];
  var segmentPressure = request.body['segmentPressure'];
  if (segmentFactors[segmentNumber] != segmentPressure && segmentPressure > 0) {
    console.log("changing_is_changed");
    is_changed = true;
    segmentFactors[segmentNumber] = segmentPressure;  
    longpoll.publish("/is_cut_poll", {
      segmentFactors
    });
    
  }
  response.send("okay");
   
});

longpoll.create("/is_cut_poll");

// app.get('/is_cut', function (request, response) {
//   response.status(200).send(is_changed ); 
// });
        
app.get('/get_cut', function (request, response) {
  if (!is_changed) {
    return null;
  }
  is_changed = false;
  response.send(segmentFactors);
});
  

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
