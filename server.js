// server.js
// where your node app starts

// init project
var express = require('express');
var app = express();
var lathejs = require('public/main.js');

app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get('/cut', function(request, response) {
  lathejs.cut();
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
