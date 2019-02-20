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

var cube;
var cylinder;
var tool; 

var _ROTATE_SPEED = 0; //speed at which the lathe rotates (initially zero)
  
var MaterialLibrary = {};

var cuttingList = [];
var cuttingPool = new ObjectPool();
var chipsGeometry;
var metalGeometry;
var activeMaterialType = "metal"; //initial material is metal

var segmentFactors = []; //stores how much all the segments in the lathe have been "cut" by. 
var lastChangedSegments; //stores which segment in the cylinder was changed last. 
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
  // Turn on the debugging panel
  var arDebug = new THREE.ARDebug(vrDisplay);
  document.body.appendChild(arDebug.getElement());

  // Setup the three.js rendering environment
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  console.log('setRenderer size', window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  canvas = renderer.domElement;
  document.body.appendChild(canvas);
  scene = new THREE.Scene();

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
  window.addEventListener('touchstart', onStartLathe);
  sound = new THREE.Audio( listener ); //audio source

  //initialize button callbacks 
  document.getElementById("zoomin").onclick = onZoomIn;
  document.getElementById("zoomout").onclick = onZoomOut;
  document.getElementById("wood").onclick = onWood;
  document.getElementById("steel").onclick = onSteel;
  document.getElementById("plastic").onclick = onPlastic;
  document.getElementById("start").onclick = onStartLathe;
  document.getElementById("stop").onclick = onStopLathe;

  //initialize shaders
  LIBRARY.Shaders.loadedSignal.add( onShadersLoaded );
  initShaderLoading(); //function is in Library.js
}
  
function onShadersLoaded() {
  //chipsPool.createObject = createChips
  cuttingPool.createObject = createCutting
  //dustPool.createObject = createDust

  //initSounds();
  initLights();
  initObjects();

	// Bind our event handlers
  window.addEventListener('resize', onWindowResize, false);
  canvas.addEventListener('touchstart', onClick, false);
  
}
  
function createCutting() {
  var cutting = new THREE.Mesh( metalGeometry, MaterialLibrary.metal );
  cutting.receiveShadow = false;
  cutting.doubleSided = false;
  cutting.castShadow = true;
  cutting.geometry.computeFaceNormals();
  return cutting;
}
  
var spawnDelay = 0;

function spawnParticle(sector) {
  //TODO: spawn wood chips, metal cuttings, or stone dust, depending on the material being cut. 
  //for now, just default to spawning metal cuttings. 
  spawnCuttings(sector); 
}
function spawnCuttings(spawnX) {

    spawnDelay++;
    if( spawnDelay < 15 ) return; 

    spawnDelay = 0;

    var cuttingMesh = cuttingPool.getObject();
    cuttingList.push(cuttingMesh);
    cuttingMesh.velocity = new THREE.Vector3(Math.random()*15-7,5,5);
    
    //TODO: initialize scales to zero, and grow cuttings over time. 
    cuttingMesh.scale.x = 0.4//+ Math.random()*1;
    cuttingMesh.scale.y = 0.4//+ Math.random()*1;
    cuttingMesh.scale.z = 0.4

    cuttingMesh.rotationVelocity = new THREE.Vector3(Math.random()*0.5,Math.random()*0.0,Math.random()*0.0);
    cuttingMesh.rotation = new THREE.Vector3(Math.PI*.5,-Math.PI*Math.random(), Math.PI*.5);

    scene.add(cuttingMesh);
}
  
function updateCuttings() {

  var i = 0; 
  var max = cuttingList.length; //number of cuttings 
  var cutting;

  for( i = max-1; i>= 0; i--) {
      cutting = cuttingList[i];
      cutting.rotation.addSelf(cutting.rotationVelocity);
      // if(cutting.scale.z < 3 && intersectionPoint) {
      //     cutting.scale.x = cutting.scale.y = cutting.scale.z += .2
      //     cutting.position = intersectionPoint.clone()
      //     cutting.position.z += 20
      // }
      // else {
          cutting.velocity.y -= 1;
          cutting.position.addSelf(cutting.velocity);
      //}
      if( cutting.position.y < -4 ) { // 4 meters below initialization point
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
  //set up materials 
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

  //lathe.material = MaterialLibrary[activeMaterialType];
  
  
  //lathe.material = new THREE.MeshNormalMaterial ();
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
  
  loader = new THREE.ObjectLoader(); //used to be a BinaryLoader, but that's deprecated now
  loader.load("/models/metal.js", function(obj) { metalLoaded(obj) });
}

function metalLoaded(obj) {
  //TODO: This function doesn't seem to be working! Double check that the obj is being generated/loaded correctly. 
  metalGeometry = obj.geometry; 
  metalGeometry.computeBoundingSphere();
  console.log(metalGeometry);
  obj.position.z = - 0.3;
  //obj.scale.set(0.5);
  scene.add(obj);
  
  //set up all the long-poll listeners 
  poll_for_cut();
  //poll_for_toolPos();
  
  // (Finally) Kick off the render loop!
  update();
}
  
  /**
  Removes pressure % of the material from the segment of the lathe at position changedSegment.
  */ 
function setRing (changedSegment, pressure) {
  var currFactor = segmentFactors[changedSegment];
  if (currFactor < pressure) return; //cutting it would set it to negative scaling! 
  
  pressure *= currFactor; 
  
  var newFactor = currFactor - pressure;
  
  if (newFactor < 0.2) newFactor = 0.2; //never let the lathe be less than 20% of the original thickness. 
  
  for (j = 0; j < _branchSegments; j++) {
    lathe.ring[changedSegment][j].x = lathe.ringOrigin[changedSegment][j].x * newFactor;
    lathe.ring[changedSegment][j].y = lathe.ringOrigin[changedSegment][j].y * newFactor;
    
    //tool.position.z = -0.5 +  (0.06 / 2);//lathe.pos.z + lathe.radius + half the length of the tool
    tool.position.x = lathe.position.x - (lathe.depth / 2) + (changedSegment/ lathe.totalLinks);
    //tool.position.x = lathe.ring[changedSegment][j].x;
    //tool.z = lathe.ringOrigin[changedSegment][j].y
    //dont scale change along z! 
    //TODO: this is going to cause problems is the lathe isn't aligned along the z-axis. 
    //is there someway to make sure it always is? 
    segmentFactors[changedSegment] = newFactor;
  }
}

/* Sets up a HTTP long poll to listen for messages from the server for when to cut the lathe.
*  https://www.pubnub.com/blog/2014-12-01-http-long-polling/
*/ 
var poll_for_cut = function () {
    $.ajax({
       url: "http://lathejs.glitch.me/is_cut_poll",
       success: function(data){
           console.log(data); // { text: "Some data" } -> will be printed in your browser console every 5 seconds
           check_and_cut(data['segmentFactors']);
           poll_for_cut();
       },
       error: function() {
           poll_for_cut();
       },
       timeout: 30000 // 30 seconds
    });
};

/* Checks where the newSegmentFactors are different from the current segmentFactors, and updates those entries. 
*  Also calls setRing, to cut the lathe accordingly. 
*/
function check_and_cut(newSegmentFactors) {
  for (var i = 0; i < newSegmentFactors.length; i++) {
    if (newSegmentFactors[i] != segmentFactors[i]) {
      if (newSegmentFactors[i] > lathe.minRadius) {  //dont create cuttings if at minimum radius.
        spawnParticle(i);
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
  //rotate the lathe block. 
  lathe.rotation.x += _ROTATE_SPEED; 
  
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
function onClick () {
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

  // move our lathe and place it at the camera's current position
  //don't rotate it! This means you must have the angle of the lathe block correct when you initialize the app. 
  lathe.position.copy(pos);
  lathe.position.z = pos.z  +  (0.5 + lathe.radius) * forward.z; //position the lathe a little bit in front of the screen
  lathe.position.x = pos.x + (0.5 * lathe.totalLinks * lathe.linkDist) * left.x;
  lathe.position.y = pos.y;
  //lathe.quaternion.copy(ori);
  //TODO: update cylinder.ringOrigins by the new offset. 
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
  console.log("onWood");
  lathe.material.color.setHex(0x6f4400);
}
function onSteel() {
  lathe.material.color.setHex(0xbbbbbb);
}
function onPlastic() {
  lathe.material.color.setHex(0x004488);
}

function onStartLathe() {
  _ROTATE_SPEED = 2.5;
  // load a sound and set it as the Audio object's buffer
  var audioLoader = new THREE.AudioLoader();
  audioLoader.load( 'https://cdn.glitch.com/eb70b5dd-9bee-4aff-9a93-08df8d562e27%2Flathe_loop.wav?1550701859159', function( buffer ) {
    sound.setBuffer( buffer );
    sound.setLoop( true );
    sound.setVolume(1);
    sound.play();
});

}
function onStopLathe() {
  _ROTATE_SPEED = 0;
}