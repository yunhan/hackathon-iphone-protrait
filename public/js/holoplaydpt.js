//Copyright 2019 Looking Glass Factory Inc. (modif. by Suto 2019)
//All rights reserved.
//Unauthorized copying or distribution of this file, and the source code contained herein, is strictly prohibited.
function HoloPlay(scene, camera, renderer, focalPointVector, constantCenter, hiResRender){
    var scope = this;
    //This makes sure we don't try to render before initializing
    var initialized = false;
    
    var interval;
    var lastScreenX;
    var lastScreenY;
    var outOfWindow = false;
    
    //private variables
    var _renderer, _scene, _camera;
    var threeD;
    var jsonObj;
    
    //Stores the distance to the focal plane
    //Let's us change the rotation or position of the camera and still have it work
    //Change this in order to change the focus of the camera after runtime
    var holdCenter, cameraForward, viewScale, center;
    
    var bufferSceneRender;
    var bufferSceneRenderd;
    //Camera properties
    var viewCone, startNear, startFar, startDist;
    var nFull=0;
    var stStyle;
    var buttonMes;
    var startTime;
    var HSMes=0;
    var nRev=1; 	//1 -> Black:front White;back
    var nDpt=30;	// Depth level (%)
    var nDptCent=50;	// Depth Center (0-100)

    //Render scenes
    var bufferMat, finalRenderScene, finalRenderCamera;
    //Looking Glass buttons
    var buttons, buttonsLastFrame, buttonsAvailable;
    var buttonNames = [ "square", "left", "right", "circle" ];
    
    //A public bool to indicate if you want to use buttons - set to "false" if not to save processing time
    this.useButtons = true;
    
    var defaultCalibration = {"configVersion":"1.0","serial":"00112","pitch":{"value":49.96086120605469},"slope":{"value":-5.502500057220459},"center":{"value":0.14347827434539795},"viewCone":{"value":40.0},"invView":{"value":1.0},"verticalAngle":{"value":0.0},"DPI":{"value":355.0},"screenW":{"value":2560.0},"screenH":{"value":1600.0},"flipImageX":{"value":0.0},"flipImageY":{"value":0.0},"flipSubp":{"value":0.0}};
    
    function init()
    {
	doLoadEEPROM(true);
        threeD = true;
        jsonObj = null;

        if(hiResRender === undefined){
            hiResRender = true;
        }

        if(focalPointVector === undefined){
            var vector = new THREE.Vector3();
            camera.getWorldDirection(vector); //Sets the vector to the camera forward

            viewScale = Math.max(camera.position.length(), 1); //Sets the focal distance to either the distance to center or just ahead of the camera
            //Because no center was provided in the constructor, it assumes that the center is 0,0,0
            center = new THREE.Vector3(0,0,0);

            vector.multiplyScalar(viewScale);
            focalPointVector = [camera.position.x + vector.x, camera.position.y + vector.y, camera.position.z + vector.z]; //Sets the focal point to the front of the camera as far away as it is from (0,0,0)

        } else{
            if(focalPointVector instanceof THREE.Vector3){
                focalPointVector = [focalPointVector.x, focalPointVector.y, focalPointVector.z];
            }
            center = new THREE.Vector3(focalPointVector[0], focalPointVector[1], focalPointVector[2]);
            viewScale = Math.max(center.distanceTo(camera.position), 1) //Sets the focal distance to either the distance to center or just ahead of the camera
        }
        if(constantCenter === undefined)
            constantCenter = true;

        _renderer = renderer;
        _camera = camera;
        _scene = scene;

        //Locks the center to a fixed position if true, which is the default
        //Good for orbit controls, but should be false for things like first-person controls
        holdCenter = constantCenter;

        cameraForward = new THREE.Vector3();
        camera.getWorldDirection(cameraForward);

        //Buffer scene
        var renderResolution = 1024;
        if(hiResRender){
            renderResolution = 2048;
        } 

        bufferSceneRender = new THREE.WebGLRenderTarget(renderResolution, renderResolution, {format: THREE.RGBFormat});
        bufferSceneRenderd = new THREE.WebGLRenderTarget(renderResolution, renderResolution, {format: THREE.RGBFormat});

         //Capture settings
        viewCone = 40;

        //Init shader uniforms
        var uniforms =
        {
            quiltTexture: {value: bufferSceneRender.texture},
            depthTexture: {value: bufferSceneRenderd.texture},
            pitch: {value:0},
            tilt: {value:0},
            center: {value:0},
            invView: {value:0},
            flipX: {value:0},
            flipY: {value:0},
            subp: {value:0},
            ri: {value:0},
            bi: {value:2},
            fDptCent: {value:nDptCent*0.01},
            fDpt: {value:nDpt*0.01}
        };

        //Set up the shader
        var shaderProperties = {
            uniforms: uniforms,
            vertexShader: VertexShaderCode,
            fragmentShader: FragmentShaderCode
        };

        //Apply the shader to the buffer material
        bufferMat = new THREE.ShaderMaterial(shaderProperties);

        //Set up the final render scene
        finalRenderScene = new THREE.Scene();
        var renderPlaneGeometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);

        var renderPlane = new THREE.Mesh(renderPlaneGeometry, bufferMat);
        finalRenderScene.add(renderPlane);

        finalRenderCamera = new THREE.OrthographicCamera(-window.innerWidth/2, window.innerWidth/2, window.innerHeight/2, -window.innerHeight/2, 1, 3);
        finalRenderCamera.position.z = 2;
        finalRenderScene.add(finalRenderCamera);

        buttonsLastFrame = [ false, false, false, false ];
        //Add the user buttons
        setupFullScreen();
		
    };

    //******HTML SETUP******//

    //Create the dom element for the fullscreen button
    function makeFullScreenButton(){
        var newHTML =
            '<input type="button" style="margin:20px; position:fixed; top:0px; right:0px; z-index: 10000; height:50px; width:200px;" id="fullscreenButton" value="Full Screen Mode (Dpt v0.1)"/>';

        var buttonDiv = document.createElement("div");

        buttonDiv.innerHTML = newHTML;

        buttonDiv.setAttribute("id", "fullscreen");

        document.body.appendChild(buttonDiv);

        buttonMes = document.createElement("div");

	stStyle='<input type="button" style="font-size: 600%; margin:20px; position:fixed; top:0px; left:0px; z-index: 10000; height:120px; width:900px;" value="';

        buttonMes.setAttribute("id", "message");

        document.body.appendChild(buttonMes);
	buttonMes.style.visibility ="hidden";
	HSMes=0;

    };

	function toggleFullScreen(){
		nFull=(nFull+1)%2;
		if(nFull==1){
			fullscreenon();
		}
	      else{

			fullscreenoff();
		}

}

	function fullscreenon(){
		if (document.body.webkitRequestFullscreen) {
			document.body.webkitRequestFullscreen(); //Chrome15+, Safari5.1+, Opera15+
		} else if (document.body.mozRequestFullScreen) {
			document.body.mozRequestFullScreen(); //FF10+
		} else if (document.body.msRequestFullscreen) {
			document.body.msRequestFullscreen(); //IE11+
		} else if (document.body.requestFullscreen) {
			document.body.requestFullscreen(); // HTML5 Fullscreen API�d�l
		} else {
			alert('�����p�̃u���E�U�̓t���X�N���[������ɑΉ����Ă��܂���');
			return;
		}
		nFull=1;
		document.getElementById('fullscreen').style.visibility ="hidden";
	}

	function fullscreenoff(){
		if (document.webkitCancelFullScreen) {
			document.webkitCancelFullScreen(); //Chrome15+, Safari5.1+, Opera15+
		} else if (document.mozCancelFullScreen) {
			document.mozCancelFullScreen(); //FF10+
		} else if (document.msExitFullscreen) {
			document.msExitFullscreen(); //IE11+
		} else if(document.cancelFullScreen) {
			document.cancelFullScreen(); //Gecko:FullScreenAPI�d�l
		} else if(document.exitFullscreen) {
			document.exitFullscreen(); // HTML5 Fullscreen API�d�l
		}
		nFull=0;
		document.getElementById('fullscreen').style.visibility = "visible";
	}

	document.addEventListener('fullscreenchange', exitHandler);
	document.addEventListener('webkitfullscreenchange', exitHandler);
	document.addEventListener('mozfullscreenchange', exitHandler);
	document.addEventListener('MSFullscreenChange', exitHandler);

	function exitHandler() {
	    if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {		document.getElementById('fullscreen').style.visibility = "visible";
	      nFull=0;
	    }
	}

    //Adding the functionality for the fullscreen button
    function setupFullScreen(){
        makeFullScreenButton();

        document.getElementById('fullscreen').addEventListener("click", function(){
            fullscreenon();
        });
    };

    //******CALIBRATION SETUP******//
    
	function applyCalibration (calibration_obj)
	{
        if(calibration_obj === undefined || calibration_obj === ""){
            jsonObj = defaultCalibration;
            alert("No Looking Glass display connected; using default calibration data. Please ensure your Looking Glass is connected to your computer via USB and reload the page.")
        } else {
		try {
		 
		    jsonObj = JSON.parse(calibration_obj);
		 
		} catch( e ) {
		 
		    jsonObj = defaultCalibration;
            	alert("No Looking Glass display connected; using default calibration data. Please ensure your Looking Glass is connected to your computer via USB and reload the page.")
		}

        }
		setShaderValues(jsonObj.DPI.value, jsonObj.pitch.value, jsonObj.slope.value, jsonObj.screenH.value, jsonObj.screenW.value, jsonObj.center.value, jsonObj.flipImageX.value, jsonObj.flipImageY.value);
		viewCone = jsonObj.viewCone.value;
	}
	
	function saveCalibration (calibration_obj)
	{
		console.log("Calibration in local storage overwritten.");
		localStorage['Config'] = calibration_obj;
    }
	
	function doLoadEEPROM (inInit)
	{
        var OSName="Unknown OS";
        if (navigator.appVersion.indexOf("Win")!=-1) OSName="Windows";
        if (navigator.appVersion.indexOf("Mac")!=-1) OSName="MacOS";
        if (navigator.appVersion.indexOf("X11")!=-1) OSName="UNIX";
        if (navigator.appVersion.indexOf("Linux")!=-1) OSName="Linux";
        
		var ws = new WebSocket('ws://localhost:11222/');
		var finished = function () {
			ws.close();
		};
		var timeout = setTimeout(function () { 
			var errstr = "Calibration not found in internal memory.";
            if (inInit) {
				console.log(errstr); 
			} else { 
				alert(errstr);
			}
			finished();
		}, 800);
		ws.onmessage = function(event) {
			console.log("New calibration loaded from internal memory.");
			saveCalibration(event.data);
			applyCalibration(event.data);
			clearTimeout(timeout);
            initialized = true;
			finished();
		};
		ws.onerror = function(event) {
			if (confirm("Three.js driver not detected! Click OK to download. If you have already installed the driver, please make sure port 11222 is open.")){
                if(OSName == "Windows"){
				    window.location.href = "http://look.glass/threejsdriver_win";
                } else if(OSName == "MacOS"){
                    window.location.href = "http://look.glass/threejsdriver_mac"
                } else{
                    alert("Only Windows and OSX operating systems are currently supported for the Three.js library.")
                }
			}
			finished();
		};
	}


    //*******SHADER SETUP******//

    function setShaderValues(dpi, pitch, slope, screenH, screenW, center, flipX, flipY, invView)
    {
        //        var screenInches = screenW / dpi;
        var screenInches = window.innerWidth / dpi;
        var newPitch = pitch * screenInches;

        //account for tilt in measuring pitch horizontally
        newPitch *= Math.cos(Math.atan(1.0 / slope));
        bufferMat.uniforms.pitch.value = newPitch;

        //tilt
//        var newTilt = screenH / (screenW * slope);
        var newTilt = window.innerHeight / (window.innerWidth * slope);
        if(flipX == 1)
            newTilt *= -1;
        bufferMat.uniforms.tilt.value = newTilt;

        //center
        //I need the relationship between the amount of pixels I have moved over to the amount of lenticulars I have jumped
        //ie how many pixels are there to a lenticular?
        bufferMat.uniforms.center.value = center;
        
        
        //should we invert?
        bufferMat.uniforms.invView.value = nRev;

        //Should we flip it for peppers?
        bufferMat.uniforms.flipX.value = flipX;
        bufferMat.uniforms.flipY.value = flipY;

        bufferMat.uniforms.subp.value = 1/(screenW * 3);

        bufferMat.uniforms.fDptCent.value = nDptCent*0.01;
	bufferMat.uniforms.fDpt.value = nDpt*0.01;

        bufferMat.needsUpdate = true;
    };

    //*******LOGIC FOR CAPTURING MULTIPLE VIEWS******//

    //Render the different views
    function captureViews0(scene, camera)
    {
	renderer.setRenderTarget(bufferSceneRender);
	renderer.clear();
        renderer.render(scene, camera);
    };
    
    function captureViews(scene, camera)
    {
	renderer.setRenderTarget(bufferSceneRenderd);
	renderer.clear();
        renderer.render(scene, camera);
    };

    HoloPlay.prototype.setConf = function (nDpt0,nDptCent0,nRev0){
	nDpt=nDpt0;
	nDptCent=nDptCent0;
	nRev=nRev0;
	bufferMat.uniforms.fDptCent.value = nDptCent*0.01;
        bufferMat.uniforms.fDpt.value = nDpt*0.01;
	bufferMat.uniforms.invView.value = nRev;
        bufferMat.needsUpdate = true;
	};
        
    //Render loop, with options for 3D or 2D rendering
    HoloPlay.prototype.render0 = function (scene, camera, renderer){
        if(!initialized)
            return;
	
        if(renderer === undefined)
            renderer = _renderer;             
        if(!threeD){
            if(camera.projectionMatrix.elements[8] != 0)
                camera.projectionMatrix.elements[8] = 0;
            renderer.render(scene, camera);
        } else{
            captureViews0(scene, camera);
        }
    };

    HoloPlay.prototype.render = function (scene, camera, renderer){
        if(!initialized)
            return;
        if(buttonsAvailable && scope.useButtons){
            var gp = navigator.getGamepads();
            for (var i = 0; i < gp.length; i++) {
              if(gp[i] != null && gp[i].id.indexOf("HoloPlay") > -1){
                buttons = gp[i].buttons;
                break;
              }
            }
            
            for(var i = 0; i < buttons.length; i++){
                if(buttonsLastFrame === undefined && !buttons[i].pressed){
                    continue;
                }
                
                if(buttonsLastFrame === undefined && buttons[i].pressed){
                    buttonDown.index = i;
                    buttonDown.name = buttonNames[i];
                    document.dispatchEvent(buttonDown);
                } else if(!buttonsLastFrame[i] && buttons[i].pressed){
                    buttonDown.index = i;
                    buttonDown.name = buttonNames[i];
                    document.dispatchEvent(buttonDown);
                } else if(buttonsLastFrame[i] && buttons[i].pressed){
                    buttonPressed.index = i;
                    buttonPressed.name = buttonNames[i];
                    document.dispatchEvent(buttonPressed);
                } else if(buttonsLastFrame[i] && !buttons[i].pressed){
                    buttonUp.index = i;
                    buttonUp.name = buttonNames[i];
                    document.dispatchEvent(buttonUp);
                }
            
                buttonsLastFrame[i] = buttons[i].pressed;
            }
            
        }
	
        if(renderer === undefined)
            renderer = _renderer;             
        if(!threeD){
            if(camera.projectionMatrix.elements[8] != 0)
                camera.projectionMatrix.elements[8] = 0;
            renderer.render(scene, camera);
        } else{
            captureViews(scene, camera);
	    renderer.setRenderTarget( null );
	//    console.timeEnd('time');
            renderer.render(finalRenderScene, finalRenderCamera);
	 //   console.time('time');

        }
    };

    //*****EVENT LISTENERS*****//
    
    function addEvent(obj, evt, fn) {
        if (obj.addEventListener) {
            obj.addEventListener(evt, fn, false);
        }
        else if (obj.attachEvent) {
            obj.attachEvent("on" + evt, fn);
        }
    };

    //Custom Looking Glass button events
    var buttonDown = new CustomEvent("buttonDown", {bubbles: true, cancelable: false, name: "none", index: -1});
    var buttonPressed = new CustomEvent("buttonPressed", {bubbles: true, cancelable: false, name: "none", index: -1});
    var buttonUp = new CustomEvent("buttonUp", {bubbles: true, cancelable: false, name: "none", index: -1});
    
    addEvent(window, "gamepadconnected", function(e) {
      var gp = navigator.getGamepads()[e.gamepad.index];
      console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
        gp.index, gp.id,
        gp.buttons.length, gp.axes.length);
      if(gp.id.indexOf("HoloPlay") > -1){
          buttonsAvailable = true;
      }
    });
    
    addEvent(document, "mouseout", function(e) {
        e = e ? e : window.event;
        var from = e.relatedTarget || e.toElement;
        if (!from || from.nodeName == "HTML") {
            if(!outOfWindow){
                outOfWindow = true;
            }
        }
    });
    
    addEvent(document, "mouseover", function(e){
       e = e ? e : window.event;
       var from = e.relatedTarget || e.toElement;
       if(from != "HTML"){
           if(outOfWindow){
               outOfWindow = false;
           }   
        }
    });
    
    //Reset shader values on window resize to make it draw properly
    addEvent(window, "resize", function(e){
        e = e ? e : window.event;
        setShaderValues(jsonObj.DPI.value, jsonObj.pitch.value, jsonObj.slope.value, jsonObj.screenH.value, jsonObj.screenW.value, jsonObj.center.value, jsonObj.flipImageX.value, jsonObj.flipImageY.value, jsonObj.invView.value);
    });
    
    //Forward Slash for switching between 2D and 3D
    addEvent(document, "keydown", function (e) {
        e = e ? e : window.event;
	fromjsfnc(e.keyCode);
//	console.log("e.keyCode="+e.keyCode);
        if(e.keyCode === 220){
            threeD = !threeD;
        }
        if(e.keyCode === 13){
            toggleFullScreen();
            }
        if(e.keyCode === 68){		//Display
            HSMes=(HSMes+1)%2;
	    if(HSMes==1) buttonMes.style.visibility ="visible";
	    else buttonMes.style.visibility ="hidden";
            }
        if(e.keyCode === 88){		//x
	    nRev=!nRev;
	    nDptCent=100-nDptCent;
	    bufferMat.uniforms.fDptCent.value = nDptCent*0.01;
            bufferMat.uniforms.invView.value = nRev;
            bufferMat.needsUpdate = true;
            }
        if(e.keyCode === 81){		//q
            }
        if(e.keyCode === 87){		//w
            }
        if(e.keyCode === 69 || e.keyCode === 67){		//e
            }
        if(e.keyCode === 82){		//r
		nDptCent=50;
		nDpt=30;
            	bufferMat.uniforms.fDpt.value = nDpt*0.01;
	        bufferMat.uniforms.fDptCent.value = nDptCent*0.01;
	        bufferMat.needsUpdate = true;
            }
        if(e.keyCode === 40){		//l
		HoloPlay.valuerest(-1);
            }
        if(e.keyCode === 38){		//r
		HoloPlay.valuerest(1);
            }
        if(e.keyCode === 37){		//d
	    nDpt--;
	    if(nDpt<0) nDpt=0;
            bufferMat.uniforms.fDpt.value = nDpt*0.01;
            bufferMat.needsUpdate = true;
            }
        if(e.keyCode === 39){		//u
	    nDpt++;
	    if(nDpt>100) nDpt=100;
            bufferMat.uniforms.fDpt.value = nDpt*0.01;
            bufferMat.needsUpdate = true;
            }
    });

    HoloPlay.valuerest = function(ncnt){
	    if(ncnt==0) nDptCent=50;
	    else nDptCent=nDptCent+ncnt;
	    if(nDptCent<0) nDptCent=0;
	    if(nDptCent>100) nDptCent=100;
	    bufferMat.uniforms.fDptCent.value = nDptCent*0.01;
	    bufferMat.needsUpdate = true;
	};

    //SHADER CODE
    var VertexShaderCode =
        "varying vec2 iUv;"+

        "void main() {"+
            "iUv = uv;"+
            "vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);"+
            "gl_Position = projectionMatrix * modelViewPosition;"+
        "}";

    var FragmentShaderCode =
        "uniform sampler2D quiltTexture;"+
        "uniform sampler2D depthTexture;"+
        "uniform float pitch;"+
        "uniform float tilt;"+
        "uniform float center;"+
        "uniform float invView;" +
        "uniform float flipX;" +
        "uniform float flipY;" +
        "uniform float subp;" +
        "uniform float fDptCent;"+
        "uniform float fDpt;"+
        "varying vec2 iUv;"+
        "const float loop=20.0;"+

        "vec2 texArr(vec3 uvz) {"+
            "float d1;"+
            "float xtemp;"+
            "float sn=sign(uvz.z-0.5);"+
            "float d3=fDptCent;"+
            "d3=d3*(uvz.z-0.5)*fDpt;"+
            "float xin=uvz.x-d3;"+
            "for(float i=0.0;i<loop;i++){"+
	            "d1 = texture2D(depthTexture, vec2(xin, uvz.y)).r;"+
	            "d1 = invView * d1 + (1.0 - invView) * (1.0 - d1);" +
	            "d1 = d1*(uvz.z-0.5)*fDpt;"+
	            "xtemp=max(0.0,sn*(uvz.x-(xin-d1+d3)));"+
	            "xtemp=min(xtemp,abs(((uvz.z-0.5)*fDpt)/(loop/1.2)));"+
	            "xin=xin+xtemp*sn;"+
            "}"+
            "xtemp=uvz.x+d1-d3;"+
            "return vec2(xtemp, uvz.y);"+
        "}"+

        "void main()"+
        "{"+
            "vec4 rgb[3];"+
            "vec3 nuv = vec3(iUv.xy, 0.0);"+

            //Flip UVs if necessary
            "nuv.x = (1.0 - flipX) * nuv.x + flipX * (1.0 - nuv.x);"+
            "nuv.y = (1.0 - flipY) * nuv.y + flipY * (1.0 - nuv.y);"+

            "for (int i = 0; i < 3; i++) {"+
                "nuv.z = (iUv.x + float(i) * subp + iUv.y * tilt) * pitch - center;"+
                "nuv.z = mod(nuv.z + ceil(abs(nuv.z)), 1.0);"+
                "rgb[i] = texture2D(quiltTexture, texArr(vec3(iUv.x, iUv.y, nuv.z)));"+
            "}"+

            "gl_FragColor = vec4(rgb[0].r, rgb[1].g, rgb[2].b, 1);"+
        "}"
    ;

    //Call our initialization function once all our values are set
    init();
}