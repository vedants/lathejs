var SoundFX = function(){

    try {
        this.context = new AudioContext();
        SoundFX.isAvailable = true;

    } catch( error ) {
        SoundFX.isAvailable = false;
        console.warn( "THREE.AudioObject: webkitAudioContext not found" );
        return this;

    }


    this.source = this.context.createBufferSource();
    this.gainNode = this.context.createGain();
    this.panner = this.context.createPanner();

    this.source.connect(this.panner);
    this.panner.connect(this.gainNode);
    this.gainNode.connect(this.context.destination);

    this.gainNode.gain.value = 0.0;
    this.source.loop = true;
}

SoundFX.prototype.load = function(url){
    // Load asynchronously
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";

    var scope = this

    xhr.onload = function() {

        scope.context.decodeAudioData(xhr.response, function onSuccess(decodedBuffer) {
            console.log(scope.source)
            scope.source.buffer = decodedBuffer;
            scope.source.start(0);
        // Decoding was successful, do something useful with the audio buffer
        }, function onFailure() {
            console.log("Decoding the audio buffer failed");
        });


    }

    xhr.send();
}

var SoundLibrary = {}