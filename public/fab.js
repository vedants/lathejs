//initialize all the variables 
var vrDisplay;
var vrFrameData;
var vrControls;
var arView;

var freezeLocalization;
var canvas;
var camera;
var scene;
var renderer;
var listener;
var sound;  
var woodSound; 
var metalSound; 
var plasticSound; 
var extendedSound;
var strokes_group;
var guides_group;
var axesHelper;

var cube;
var cylinder;
var tool; 
var lathe;
var ref_lathe; 
var _ROTATE_SPEED = 0;  
var _TRANSLATE_FACTOR = .005;//0.5 cm 
var time_since_last_cut = 0; 
var time_threshold = 0.55; //seconds 
var MaterialLibrary = {};

var cuttingList = [];
var chipsList = [];
var cuttingPool = new ObjectPool();
var chipsPool = new ObjectPool();
var dustPool = new ObjectPool();
var chipsGeometry;
var metalGeometry;
var activeMaterialType = "wood"; //default material
var base_url = "http://turnbywire.glitch.me"; //lathejs.glitch.me
var ws = new WebSocket('ws://turnbywire.glitch.me'); //websocket server for drawings 
var wsMaterial = new WebSocket('ws://turnbywire.glitch.me/voice'); //websocket server for voice commands and messages from the tbW

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
  //document.body.appendChild(canvas);
  document.getElementsByClassName("wrapper")[0].appendChild(canvas);
  scene = new THREE.Scene();
  
  // Turn on the debugging panel
  var arDebug = new THREE.ARDebug(vrDisplay);
  //document.body.appendChild(arDebug.getElement());
  //Turn on the debugging axes 
  axesHelper = new THREE.AxesHelper( 2 );
  

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
  
  freezeLocalization = false; //by default, track. 

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
  
  woodSound = new THREE.PositionalAudio (listener); 
  plasticSound = new THREE.PositionalAudio (listener); 
  metalSound = new THREE.PositionalAudio (listener);
  extendedSound = new THREE.PositionalAudio(listener);
  
  sound.context.resume();
  
  woodSound.context.resume();
  plasticSound.context.resume();
  metalSound.context.resume();
  extendedSound.context.resume();
  
  
  listener.context.resume();

  strokes_group = new THREE.Group();
  guides_group = new THREE.Group();
  
  scene.add(strokes_group);
  scene.add(guides_group);
  setUpWebSocket();
  setUpMaterialWebSocket();

  //initialize button callbacks 
  document.getElementById("zoomin").onclick = onZoomIn;
  document.getElementById("zoomout").onclick = onZoomOut;
  document.getElementById("wood").onclick = onWood;
  document.getElementById("metal").onclick = onMetal;
  document.getElementById("plastic").onclick = onPlastic;
  document.getElementById("marble").onclick = onMarble;
  document.getElementById("wireframe").onclick = onWireframe;
  document.getElementById("normals").onclick = onNormals;
  document.getElementById("start").onclick = onStartLathe;
  document.getElementById("stop").onclick = onStopLathe;
  document.getElementById("reset").onclick = resetLathe;
  
  document.getElementById("undo").onclick = onUndo;
  // document.getElementById("redo").onclick = onRedo;
  document.getElementById("freeze").onclick = onToggleLocalization;
  
  document.getElementById("axes").onclick = onToggleAxes;

  document.getElementById("debug").onclick = onToggleDebugConsole;

  document.getElementById("posx+").onclick = onPosXPlus;
  document.getElementById("posx-").onclick = onPosXMinus;
  document.getElementById("posy+").onclick = onPosYPlus;
  document.getElementById("posy-").onclick = onPosYMinus;
  document.getElementById("posz+").onclick = onPosZPlus;
  document.getElementById("posz-").onclick = onPosZMinus;

  //initialize shaders
  LIBRARY.Shaders.loadedSignal.add( onShadersLoaded );
  //initSounds(); 
  initShaderLoading();
}

function initSounds() {
  //webKitAudio only works on chrome :'(
  SoundLibrary.machineFx = new SoundFX();
  SoundLibrary.wood = new SoundFX();
  SoundLibrary.metal = new SoundFX();
  //SoundLibrary.stone = new SoundFX();

  if( SoundFX.isAvailable ) {

      SoundLibrary.machineFx.load("sounds/lathe_loop.wav")
      SoundLibrary.machineFx.source.playbackRate.value = 0;

      SoundLibrary.wood.load("sounds/lathe_wood3.wav")
      SoundLibrary.wood.source.playbackRate.value = 1;

      SoundLibrary.metal.load("sounds/lathe_metal.wav")
      SoundLibrary.metal.source.playbackRate.value = 1;
  }
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
  var chips = new THREE.Mesh( chipsGeometry, new THREE.MeshBasicMaterial( {color:0xc19a6b}));
  chips.receiveShadow = false; 
  chips.doubleSided = false; 
  chips.castShadow = true; 
  chips.geometry.computeFaceNormals();
  return chips;
}

function createDust() {
  //TODO: use perlin noise generator to create dust cloud effect for cutting marble
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
  //only spawn cuttings with a 35% chance 
  if (Math.random() > 0.35) return;
  if (activeMaterialType == "wood") spawnChips(spawnPosition);
  if (activeMaterialType == "metal") spawnCuttings(spawnPosition, 0x555555);
  if (activeMaterialType == "plastic") spawnCuttings(spawnPosition, 0xcccccc);
  //if (activeMaterialType == "marble") spawnDust()
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
  //TODO
}

function updateDust(){
  //TODO
}

function spawnCuttings(spawnPosition, color=0xff0000) {

  spawnDelay++;
  if( spawnDelay < 0 ) return; //maybe change the 0 here to ~10?

  var cuttingMesh = cuttingPool.getObject();
  cuttingMesh.material.color = new THREE.Color(color);
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
    // when cuttings fall 1 meter below the lathe, destroy them and return to the pool
    if( cutting.position.y < -1 ) { 
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

  var tex = new THREE.TextureLoader().load("https://cdn.glitch.com/b8e3f72e-245f-4971-98f0-3ac4cf1d8098%2Fscratches1.png?1553059491848", {}, 
           function(){});
    
      tex.repeat = (0.5,100);
  
      var woodUniforms = {
      //specular: { value: new THREE.Color( 0x111111) },
      //shininess: { value: 30 },
      //directionalLightColor: { value: new THREE.Vector3( 1, 0, 0) },
      //directionalLightDirection: { value: new THREE.Vector3( 1, 0, 0) },
      DiffuseColour1: { type: "c", value: new THREE.Color(0xdbc6a9) }, //dbc6a9
      DiffuseColour2: { type: "c", value: new THREE.Color(0xc4ae87) }, //c4ae87
      GrainCentre: { type: "v3", value: new THREE.Vector3(10,5,100) },
      GrainMult: { type: "f", value: 10 },       
      };
      
      var finalWoodUniform = THREE.UniformsUtils.merge( [THREE.ShaderLib["phong"].uniforms, woodUniforms] );

    
      var params = {
      uniforms:  finalWoodUniform,
      vertexShader:   LIBRARY.Shaders.Wood.vertex,
      fragmentShader: LIBRARY.Shaders.Wood.fragment,
      lights: true
      }
      
      MaterialLibrary.wood = new THREE.ShaderMaterial(params);
      MaterialLibrary.wood.side = THREE.DoubleSide;
  
  var metalUniforms = {
      DiffuseColour1: { type: "c", value: new THREE.Color(0xeeeeee) },
      DiffuseColour2: { type: "c", value: new THREE.Color(0x777777 ) },
      tex: { type: "t", value: null}
      };

      var finalMetalUniform = THREE.UniformsUtils.merge( [THREE.ShaderLib["phong"].uniforms, metalUniforms] );
  
      var testUni = THREE.UniformsUtils.merge([
            THREE.UniformsLib['lights'],
            metalUniforms
        ]),
  
      params = {
          uniforms:  finalMetalUniform,
          vertexShader:   LIBRARY.Shaders.Metal.vertex,
          fragmentShader: LIBRARY.Shaders.Metal.fragment,
          lights: true,
      }
    
      MaterialLibrary.metal = new THREE.ShaderMaterial(params);
      MaterialLibrary.metal.side = THREE.DoubleSide
      MaterialLibrary.metal.uniforms.tex.value = tex;
  
      var plasticUniforms = {
        tex: { type: "t", value: null}
      };

      var finalPlasticUniform = THREE.UniformsUtils.merge( [THREE.ShaderLib["phong"].uniforms, plasticUniforms] );
  
      params = {
          uniforms:  finalPlasticUniform,
          vertexShader:   LIBRARY.Shaders.Plastic.vertex,
          fragmentShader: LIBRARY.Shaders.Plastic.fragment,
          lights: true
      }

      MaterialLibrary.plastic = new THREE.ShaderMaterial(params);
      MaterialLibrary.plastic.side = THREE.DoubleSide;
      MaterialLibrary.plastic.uniforms.tex.value = tex;
  
      var marbleUniforms = {
      };

      var finalMarbleUniform = THREE.UniformsUtils.merge( [THREE.ShaderLib["phong"].uniforms, marbleUniforms] );
  
      params = {
          uniforms:  finalMarbleUniform,
          vertexShader:   LIBRARY.Shaders.Marble.vertex,
          fragmentShader: LIBRARY.Shaders.Marble.fragment,
          lights: true
      }

  MaterialLibrary.marble = new THREE.ShaderMaterial(params);
  MaterialLibrary.marble.side = THREE.DoubleSide;
  
  MaterialLibrary.normals = new THREE.MeshBasicMaterial();
  MaterialLibrary.normals.side = THREE.DoubleSide;
  MaterialLibrary.wireframe = new THREE.MeshBasicMaterial();
  MaterialLibrary.wireframe.wireframe = true; 
  MaterialLibrary.wireframe.side = THREE.DoubleSide;
  
  

  //set up the lathe!!!
  lathe = new Lathe();  
  lathe.build(); //(see lathe.js)

  lathe.material = MaterialLibrary["wood"];
  
  // lathe.material = new THREE.MeshNormalMaterial ();
  // lathe.material = new THREE.MeshLambertMaterial( { color : 0xbb0000} );
  lathe.material.side = THREE.DoubleSide;
  lathe.receiveShadow = true;
  lathe.castShadow = false;
  lathe.geometry.dynamic = true;
  lathe.geometry.computeFaceNormals();
  lathe.geometry.computeVertexNormals();
  
  lathe.position.x = - 0.5 * lathe.totalLinks * lathe.linkDist //center it horizontally 
  lathe.position.z = -0.3 - lathe.radius; //position the lathe a little bit in front of the screen
  lathe.rotation.y = 90 * TO_RADIANS; 
  axesHelper.position.x = lathe.position.x 
  axesHelper.position.z = lathe.position.z;
  
  scene.add(lathe);
  lathe.add(sound);
  
  lathe.add(woodSound); 
  lathe.add(plasticSound);
  lathe.add(metalSound);
  lathe.add(extendedSound);
  strokes_group.parent = lathe;
  guides_group.parent = lathe;
  scene.add( axesHelper );
  attach(axesHelper, lathe, scene);
  
  //add grid, but make it invisible
  addGrids();
  onGridToggle();
  
  
  //set up the cutting tool (no longer in use)
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
  var newFactor = pressure;
  if (newFactor < 0.1) newFactor = 0.1; //never let the lathe be less than 10% of the original thickness. 
  //TODO: set based on lathe.minRadius
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
    // $.ajax({
    //    url: base_url + "/is_cut_poll",
    //    success: function(data) {
    //        console.log("got data");
    //        check_and_cut(data);
    //        poll_for_cut();
    //    },
    //    error: function() {
    //        console.log("longpoll error");
    //        //wait 
    //        setTimeout(function(){
    //         poll_for_cut();
    //         }, 2000);
    //    },
    //    timeout: 600000 // every 10 minutes, reset the connection. 
    // });
};

/* Checks where the newSegmentFactors are different from the current segmentFactors, and updates those entries. 
*  Also calls setRing, to cut the lathe accordingly. 
*/


function check_and_cut(newSegmentFactors) {
  for (var i = 0; i < newSegmentFactors.length - 1; i++) {
    if (newSegmentFactors[i] != segmentFactors[i]) {
      time_since_last_cut = 0; 
      if (extendedSound.isPlaying) extendedSound.setVolume(1 - newSegmentFactors[i]);
      if (newSegmentFactors[i] > lathe.minRadius && newSegmentFactors[i] > segmentFactors[i]) {  //dont create cuttings if at minimum radius.
        console.log(i);
        var spawnPosition = lathe.ring[i][_branchSegments / 2].clone();
        spawnPosition = spawnPosition.applyMatrix4(lathe.matrixWorld);
        spawnParticle(spawnPosition);
      }
      setRing(i, newSegmentFactors[i]);
      
      }
  }
  lathe.geometry.verticesNeedUpdate = true;
}

function resetLathe() {
  for (var i = 0; i < segmentFactors.length - 1; i++) {
      setRing(i, 1);
  }
  lathe.geometry.verticesNeedUpdate = true;   
  sound.setVolume(0.7);
}

/**
 * The render loop, called once per frame. Handles updating
 * our scene and rendering.
 */

var clock = new THREE.Clock();

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
  if (!freezeLocalization) {
    vrControls.update();
  }
  

  // Render our three.js virtual scene
  renderer.clearDepth();
  renderer.render(scene, camera);
  
  //rotate the lathe block. 
  lathe.rotation.z += _ROTATE_SPEED; 
  
  //update lathe rotation volume 
  time_since_last_cut += clock.getDelta();
  if (time_since_last_cut > time_threshold) {
    //not currently cutting
    sound.setVolume(0.3);
    woodSound.setVolume(0.0); //TODO: change to zero after testing
    plasticSound.setVolume(0.0);
    metalSound.setVolume(0.0);
    extendedSound.setVolume(0.0);
  } else {
    //currently cutting
    sound.setVolume(0.3);
    woodSound.setVolume(0.9);
    plasticSound.setVolume(0.9);
    metalSound.setVolume(0.9);
    
    //TODO: dynamically adapt extendedSound somewhere
  }
  
  // if (! $.isEmptyObject(offset)){
  //   updateLathePosition(); 
  // }
  
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
  
  lathe.parent = camera;
  lathe.position.x = .25 * lathe.totalLinks * lathe.linkDist - 0.01//center it on the chuck
  lathe.position.y = .05; //
  lathe.position.z = - 0.1778; //position the lathe a little bit in front of the screen
  lathe.rotation.x = 0; 
  lathe.rotation.y = 90 * TO_RADIANS; 
  lathe.rotation.z = 0;

}
function onClickEnd () {
  lathe.position.copy(lathe.getWorldPosition());
  lathe.quaternion.copy(lathe.getWorldQuaternion());
  lathe.parent = scene;
}

function updateLathePosition() {
  // var pose = vrFrameData.pose;
  // var camera_pos = new THREE.Vector3(pose.position[0],pose.position[1],pose.position[2]);
  // var camera_rot = new THREE.Quaternion(pose.orientation[0], pose.orientation[1], pose.orientation[2], pose.orientation[3]);
  // var new_pos = new THREE.Vector3(); 
  // var new_rot = new THREE.Quaternion();
  // new_pos.addVectors(camera_pos, offset.pos); 
  // //angle between the two quaternions
  // new_rot = offset.rot.inverse().multiply(camera_rot)
  // lathe.position.copy(new_pos);
  // lathe.quaternion.copy(lathe.quaternion.multiply(new_rot));
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
  lathe.material = MaterialLibrary.wood;
  //lathe.material.color.setHex(0x6f4400);
  
  //update cutting forces 
  $.get( "http://turnbywire.glitch.me/wood_force", function( data ) {
  });
  woodSound.context.resume();
  plasticSound.context.resume(); 
  metalSound.context.resume();
  listener.context.resume();
  extendedSound.context.resume();
  
  audioLoader.load( 'https://cdn.glitch.com/724cb6ba-bdad-4d77-93e3-ea70c80d2570%2Flathe_metal.wav?1557087268814', function( buffer ) {
    woodSound.setBuffer( buffer );
    woodSound.setLoop( true );
    woodSound.setVolume(0.0);
    if (metalSound.isPlaying) metalSound.stop();
    if (plasticSound.isPlaying) plasticSound.stop();
    if (extendedSound.isPlaying) extendedSound.stop();
    woodSound.play();
    
  });
}
  
function onNormals() {
  activeMaterialType = "normals";
  lathe.material = new THREE.MeshNormalMaterial();
  
  //update cutting forces 
  $.get( "http://turnbywire.glitch.me/zero_force", function( data ) {
  });  
  
  audioLoader.load( 'https://cdn.glitch.com/724cb6ba-bdad-4d77-93e3-ea70c80d2570%2Flathe_metal.wav?1557087268814', function( buffer ) {
    extendedSound.setBuffer( buffer );
    extendedSound.setLoop( true );
    extendedSound.setVolume(0.0);
    if (woodSound.isPlaying) woodSound.stop();
    if (metalSound.isPlaying) metalSound.stop();
    if (plasticSound.isPlaying) plasticSound.stop();
    extendedSound.play();
    
  });
  
  
  //if (extendedSound.isPlaying) extendedSound.stop();
  
}
  
function onWireframe() {
  activeMaterialType = "wireframe";
  //lathe.material = MaterialLibrary.wireframe;
  onGridToggle();
}
                   
function onMetal() {
  activeMaterialType = "metal";
  lathe.material = MaterialLibrary.metal;
  //lathe.material.color.setHex(0xbbbbbb);
  
  //update cutting forces 
  $.get( "http://turnbywire.glitch.me/metal_force", function( data ) {
  });
  
  // load a sound and set it as the Audio object's buffer
  var audioLoader = new THREE.AudioLoader(); 
  woodSound.context.resume();
  plasticSound.context.resume(); 
  metalSound.context.resume();
  listener.context.resume();
  extendedSound.context.resume();
  
  audioLoader.load( 'https://cdn.glitch.com/724cb6ba-bdad-4d77-93e3-ea70c80d2570%2Flathe_metal.wav?1557087268814', function( buffer ) {
    metalSound.setBuffer( buffer );
    metalSound.setLoop( true );
    metalSound.setVolume(0.0); //only make it audible when you're cutting
    if (woodSound.isPlaying) woodSound.stop();
    if (plasticSound.isPlaying) plasticSound.stop();
    if (extendedSound.isPlaying) extendedSound.stop();
    metalSound.play();
    
  });
}
function onPlastic() {
  activeMaterialType = "plastic";
  lathe.material = MaterialLibrary.plastic;
  //lathe.material.color.setHex(0x004488);
  
  //update cutting forces 
  $.get( "http://turnbywire.glitch.me/plastic_force", function( data ) {
  });
  // load a sound and set it as the Audio object's buffer
  var audioLoader = new THREE.AudioLoader(); 
  woodSound.context.resume();
  plasticSound.context.resume();
  metalSound.context.resume();
  listener.context.resume();
  extendedSound.context.resume();
  
  audioLoader.load( 'http://cdn.glitch.com/eb70b5dd-9bee-4aff-9a93-08df8d562e27%2Flathe_loop.wav?1550701859159', function( buffer ) {
    plasticSound.setBuffer( buffer );
    plasticSound.setLoop( true );
    plasticSound.setVolume(0.0); //only make it audible when you're cutting
    if (woodSound.isPlaying) woodSound.stop();
    if (metalSound.isPlaying) metalSound.stop();
    if (extendedSound.isPlaying) extendedSound.stop();
    plasticSound.play();
  });
}

function onMarble() {
  lathe.material = MaterialLibrary.marble;
  activeMaterialType= "marble";
  
  //update cutting forces 
  $.get( "http://turnbywire.glitch.me/marble_force", function( data ) {
  });
  
  var audioLoader = new THREE.AudioLoader(); 
  listener.context.resume();
}

function onStartLathe() {
  _ROTATE_SPEED = 2.55;
  // load a sound and set it as the Audio object's buffer
  var audioLoader = new THREE.AudioLoader(); 
  sound.context.resume();
  listener.context.resume();

  audioLoader.load( 'http://cdn.glitch.com/eb70b5dd-9bee-4aff-9a93-08df8d562e27%2Flathe_loop.wav?1550701859159', function( buffer ) {
    sound.setBuffer( buffer );
    sound.setLoop( true );
    sound.setVolume(0.7);
    sound.play();
  });
}

function onStopLathe() {
  _ROTATE_SPEED = 0;
  if (sound && sound.isPlaying) {
    sound.stop();
  }
  
}

function onUndo() {
  $.get( "http://turnbywire.glitch.me/undo", function( data ) {
    console.log("undo");
  });

}

function onRedo() {
  $.get( "http://turnbywire.glitch.me/redo", function( data ) {
  console.log( "redo was performed" ); 
});
}

function onToggleAxes() {
  axesHelper.visible = !axesHelper.visible; 
}
function onToggleDebugConsole() {
  var x = document.getElementById("debugconsole");
  if (x.style.display == "none") {
    x.style.display = "block";
  } else {
    x.style.display = "none";
  }
}

function onToggleLocalization() {
   freezeLocalization = !freezeLocalization;
}

function onPosXPlus() {
  lathe.position.x += _TRANSLATE_FACTOR;
}
function onPosXMinus() {
  lathe.position.x -= _TRANSLATE_FACTOR;
}
function onPosYPlus() {
  lathe.position.y += _TRANSLATE_FACTOR;
}
function onPosYMinus() {
  lathe.position.y -= _TRANSLATE_FACTOR;
}
function onPosZPlus() {
  lathe.position.z += _TRANSLATE_FACTOR;
}
function onPosZMinus() {
  lathe.position.z -= _TRANSLATE_FACTOR;
}


//******RECEIVE DRAWINGS ******************//

var drawMaterial = new THREE.RawShaderMaterial({
  vertexShader: document.getElementById( 'inkVertexShader' ).textContent,
  fragmentShader: document.getElementById( 'inkFragmentShader' ).textContent,
  side: THREE.DoubleSide,
  transparent: true
});

function setUpWebSocket() {
  // event emmited when connected
  ws.onopen = function () {
    console.log('websocket is listening for messages about drawings ...')
  };
  // event emmited when receiving message 
  ws.onmessage = function (evt) {
    console.log("msg: " + evt.data);

    //clear strokes group
    const num_strokes = strokes_group.children.length;
    for (var i = num_strokes - 1; i >= 0; i--) {
      strokes_group.remove(strokes_group.children[i]);
    }
    //add all the new strokes 
    var objloader = new THREE.ObjectLoader();
    var strokes_arr = JSON.parse(evt.data);
    for (var i = 0; i < strokes_arr.length; i++) {
      var stroke = objloader.parse(strokes_arr[i]); 
      stroke.drawMode = THREE.TriangleStripDrawMode;
      scene.add(stroke);
      attach(stroke, strokes_group, scene);
      //strokes_group.add(stroke);
    }
  };
  
  ws.onclose = function(evt) { 
    console.log("websocket closed: " +  evt); 
    console.log("restarting websocket: " +  evt); 
    setUpWebSocket();
    
  };
  ws.onerror = function(evt) { 
    console.log("websocket error: "+ evt);
  };
}

function setUpMaterialWebSocket() {
  // event emmited when connected
  wsMaterial.onopen = function () {
    console.log('websocket is listening for messages about material updates ...')
  };
  // event emmited when receiving message 
  //reload
  wsMaterial.onmessage = function (evt) {
    console.log("change material to:" + evt.data);
    const newMat = evt.data; 
  
    
    if (newMat == "wood") {
       onWood();
     } 
    else if (newMat == "plastic") {
       onPlastic()
     }
    else if (newMat == "metal") {
       onMetal();
     }
    else if (newMat == "marble") {
       onMarble();
    }
    else if (newMat == "normals") {
       onNormals();
    }
    else if (newMat == "wireframe") {
       onWireframe();
    }
    else if (newMat == "reset") {
       resetLathe();
    }
    //newMat is a JSON 
    var parsedMsg = JSON.parse(newMat); 
    //check if parsedMsg is to add or remove a guide
    
    if (parsedMsg.type && parsedMsg.type == "path") {
      check_and_cut(parsedMsg.data);
    }
    if (parsedMsg.pos && parsedMsg.ax && parsedMsg.type) {
      
      if (parsedMsg.type == "add") {
        var g = addGuide(parsedMsg.ax, parseFloat(parsedMsg.pos)); 
        //g.parent = scene;
        console.log(g.getWorldPosition()); //the mere act of printing these positions makes it work
        detach(g, lathe, scene);
        console.log(g.position); //what is this sorcery? 
        //it's 3 am and idgaf anymore just don't remove these two console log statements.... 
        
    
     } else {
       removeGuide(parsedMsg.ax, parseFloat(parsedMsg.pos));
     }
    }
    return false;
  };
  
  wsMaterial.onclose = function(evt) { 
      console.log("websocket for materials closed: " +  evt)
      console.log("restarting webserver..."); 
      wsMaterial = new WebSocket('ws://turnbywire.glitch.me/voice'); 
      setUpMaterialWebSocket();
    
  };
  wsMaterial.onerror = function(evt) { 
    console.log("materials websocket error: "+ evt);
    wsMaterial = new WebSocket('ws://turnbywire.glitch.me/voice'); 
    setUpMaterialWebSocket();
  };
}

function attach (child, parent, scene) {
    child.applyMatrix( new THREE.Matrix4().getInverse( parent.matrixWorld ) );
		scene.remove( child );
		parent.add( child );
}

function detach (child, parent, scene) {
  child.applyMatrix(parent.matrixWorld);
  parent.remove(child); 
  scene.add(child);
}

//var x;

function drawLine(start, finish) {
  var material = new THREE.LineBasicMaterial( { color: 0x0000ff } );
  var geometry = new THREE.Geometry();
  geometry.vertices.push(start);
  geometry.vertices.push(finish);
  var line = new THREE.Line( geometry, material );
  return line;
}

const guide_length = 0.3; // ~1 t
function addGuide(axis, position) {
  // onStopLathe();
  // lathe.rotation.z = 0;
  // lathe.matrixWorldNeedsUpdate = true
  
  position = position * 0.001; //convert from mm to meters.   
  console.log('adding guide...');
  var start, finish; 
  if (axis == "r") {
    console.log("R");
    start = new THREE.Vector3(0, 0, 0); 
    finish = new THREE.Vector3(0, 0, guide_length);
  } else if (axis == "z") {
      console.log("Z");
      start = new THREE.Vector3(0, 0, 0);
      finish = new THREE.Vector3(0, guide_length,0); 
  }
  var x = drawLine(start, finish);
  
  if (axis == "r") {
    lathe.add(x); 
    x.position.x -= position;
  } 
  else if (axis == "z") {
    var geometry = new THREE.CircleGeometry( 2 * lathe.radius, 32 );
    var material = new THREE.MeshBasicMaterial( { color: 0x004444 } );
    material.side = THREE.DoubleSide;
    material.transparent = true;
    material.opacity = 0.4;
    var c = new THREE.Mesh( geometry, material );
    
    

    lathe.add(c);
    c.position.z += position;
  }
  
  //onStartLathe();
  
  return x;
  
}

function removeGuide(axis, position) {
  //search all guides in guides_group, and remove the one that matches the function params
  console.log('removing guide...');
  return; 
}


var grids = []; 
function addGrid(pos_x, num_segments) {
  const rad = 1.05 * lathe.radius;
  const length = lathe.depth/1000/num_segments;
  var branchSegs = 12;
  var geometry = new THREE.CylinderGeometry( rad, rad, length, branchSegs );
  var material = new THREE.MeshBasicMaterial( {color: 0x00bb00} );
  var cylinder = new THREE.Mesh( geometry, material );
  var grid = cylinder;
  grid.material.wireframe = true;
  
  lathe.add( grid );
  grid.rotation.x = Math.PI / 2;
  grid.position.z += pos_x;
  grids.push(grid);
}

function addGrids() {
  const numSegments = 10; //divide the lathe into 10 parts 
  for (var i = 0; i < lathe.depth; i += lathe.depth / numSegments) {
    addGrid(i, numSegments);
  }
}

function onGridToggle() {
  for (var i = 0; i < grids.length; i++) {
    var grid = grids[i] 
    grid.visible = !grid.visible;
  }
  
}

