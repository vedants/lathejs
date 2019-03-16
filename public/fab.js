//initialize all the variables 
var vrDisplay;
var vrFrameData;
var vrControls;
var arView;

var canvas;
var camera;
var scene;
var renderer;
var listener; 
var sound;
var strokes_group; 

var cube;
var cylinder;
var tool; 
var lathe; 
var ref_lathe; 
var _ROTATE_SPEED = 0;  
  
var MaterialLibrary = {};

var cuttingList = [];
var chipsList = [];
var cuttingPool = new ObjectPool();
var chipsPool = new ObjectPool();
var dustPool = new ObjectPool();
var chipsGeometry;
var metalGeometry;
var activeMaterialType = "metal";
var base_url = "http://v.local:8000"; //lathejs.glitch.me
var ws = new WebSocket('ws://v.local:40510'); //websocket server

var segmentFactors = []; //stores how much all the segments in the lathe have been "cut" by. 
var offset = {};

/**
 * Use the `getARDisplay()` utility to leverage the WebVR API
 * to see if there are any AR-capable WebVR VRDisplays. Returns
 * a valid display if found. Otherwise, display the unsupported
 * browser message.
 */
THREE.ARUtils.getARDisplay().then(function (display) {
  if (display) {
    vrFrameData = new VRFrameData();
    vrDisplay = display;
    init();
  } else {
    THREE.ARUtils.displayUnsupportedMessage();
  }
});

function init() {

  // Setup the three.js rendering environment
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  console.log('setRenderer size', window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  canvas = renderer.domElement;
  document.body.appendChild(canvas);
  scene = new THREE.Scene();
  
  // Turn on the debugging panel
  var arDebug = new THREE.ARDebug(vrDisplay);
  document.body.appendChild(arDebug.getElement());
  //Turn on the debugging axes 
  var axesHelper = new THREE.AxesHelper( 5 );
  scene.add( axesHelper );

  // Creating the ARView, which is the object that handles
  // the rendering of the camera stream behind the three.js
  // scene
  arView = new THREE.ARView(vrDisplay, renderer);

  // The ARPerspectiveCamera is very similar to THREE.PerspectiveCamera,
  // except when using an AR-capable browser, the camera uses
  // the projection matrix provided from the device, so that the
  // perspective camera's depth planes and field of view matches
  // the physical camera on the device.
  camera = new THREE.ARPerspectiveCamera(
    vrDisplay,
    60,
    window.innerWidth / window.innerHeight,
    vrDisplay.depthNear,
    vrDisplay.depthFar
  );

  // VRControls is a utility from three.js that applies the device's
  // orientation/position to the perspective camera, keeping our
  // real world and virtual world in sync.
  vrControls = new THREE.VRControls(camera);
  
  // create listener that plays back sounds (spatialized to the camera position)
  listener = new THREE.AudioListener();
  camera.add( listener );
  
  var source = listener.context.createBufferSource();
  source.connect(listener.context.destination);
  source.start();
  
  sound = new THREE.PositionalAudio( listener );
  sound.context.resume();
  listener.context.resume();

  strokes_group = new THREE.Group();
  scene.add(strokes_group);
  setUpWebSocket();


  //initialize button callbacks 
  document.getElementById("zoomin").onclick = onZoomIn;
  document.getElementById("zoomout").onclick = onZoomOut;
  document.getElementById("wood").onclick = onWood;
  document.getElementById("metal").onclick = onMetal;
  document.getElementById("plastic").onclick = onPlastic;
  document.getElementById("start").onclick = onStartLathe;
  document.getElementById("stop").onclick = onStopLathe;

  //initialize shaders
  LIBRARY.Shaders.loadedSignal.add( onShadersLoaded );
  initShaderLoading();
}
  
function onShadersLoaded() {
  chipsPool.createObject = createChips
  cuttingPool.createObject = createCutting
  dustPool.createObject = createDust

  initLights();
  initObjects();

  window.addEventListener('resize', onWindowResize, false);
  
  canvas.addEventListener('touchstart', onClickStart, false); 
  canvas.addEventListener('touchend', onClickEnd, false); 
}

function createChips() {
  //var chips = new THREE.Mesh( chipsGeometry, MaterialLibrary.wood );
  var chips = new THREE.Mesh( chipsGeometry, new THREE.MeshBasicMaterial( {color:0x00bbbb}));
  chips.receiveShadow = false; 
  chips.doubleSided = false; 
  chips.castShadow = true; 
  chips.geometry.computeFaceNormals();
  return chips;
}

function createDust() {
}

function createCutting() {
  //var cutting = new THREE.Mesh( metalGeometry, MaterialLibrary.metal );
  var cutting = new THREE.Mesh( metalGeometry, new THREE.MeshBasicMaterial( { color: 0xff0000 } ));
  cutting.receiveShadow = false;
  cutting.doubleSided = false;
  cutting.castShadow = true;
  cutting.geometry.computeFaceNormals();
  return cutting;
}
  
var spawnDelay = 0;

function spawnParticle(spawnPosition) {
  if (activeMaterialType == "wood") spawnChips(spawnPosition);
  if (activeMaterialType == "metal") spawnCuttings(spawnPosition);
  if (activeMaterialType == "plastic") spawnDust(spawnPosition);
}

function spawnChips(spawnPosition) {
  
    spawnDelay++;
    if( spawnDelay < 0 ) return; 
    spawnDelay = 0;

    var chipsMesh = chipsPool.getObject();
    chipsList.push(chipsMesh);
    chipsMesh.velocity = new THREE.Vector3(Math.random()*0.001, -0.002, 0);
    chipsMesh.scale.x = 0.001 + Math.random()*0.001;
    chipsMesh.scale.y = 0.001 + Math.random()*0.001;
    chipsMesh.scale.z = 0.001
    chipsMesh.rotationVelocity = new THREE.Vector3(Math.random()*0.1,Math.random()*0.1,Math.random()*0.1);
    chipsMesh.rotation = new THREE.Vector3(Math.PI*.5,Math.PI,Math.random()*Math.PI);
    chipsMesh.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);

    scene.add(chipsMesh);
}

function updateChips() {
  var i=0, max = chipsList.length;
  var chips;
  for( i = max - 1; i >= 0; i--) {
    chips = chipsList[i];
    chips.position.add(chips.velocity);
    chips.rotation.set(chips.rotation.x + chips.rotationVelocity.x, chips.rotation.y + chips.rotationVelocity.y, chips.rotation.z + chips.rotationVelocity.z);   
    chips.velocity.y -= 0.0002;

    if( chips.position.y < -1) {
      scene.remove(chips);
      chipsPool.returnObject(chips.poolId);
      chipsList.splice(i,1);
    }
  }
}

function spawnDust(spawnPosition) {
}
function updateDust(){
}

function spawnCuttings(spawnPosition) {

  spawnDelay++;
  if( spawnDelay < 0 ) return; //maybe change the 0 here to 15? 

  var cuttingMesh = cuttingPool.getObject();
  cuttingList.push(cuttingMesh);

  cuttingMesh.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
  cuttingMesh.scale.set(0.001, 0.001, 0.001);
  cuttingMesh.velocity = new THREE.Vector3(Math.random()*0.001, -0.002, 0);
  cuttingMesh.scale.x = 0.0001 + Math.random()*0.001;
  cuttingMesh.scale.y = 0.0001 + Math.random()*0.001;
  cuttingMesh.scale.z = 0.0001;
  cuttingMesh.rotationVelocity = new THREE.Vector3(Math.random()*0.25,Math.random()*0.0,Math.random()*0.0);
  cuttingMesh.rotation = new THREE.Vector3(Math.PI*.5,-Math.PI*Math.random(), Math.PI*.5);

  scene.add(cuttingMesh);
}
  
function updateCuttings() {
  var i = 0; 
  var max = cuttingList.length;
  var cutting;

  for( i = max-1; i>= 0; i--) {
    cutting = cuttingList[i];
    cutting.rotation.set(cutting.rotation.x + cutting.rotationVelocity.x, cutting.rotation.y + cutting.rotationVelocity.y, cutting.rotation.z + cutting.rotationVelocity.z);
    if(cutting.scale.z < 0.001) {
      cutting.scale.x = cutting.scale.y = cutting.scale.z += .0002;
    }
    else {    
      cutting.velocity.y -= 0.0002;
      cutting.position.add(cutting.velocity);
    }
    if( cutting.position.y < -1 ) { // 1 meter below the lathe
      scene.remove(cutting);
      cuttingPool.returnObject(cutting.poolId);
      cuttingList.splice(i,1);
    }
  }
}
  
function initLights() {
  var dirLight = new THREE.DirectionalLight();
  dirLight.intensity = 0.8
  dirLight.position.x = camera.position.x+4;
  dirLight.position.y = camera.position.y+2;
  dirLight.position.z = camera.position.z-4;
  dirLight.lookAt(scene.position);

  dirLight.shadow.camera.left = -9;
  dirLight.shadow.camera.right = 7;
  dirLight.shadow.camera.top = 4.50;
  dirLight.shadow.camera.bottom = -4.80;
  dirLight.castShadow = true;
  scene.add( dirLight);

  var dirLight = new THREE.DirectionalLight();
  dirLight.intensity = 0.3
  dirLight.position.x = camera.position.x-4;
  dirLight.position.y = camera.position.y+24;
  dirLight.position.z = camera.position.z-12;
  dirLight.lookAt(scene.position);
  scene.add( dirLight);

  var dirLight = new THREE.DirectionalLight();
  dirLight.intensity = 0.3
  dirLight.position.x = camera.position.x-4;
  dirLight.position.y = camera.position.y-24;
  dirLight.position.z = camera.position.z-2;
  dirLight.lookAt(scene.position);
  scene.add( dirLight);
  
  var pointLight = new THREE.PointLight( 0xffffff, 1, 100 );
  pointLight.position.set( 0,0, 0);
  scene.add(pointLight);
}
  
function initObjects() {
  dustTexture = new THREE.TextureLoader().load( "textures/dust.png");

  var woodUniforms = {
      DiffuseColour1: { type: "c", value: new THREE.Color(0xdbc6a9) },
      DiffuseColour2: { type: "c", value: new THREE.Color(0xc4ae87) },
      GrainCentre: { type: "v3", value: new THREE.Vector3(10,5,100) },
      GrainMult: { type: "f", value: 10 }
  };

  var finalWoodUniform = THREE.UniformsUtils.merge( [THREE.ShaderLib["phong"].uniforms, woodUniforms] );

  var tex = new THREE.TextureLoader().load("/textures/treebark.jpg");
  tex.mapping = THREE.UVMapping;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  finalWoodUniform.map.texture = tex;

  var params = {
      uniforms:  finalWoodUniform,
      vertexShader:   LIBRARY.Shaders.Wood.vertex,
      fragmentShader: LIBRARY.Shaders.Wood.fragment,
      lights: true
  }

  MaterialLibrary.wood = new THREE.ShaderMaterial(params);

  var metalUniforms = {
      DiffuseColour1: { type: "c", value: new THREE.Color(0xeeeeee) },
      DiffuseColour2: { type: "c", value: new THREE.Color(0x777777 ) }
  };

  var finalMetalUniform = THREE.UniformsUtils.merge( [THREE.ShaderLib["phong"].uniforms, metalUniforms] );
  params = {
      uniforms:  finalMetalUniform,
      vertexShader:   LIBRARY.Shaders.Metal.vertex,
      fragmentShader: LIBRARY.Shaders.Metal.fragment,
      lights: true
  }

  MaterialLibrary.metal = new THREE.ShaderMaterial(params);

  var stoneUniforms = {
      DiffuseColour1: { type: "c", value: new THREE.Color(0x999999) },
      DiffuseColour2: { type: "c", value: new THREE.Color(0x222222) }
  };

  var finalStoneUniform = THREE.UniformsUtils.merge( [THREE.ShaderLib["phong"].uniforms, stoneUniforms] );

  params = {
      uniforms:  finalStoneUniform,
      vertexShader:   LIBRARY.Shaders.Stone.vertex,
      fragmentShader: LIBRARY.Shaders.Stone.fragment,
      lights: true
  }

  MaterialLibrary.stone = new THREE.ShaderMaterial(params);

  //set up the lathe!!!
  lathe = new Lathe();  
  lathe.build(); //(see lathe.js)

  //lathe.material = MaterialLibrary["metal"];
  
  lathe.material = new THREE.MeshNormalMaterial ();
  lathe.material = new THREE.MeshLambertMaterial( { color : 0xbb0000} );
  lathe.material.side = THREE.DoubleSide;
  lathe.receiveShadow = true;
  lathe.castShadow = false;
  lathe.geometry.dynamic = true;
  lathe.geometry.computeFaceNormals();
  lathe.geometry.computeVertexNormals();
  
  lathe.position.z = -0.5 - lathe.radius; //position the lathe a little bit in front of the screen
  lathe.position.x = - 0.5 * lathe.totalLinks * lathe.linkDist //center it horizontally 
  lathe.rotation.y = 90 * TO_RADIANS; 
  
  scene.add(lathe);
  lathe.add(sound);
  
  //set up the cutting tool!!! 
  var rectgeom = new THREE.BoxGeometry( 0.01, 0.01, 0.06 );
  var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
  
  tool = new THREE.Mesh( rectgeom, material );
  tool.position.x = 0; 
  tool.position.y = 0;
  tool.position.z = -0.5 +  (0.06 / 2); //lathe.pos.z + lathe.radius + half the length of the tool
  //scene.add(tool);
  
  //initializes all the segmentFactors to 1 (since everything is at full, i.e. 100% scale initially
  for (var i = 0; i < lathe.totalLinks; i++) {
    segmentFactors.push(1); 
  }
  
  loader = new THREE.ObjectLoader();
  loader.load("/models/wood.js", function(obj) { woodLoaded(obj) });
}

function woodLoaded(obj) {
  chipsGeometry = obj.geometry;
  loader = new THREE.ObjectLoader(); 
  loader.load("/models/metal.js", function(obj) { metalLoaded(obj) });
}

function metalLoaded(obj) {
  metalGeometry = obj.geometry; 
  metalGeometry.computeBoundingSphere();
  
  //set up all the long-poll listeners
  poll_for_cut();

  //Kick off the render loop!
  update();
}
  
function setRing (changedSegment, pressure) {
  var currFactor = segmentFactors[changedSegment];
  if (currFactor < pressure) return; //cutting it would set it to negative scaling! 
  
  var newFactor = pressure;
  if (newFactor < 0.2) newFactor = 0.2; //never let the lathe be less than 20% of the original thickness. 
  for (j = 0; j < _branchSegments; j++) {  
    lathe.ring[changedSegment][j].x = lathe.ringOrigin[changedSegment][j].x * newFactor;
    lathe.ring[changedSegment][j].y = lathe.ringOrigin[changedSegment][j].y * newFactor;
    segmentFactors[changedSegment] = newFactor;
  }
}

/* Sets up a HTTP long poll to listen for messages from the server for when to cut the lathe.
*  https://www.pubnub.com/blog/2014-12-01-http-long-polling/
*/ 
var poll_for_cut = function () {
    $.ajax({
       url: base_url + "/is_cut_poll",
       success: function(data) {
           console.log("got data");
           check_and_cut(data['segmentFactors']);
           poll_for_cut();
       },
       error: function() {
           console.log("longpoll error");
           poll_for_cut();
       },
       timeout: 60000 // every 60 seconds, reset the connection. 
    });
};

/* Checks where the newSegmentFactors are different from the current segmentFactors, and updates those entries. 
*  Also calls setRing, to cut the lathe accordingly. 
*/
function check_and_cut(newSegmentFactors) {
  
  for (var i = 0; i < newSegmentFactors.length; i++) {
    if (newSegmentFactors[i] != segmentFactors[i]) {
      if (newSegmentFactors[i] > lathe.minRadius) {  //dont create cuttings if at minimum radius.
        var spawnPosition = lathe.ring[i][_branchSegments / 2].clone();
        spawnPosition = spawnPosition.applyMatrix4(lathe.matrixWorld);
        spawnParticle(spawnPosition);
      }
      setRing(i, newSegmentFactors[i]);
      
      }
    }
    lathe.geometry.verticesNeedUpdate = true;
    
}

/**
 * The render loop, called once per frame. Handles updating
 * our scene and rendering.
 */

function update() {
  
  // Clears color from the frame before rendering the camera (arView) or scene.
  renderer.clearColor();

  // Render the device's camera stream on screen first of all.
  // It allows to get the right pose synchronized with the right frame.
  arView.render();

  // Update our camera projection matrix in the event that
  // the near or far planes have updated
  camera.updateProjectionMatrix();

  // From the WebVR API, populate `vrFrameData` with
  // updated information for the frame
  vrDisplay.getFrameData(vrFrameData);

  // Update our perspective camera's positioning
  vrControls.update();

  // Render our three.js virtual scene
  renderer.clearDepth();
  renderer.render(scene, camera);
  
  //rotate the lathe block. 
  lathe.rotation.z += _ROTATE_SPEED; 

  if (offset != "") {
    updateLathePosition(); 
  }
  
  //update cuttings 
  updateCuttings();
  updateChips();
  updateDust();
  
  // Kick off the requestAnimationFrame to call this function
  // when a new VRDisplay frame is rendered
  vrDisplay.requestAnimationFrame(update);
}

/**
 * On window resize, update the perspective camera's aspect ratio,
 * and call `updateProjectionMatrix` so that we can get the latest
 * projection matrix provided from the device
 */
function onWindowResize () {
  console.log('setRenderer size', window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * When clicking on the screen, move the lathe to directly in front of the user's
 * current position.
 */
function onClickStart () {
  // Fetch the pose data from the current frame
  var pose = vrFrameData.pose;

  // Convert the pose orientation and position into
  // THREE.Quaternion and THREE.Vector3 respectively
  var ori = new THREE.Quaternion(
    pose.orientation[0],
    pose.orientation[1],
    pose.orientation[2],
    pose.orientation[3]
  );

  var pos = new THREE.Vector3(
    pose.position[0],
    pose.position[1],
    pose.position[2]
  );
  
  var dirMtx = new THREE.Matrix4();
  dirMtx.makeRotationFromQuaternion(ori);
  
  var forward = new THREE.Vector3(0,0, -1.0); 
  var left = new THREE.Vector3(-1.0, 0,0);
  forward.transformDirection(dirMtx);
  left.transformDirection(dirMtx);

  offset.pos  = new THREE.Vector3();
  offset.pos.subVectors(lathe.position, pos);
  offset.rot = ori; 

}
function onClickEnd () {
  offset = {}; 
}

function updateLathePosition() {
  var pose = vrFrameData.pose;
  var camera_pos = new THREE.Vector3(pose.position[0],pose.position[1],pose.position[2]);
  var camera_rot = new THREE.Quaternion(pose.orientation[0], pose.orientation[1], pose.orientation[2], pose.orientation[3]);
  var new_pos = new THREE.Vector3(); 
  var new_rot = new THREE.Quaternion();
  new_pos.addVectors(camera_pos, offset.pos); 
  new_rot = offset.rot.angleTo(camera_rot);
  lathe.position.copy(new_pos);
  lathe.quaternion.copy(new_rot);
}

function onZoomIn () {
  var currScale = lathe.scale;  
  var zoomFactor = 0.10;
  if (currScale >= 4.0) return;
  lathe.scale.set( currScale.x + zoomFactor, currScale.y + zoomFactor, currScale.z + zoomFactor);
}

function onZoomOut () {
  var currScale = lathe.scale;  
  var zoomFactor = 0.10;
  if (currScale <= 0.25) return;
  lathe.scale.set( currScale.x - zoomFactor, currScale.y - zoomFactor, currScale.z - zoomFactor);
}

function onWood() {
  activeMaterialType = "wood";
  lathe.material.color.setHex(0x6f4400);
}
function onMetal() {
  activeMaterialType = "metal";
  lathe.material.color.setHex(0xbbbbbb);
}
function onPlastic() {
  activeMaterialType = "plastic";
  lathe.material.color.setHex(0x004488);
}

function onStartLathe() {
  _ROTATE_SPEED = 2.5;
  // load a sound and set it as the Audio object's buffer
  var audioLoader = new THREE.AudioLoader(); 
  sound.context.resume();
  listener.context.resume();

  audioLoader.load( 'http://cdn.glitch.com/eb70b5dd-9bee-4aff-9a93-08df8d562e27%2Flathe_loop.wav?1550701859159', function( buffer ) {
    sound.setBuffer( buffer );
    sound.setLoop( true );
    sound.setVolume(1);
    sound.play();
  });
}

function onStopLathe() {
  _ROTATE_SPEED = 0;
  sound.stop();
}

function setUpWebSocket() {
    // event emmited when connected
  ws.onopen = function () {
      console.log('websocket is connected ...')
      // sending a send event to websocket server
      ws.send('fab client is connected')
  };
  // event emmited when receiving message 
  ws.onmessage = function (evt) {
      console.log("msg: " + evt.data);
      if (evt.data.includes("is connected")) {
        console.log("new client has connected!");
        return; 
      }

      //clear strokes group
      for (var i = strokes_group.children.length - 1; i >= 0; i--) {
        strokes_group.remove(strokes_group.children[i]);
      }
      //add all the new strokes 
      var objloader = new THREE.ObjectLoader();
      var strokes_arr = JSON.parse(evt.data);
      for (var i = 0; i < strokes_arr.length; i++) {
        var stroke = objloader.parse(strokes_arr[i]); 
        strokes_group.add(stroke);
      }
  };
  ws.onclose = function(evt) { 
      console.log("websocket closed: " +  evt)
    };
  ws.onerror = function(evt) { 
    console.log("websocket error: "+ evt);
  };
}
