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
  
var MaterialLibrary = {};
var activeMaterialType = "metal";

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
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  console.log('setRenderer size', window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  canvas = renderer.domElement;
  document.body.appendChild(canvas);
  scene = new THREE.Scene();
  
  var arDebug = new THREE.ARDebug(vrDisplay);
  document.body.appendChild(arDebug.getElement());

  var axesHelper = new THREE.AxesHelper( 5 );
  scene.add( axesHelper );

  arView = new THREE.ARView(vrDisplay, renderer);

    camera = new THREE.ARPerspectiveCamera(
    vrDisplay,
    60,
    window.innerWidth / window.innerHeight,
    vrDisplay.depthNear,
    vrDisplay.depthFar
  );

  vrControls = new THREE.VRControls(camera);
  
  listener = new THREE.AudioListener();
  camera.add( listener );
  
  var source = listener.context.createBufferSource();
  source.connect(listener.context.destination);
  source.start();
  
  sound = new THREE.PositionalAudio( listener );
  sound.context.resume();
  listener.context.resume();

  document.getElementById("zoomin").onclick = onZoomIn;
  document.getElementById("zoomout").onclick = onZoomOut;
  document.getElementById("wood").onclick = onWood;
  document.getElementById("metal").onclick = onMetal;
  document.getElementById("plastic").onclick = onPlastic;

  LIBRARY.Shaders.loadedSignal.add( onShadersLoaded );
  initShaderLoading();
}
  
function onShadersLoaded() {

  initLights();
  initObjects();

  window.addEventListener('resize', onWindowResize, false);
  canvas.addEventListener('touchstart', onClick, false); 
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
  lathe.build(); //TODO: get lathe mesh over network, instead of building it locally. 

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
  
  scene.add(lathe);
  lathe.add(sound);  
  
  //set up all the long-poll listeners 
  poll_for_update();
  
  //Kick off the render loop!
  update();
}

var poll_for_update = function () {
    $.ajax({
       url: "https://lathejs.glitch.me/is_lathe_updated",
       success: function(data) {
           console.log("got data"); 
           check_and_update();
           poll_for_cut();
       },
       error: function() {
           console.log("longpoll error");
           poll_for_cut();
       },
       timeout: 30000 // 30 seconds
    });
}

function check_and_update() {
  var loader = new THREE.ObjectLoader();
  loader.load(
	  "models/json/lathe.json", function ( obj ) {
      console.log("got lathe:"); 
      console.log(obj);
      lathe = obj; 
	  });
}

 //The render loop, called once per frame. Handles updating our scene and rendering. 
function update() {
  renderer.clearColor();
  arView.render();
  camera.updateProjectionMatrix();
  vrDisplay.getFrameData(vrFrameData);
  vrControls.update();
  renderer.clearDepth();
  renderer.render(scene, camera);
  vrDisplay.requestAnimationFrame(update);
}

function onWindowResize () {
  console.log('setRenderer size', window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}


function onClick () {
  var pose = vrFrameData.pose;
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

  lathe.position.copy(pos);
  lathe.quaternion.copy(ori);
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