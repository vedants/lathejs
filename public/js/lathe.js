function make_lathe () {
  
  var PI2 = Math.PI * 2
  var TO_RADIANS = Math.PI / 180;
  var _branchSegments = 24; //number of sides on perimeter of each "ring" (approximation factor)
  
  
  var geometry = new THREE.BoxGeometry( 0.25, 0.05, 0.05 );
  var faceIndices = ['a', 'b', 'c'];
  for (var i = 0; i < geometry.faces.length; i++) {
    var f  = geometry.faces[i];
    for (var j = 0; j < 3; j++) {
      var vertexIndex = f[faceIndices[ j ]];
      f.vertexColors[j] = colors[vertexIndex];
    }
  }
  var material = new THREE.MeshBasicMaterial({ vertexColors: THREE.VertexColors });
  cube = new THREE.Mesh(geometry, material);
  
  return cube;
  
}