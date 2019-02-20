/**
 * @author inear
 * 
 */

var PI2 = Math.PI * 2
var TO_RADIANS = Math.PI / 180;
var _branchSegments = 12; //number of sides on perimeter of each "ring" (approximation factor)

Lathe = function ( materials, radius ) {
	
	THREE.Mesh.call( this, new THREE.Geometry(), materials );

	var numCurrentPos = 0;
	this.doubleSided = true;
	
	var basePoint = new THREE.Vector3(0,0,0);
	var branchPoint = new THREE.Object3D();
	branchPoint.position = new THREE.Vector3(0,0,0);
	this.radius = 0.1; // ~= 4inches  
  this.minRadius = 0.001; //never let the lathe get thinner than this.

	var R;
	var S;
	var branchPoint;
	
	var vertices = this.geometry.vertices;
	var faces = this.geometry.faces;
  
	//Array of face UV layers, used for mapping textures onto the geometry. 
	//Each UV layer is an array of UVs matching the order and number of vertices in faces 
	var faceVertexUvs = this.geometry.faceVertexUvs
	
  //total length = totalLinks * linkDist = 300 * 0.002 = 0.6m ~= 2ft long
	this.totalLinks = 100; //number of ring segments along the length of the cylinder
	this.linkDist = 0.005; //width of each ring segment
  this.depth = this.totalLinks * this.linkDist;
	this.segmentAngle = Math.PI * 2 / _branchSegments; //angle between lines on the perimeter of each ring.
	this.ring = new Array(this.totalLinks);
	this.ringOrigin = new Array(this.totalLinks);
	this.offsetPoints = new Array(this.totalLinks);
	
	this.build = function() {
		//reset
		var segmentsEachTime = 0;
		//for each step
		while (segmentsEachTime < this.totalLinks)
		{
			segmentsEachTime++;
			
      //last point
			basePoint.x = branchPoint.position.x;
			basePoint.y = branchPoint.position.y;
			basePoint.z = branchPoint.position.z;
			
			//move forward
			branchPoint.translateZ(this.linkDist);
			
			//difference from last segment
			var diffVector = new THREE.Vector3();
			diffVector.subVectors( branchPoint.position, basePoint);

			var transformPoint = new THREE.Vector3();
			transformPoint.addVectors(diffVector, new THREE.Vector3(10, 0, 0));

			//height from transformPoint
			R = new THREE.Vector3();
			R.crossVectors(transformPoint, diffVector);

			S = new THREE.Vector3();
			S.crossVectors(R, diffVector);

			R.normalize();
			S.normalize();
		
			//build branch
			this.buildNode();

			branchPoint.updateMatrix();

			numCurrentPos++;
			
		}
		
		//computerCentroids was deprecated in the newer version of THREE.js 
		//I believe the centroids aren't used for much beyond lighting?
		
		//this.geometry.computeCentroids()
		this.geometry.computeFaceNormals();
		this.geometry.computeVertexNormals(); 
		this.geometry.computeBoundingSphere();
		this.geometry.computeBoundingBox();
	}
	
	this.buildNode = function() {
		
		var intSegmentStep;
		var pX;
		var pY;
		var pZ;
		var newVertex3D;
		var p1,p2,p3,p4;
		
		var bFirstNode = numCurrentPos == 0
		
		var transformedRadius = this.radius;
		
		intSegmentStep = 0;

		this.offsetPoints[numCurrentPos] =  new THREE.Vector3(0,0,0);
		this.ring[numCurrentPos] = new Array();
		this.ringOrigin[numCurrentPos] = new Array();
		
		while (intSegmentStep < _branchSegments)
		{
			transformedRadius = this.radius;
						
			if( transformedRadius < this.minRadius) transformedRadius = this.minRadius; //never allow radius to be less than 0.03937 inches
			
			pX = basePoint.x + transformedRadius * Math.cos(intSegmentStep * this.segmentAngle) * R.x + transformedRadius * Math.sin(intSegmentStep * this.segmentAngle) * S.x;
			pY = basePoint.y + transformedRadius * Math.cos(intSegmentStep * this.segmentAngle) * R.y + transformedRadius * Math.sin(intSegmentStep * this.segmentAngle) * S.y;
			pZ = basePoint.z + transformedRadius * Math.cos(intSegmentStep * this.segmentAngle) * R.z + transformedRadius * Math.sin(intSegmentStep * this.segmentAngle) * S.z;

      newVertex3D = new THREE.Vector3(pX, pY, pZ);

			vertices.push(newVertex3D);

			this.ring[numCurrentPos].push( newVertex3D );
			this.ringOrigin[numCurrentPos].push( new THREE.Vector3(pX, pY, pZ));

			intSegmentStep++;
		}

		if ( bFirstNode ) return;

		intSegmentStep = 0;
		while (intSegmentStep < _branchSegments)
		{
			if ( intSegmentStep < (_branchSegments - 1)) {
				//second ring
				p1 = vertices.length - _branchSegments + intSegmentStep + 1;
				p4 = vertices.length - _branchSegments + intSegmentStep ;
				
				//first ring
				p2 = vertices.length - _branchSegments * 2 + intSegmentStep + 1;
				p3 = vertices.length - _branchSegments * 2 + intSegmentStep;
			}
			else {
				//last side - connected to first point in ring
				p1 = vertices.length - _branchSegments;
				p4 = vertices.length - _branchSegments + intSegmentStep;
				
				p2 = vertices.length - _branchSegments * 2;
				p3 = vertices.length - _branchSegments * 2 + intSegmentStep;
			}	

			//THREE.FACE4 is depracated! 
			//faces.push( new THREE.Face4( p1, p2, p3, p4  ) );

			//replace with two THREE.FACE3s
			faces.push( new THREE.Face3( p1, p2, p4 ) );
			faces.push( new THREE.Face3( p4, p2, p3 ) );

			var startX = 1/_branchSegments*(intSegmentStep+1);
			var endX = startX - 1/_branchSegments;
			
			var startY = numCurrentPos/this.totalLinks//*3;
			var endY = startY + 1/this.totalLinks//*3
			
			var startY = 0
			var endY = 1
			
			faceVertexUvs[ 0 ].push([
				new THREE.Vector2( startX, endY),
				new THREE.Vector2( startX,startY ),
				new THREE.Vector2( endX, endY )
			])

			faceVertexUvs[ 0 ].push([
				new THREE.Vector2( endX, endY ),
				new THREE.Vector2( startX,startY ),
				new THREE.Vector2( endX ,startY )
			])
      
			intSegmentStep++;
		}
	}
};


Lathe.prototype = new THREE.Mesh();
Lathe.prototype.constructor = Lathe;
Lathe.prototype.supr = THREE.Mesh.prototype;
