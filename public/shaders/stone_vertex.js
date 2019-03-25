varying vec3 mPosition;
varying vec3 mNormal;
varying vec3 vViewPosition;
varying vec3 vNormal;

uniform float time;


#ifdef USE_SHADOWMAP

    varying vec4 vShadowCoord[ MAX_SHADOWS ];
    uniform mat4 shadowMatrix[ MAX_SHADOWS ];

#endif

void main() {


    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

    vViewPosition = -mvPosition.xyz;

    vec3 transformedNormal = normalMatrix * normal;
    vNormal = transformedNormal;
    mNormal = normal;

    #ifdef USE_SHADOWMAP

        for( int i = 0; i < MAX_SHADOWS; i ++ ) {

            #ifdef USE_MORPHTARGETS

                vShadowCoord[ i ] = shadowMatrix[ i ] * objectMatrix * vec4( morphed, 1.0 );

            #else

                vShadowCoord[ i ] = shadowMatrix[ i ] * objectMatrix * vec4( position, 1.0 );

            #endif

        }

    #endif
    
    mPosition = position.xyz;

    gl_Position = projectionMatrix * mvPosition;

}