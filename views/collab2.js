<!DOCTYPE html>
<html lang="en">
<head>
  <title>three.ar.js - LatheJS</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, user-scalable=no,
  minimum-scale=1.0, maximum-scale=1.0">
  <style>
    body {
      font-family: monospace;
      margin: 0;
      overflow: hidden;
      position: fixed;
      width: 100%;
      height: 100vh;
      -webkit-user-select: none;
      user-select: none;
    }
    #info {
      position: absolute;
      left: 50%;
      bottom: 0;
      transform: translate(-50%, 0);
      margin: 1em;
      z-index: 10;
      display: block;
      line-height: 2em;
      text-align: center;
    }
    #info * {
      color: #fff;
    }
    .title {
      background-color: rgba(40, 40, 40, 0.4);
      padding: 0.4em 0.6em;
      border-radius: 0.1em;
    }
    .links {
      background-color: rgba(40, 40, 40, 0.6);
      padding: 0.4em 0.6em;
      border-radius: 0.2em;
    }
    canvas {
      position: absolute;
      top: 0;
      left: 0;
    }
  </style>
  
</head>
<body>
<div id="info">
  <span class="links">
    <a href="#" id="zoomin">+</a> 
    <a href="#" id="zoomout">-</a> |
    <a href="#" id="wood" >wood</a>  
    <a href="#" id="metal">steel</a>   
    <a href="#" id="plastic">plastic</a> | 
    <a href="#" id="undo">undo</a>  
    <a href="#" id="redo">redo</a> |
    <a href="#" id="draw">draw</a>
    <a href="#" id="move">move</a> |
    <a href="/" id="reset">reset  </a>
  </span>
  <span class="title">ar_lathe[collab]</span><br/>
</div>
  
<!-- Load THREE.AR.JS Scripts   -->
<script src="https://cdn.glitch.com/eb70b5dd-9bee-4aff-9a93-08df8d562e27%2Fthree.js?1550097373433"></script>
<script src="https://cdn.glitch.com/eb70b5dd-9bee-4aff-9a93-08df8d562e27%2FVRControls.js?1550097368320"></script>
<script src="https://cdn.glitch.com/eb70b5dd-9bee-4aff-9a93-08df8d562e27%2Fthree.ar.js?1550097284604"></script>
  
<!-- Load Lathe Shaders   -->  
  <script data-src="/shaders/wood_vertex.js" data-name="Wood" type="x-shader/x-vertex"></script>
  <script data-src="/shaders/wood_fragment.js" data-name="Wood" type="x-shader/x-fragment"></script>

  <script data-src="/shaders/metal_vertex.js" data-name="Metal" type="x-shader/x-vertex"></script>
  <script data-src="/shaders/metal_fragment.js" data-name="Metal" type="x-shader/x-fragment"></script>

  <script data-src="/shaders/stone_vertex.js" data-name="Stone" type="x-shader/x-vertex"></script>
  <script data-src="/shaders/stone_fragment.js" data-name="Stone" type="x-shader/x-fragment"></script>
  
<!--  Load Lathe Scripts -->
  <script src = "/js/jquery-1.7.1.min.js"></script>
  <script src = "/js/signals.js"></script>
  <script src = "/js/Cylinder.js"></script>
  <script src = "/js/Detector.js"></script>
  <script src = "/js/ObjectPool.js"></script>
  <script src = "/js/sounds.js"></script>
  <script src = "/js/lathe.js"></script>
  <script src = "/js/Library.js"></script>
  
<!-- this file has all the interesting things in it -->
  <script src ="/collab.js"> </script>
</body>
</html>