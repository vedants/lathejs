// where the node app starts

// init project
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var longpoll = require("express-longpoll")(app, { DEBUG: true });

app.use(bodyParser.json());
app.use(express.static('public'));

var is_changed; 
var segmentFactors = []; //stores the server view of the segmentFactors
var _totalLinks = 100; //number of axial divisions on the lathe. 

function reset() {
  is_changed = false;
  segmentFactors = [];
  for (var i = 0; i < _totalLinks; i++) {
    segmentFactors.push(1); 
  }  
}

app.get('/', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/index.html'); //TODO: pass _totalLinks in here somehow...
});

app.get('/reset', function (request, response) {
  reset(); 
  response.send("Reset.");
});

app.post('/cut', function(request, response) {
  var segmentNumber = request.body['segmentNumber'];
  var segmentPressure = request.body['segmentPressure'];
  if (segmentFactors[segmentNumber] != segmentPressure && segmentPressure > 0) {
    is_changed = true;
    segmentFactors[segmentNumber] = segmentPressure;  
    longpoll.publish("/is_cut_poll", {segmentFactors});
  }
  response.send("got cut.");
   
});

longpoll.create("/is_cut_poll");
  

// listen for requests
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});