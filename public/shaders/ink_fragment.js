precision mediump float;
precision mediump int;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vVelocity;
void main()	{
  vec2 uv = vUv;
  uv *= 2.0;
  uv -= 1.0;
  float aa = 1.0 - abs( uv.y );
  aa = smoothstep( 0.0, 0.05, aa );
  gl_FragColor = vec4( vNormal, aa );
}