#define MAX_DIR_LIGHTS 0

vec4 permute( vec4 x ) {

	return mod( ( ( x * 34.0 ) + 1.0 ) * x, 289.0 );
}

vec4 taylorInvSqrt( vec4 r ) {

	return 1.79284291400159 - 0.85373472095314 * r;

}

uniform vec3 ambientLightColor;

#if MAX_DIR_LIGHTS > 0

    uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];
    uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];

#endif

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

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 mNormal;

uniform float shininess;
uniform vec3 specular;
uniform vec3 diffuse;
uniform vec3 ambient;

uniform vec3 DiffuseColour1;
uniform vec3 DiffuseColour2;
uniform vec3 GrainCentre;
uniform float GrainMult;

varying vec3 mPosition;


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
	//n += 0.125  * abs( snoise( coord * 4.0 ) );
	//n += 0.0625 * abs( snoise( coord * 8.0 ) );
	return n;

}

void main()
{

    vec3 normal = normalize( vNormal );
    vec3 viewPosition = normalize( vViewPosition );

    #if MAX_DIR_LIGHTS > 0

        vec3 dirDiffuse  = vec3( 0.0 );
        vec3 dirSpecular = vec3( 0.0 );

        for( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {

            vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );

            vec3 dirVector = normalize( lDirection.xyz );
            float dirDiffuseWeight = max( dot( normal, dirVector ), 0.0 );

            dirDiffuse  += diffuse * directionalLightColor[ i ] * dirDiffuseWeight;

            // specular

            vec3 dirHalfVector = normalize( dirVector + viewPosition );
            float dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );
            float dirSpecularWeight = max( pow( dirDotNormalHalf, 80.0 ), 0.0 );

            vec3 schlick = specular + vec3( 1.0 - specular ) * pow( dot( dirVector, dirHalfVector ), 4.0 );
            dirSpecular += schlick * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight;

        }

    #endif

    float scaledT	= fract(mPosition.z * 0.1);
    float	frac1	= clamp(scaledT / 2.0, 0.0, 1.0);
    float	frac2	= clamp((scaledT - 0.2) / 2.0, 0.0, 1.0);

    frac1	=	frac1 * (1.0 - frac2);
    frac1	=	frac1 * frac1 * (3.0 - (2.0 * frac1));

    vec3 totalDiffuse = vec3( 0.0 );
    vec3 totalSpecular = vec3( 0.0 );

    #if MAX_DIR_LIGHTS > 0
        totalDiffuse += dirDiffuse;
        totalSpecular += dirSpecular;
    #endif

    vec3 scaledPos = vec3( 0.0,0.0,mPosition.z*.17) + surface(mPosition*0.01);

    vec3 DiffuseColour = mix(totalDiffuse*DiffuseColour1,totalDiffuse*DiffuseColour2,surface(scaledPos));

    DiffuseColour = mix(DiffuseColour, totalDiffuse*DiffuseColour2 , smoothstep(.91,0.98,distance( mPosition, vec3(0.0,0.0,mPosition.z))/200.0));

    gl_FragColor = vec4( DiffuseColour * ( totalDiffuse + ambientLightColor * ambient ) + totalSpecular*0.8,1.0);

    vec3 shadowColor = vec3( 1.0 );

    #ifdef USE_SHADOWMAP


        float fDepth;

        for( int i = 0; i < MAX_SHADOWS; i ++ ) {

        vec3 shadowCoord = vShadowCoord[ i ].xyz / vShadowCoord[ i ].w;

        // don't shadow pixels behind far plane of light frustum

        if ( shadowCoord.z <= 1.0 ) {

            shadowCoord.z += shadowBias[ i ];

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

        gl_FragColor.xyz = gl_FragColor.xyz * shadowColor;

}
