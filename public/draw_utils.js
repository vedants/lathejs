// Drawing constants.
var MINIMIM_POINT_DISTANCE = 0.001;
var MINIMUM_STROKE_POINTS = 2;
var MINIMUM_BRUSH_POINTS = 2;
var STROKE_DISTANCE = 0.1;
var STROKE_WIDTH_EASING = 0.05;
var STROKE_WIDTH_MINIMUM = 0.00125;
var STROKE_WIDTH_MAXIMUM = 0.1;
var STROKE_WIDTH_MODIFIER = 1.25;
var STROKE_POSITION_EASING = 0.5;
var STROKE_VELOCITY_EASING = 0.5;
var STROKE_ORTHOGONAL_EASING = 0.5;
var STROKE_NORMAL_EASING = 0.95;
var STROKE_NORMAL_QUAT_EASING = 0.5;
var MINIMIM_ERASE_ENERGY = 0.005;
var MINIMIM_ERASE_ENERGY_FRAMES = 15;
// Setup drawing variables.
var drawing = false;
var stroke = [];
var strokes = [];
var strokeIndex = 0;
var brush;
var brushStroke = [];
var drawMaterial = new THREE.RawShaderMaterial({
  vertexShader: document.getElementById( 'vertexShader' ).textContent,
  fragmentShader: document.getElementById( 'fragmentShader' ).textContent,
  side: THREE.DoubleSide,
  transparent: true
});


renderer.domElement.addEventListener('touchstart', function(event) {
drawing = true;
});


renderer.domElement.addEventListener('touchend', function(event) {
drawing = false;
stroke.length = 0;
strokeIndex += 1;
sendStrokesOverWebSocket();
});

update_draw_utils();


// Get a point in front of the device to use as the drawing location.
// Pass in a THREE.Vector3 to be populated with data to avoid creating garbage.
// This strange function structure is a way of avoiding creating garbage while
// generating the rotated forward vector.
var getDrawPoint = (function() {
  // Setup a basic forward vector (scaled down so it's not so far away).
  var forward = new THREE.Vector3(0, 0, -1).multiplyScalar(STROKE_DISTANCE);
  // Create a scratch vector for generating the rotated forward vector.
  var rotatedForward = new THREE.Vector3();
  return function(out) {
    // Start with the camera position, which is equivalent to device pose.
    out.copy(camera.position);
    // Rotate the forward vector by the pose orientation.
    rotatedForward.copy(forward);
    rotatedForward.applyQuaternion(camera.quaternion);
    out.add(rotatedForward);
  }
})();


// Basic physics parameters to help smooth out input data for nicer
// brush strokes
var strokeWidth = STROKE_WIDTH_MINIMUM;
var position = new THREE.Vector3();
var previousPosition = new THREE.Vector3();
var normalQuat = new THREE.Quaternion();
var previousNormalQuat = new THREE.Quaternion();
var normal = new THREE.Vector3(0, 0, 1);
var previousNormal = new THREE.Vector3(0, 0, 1);
var velocity = new THREE.Vector3();
var previousVelocity = new THREE.Vector3();
var acceleration = new THREE.Vector3();
// An array to keep track of the past accelerations
var accelerationArray = [];

/**
 * This function returns an object that represents a point in the stroke.
 * The position, normal, velocity and width values are used to help calculate
 * how the stroke will look. They are set by the physics values being
 * calculated every frame inside the updatePhysics function
 */
function getStroke()
{
  return {
    position: new THREE.Vector3(position.x, position.y, position.z),
    normal: new THREE.Vector3(normal.x, normal.y, normal.z),
    velocity: new THREE.Vector3(velocity.x, velocity.y, velocity.z),
    width: strokeWidth
  };
}


/**
 * This function is called when the user touches down and starts to draw
 * a stroke
 */
function processDraw() {
  // Add the draw point to the current stroke.
  stroke.push(getStroke());
  // Check to see if you have enough points (2) to start drawing a stroke
  if(stroke.length < MINIMUM_STROKE_POINTS) {
    return;
  }
  // Get the last two points in the stroke
  var s0 = stroke[stroke.length - 2];
  var s1 = stroke[stroke.length - 1];
  // Check if the distance between the last two points is bigger
  // than a set amount, this avoids tiny strips in the brush stroke
  if(s0.position.distanceTo(s1.position) < MINIMIM_POINT_DISTANCE) {
    stroke.pop();
    return;
  }
  // Remove the old stroke from the scene so we can regenerate the stroke.
  if (strokes[strokeIndex]) {
    scene.remove(strokes[strokeIndex]);
  }
  // Generate a new stroke and cache it in our array of strokes
  strokes[strokeIndex] = generateStroke(stroke);
  // Add the stroke to the threejs scene for rendering
  scene.add(strokes[strokeIndex]);
}


/**
 * This function is responsible for constantly rendering a brush reticle
 * when the user is not touching down on the screen. This helps to pre-
 * visualize the dynamics of the brush (color, stroke width, etc)
 */
function processDrawBrush() {
  // Add the draw point to the current stroke.
  brushStroke.push(getStroke());
  // Don't use positions if they aren't far enough away from the previous point.
  if(brushStroke.length < MINIMUM_BRUSH_POINTS) {
    return;
  }
  // Remove the old brush reticle from the scene so we can regenerate it
  if (brush) {
    brushStroke.shift();
    scene.remove(brush);
  }
  // Get the last two points in the stroke
  var b0 = brushStroke[brushStroke.length - 2];
  var b1 = brushStroke[brushStroke.length - 1];
  // Check if the distance between the last two points is bigger
  // than a set amount, this avoids tiny strips in the brush stroke
  if(b0.position.distanceTo(b1.position) < MINIMIM_POINT_DISTANCE) {
    return;
  }
  // Generate a new stroke and sets it to brush reticle
  brush = generateStroke(brushStroke);
  // Add the brush reticle to the threejs scene for rendering
  scene.add(brush);
}



/**
 * This function calculates the positions, normals, uvs and velocities
 * float32Arrays needed to create a buffer geometry so we can render our brush
 * strokes using threejs (WebGL)
 */
function generateStroke(strokeData) {
  // Create Float32Arrays of the proper size to hold vertex information
  // Each stroke is rendered by a triangle strip, thus each stroke point yields
  // two verticies, and each vertex contains three (x, y, z) or two
  // floats (u, v) depending on property.
  var positions = new Float32Array(strokeData.length * 2 * 3);
  var normals = new Float32Array(strokeData.length * 2 * 3);
  var uvs = new Float32Array(strokeData.length * 2 * 2);
  var velocities = new Float32Array(strokeData.length * 2 * 3);
  // Create a Vector3 to cache the vertex offset vector
  var v = new THREE.Vector3();
  // Create a reference to the last stroke point's velocity
  var lastVelocity;
  // Create two Vector3s to cache the positions of the two vertex positions
  // calculated from the origin stroke position and its physics properties
  var p1 = new THREE.Vector3();
  var p2 = new THREE.Vector3();
  // Create a variable to keep track of whether the current stroke point's
  // velocity is in the opposite direction of the last point's velocity
  var flip = false;
  // loop through the stroke points and calculate its two emiited vertex
  // offset positions and set their other properties in the Float32Arrays
  // created above
  for (var i = 0; i < strokeData.length; i++) {
    // Get the current stroke point
    var entry = strokeData[i];
    // Calculate the stroke point's offset by using the cross product of the
    // stroke point's normal and its velocity
    v.crossVectors(entry.normal, entry.velocity);
    // Normalize the vector and scale it by the precalculated stroke width
    v.normalize();
    // This width is based on how fast the user was moving the device when the
    // stroke was drawn
    v.multiplyScalar(entry.width);
    // If this isn't the first point check for a velocity flip, otherwise create
    // a new Vector3
    if( lastVelocity ) {
      // Use the dot product to check whether the current velocity is in the
      // direction as the previous stroke's velocity
      var directionChange = lastVelocity.dot( entry.velocity );
      if( directionChange < 0 ) {
        flip = !flip;
      }
    }
    else {
      lastVelocity = new THREE.Vector3();
    }
    lastVelocity.copy( entry.velocity );
    // this is used to avoid improper drawing of triangles when the user
    // changes direction of a stroke
    if( flip ) {
      p1.addVectors(entry.position, v);
      p2.subVectors(entry.position, v);
    }
    else {
      p1.subVectors(entry.position, v);
      p2.addVectors(entry.position, v);
    }
    // Calculate the offset for the current vertex (i * 2 * 3)
    // Set the positions for the ith and ith + 1 verticies
    var index = i * 2 * 3;
    positions[index] = p1.x;
    positions[index + 1] = p1.y;
    positions[index + 2] = p1.z;
    positions[index + 3] = p2.x;
    positions[index + 4] = p2.y;
    positions[index + 5] = p2.z;
    // Calculate the offset for the current vertex (i * 2 * 3)
    index = i * 2 * 3;
    // Set the normals for the ith and ith + 1 verticies
    normals[index] = entry.normal.x;
    normals[index + 1] = entry.normal.y;
    normals[index + 2] = entry.normal.z;
    normals[index + 3] = entry.normal.x;
    normals[index + 4] = entry.normal.y;
    normals[index + 5] = entry.normal.z;
    // Calculate the offset for the current vertex (i * 2 * 3)
    index = i * 2 * 3;
    // Set the velocities for the ith and ith + 1 verticies
    velocities[index] = entry.velocity.x;
    velocities[index + 1] = entry.velocity.y;
    velocities[index + 2] = entry.velocity.z;
    velocities[index + 3] = entry.velocity.x;
    velocities[index + 4] = entry.velocity.y;
    velocities[index + 5] = entry.velocity.z;
    // Calculate the offset for the current vertex (i * 2 * 3)
    index = i * 2 * 2;
    // Set the uvs for the ith and ith + 1 verticies
    // Each complete stroke has vertex coordinates from (0,0) to (1,1)
    uvs[index] = i / (strokeData.length - 1);
    uvs[index + 1] = 0;
    uvs[index + 2] = i / (strokeData.length - 1);
    uvs[index + 3] = 1;
  }
  // Create a Threejs BufferGeometry
  var geometry = new THREE.BufferGeometry();
  function disposeArray() { this.array = null; }
  // Add attributes to the buffer geometry using the Float32Arrays created
  // above. This will tell our shader pipeline information about each vertex
  // so we can create all types of dynamic strokes & paints
  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3).onUpload(disposeArray));
  geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3).onUpload(disposeArray));
  geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2).onUpload(disposeArray));
  geometry.addAttribute('velocity', new THREE.BufferAttribute(velocities, 3).onUpload(disposeArray));
  geometry.computeBoundingSphere();
  // Create a Threejs mesh and set its draw mode to triangle strips
  var mesh = new THREE.Mesh(geometry, drawMaterial);
  mesh.drawMode = THREE.TriangleStripDrawMode;
  return mesh;
}

/**
 * Small utility function to sum the last n frames of acceleration to see if
 * the device was shaken. If the device was shaken, then the last stroke is
 * erased.
 */
function checkForShake()
{
  //Calculate the current acceleration's magnitude and add it to the
  // acceleration array
  accelerationArray.push(acceleration.length());
  var len = accelerationArray.length;
  // if the accelerationArray has enough frames to calculate whether the user
  // has shaken the device, then check for a shake
  if(len > MINIMIM_ERASE_ENERGY_FRAMES) {
    // Sum the "energy" total by looping through the accelerationArray values
    var energy = 0;
    for(var i = 0; i < len; i++) {
      energy += accelerationArray[i];
    }
    // Check to see if the total energy is greate than a preset amount
    // this amount was calculated via user testing different shake thresholds
    if(energy > MINIMIM_ERASE_ENERGY * MINIMIM_ERASE_ENERGY_FRAMES) {
      // If a shake was detected, clear the accelerationArray so we don't get
      // multiple shakes in a small time frame
      accelerationArray.length = 0;
      // This is the action that happens when the user shakes the device, the
      // app clears or removes the last stroke
      clearLastStroke();
    }
    else {
      // If the energy wasn't high enough pop off the oldest acceleration value
      accelerationArray.shift();
    }
  }
}



/**
 * Clears all the strokes and essentially lets the user start over
 */
function clearStrokes()
{
  // If the user if currently drawing, stop
  drawing = false;
  // Clear the current stroke array
  stroke.length = 0;
  // Reset the current stroke index
  strokeIndex = 0;
  // Remove all the threejs mesh strokes from the scene
  var len = strokes.length;
  for( var i = 0; i < len; i++ ) {
    scene.remove(strokes[i]);
  }
}
/**
 * Clears the last stroke, acts essentially as an UNDO
 */
function clearLastStroke()
{
  // If the user if currently drawing, stop, and remove the stroke
  if( drawing ) {
    drawing = false;
    scene.remove(strokes[strokeIndex]);
    stroke.length = 0;
  }
  // Also remove the last drawn stroke
  strokeIndex -= 1;
  scene.remove(strokes[strokeIndex]);
}


function updatePhysics()
{
  // Cache previous positions & normals
  previousPosition.copy(position);
  previousNormal.copy(normal);
  previousNormalQuat.copy(normalQuat);
  previousVelocity.copy(velocity);
  // Update Drawing Stroke Position
  getDrawPoint(position);
  position.lerpVectors(previousPosition, position, STROKE_POSITION_EASING);
  normalQuat.slerp(camera.quaternion, STROKE_NORMAL_QUAT_EASING);
  // Update Drawing Stroke Normal
  normal.set(0, 0, 1);
  normal.applyQuaternion(normalQuat);
  normal.normalize();
  normal.lerpVectors(previousNormal, normal, STROKE_NORMAL_EASING);
  // Update velocity
  velocity.subVectors(position, previousPosition);
  velocity.lerpVectors(previousVelocity, velocity, STROKE_VELOCITY_EASING);
  // Update acceleration
  acceleration.subVectors(velocity, previousVelocity);
  // Update Drawing Stroke Width
  strokeWidth = THREE.Math.lerp(strokeWidth, velocity.length() * STROKE_WIDTH_MODIFIER, STROKE_WIDTH_EASING);
  strokeWidth = Math.min( Math.max( strokeWidth, STROKE_WIDTH_MINIMUM ), STROKE_WIDTH_MAXIMUM );
}



//TODO: put this stuff in the update loop: 
function update_draw_utils() {
	updatePhysics(); 
 	checkForShake();
	if ( drawing ) { processDraw(); }
 	processDrawBrush();
}
