

vec4 permute( vec4 x ) {

    return mod( ( ( x * 34.0 ) + 1.0 ) * x, 289.0 );
}

vec4 taylorInvSqrt( vec4 r ) {

    return 1.79284291400159 - 0.85373472095314 * r;

}

uniform vec3 ambientLightColor;

#define MAX_DIR_LIGHTS 2

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

uniform sampler2D tex;

const float PI = 3.14159265358979323846264338;
const float PI_2 = 1.57079632679489661923;
const float E = 2.71828;

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


#define noiseWidth 128

#define noiseHeight 128

float rand(vec2 co){
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

/*
void generateNoise()
{
  for (int y = 0; y < noiseHeight; y++)
  for (int x = 0; x < noiseWidth; x++)
  {
    noise[y][x] = rand(vec2(y,x));
  }
}
*/

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}

float smoothNoise(float z, float y, float x, float s)
{  
   //get fractional part of x and y
  // x = float(int(x)); //line 302
  // y = float(int(y));
  // z = float(int(z));

   //float size = 1.0;
  float value = 0.0;
  
  if (y < 0.0) {
    return 0.0;
  }
  
  x = abs(x);
  y = abs(y);
  z = abs(z);
    
  float x_0 = float(int(x));
  float y_0 = float(int(y));
  float z_0 = float(int(z));

  float x_1 = float(int(x)) + 1.0;
  float y_1 = float(int(y)) + 1.0;
  float z_1 = float(int(z)) + 1.0;

  float x_d = (x - x_0)/(x_1 - x_0);
  float y_d = (y - y_0)/(y_1 - y_0);
  float z_d = (z - z_0)/(z_1 - z_0);
  
  float c_000 = noise(vec3(x_0, y_0, z_0));
  float c_001 = noise(vec3(x_0, y_0, z_1));
  float c_010 = noise(vec3(x_0, y_1, z_0));
  float c_011 = noise(vec3(x_0, y_1, z_1));
  float c_100 = noise(vec3(x_1, y_0, z_0));
  float c_101 = noise(vec3(x_1, y_0, z_1));
  float c_110 = noise(vec3(x_1, y_1, z_0));
  float c_111 = noise(vec3(x_1, y_1, z_1));
                      
  float c_00 = c_000*(1.0 - x_d) + c_100*x_d;
  float c_01 = c_001*(1.0 - x_d) + c_101*x_d;
  float c_10 = c_010*(1.0 - x_d) + c_110*x_d;
  float c_11 = c_011*(1.0 - x_d) + c_111*x_d;
  
  float c_0 = c_00*(1.0 - y_d) + c_10*y_d;
  float c_1 = c_01*(1.0 - y_d) + c_11*y_d;
  
  float c = c_0*(1.0 - z_d) + c_1*z_d;

    /*
    for (int j = -2; j <=2; j++) {
      for (int k = -2; k <=2; k++) {
        for (int l = -2; l <=2; l++) {
          float w = 0.0; //weight for gaussian smoothing
          if (abs(float(j)) + abs(float(k)) + abs(float(l)) == 4.0) { w = 1.0; }
          else if (abs(float(j)) + abs(float(k)) + abs(float(l)) == 3.0) { w = 4.0; }
          else if (abs(float(j)) + abs(float(k)) + abs(float(l)) == 2.0) { w = 7.0; }
          else if (abs(float(j)) + abs(float(k)) + abs(float(l))  == 1.0) { w = 26.0; }
          else if (abs(float(j)) + abs(float(k)) + abs(float(l)) == 0.0) { w = 41.0; }
          //463 = 2 * 48 + 2 * 65 + 237
          //value += rand(vec2(x+float(j) + z+float(l), y+float(k))) * w / 463.0;
          value += noise(vec3(x + float(j),y + float(k),z+float(l))) * w / 463.0;
          //value += 0.33 * rand(vec2(y+float(k),z+float(l))) * w / 463.0;
          //value += 0.33 * rand(vec2(x+float(k),y+float(l))) * w / 463.0;
        }
      }
    }
    */
  
  //value += 0.66 * rand(vec2(x, y));
  //value += 0.34 * rand(vec2(z,0.0));

   //value += rand(vec2(x-size,y));
   // value += rand(vec2(x,y-size));
   // value += rand(vec2(x+size,y));
   // value += rand(vec2(x,y+size));
  
   
   return c;// / 5.0; //2j + 1
}


void main()
{
    vec3 directionalLightDirection[3];
    vec3 directionalLightColor[3];  
  
    //directionalLightDirection[0] = vec3(-0.3,0.0,0.0);  
    directionalLightDirection[0] = vec3(0.25,-0.1,0);
    directionalLightDirection[1] = vec3(0,1, 0);
    directionalLightDirection[2] = vec3(0, 0, 1);
  
    directionalLightColor[0] = vec3(0, 0, 0);
    directionalLightColor[1] = vec3(1, 1, 1);
    directionalLightColor[2] = vec3(0, 0, 0);
  
    vec3 normal = normalize( vNormal );
    vec3 viewPosition = normalize( vViewPosition );
  
    vec3 perpThickness;
    vec3 parallelThickness;
  
    float thicknessPerp = 0.0;
    float thicknessParallel = 0.0;
    float correctSide = 0.0;
  
    float radius;
  
    float latheRadius = 0.1;
    float latheLength = 0.5;
  
    vec3 mPositionCentered = mPosition - vec3(0,0,latheLength / 2.0);
  
    //MARBLE TESTS
  
    float x = mPositionCentered.x;
    float y = mPositionCentered.y;
    float z = mPositionCentered.z;
  
    //color.r = color.g = color.b = sineValue;
  
    vec3 dirDiffuse  = vec3( 0.0 );
    vec3 dirSpecular = vec3( 0.0 );
    float dirDiffuseWeight;
    float gaussian;

    for ( int i = 0; i < MAX_DIR_LIGHTS; i++) {
      //decompose light direction into components perpendicular and parallel to cylinder
      //for testing:
      
      vec3 lightToPoint = directionalLightDirection[i] - mPositionCentered;
      vec3 lightToPointUnit = normalize(lightToPoint);
      vec2 lightToPointPerp = lightToPoint.xy;
      vec2 lightToPointPerpUnit = normalize(lightToPointPerp);
      
      vec2 mNormalPerp = mNormal.xy;
      vec2 mNormalPerpUnit = normalize(mNormalPerp);
      
      vec3 lightToCenter = directionalLightDirection[i] - vec3(0.0,0.0,mPositionCentered.z);
      vec2 lightToCenterPerp = lightToCenter.xy;
      vec2 lightToCenterPerpUnit = normalize(lightToCenterPerp);
      
      vec3 perp = vec3(lightToPoint.xy, 0.0);
      vec3 parallel = vec3(0.0, 0.0, lightToPoint.z);
      
      float x = lightToPoint.x;
      float y = lightToPoint.y;
      float z = lightToPoint.z;
  
      //current radius (latheRadius is original radius before cutting)
      radius = distance( mPosition, vec3(0.0,0.0,mPosition.z) );
      
      correctSide = dot(lightToPointPerp, mNormalPerp);
      
      vec3 dir = directionalLightDirection[i];
      
      vec3 closestPt;
      
      if (-latheLength/2.0 <= dir.x && dir.x <= latheLength/2.0) 
      {
        closestPt = vec3(latheRadius * normalize(dir.xy), 0) + vec3(0,0,dir.z);
      }
      else if (-latheRadius <= dir.y && dir.y <= latheRadius) 
      {
        if (dir.x <= -latheLength/2.0) 
        {
          closestPt = vec3(0, 0, -latheLength/2.0) + vec3(dir.xy,0);
        }
        else if (dir.x >= latheLength/2.0) 
        {
          closestPt = vec3(0, 0, latheLength/2.0) + vec3(dir.xy,0);
        }
        else 
        {
          closestPt = vec3(0,0,0);
          //error - turn magenta
        }
      }
      else 
      {
        closestPt = vec3(0, 0, -latheLength/2.0) + vec3(latheRadius*normalize(dir.xy),0);
      }
      
      vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );

      vec3 dirVector = normalize( lDirection.xyz );
      //is light coming from correct side
      dirDiffuseWeight = max( dot( normal, dirVector ), 0.0 ); //0.5

      dirDiffuse += diffuse * directionalLightColor[ i ] * dirDiffuseWeight;

      vec3 dirHalfVector = normalize( dirVector + viewPosition );
      float dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );
      float dirSpecularWeight = max( pow( dirDotNormalHalf, shininess ), 0.0 );

      dirSpecular += specular * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight;
      
      vec3 mu = closestPt;
      
      vec3 pos = mPositionCentered;
    
      float sigma = length(mu - dir);
   
      float pwr = -1.0 * dot((pos - mu), (pos - mu)) / (2.0*pow(sigma,2.0));
       
      //gaussian distribution
      gaussian += (1.0/sqrt(2.0*PI*sigma)) * pow(E,pwr);

      }
  
      vec3 totalDiffuse = vec3( 0.0 );
      vec3 totalSpecular = vec3( 0.0 );

      #if MAX_DIR_LIGHTS > 0
          totalDiffuse += dirDiffuse;
          totalSpecular += dirSpecular;
      #endif
      
      int ringNum = 0;
      //int numSegments = 100;
      float latheStart = 0.0;
      float segmentLength = 0.005;

      for (int i = 0; i < 100; i++) {
        float lower = latheStart + float(i)*segmentLength;
        float upper = latheStart + float(i + 1)*segmentLength;
        if (lower <= mPosition.z && mPosition.z < upper) {
          ringNum = i;
        }
      }

      vec2 scaledUV = vec2(vUv.x, vUv.y * 0.01 + float(ringNum)*0.01);

      vec3 spec = texture2D(tex, scaledUV * 1.01).xyz;
  
      vec3 matColor = vec3(1.0,1.0,1.0);
      vec3 scatterColor = vec3(0.9,0.9,0.7);
  
      vec3 scratchHighlights = mix(vec3(0.0,0.0,0.0), totalSpecular * (1.0 - spec), smoothstep(.91,1.0,distance( mPosition, vec3(0.0,0.0,mPosition.z))*10.2));
      
      vec3 scaledPos2 = vec3( 0.0,0.0,mPosition.z*300.0) + surface(vec3(0.0,mPosition.z*100.0,0.0)*10.0);
  
      // float d3 = length( vec3(mPosition.x*0.3,mPosition.y*0.3,0.0) + newSurface);
      // float g3 = clamp(cos(d3*GrainMult),0.0,1.0);

      //vec3 DiffuseColour3 = mix(DiffuseColour1,DiffuseColour2,g3);

      vec3 innerColor = mix(vec3(1.0,1.0,1.0), totalDiffuse*matColor,surface(scaledPos2));
  
      matColor = mix(innerColor, matColor, smoothstep(.91,1.0,distance( mPosition, vec3(0.0,0.0,mPosition.z))*10.2));
  //
  
      gl_FragColor = vec4(matColor * ( totalDiffuse * 0.6 * matColor) + totalSpecular + gaussian * scatterColor * 0.5 + scratchHighlights * 4.0,1.0);      
      //gl_FragColor = vec4(vec3(gaussian,0.0,0.0) + vec3(0.6,0.6,0.6),1.0);
  /*
//       float latheDiam = latheRadius * 2.0;
      
//       float lightToPointDist = length(lightToPoint);
      
//       float lightMult = 3.0 * length(directionalLightDirection[i]);
      
      //gl_FragColor += vec4(lightMult + latheDiam * lightMult - lightToPointDist * lightMult,0,0,1.0);
            
      //for perp component, use formula for length of chord
      
      //thicknessPerp = abs(2.0 * radius * cos( atan(y / x) - acos(x / radius) ));
      thicknessPerp = 2.0 * radius * cos (180.0 - acos(dot(mNormalPerpUnit, lightToPointPerpUnit)));
      
      
      //for parallel component, look at angle between component and point
      //arctan(z / x)
      thicknessParallel = atan(x / z);
      
    }
    */

    //gl_FragColor = vec4( abs(latheRadius / (thicknessPerp * 5.0)), 0.0,0.0,1.0);
  
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
