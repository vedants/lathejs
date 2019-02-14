// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

app.use(bodyParser.json());
var is_changed = false;
var segmentFactors = [];
var _totalLinks = 100;
for (var i = 0; i < _totalLinks; i++) {
    segmentFactors.push(1); 
}

app.use(express.static('public'));

app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html'); //TODO: pass _totalLinks in here somehow...
});

app.post('/cut', function(request, response) {
  console.log(request.body);
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
