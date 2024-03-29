

vec4 permute( vec4 x ) {

    return mod( ( ( x * 34.0 ) + 1.0 ) * x, 289.0 );
}

vec4 taylorInvSqrt( vec4 r ) {

    return 1.79284291400159 - 0.85373472095314 * r;

}

uniform vec3 ambientLightColor;

#define MAX_DIR_LIGHTS 3

#if MAX_DIR_LIGHTS > 0

    uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];
    uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];    

#endif

//#define USE_SHADOWMAP 1
#define MAX_SHADOWS 1

#ifdef USE_SHADOWMAP

    uniform sampler2D shadowMap[ MAX_SHADOWS ];
    uniform vec2 shadowMapSize[ MAX_SHADOWS ];

    uniform float shadowDarkness[ MAX_SHADOWS ];
    uniform float shadowBias[ MAX_SHADOWS ];

    varying vec4 vShadowCoord[ MAX_SHADOWS ];

    float unpackDepth( const in vec4 rgba_depth ) {

        const vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );
        float depth = dot( rgba_depth, bit_shift );
        return depth;

    }

#endif

varying vec3 mPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 mNormal;
varying vec2 vUv;

uniform float shininess;
uniform vec3 specular;
uniform vec3 diffuse;
uniform vec3 ambient;

uniform vec3 DiffuseColour1;
uniform vec3 DiffuseColour2;
uniform vec3 GrainCentre;
uniform float GrainMult;

uniform sampler2D map;


float snoise( vec3 v ) {

    const vec2 C = vec2( 1.0 / 6.0, 1.0 / 3.0 );
    const vec4 D = vec4( 0.0, 0.5, 1.0, 2.0 );

    // First corner

    vec3 i  = floor( v + dot( v, C.yyy ) );
    vec3 x0 = v - i + dot( i, C.xxx );

    // Other corners

    vec3 g = step( x0.yzx, x0.xyz );
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

    // Permutations

    i = mod( i, 289.0 );
    vec4 p = permute( permute( permute(
        i.z + vec4( 0.0, i1.z, i2.z, 1.0 ) )
        + i.y + vec4( 0.0, i1.y, i2.y, 1.0 ) )
        + i.x + vec4( 0.0, i1.x, i2.x, 1.0 ) );

    // Gradients
    // ( N*N points uniformly over a square, mapped onto an octahedron.)

    float n_ = 1.0 / 7.0; // N=7

    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor( p * ns.z *ns.z );  //  mod(p,N*N)

    vec4 x_ = floor( j * ns.z );
    vec4 y_ = floor( j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs( x ) - abs( y );

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );


    vec4 s0 = floor( b0 ) * 2.0 + 1.0;
    vec4 s1 = floor( b1 ) * 2.0 + 1.0;
    vec4 sh = -step( h, vec4( 0.0 ) );

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3( a0.xy, h.x );
    vec3 p1 = vec3( a0.zw, h.y );
    vec3 p2 = vec3( a1.xy, h.z );
    vec3 p3 = vec3( a1.zw, h.w );

    // Normalise gradients

    vec4 norm = taylorInvSqrt( vec4( dot( p0, p0 ), dot( p1, p1 ), dot( p2, p2 ), dot( p3, p3 ) ) );
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value

    vec4 m = max( 0.6 - vec4( dot( x0, x0 ), dot( x1, x1 ), dot( x2, x2 ), dot( x3, x3 ) ), 0.0 );
    m = m * m;
    return 22.0 * dot( m*m, vec4( dot( p0, x0 ), dot( p1, x1 ),  dot( p2, x2 ), dot( p3, x3 ) ) );

}

float surface( vec3 coord ) {

    float n = 0.0;

    n += 0.7    * abs( snoise( coord ) );
    n += 0.25   * abs( snoise( coord * 2.0 ) );
    n += 0.125  * abs( snoise( coord * 4.0 ) );
    n += 0.0625 * abs( snoise( coord * 8.0 ) );
    return n;

}

float surface2( vec3 coord ) {

	float n = 0.0;

	n += 0.7    * abs( snoise( coord ) );
	n += 0.25   * abs( snoise( coord * 2.0 ) );
	//n += 0.125  * abs( snoise( coord * 4.0 ) );
	//n += 0.0625 * abs( snoise( coord * 8.0 ) );
	return n;

}

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main()
{
    //TEST
  
    
    vec3 directionalLightDirection[3];
    vec3 directionalLightColor[3];  
  
    directionalLightDirection[0] = vec3(-1, 1, 1);
    directionalLightDirection[1] = vec3(-1, 1, -1);
    directionalLightDirection[2] = vec3(0.5, 0.1, 0.25);
  
    directionalLightColor[0] = vec3(1, 1, 1);
    directionalLightColor[1] = vec3(1, 1, 1);
    directionalLightColor[2] = vec3(1, 1, 1);
  
    vec3 normal = normalize( vNormal );
    vec3 viewPosition = normalize( vViewPosition );
  
    float specular = 0.3;
    float diffuse = 1.0;

    #if MAX_DIR_LIGHTS > 0

        vec3 dirDiffuse  = vec3( 0.0 );
        vec3 dirSpecular = vec3( 0.0 );
        float dirDiffuseWeight;

        for( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {

            vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );

            vec3 dirVector = normalize( lDirection.xyz );
            //is light coming from correct side
            dirDiffuseWeight = max( dot( normal, dirVector ), 0.0 ); //0.5

            dirDiffuse += diffuse * directionalLightColor[ i ] * dirDiffuseWeight;

            vec3 dirHalfVector = normalize( dirVector + viewPosition );
            float dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );
            float dirSpecularWeight = max( pow( dirDotNormalHalf, shininess ), 0.0 );

            dirSpecular += specular * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight;

        }

    #endif
    
    vec3 totalDiffuse = vec3( 0.0 );
    vec3 totalSpecular = vec3( 0.0 );

    #if MAX_DIR_LIGHTS > 0
        totalDiffuse += dirDiffuse;
        totalSpecular += dirSpecular;
    #endif
    
    //OLD STUFF
    /*
    //doesnt seem to have much of an effect
    vec3 GrainCentre = vec3(10,5,100);

    float d = length( vec3(mPosition.x*.3,mPosition.y*.3,0.0) - GrainCentre + surface(mPosition*.01));
    float g = clamp(cos(d*GrainMult),0.0,1.0);
    
    vec3 DiffuseColour = mix(totalDiffuse*DiffuseColour1,totalDiffuse*DiffuseColour2,g);
    DiffuseColour = mix(DiffuseColour, totalDiffuse*texture2D( map, vUv*2.0 ).xyz , smoothstep(.91,0.98,distance( mPosition, vec3(0.0,0.0,mPosition.z))*10.0));
    
    // d and d_bigger are around 100
    vec3 d2 = vec3(d - 100.0, 0, 0);
    //actually does something cool!!! - position multiplier was too small
    vec3 snoise = vec3(abs(snoise(mPosition * 100.0)), 0, 0);
    */
  
    //gs 5 gm 50 // more marbled
    //gs 1 gm 1000 // more wood-like
  
    //lower gs/gm ratio = more wood-like
    //gs = inverse pattern size (bigger = smaller pattern)
  
    //increase GS keeping GM const: same pattern but smaller
    //increase GM keeping CS const: smaller and more wood-like
    //increase both keeping ratio constant: more wood-like
    
    //just x: vertical stripes
    //just y: horizontal stripes
    //just z: rings
    //x & y: no loops
    //x & z: kind of a vertical loopy pattern, closer to website
    //y & z: pretty close to original
  
    float GrainSize = 10.0;
  
    float GrainMult = 100.0;
  
    vec3 scaledPos = vec3( 0.0,mPosition.y*170.0,0.0) + surface(mPosition*10.0);
    vec3 scratches = mix(vec3(0,0,0),vec3(0.2,0.2,0.3),surface2(scaledPos));
  
    float newSurface = surface(vec3(mPosition.x*0.1, mPosition.y, mPosition.z*0.1) * GrainSize);
  
    float d3 = length( vec3(mPosition.x*0.3,mPosition.y*0.3,0.0) - GrainCentre + newSurface);
    float g3 = clamp(cos(d3*GrainMult),0.0,1.0);
  
    vec3 DiffuseColour3 = mix(DiffuseColour1,DiffuseColour2,g3);
    DiffuseColour3 -= 0.5 * scratches;
    //DiffuseColour3 = mix(DiffuseColour3, totalDiffuse*texture2D( map, vUv).xyz , smoothstep(.91,0.98,distance( mPosition, vec3(0.0,0.0,mPosition.z))*10.2));
  
    directionalLightDirection[0] = vec3(0,0.2,0);
  
    vec3 mPositionCentered = mPosition - vec3(0,0,0.25);
  
    // testing for subsurface calculation
    //vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ 0 ] - mPositionCentered, 0.0 );
    //vec3 dirVector = normalize( lDirection.xyz );
    vec3 dirVector2 = normalize(directionalLightDirection[ 0 ] - mPositionCentered);
    vec3 normal2 = normalize(mNormal);
    //gl_FragColor = vec4(dot(normal2, dirVector2),0.0,0.0,1.0);
  
    gl_FragColor = vec4(DiffuseColour3 * ( totalDiffuse * DiffuseColour3) + totalSpecular + vec3(0.16,0.13,0.11),1.0);//DiffuseColour * ( totalDiffuse * DiffuseColour) + totalSpecular + ambientLightColor * ambient,1.0);

    vec3 shadowColor = vec3( 1.0 );

    #ifdef USE_SHADOWMAP


        float fDepth;

        for( int i = 0; i < MAX_SHADOWS; i ++ ) {

            vec3 shadowCoord = vShadowCoord[ i ].xyz / vShadowCoord[ i ].w;

            // don't shadow pixels behind far plane of light frustum

            if ( shadowCoord.z <= 1.0 ) {

                shadowCoord.z += shadowBias[ i ];

                // using "if ( all )" for ATI OpenGL shader compiler
                // "if ( something && something )" breaks it

                // don't shadow pixels outside of light frustum

                bvec4 shadowTest = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );

                if ( all( shadowTest ) ) {

                    #ifdef SHADOWMAP_SOFT

                        float shadow = 0.0;

                        const float shadowDelta = 1.0 / 9.0;

                        float xPixelOffset = 1.0 / shadowMapSize[ i ].x;
                        float yPixelOffset = 1.0 / shadowMapSize[ i ].y;

                        float dx0 = -1.25 * xPixelOffset;
                        float dy0 = -1.25 * yPixelOffset;
                        float dx1 = 1.25 * xPixelOffset;
                        float dy1 = 1.25 * yPixelOffset;

                        fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );
                        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                        fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );
                        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                        fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );
                        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                        fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );
                        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                        fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy ) );

                        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                        fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, 0.0 ) ) );
                        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                        fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );
                        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                        fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );
                        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                        fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );
                        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;

                        shadowColor = shadowColor * vec3( ( 1.0 - shadowDarkness[ i ] * shadow ) );

                    #else

                        vec4 rgbaDepth = texture2D( shadowMap[ i ], shadowCoord.xy );
                        float fDepth = unpackDepth( rgbaDepth );

                        if ( fDepth < shadowCoord.z )
                            shadowColor = shadowColor * vec3( 1.0 - shadowDarkness[ i ] );


                    #endif

            }

            }
        }

        #endif

    #ifdef GAMMA_OUTPUT

                shadowColor *= shadowColor;

    #endif

    //gl_FragColor.xyz = gl_FragColor.xyz * shadowColor;

}
