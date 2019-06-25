var express = require('express');
var fs = require('fs');
var app = express();
var cors = require('cors');
var bodyParser = require('body-parser');
var longpoll = require("express-longpoll")(app, { DEBUG: false });

var expressWs = require('express-ws')(app);

var WebSocketServer = require('ws').Server;

app.use(express.static('public'));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', parameterLimit: 100000, extended: true }));
app.use(cors());

//this is using express-ws 
var connections = []; //connection pool. when does this get flushed? only on server reload... 

//websocket for sending drawings back and forth. 
//this works! 
 app.ws('/', function (ws, req) {
   console.log("new draw connection"); 
   connections.push(ws); 
   
   ws.on('message', function(msg) {
      //send drawing to everyone in the connection pool 
     for(var i = 0; i < connections.length; i++) {
      if (connections[i].readyState != 3) { //socket is not closed
        connections[i].send(msg);  
      }
     }
   });
 });

//websocket for sending material changes (from the python voice server)
var fab_voice_ws = null; //this is the websocket that the fab opens. commands from the voice server meant for the fab are sent over this. 
app.ws('/voice', function (ws, req) {
  console.log('setting fab_voice_ws');
   fab_voice_ws = ws; 
});

var lathe_ws = null; //this is the websocket that the turnByWire lathe client opens.
//commands from the voice server meant for the lathe client are sent over this. 
app.ws('/lathe', function (ws, req) {
  console.log('setting lathe_ws');
  lathe_ws = ws; 
});

app.post('/voice_to_fab', function(request, response) {
  var newMaterial = request.body.data; 
  console.log('got message from voice server to send data to fab :' + newMaterial);
  fab_voice_ws.send(newMaterial); 
  response.send("okay."); 
});


app.get('/undo', function (request, response) {
  var msg = JSON.stringify({'command': 'undo'});
  if (lathe_ws) {
    lathe_ws.send(msg);
    response.send("ok");
  } else {
    response.send("not okay");
  }
});
        
app.get('/redo', function (request, response) {
  var msg = JSON.stringify({'command': 'redo'});
  if (lathe_ws) {
    lathe_ws.send(msg);
    response.send("ok");
  } else {
    response.send("not okay");
  }
});

app.get('/wood_force', function (request, response) {
  var msg_r = JSON.stringify({'command': 'cuttingForce', 'ax':'r', 'amt':2});
  var msg_z = JSON.stringify({'command': 'cuttingForce', 'ax':'z', 'amt':2});
  if (lathe_ws) {
    lathe_ws.send(msg_r);
    lathe_ws.send(msg_z);
    response.send("ok");
  } else {
    response.send("not okay");
  }
});

app.get('/plastic_force', function (request, response) {
  var msg_r = JSON.stringify({'command': 'cuttingForce', 'ax':'r', 'amt':3});
  var msg_z = JSON.stringify({'command': 'cuttingForce', 'ax':'z', 'amt':3});
  if (lathe_ws) {
    lathe_ws.send(msg_r);
    lathe_ws.send(msg_z);
    response.send("ok");
  } else {
    response.send("not okay");
  }
});

app.get('/metal_force', function (request, response) {
  var msg_r = JSON.stringify({'command': 'cuttingForce', 'ax':'r', 'amt':5});
  var msg_z = JSON.stringify({'command': 'cuttingForce', 'ax':'z', 'amt':5});
  if (lathe_ws) {
    lathe_ws.send(msg_r);
    lathe_ws.send(msg_z);
    response.send("ok");
  } else {
    response.send("not okay");
  }
});

app.get('/marble_force', function (request, response) {
  var msg_r = JSON.stringify({'command': 'cuttingForce', 'ax':'r', 'amt':10});
  var msg_z = JSON.stringify({'command': 'cuttingForce', 'ax':'z', 'amt':10});
  if (lathe_ws) {
    lathe_ws.send(msg_r);
    lathe_ws.send(msg_z);
    response.send("ok");
  } else {
    response.send("not okay");
  }
});

app.get('/zero_force', function (request, response) {
  var msg_r = JSON.stringify({'command': 'cuttingForce', 'ax':'r', 'amt':1});
  var msg_z = JSON.stringify({'command': 'cuttingForce', 'ax':'z', 'amt':1});
  if (lathe_ws) {
    lathe_ws.send(msg_r);
    lathe_ws.send(msg_z);
    response.send("ok");
  } else {
    response.send("not okay");
  }
});
      
        
app.post('/voice_to_lathe', function(request, response) {
  var command = request.body.data; 
  console.log('got message from voice server to send data to lathe_server :' + command);
  lathe_ws.send(command); 
  response.send("okay."); 
});

app.post('/addGuide', function(request, response) {
  var guideData = request.body; 
  guideData.type = "add";
  console.log('got message from add guide:' + guideData);
  fab_voice_ws.send(JSON.stringify(guideData)); 
  response.send("okay."); 
});

app.post('/removeGuide', function(request, response) {
  var guideData = request.body; 
  guideData.type = "remove";
  console.log('got message to remove guide:' +guideData);
  fab_voice_ws.send(guideData); 
  response.send("okay."); 
});



//PARAMETERS 
var is_changed; //deprecated with new integration 
var segmentFactors = []; //stores the server view of the segmentFactors  //deprecated with new integration 
var _totalLinks = 300; //number of axial divisions on the lathe. //this must match the number in lathe.js
var path_params = {
  latest_path: [],
  radius: 0,
  length: 0
}

function reset() {
  is_changed = false;
  segmentFactors = [];
  for (var i = 0; i < _totalLinks; i++) {
    segmentFactors.push(1); 
  } 
  
  path_params.latest_path = [];
  path_params.radius = null; 
  path_params.length = null;
}


app.post('/sendPath', function(request, response) {
  console.log('got message from lathe');
  console.log("**************");
  var data = request.body//JSON.parse(request.body);
  //console.log(data);
  if (!path_params.radius || !path_params.length) { //initialize the params
    path_params.latest_path = data; 
    path_params.length = data[2][0]//assumes that paper.js always returns points on a path in the same order, with the bottom left point being frst. 
    path_params.radius = data[0][1]//assumes that paper.js always returns points on a path in the same order, with the bottom left point being frst. 
    
    var path = interpolatePath(data);
    //console.log(path);
    
  } else {
      if (path_params.latest_path == data) {
        //path hasn't changed since last time we computed it. 
        //don't do any computation 
        //exit immediately 
        console.log("no change observed"); 
        response.send("thnx but no thnx");
        return;
      }
    
    
    var path = interpolatePath(data);
    console.log(JSON.stringify(path));
    
    //longpoll.publish('/is_cut_poll', path);
    console.log(fab_voice_ws.readyState);
    if (fab_voice_ws.readyState != 1){
      console.log("fab voice ws is closed!"); 
    } else {
      fab_voice_ws.send(JSON.stringify({type:"path", data:path})); 
    }
    


    //TODO: could probably make huge perf gains (more in I/O than CPU) by moving check_and_cut checks out of fab.js into server side. 
    
    //update latest path rendered
    path_params.latest_path = data;
  }
  console.log("Done"+ Math.random());   
  response.send("thnx"); 
});

app.get('/', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/index_menu.html');
});

app.get('/draw', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/draw.html');
});

app.get('/collab', function(request, response) {
  reset();
  response.sendFile(__dirname + '/views/collab.html'); 
});

app.post('/cut', function(request, response) {
  console.log('got cut signal @ ' + new Date().toLocaleTimeString());
  var segmentNumber = request.body['segmentNumber'];
  var segmentPressure = request.body['segmentPressure'];
  if (segmentFactors[segmentNumber] != segmentPressure && segmentPressure > 0) {
    is_changed = true;
    segmentFactors[segmentNumber] = segmentPressure;  
    longpoll.publish('/is_cut_poll', {segmentFactors});
  }
  response.send('got cut.');
});

//checks if the lathe has been cut by the hand wheels. 
//triggered by lathe, listener in fab.js
longpoll.create("/is_cut_poll"); 

//checks if the lathe geometry has been updated. 
//triggered by main.js, listener in collab.js
//DEPRECATED
longpoll.create("/is_lathe_updated");//checks if the geometry has been 

//express server listen for requests on port process.env.PORT ( defaults to 3000 I think?)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});


function interpolatePoint(init_point, length, radius, totalLinks) {
  var x_i = init_point[0]; 
  var y_i = init_point[1]; 
  
  var x_f = x_i / length * totalLinks; //THIS IS WHERE THE DISCRETIZATON HAPPENS!
  var y_f = y_i / radius;
  
  return [x_f, y_f];
}

//runs in O(N) time.
function interpolatePath(path, totalLinks = _totalLinks) {
  //anti-clockwise order, starting at bottom left.
  path = [path[0]].concat(path.slice(1).reverse());
  //initialize finalSegments array
  var finalSegments = [];
  for (var i = 0; i < totalLinks; i++) {
    finalSegments.push(1); 
  }  
  //iterate over every line on the path 
  console.log("path length", path.length); 
  for (var j =0; j < path.length - 1; j++) {
    var line_i = [path[j], path[j+1]];
    //get interpolated values
    var line_f = [interpolatePoint(line_i[0], path_params.length, path_params.radius, totalLinks), 
                      interpolatePoint(line_i[1], path_params.length, path_params.radius, totalLinks)];
    
    var start_x = line_f[0][0];
    var end_x = line_f[1][0];
    var start_y = line_f[0][1];
    var end_y = line_f[1][1];
    var slope = (end_y - start_y) / (end_x - start_x);
    
    if (end_x <= start_x) {
      //console.warn("encountered a weird edge case that might be a problem but so far looks okay");
    }
    
    //we need the integer value of x so that we can use it to index into the finalSegments array. 
    //we don't need to round end_x because the for loop only increments curr_x in multiplies of 1.
    //except that we do, just to ensure that end_x >= start_x, so the loop always runs for at least one iteration. 
    start_x = Math.round(start_x); 
    
    //we only need the outer contour of stockFront. skip all points on the interior of the path line. 
    if (end_y < 1e-15) break;
    
    //fill in intermediate segments by interpolating linearly between start and end
    //for (var curr_x = start_x; curr_x < end_x; curr_x++) {
    for (var curr_x = start_x; curr_x <= Math.round(end_x); curr_x++) {
      var curr_y = start_y + slope * (curr_x - start_x); 
      if (curr_y > 1) curr_y = 1; //never exceed 1 (happens sometimes due to rounding errors)
      if (curr_x > totalLinks) continue; //don't create too many segments (happens sometimes due to off-by-one errors) 
       
      finalSegments[curr_x] = curr_y;
    }
  } 
  return finalSegments;
}