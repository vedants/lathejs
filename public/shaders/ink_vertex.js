  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec2 uv;
  attribute vec3 velocity;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vVelocity;
  void main()
  {
      vPosition = position;
      vNormal = normal;
      vUv = uv;
      vVelocity = velocity;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }