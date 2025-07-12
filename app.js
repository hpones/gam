let video = document.getElementById('video');
let glcanvas = document.getElementById('glcanvas');
let canvas = document.getElementById('canvas'); // Para la captura de imágenes estáticas y ahora para MediaPipe
let filterSelect = document.getElementById('filterSelect');
let captureBtn = document.getElementById('capture-button');
let recordBtn = document.getElementById('record-button');
let pauseBtn = document.getElementById('pause-button');
let stopBtn = document.getElementById('stop-button');
let fullscreenBtn = document.getElementById('fullscreen-button');
let filterBtn = document.getElementById('filter-button');
let filtersDropdown = document.getElementById('filters-dropdown');
let gallery = document.getElementById('gallery');
let controls = document.getElementById('controls');
let recordingControls = document.getElementById('recording-controls');
let cameraContainer = document.getElementById('camera-container'); // Necesario para fullscreen

// Modal elements
let previewModal = document.getElementById('previewModal');
let closeButton = document.querySelector('.close-button');
let modalContent = document.querySelector('.modal-content');

let currentStream;
let mediaRecorder;
let chunks = [];
let isRecording = false;
let isPaused = false;
let selectedFilter = 'none';
let currentCameraDeviceId = null;
let currentFacingMode = null; // 'user' (frontal) o 'environment' (trasera)

// --- VARIABLES Y CONFIGURACIÓN DE WEBG L ---
let gl; // Contexto WebGL
let program; // Programa de shaders
let positionBuffer; // Buffer para las posiciones de los vértices
let texCoordBuffer; // Buffer para las coordenadas de textura
let videoTexture; // Textura donde se cargará el fotograma del video
let filterTypeLocation; // Ubicación del uniform para el tipo de filtro
let timeLocation; // Ubicación del uniform para el tiempo (para efectos dinámicos)

// --- VARIABLES Y CONFIGURACIÓN DE AUDIO ---
let audioContext;
let analyser;
let microphone;
let dataArray;
const AUDIO_THRESHOLD = 0.15;

let paletteIndex = 0;
const palettes = [
    [1.0, 0.0, 0.0],    // Rojo (valores normalizados 0-1)
    [0.0, 1.0, 0.0],    // Verde
    [0.0, 0.0, 1.0],    // Azul
    [1.0, 1.0, 0.0],    // Amarillo
    [1.0, 0.0, 1.0],    // Magenta
    [0.0, 1.0, 1.0],    // Cyan
];
let colorShiftUniformLocation;

// --- NUEVOS UNIFORMS PARA EL FILTRO MODULAR COLOR SHIFT ---
let bassAmpUniformLocation;
let midAmpUniformLocation;
let highAmpUniformLocation;

// --- VARIABLES DE MEDIAPIPE ---
let selfieSegmentation;
let mpCamera;

// Vertex Shader: define la posición de los vértices y las coordenadas de textura
const vsSource = `
    attribute vec4 a_position;
    attribute vec2 a_texCoord;

    varying vec2 v_texCoord;

    void main() {
        gl_Position = a_position;
        v_texCoord = a_texCoord;
    }
`;

// Fragment Shader: define el color de cada píxel, ahora con lógica de filtros
const fsSource = `
    precision mediump float;

    uniform sampler2D u_image;
    uniform bool u_flipX;
    uniform int u_filterType;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec3 u_colorShift;

    uniform float u_bassAmp;
    uniform float u_midAmp;
    uniform float u_highAmp;

    varying vec2 v_texCoord;

    const int FILTER_NONE = 0;
    const int FILTER_GRAYSCALE = 1;
    const int FILTER_INVERT = 2;
    const int FILTER_SEPIA = 3;
    const int FILTER_ECO_PINK = 4;
    const int FILTER_WEIRD = 5;
    const int FILTER_GLOW_OUTLINE = 6;
    const int FILTER_ANGELICAL_GLITCH = 7;
    const int FILTER_AUDIO_COLOR_SHIFT = 8;
    const int FILTER_MODULAR_COLOR_SHIFT = 9;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float brightness(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
    }

    void main() {
        vec2 texCoord = v_texCoord;
        if (u_flipX) {
            texCoord.x = 1.0 - texCoord.x;
        }
        vec4 color = texture2D(u_image, texCoord);
        vec3 finalColor = color.rgb;
        float alpha = color.a;

        if (u_filterType == FILTER_GRAYSCALE) {
            float brightness = (color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722);
            finalColor = vec3(brightness);
        } else if (u_filterType == FILTER_INVERT) {
            finalColor = 1.0 - finalColor;
        } else if (u_filterType == FILTER_SEPIA) {
            float r = color.r;
            float g = color.g;
            float b = color.b;
            finalColor.r = (r * 0.393) + (g * 0.769) + (b * 0.189);
            finalColor.g = (r * 0.349) + (g * 0.686) + (b * 0.168);
            finalColor.b = (r * 0.272) + (g * 0.534) + (b * 0.131);
            finalColor = clamp(finalColor, 0.0, 1.0);
        } else if (u_filterType == FILTER_ECO_PINK) {
            float brightness = (color.r + color.g + color.b) / 3.0;
            if (brightness < 0.3137) {
                finalColor.r = min(1.0, color.r + (80.0/255.0));
                finalColor.g = max(0.0, color.g - (50.0/255.0));
                finalColor.b = min(1.0, color.b + (100.0/255.0));
            }
        } else if (u_filterType == FILTER_WEIRD) {
            float brightness = (color.r + color.g + color.b) / 3.0;
            if (brightness > 0.7058) {
                float temp_r = color.r;
                finalColor.r = color.b;
                finalColor.b = color.g;
                finalColor.g = temp_r;
            } else if (brightness < 0.3921) {
                finalColor *= 0.5;
            }
        } else if (u_filterType == FILTER_GLOW_OUTLINE) {
            vec2 onePixel = vec2(1.0, 1.0) / u_resolution;
            float distortionFactor = 0.005;
            vec2 offsetUp = vec2(sin(texCoord.y * 100.0) * distortionFactor, onePixel.y + cos(texCoord.x * 100.0) * distortionFactor);
            vec2 offsetDown = vec2(cos(texCoord.y * 100.0) * distortionFactor, -onePixel.y + sin(texCoord.x * 100.0) * distortionFactor);
            vec2 offsetLeft = vec2(-onePixel.x + sin(texCoord.y * 100.0) * distortionFactor, cos(texCoord.x * 100.0) * distortionFactor);
            vec2 offsetRight = vec2(onePixel.x + cos(texCoord.y * 100.0) * distortionFactor, sin(texCoord.x * 100.0) * distortionFactor);

            vec4 up = texture2D(u_image, texCoord + offsetUp);
            vec4 down = texture2D(u_image, texCoord + offsetDown);
            vec4 left = texture2D(u_image, texCoord + offsetLeft);
            vec4 right = texture2D(u_image, texCoord + offsetRight);

            float diff = abs(color.r - up.r) + abs(color.r - down.r) + abs(color.r - left.r) + abs(color.r - right.r);
            float edge = smoothstep(0.01, 0.1, diff);
            vec3 outlineColor = vec3(1.0);

            float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float glowFactor = smoothstep(0.7, 1.0, brightness) * 0.5;

            finalColor = mix(finalColor + glowFactor, outlineColor, edge);
        } else if (u_filterType == FILTER_ANGELICAL_GLITCH) {
            vec2 uv = texCoord;

            vec4 col = texture2D(u_image, uv);
            col.rgb *= 1.3;

            float b = brightness(col.rgb);

            vec2 distortion = vec2(
                (random(uv + vec2(sin(u_time * 0.1), cos(u_time * 0.1))) - 0.5) * 0.1,
                (random(uv + vec2(cos(u_time * 0.1), sin(u_time * 0.1))) - 0.5) * 0.1
            );

            vec4 distorted = texture2D(u_image, uv + distortion);

            if (b > 0.5) {
                vec3 glowColor = vec3(
                    0.5 + 0.3 * sin(u_time * 2.0),
                    0.2 + 0.5 * cos(u_time * 1.5),
                    0.6 + 0.4 * sin(u_time * 3.0)
                );

                finalColor = mix(distorted.rgb, glowColor, 0.5);
            } else {
                finalColor = distorted.rgb;
            }
            alpha = col.a;
        } else if (u_filterType == FILTER_AUDIO_COLOR_SHIFT) {
            finalColor = mod(color.rgb + u_colorShift, 1.0);
        } else if (u_filterType == FILTER_MODULAR_COLOR_SHIFT) {
            const vec3 palette0 = vec3(80.0/255.0, 120.0/255.0, 180.0/255.0);
            const vec3 palette1 = vec3(100.0/255.0, 180.0/255.0, 200.0/255.0);
            const vec3 palette2 = vec3(120.0/255.0, 150.0/255.0, 255.0/255.0);

            float brightness_val = (color.r + color.g + color.b) / 3.0;

            if (brightness_val > (170.0/255.0)) {
                finalColor.rgb = mix(color.rgb, palette2, u_highAmp);
            } else if (brightness_val > (100.0/255.0)) {
                finalColor.rgb = mix(color.rgb, palette1, u_midAmp);
            } else {
                finalColor.rgb = mix(color.rgb, palette0, u_bassAmp);
            }
            finalColor.rgb = clamp(finalColor.rgb, 0.0, 1.0);
        }

        gl_FragColor = vec4(finalColor, alpha);
    }
`;

// Helper para compilar un shader
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error al compilar el shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Helper para enlazar shaders a un programa
function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error al enlazar el programa:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

// Configura los buffers de un cuadrado que llena el canvas
function setupQuadBuffers(gl) {
    const positions = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
    ]);
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const texCoords = new Float32Array([
        0, 1,
        1, 1,
        0, 0,
        0, 0,
        1, 1,
        1, 0,
    ]);
    texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
}

// Inicializa la textura para el video
function setupVideoTexture(gl) {
    videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

// Actualiza la textura con el fotograma actual del video
function updateVideoTexture(gl, video) {
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
}

// --- FUNCIÓN DE INICIALIZACIÓN WEBG L ---
function initWebGL() {
    gl = glcanvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
        alert('Tu navegador no soporta WebGL. No se podrán aplicar filtros avanzados.');
        return;
    }

    const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
    program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    program.positionLocation = gl.getAttribLocation(program, 'a_position');
    program.texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    program.imageLocation = gl.getUniformLocation(program, 'u_image');
    program.flipXLocation = gl.getUniformLocation(program, 'u_flipX');
    filterTypeLocation = gl.getUniformLocation(program, 'u_filterType');
    program.resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    timeLocation = gl.getUniformLocation(program, 'u_time');
    colorShiftUniformLocation = gl.getUniformLocation(program, 'u_colorShift');

    bassAmpUniformLocation = gl.getUniformLocation(program, 'u_bassAmp');
    midAmpUniformLocation = gl.getUniformLocation(program, 'u_midAmp');
    highAmpUniformLocation = gl.getUniformLocation(program, 'u_highAmp');

    gl.enableVertexAttribArray(program.positionLocation);
    gl.enableVertexAttribArray(program.texCoordLocation);

    setupQuadBuffers(gl);
    setupVideoTexture(gl);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(program.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(program.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(program.imageLocation, 0);

    gl.uniform1i(filterTypeLocation, 0);
}


// --- LÓGICA DE CÁMARA Y STREAMING ---
let availableCameraDevices = [];

async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    availableCameraDevices = videoDevices;

    if (availableCameraDevices.length > 0) {
      if (!currentCameraDeviceId || !availableCameraDevices.some(d => d.deviceId === currentCameraDeviceId)) {
        currentCameraDeviceId = availableCameraDevices[0].deviceId;
      }
      startCamera(currentCameraDeviceId);
    } else {
      alert('No se encontraron dispositivos de cámara.');
    }
  } catch (err) {
    console.error('Error al listar dispositivos de cámara:', err);
    alert('Error al listar dispositivos de cámara. Revisa los permisos.');
  }
}

async function startCamera(deviceId) {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  const constraints = {
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: true
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    currentCameraDeviceId = deviceId || currentStream.getVideoTracks()[0].getSettings().deviceId;

    const videoTrack = currentStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    currentFacingMode = settings.facingMode || 'unknown';

    // --- Web Audio API setup ---
    if (currentStream.getAudioTracks().length > 0) {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        }

        if (microphone) {
            microphone.disconnect();
        }

        const audioSource = audioContext.createMediaStreamSource(currentStream);
        audioSource.connect(analyser);
        microphone = audioSource;
    } else {
        if (microphone) {
            microphone.disconnect();
            microphone = null;
        }
        if (analyser) {
            analyser.disconnect();
            analyser = null;
        }
    }
    // --- Fin Web Audio API setup ---

    video.onloadedmetadata = () => {
      video.play();
      if (glcanvas.width !== video.videoWidth || glcanvas.height !== video.videoHeight) {
        glcanvas.width = video.videoWidth;
        glcanvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (gl) {
          gl.viewport(0, 0, glcanvas.width, glcanvas.height);
        }
      }
      if (!gl) {
        initWebGL();
      }

      if (!selfieSegmentation) {
          selfieSegmentation = new SelfieSegmentation({
              locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
          });
          selfieSegmentation.setOptions({
              modelSelection: 1,
          });
          selfieSegmentation.onResults(onMediaPipeResults);
      }
      if (!mpCamera) {
          mpCamera = new Camera(video, {
              onFrame: async () => {
                  if (video.videoWidth > 0 && video.videoHeight > 0) {
                      await selfieSegmentation.send({ image: video });
                  }
              },
              width: video.videoWidth,
              height: video.videoHeight
          });
          mpCamera.start();
      }

      drawVideoFrame();
    };
  } catch (err) {
    console.error('No se pudo acceder a la cámara/micrófono:', err);
    alert('No se pudo acceder a la cámara/micrófono. Revisa los permisos. Error: ' + err.name);
  }
}

// --- FUNCIÓN PARA MANEJAR RESULTADOS DE MEDIAPIPE ---
function onMediaPipeResults(results) {
    const ctx = canvas.getContext("2d");

    const isMediaPipeFilter = ["whiteGlow", "inverseMask", "blackBg", "whiteBg"].includes(selectedFilter);
    if (isMediaPipeFilter) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        switch (selectedFilter) {
            case "whiteGlow":
                ctx.save();
                ctx.filter = "blur(20px)";
                ctx.globalAlpha = 0.7;
                for (let i = 0; i < 3; i++) {
                    ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
                }
                ctx.restore();

                ctx.save();
                ctx.globalCompositeOperation = "destination-in";
                ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
                ctx.restore();

                ctx.globalCompositeOperation = "destination-over";
                ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
                break;

            case "inverseMask":
                ctx.filter = "blur(10px)";
                ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
                ctx.filter = "none";

                ctx.save();
                ctx.globalCompositeOperation = "destination-out";
                ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
                ctx.restore();
                break;

            case "blackBg":
            case "whiteBg":
                ctx.fillStyle = selectedFilter === "blackBg" ? "black" : "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.save();
                ctx.globalCompositeOperation = "destination-in";
                ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
                ctx.restore();

                ctx.globalCompositeOperation = "destination-over";
                ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
                break;

            default:
                ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        }
        ctx.globalCompositeOperation = "source-over";
    }
}


// --- BUCLE PRINCIPAL DE RENDERIZADO WEBG L / MEDIAPIPE ---
function drawVideoFrame() {
    requestAnimationFrame(drawVideoFrame);

    const isMediaPipeFilter = ["whiteGlow", "inverseMask", "blackBg", "whiteBg"].includes(selectedFilter);

    if (!isMediaPipeFilter) {
        if (!gl || !program || !video.srcObject || video.readyState !== video.HAVE_ENOUGH_DATA) {
            return;
        }
        updateVideoTexture(gl, video);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

        const isFrontFacing = currentFacingMode === 'user';
        gl.uniform1i(program.flipXLocation, isFrontFacing ? 1 : 0);

        gl.uniform2f(program.resolutionLocation, glcanvas.width, glcanvas.height);

        const currentTime = performance.now() / 1000.0;
        gl.uniform1f(timeLocation, currentTime);

        if (analyser && dataArray && selectedFilter === 'audio-color-shift') {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            let average = sum / dataArray.length;
            let normalizedLevel = average / 255.0;

            if (normalizedLevel > AUDIO_THRESHOLD) {
                changePaletteIndex();
            }
        }

        if (selectedFilter === 'audio-color-shift') {
            const currentColor = palettes[paletteIndex];
            gl.uniform3fv(colorShiftUniformLocation, new Float32Array(currentColor));
        }

        if (selectedFilter === 'modular-color-shift') {
            const bassAmp = mapValue(Math.sin(currentTime * 0.8 + 0), -1, 1, 0.0, 2.0);
            const midAmp = mapValue(Math.sin(currentTime * 1.2 + Math.PI / 3), -1, 1, 0.0, 1.5);
            const highAmp = mapValue(Math.sin(currentTime * 1.5 + Math.PI * 2 / 3), -1, 1, 0.0, 2.5);

            gl.uniform1f(bassAmpUniformLocation, bassAmp);
            gl.uniform1f(midAmpUniformLocation, midAmp);
            gl.uniform1f(highAmpUniformLocation, highAmp);
        }

        let filterIndex = 0;
        switch (selectedFilter) {
            case 'grayscale': filterIndex = 1; break;
            case 'invert': filterIndex = 2; break;
            case 'sepia': filterIndex = 3; break;
            case 'eco-pink': filterIndex = 4; break;
            case 'weird': filterIndex = 5; break;
            case 'glow-outline': filterIndex = 6; break;
            case 'angelical-glitch': filterIndex = 7; break;
            case 'audio-color-shift': filterIndex = 8; break;
            case 'modular-color-shift': filterIndex = 9; break;
            default: filterIndex = 0; break;
        }
        gl.uniform1i(filterTypeLocation, filterIndex);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

// Función auxiliar para mapear un valor de un rango a otro
function mapValue(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}


// --- MANEJADORES DE EVENTOS ---
captureBtn.addEventListener('click', () => {
    const targetCanvas = (glcanvas.style.display !== 'none') ? glcanvas : canvas;

    if (!targetCanvas || !targetCanvas.width || !targetCanvas.height) {
        console.error('El canvas activo no está inicializado o no tiene dimensiones para la captura.');
        return;
    }

    let img = new Image();
    img.src = targetCanvas.toDataURL('image/png');

    img.onload = () => {
        addToGallery(img, 'img', img.src);
    };
    img.onerror = (e) => {
        console.error('Error al cargar la imagen para la galería:', e);
    };
});


recordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    chunks = [];
    const targetCanvas = (glcanvas.style.display !== 'none') ? glcanvas : canvas;
    if (!targetCanvas) {
        console.error('No se pudo encontrar el canvas activo para la grabación.');
        return;
    }

    // Prioritize MP4 if supported, fallback to webm
    let mimeType = 'video/webm; codecs=vp8'; // Default fallback
    if (MediaRecorder.isTypeSupported('video/mp4')) { // More generic MP4 check
        mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
        mimeType = 'video/webm; codecs=vp9'; // Better quality webm
    }

    let streamToRecord = targetCanvas.captureStream();
    mediaRecorder = new MediaRecorder(streamToRecord, { mimeType: mimeType });

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      let vid = document.createElement('video');
      vid.src = url;
      // Set autoplay and controls for the video in the modal
      vid.autoplay = true;
      vid.controls = true;
      vid.loop = true; // Loop for better preview experience

      vid.onloadedmetadata = () => {
        addToGallery(vid, 'video', url);
      };
    };
    mediaRecorder.start();
    isRecording = true;
    controls.style.display = 'none';
    recordingControls.style.display = 'flex';
  }
});

pauseBtn.addEventListener('click', () => {
  if (isPaused) {
    mediaRecorder.resume();
    pauseBtn.textContent = '⏸️';
  } else {
    mediaRecorder.pause();
    pauseBtn.textContent = '▶️';
  }
  isPaused = !isPaused;
});

stopBtn.addEventListener('click', () => {
  mediaRecorder.stop();
  isRecording = false;
  controls.style.display = 'flex';
  recordingControls.style.display = 'none';
});

filterBtn.addEventListener('click', () => {
  filtersDropdown.style.display = (filtersDropdown.style.display === 'block') ? 'none' : 'block';
});

filterSelect.addEventListener('change', () => {
  selectedFilter = filterSelect.value;
  filtersDropdown.style.display = 'none';

  const isMediaPipeFilter = ["whiteGlow", "inverseMask", "blackBg", "whiteBg"].includes(selectedFilter);
  if (isMediaPipeFilter) {
      glcanvas.style.display = 'none';
      canvas.style.display = 'block';
  } else {
      glcanvas.style.display = 'block';
      canvas.style.display = 'none';
  }
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    cameraContainer.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

function addToGallery(element, type, srcUrl) {
  let container = document.createElement('div');
  container.className = 'gallery-item';

  // Clonar el elemento para la miniatura
  let thumbnail = element.cloneNode(true);
  thumbnail.style.height = '70%'; // Thumbnail height
  thumbnail.style.width = '100%'; // Thumbnail width
  thumbnail.removeAttribute('controls'); // Remove controls for thumbnail video
  thumbnail.removeAttribute('autoplay'); // Remove autoplay for thumbnail video
  thumbnail.loop = false; // Do not loop thumbnail video
  container.appendChild(thumbnail);

  // Add click/tap to preview
  thumbnail.addEventListener('click', () => {
      modalContent.innerHTML = ''; // Clear previous content
      let previewElement = element.cloneNode(true);
      previewElement.style.width = '100%';
      previewElement.style.height = 'auto';
      if (type === 'video') {
          previewElement.controls = true; // Add controls for preview video
          previewElement.autoplay = true; // Auto-play video in modal
          previewElement.loop = true; // Loop video in modal
          previewElement.muted = false; // Ensure video sound is not muted in preview
          // Important: Load video to ensure it plays in modal
          previewElement.load();
      }
      modalContent.appendChild(previewElement);
      previewModal.style.display = 'flex'; // Show modal using flex for centering
  });

  let actions = document.createElement('div');
  actions.className = 'gallery-actions';

  let downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'Descargar';
  downloadBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = srcUrl; // Use the actual blob URL or data URL
    // Adjust download filename based on the actual MIME type of the blob
    let fileExtension = 'bin'; // Default fallback extension
    if (srcUrl.includes('image/png') || srcUrl.includes('image/jpeg')) {
        fileExtension = 'png';
    } else if (srcUrl.includes('video/mp4')) {
        fileExtension = 'mp4';
    } else if (srcUrl.includes('video/webm')) {
        fileExtension = 'webm';
    }
    a.download = type === 'img' ? `foto_${Date.now()}.png` : `video_${Date.now()}.${fileExtension}`;
    a.click();
  };

  let shareBtn = document.createElement('button');
  shareBtn.textContent = 'Compartir';
  shareBtn.onclick = async () => {
    if (navigator.share) {
      try {
        const file = await fetch(srcUrl).then(res => res.blob());
        const fileName = type === 'img' ? `foto_${Date.now()}.png` : `video_${Date.now()}.${file.type.split('/')[1] || 'bin'}`;
        const fileType = file.type;
        const shareData = {
          files: [new File([file], fileName, { type: fileType })],
          title: 'Mi creación desde Experimental Camera',
          text: '¡Echa un vistazo a lo que hice con Experimental Camera!'
        };
        await navigator.share(shareData);
      } catch (error) {
        console.error('Error al compartir:', error);
      }
    } else {
      alert('La API Web Share no es compatible con este navegador.');
    }
  };

  let deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.onclick = () => {
    if (type === 'video' && srcUrl.startsWith('blob:')) {
      URL.revokeObjectURL(srcUrl);
    }
    container.remove();
  };

  actions.appendChild(downloadBtn);
  if (navigator.share) {
    actions.appendChild(shareBtn);
  }
  actions.appendChild(deleteBtn);
  container.appendChild(actions);

  gallery.prepend(container);
}

// Close modal when close button is clicked
closeButton.addEventListener('click', () => {
    previewModal.style.display = 'none';
    // Pause any playing video in the modal when closing
    const currentModalVideo = modalContent.querySelector('video');
    if (currentModalVideo) {
        currentModalVideo.pause();
        currentModalVideo.currentTime = 0; // Reset video to start
    }
    modalContent.innerHTML = ''; // Clear content when closing
});

// Close modal when clicking outside the content
window.addEventListener('click', (event) => {
    if (event.target == previewModal) {
        previewModal.style.display = 'none';
        // Pause any playing video in the modal when closing
        const currentModalVideo = modalContent.querySelector('video');
        if (currentModalVideo) {
            currentModalVideo.pause();
            currentModalVideo.currentTime = 0; // Reset video to start
        }
        modalContent.innerHTML = ''; // Clear content when closing
    }
});


// --- LÓGICA DE DOBLE TAP/CLICK PARA CAMBIAR DE CÁMARA ---
let lastTap = 0;
const DBL_TAP_THRESHOLD = 300;

glcanvas.addEventListener('touchend', (event) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;

    if (tapLength < DBL_TAP_THRESHOLD && tapLength > 0) {
        event.preventDefault();
        toggleCamera();
    }
    lastTap = currentTime;
}, { passive: false });

glcanvas.addEventListener('dblclick', () => {
    toggleCamera();
});

function toggleCamera() {
    if (availableCameraDevices.length > 1) {
        const currentIdx = availableCameraDevices.findIndex(
            device => device.deviceId === currentCameraDeviceId
        );
        const nextIdx = (currentIdx + 1) % availableCameraDevices.length;
        const nextDeviceId = availableCameraDevices[nextIdx].deviceId;
        startCamera(nextDeviceId);
    } else {
        alert("Solo hay una cámara disponible.");
    }
}

function changePaletteIndex() {
    paletteIndex = (paletteIndex + 1) % palettes.length;
}

// Iniciar el proceso de listar cámaras y obtener el stream
listCameras();
