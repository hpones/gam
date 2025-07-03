let video = document.getElementById('video');
let glcanvas = document.getElementById('glcanvas');
let canvas = document.getElementById('canvas'); // Para la captura de imágenes estáticas
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
let cameraContainer = document.getElementById('camera-container');

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

// Shaders GLSL (en cadenas de texto)
const vsSource = `
    attribute vec4 a_position;
    attribute vec2 a_texCoord;

    varying vec2 v_texCoord;

    void main() {
        gl_Position = a_position;
        v_texCoord = a_texCoord;
    }
`;

const fsSource = `
    precision mediump float;

    uniform sampler2D u_image;
    uniform bool u_flipX;
    uniform int u_filterType;

    varying vec2 v_texCoord;

    const int FILTER_NONE = 0;
    const int FILTER_GRAYSCALE = 1;
    const int FILTER_INVERT = 2;
    const int FILTER_SEPIA = 3;
    const int FILTER_ECO_PINK = 4;
    const int FILTER_WEIRD = 5;

    void main() {
        vec2 texCoord = v_texCoord;
        if (u_flipX) {
            texCoord.x = 1.0 - texCoord.x;
        }
        vec4 color = texture2D(u_image, texCoord);

        if (u_filterType == FILTER_GRAYSCALE) {
            float brightness = (color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722);
            color = vec4(brightness, brightness, brightness, color.a);
        } else if (u_filterType == FILTER_INVERT) {
            color = vec4(1.0 - color.r, 1.0 - color.g, 1.0 - color.b, color.a);
        } else if (u_filterType == FILTER_SEPIA) {
            float r = color.r;
            float g = color.g;
            float b = color.b;
            color.r = (r * 0.393) + (g * 0.769) + (b * 0.189);
            color.g = (r * 0.349) + (g * 0.686) + (b * 0.168);
            color.b = (r * 0.272) + (g * 0.534) + (b * 0.131);
            color = clamp(color, 0.0, 1.0);
        } else if (u_filterType == FILTER_ECO_PINK) {
            float brightness = (color.r + color.g + color.b) / 3.0;
            if (brightness < 0.3137) { // 80 / 255 = 0.3137
                color.r = min(1.0, color.r + (80.0/255.0));
                color.g = max(0.0, color.g - (50.0/255.0));
                color.b = min(1.0, color.b + (100.0/255.0));
            }
        } else if (u_filterType == FILTER_WEIRD) {
            float brightness = (color.r + color.g + color.b) / 3.0;
            if (brightness > 0.7058) { // 180 / 255 = 0.7058
                float temp_r = color.r;
                color.r = color.b;
                color.b = color.g;
                color.g = temp_r;
            } else if (brightness < 0.3921) { // 100 / 255 = 0.3921
                color.rgb *= 0.5;
            }
        }
        gl_FragColor = color;
    }
`;

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

function setupVideoTexture(gl) {
    videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function updateVideoTexture(gl, video) {
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
}

function initWebGL() {
    gl = glcanvas.getContext('webgl');
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

    gl.enableVertexAttribArray(program.positionLocation);
    gl.enableVertexAttribArray(program.texCoordLocation);

    setupQuadBuffers(gl);
    setupVideoTexture(gl);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(program.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(program.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(program.imageLocation, 0);
    gl.uniform1i(filterTypeLocation, 0); // 0 = FILTER_NONE
}

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

    video.onloadedmetadata = () => {
      video.play();
      if (glcanvas.width !== video.videoWidth || glcanvas.height !== video.videoHeight) {
        glcanvas.width = video.videoWidth;
        glcanvas.height = video.videoHeight;
        if (gl) {
          gl.viewport(0, 0, glcanvas.width, glcanvas.height);
        }
      }
      if (!gl) {
        initWebGL();
      }
      drawVideoFrame();
    };
  } catch (err) {
    console.error('No se pudo acceder a la cámara:', err);
    alert('No se pudo acceder a la cámara. Revisa los permisos. Error: ' + err.name);
  }
}

function drawVideoFrame() {
    if (!gl || !program || !video.srcObject) {
        requestAnimationFrame(drawVideoFrame);
        return;
    }

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        updateVideoTexture(gl, video);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

        const isFrontFacing = currentFacingMode === 'user';
        gl.uniform1i(program.flipXLocation, isFrontFacing ? 1 : 0);

        let filterIndex = 0;
        switch (selectedFilter) {
            case 'grayscale': filterIndex = 1; break;
            case 'invert': filterIndex = 2; break;
            case 'sepia': filterIndex = 3; break;
            case 'eco-pink': filterIndex = 4; break;
            case 'weird': filterIndex = 5; break;
            default: filterIndex = 0; break;
        }
        gl.uniform1i(filterTypeLocation, filterIndex);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    requestAnimationFrame(drawVideoFrame);
}

// --- MANEJADORES DE EVENTOS ---
captureBtn.addEventListener('click', () => {
    if (!gl || !glcanvas.width || !glcanvas.height) {
        console.error('WebGL no está inicializado o el canvas no tiene dimensiones.');
        return;
    }

    // Leer los píxeles directamente del glcanvas (WebGL)
    const pixels = new Uint8Array(glcanvas.width * glcanvas.height * 4);
    gl.readPixels(0, 0, glcanvas.width, glcanvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Crear un canvas 2D temporal para dibujar y obtener la URL de la imagen
    canvas.width = glcanvas.width;
    canvas.height = glcanvas.height;
    let ctx = canvas.getContext('2d');

    // WebGL lee los píxeles del origen inferior izquierdo, mientras que canvas 2D dibuja desde
    // el origen superior izquierdo. Necesitamos invertir el eje Y.
    const imageData = ctx.createImageData(glcanvas.width, glcanvas.height);
    for (let y = 0; y < glcanvas.height; y++) {
        for (let x = 0; x < glcanvas.width; x++) {
            const gl_idx = (y * glcanvas.width + x) * 4;
            const ctx_idx = ((glcanvas.height - 1 - y) * glcanvas.width + x) * 4; // Invertir Y

            imageData.data[ctx_idx + 0] = pixels[gl_idx + 0]; // R
            imageData.data[ctx_idx + 1] = pixels[gl_idx + 1]; // G
            imageData.data[ctx_idx + 2] = pixels[gl_idx + 2]; // B
            imageData.data[ctx_idx + 3] = pixels[gl_idx + 3]; // A
        }
    }
    ctx.putImageData(imageData, 0, 0);

    let img = new Image();
    img.src = canvas.toDataURL('image/png');
    addToGallery(img, 'img');
});


recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    chunks = [];
    let streamToRecord = glcanvas.captureStream();
    mediaRecorder = new MediaRecorder(streamToRecord, { mimeType: 'video/webm; codecs=vp8' });

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      let vid = document.createElement('video');
      vid.src = url;
      vid.controls = true;
      vid.onloadedmetadata = () => {
        vid.play();
      };
      addToGallery(vid, 'video');
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
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    cameraContainer.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

function addToGallery(element, type) {
  let container = document.createElement('div');
  container.className = 'gallery-item';
  container.appendChild(element);

  let actions = document.createElement('div');
  actions.className = 'gallery-actions';

  let downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'Descargar';
  downloadBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = element.src;
    a.download = type === 'img' ? 'foto.png' : 'video.webm';
    a.click();
  };

  let shareBtn = document.createElement('button');
  shareBtn.textContent = 'Compartir';
  shareBtn.onclick = async () => {
    if (navigator.share) {
      try {
        const file = await fetch(element.src).then(res => res.blob());
        const fileName = type === 'img' ? 'foto.png' : 'video.webm';
        const fileType = type === 'img' ? 'image/png' : 'video/webm';
        const shareData = {
          files: [new File([file], fileName, { type: fileType })],
          title: 'Mi creación desde Experimental Camera',
          text: '¡Echa un vistazo a lo que hice con Experimental Camera!'
        };
        await navigator.share(shareData);
        console.log('Contenido compartido exitosamente');
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
    if (type === 'video' && element.src.startsWith('blob:')) {
      URL.revokeObjectURL(element.src);
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

// --- LÓGICA DE DOBLE TAP PARA CAMBIAR DE CÁMARA (para móviles) ---
let lastTap = 0;
const DBL_TAP_THRESHOLD = 300;

// Aquí la corrección con { passive: false } para touchend
glcanvas.addEventListener('touchend', (event) => {
    // console.log("Touchend en glcanvas"); // Para depuración
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;

    if (tapLength < DBL_TAP_THRESHOLD && tapLength > 0) {
        // console.log("Doble tap detectado!"); // Para depuración
        event.preventDefault(); // Prevenir el zoom predeterminado

        if (availableCameraDevices.length > 1) {
            const currentIdx = availableCameraDevices.findIndex(
                device => device.deviceId === currentCameraDeviceId
            );
            const nextIdx = (currentIdx + 1) % availableCameraDevices.length;
            const nextDeviceId = availableCameraDevices[nextIdx].deviceId;
            startCamera(nextDeviceId);
        } else {
            console.log("Solo hay una cámara disponible para cambiar.");
        }
    }
    lastTap = currentTime;
}, { passive: false }); // <--- Importante: { passive: false }

// Evento dblclick en glcanvas
glcanvas.addEventListener('dblclick', () => {
    // console.log("Doble click detectado!"); // Para depuración
    if (availableCameraDevices.length > 1) {
        const currentIdx = availableCameraDevices.findIndex(
            device => device.deviceId === currentCameraDeviceId
        );
        const nextIdx = (currentIdx + 1) % availableCameraDevices.length;
        const nextDeviceId = availableCameraDevices[nextIdx].deviceId;
        startCamera(nextDeviceId);
    } else {
        console.log("Solo hay una cámara disponible para cambiar.");
    }
});

listCameras();
