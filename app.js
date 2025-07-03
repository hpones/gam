let video = document.getElementById('video');
let glcanvas = document.getElementById('glcanvas');
let canvas = document.getElementById('canvas');
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

// Eliminar referencias a los elementos del panel de cámara
// let cameraPanel = document.getElementById('camera-panel');
// let cameraPanelHeader = document.getElementById('camera-panel-header');
// let minimizeCameraPanelBtn = document.getElementById('minimize-camera-panel');
// let cameraPanelContent = document.getElementById('camera-panel-content');
// let cameraSelect = document.getElementById('cameraSelect'); // ¡Mantener esta para la lista interna!
// let switchCameraButton = document.getElementById('switchCameraButton'); // ¡Eliminar esta!

let currentStream;
let mediaRecorder;
let chunks = [];
let isRecording = false;
let isPaused = false;
let selectedFilter = 'none';
let currentCameraDeviceId = null;
let currentFacingMode = null;

// Variables para el arrastre del panel - ELIMINAR YA NO ES NECESARIO
// let isDragging = false;
// let offsetX, offsetY;

// Cache del contexto 2D del glcanvas
const glContext = glcanvas.getContext('2d');

// Array para almacenar los IDs de las cámaras disponibles
let availableCameraDevices = [];


function applyFilterToContext(ctx, filterType) {
  // ... (Esta función se mantiene igual) ...
  switch (filterType) {
    case 'grayscale':
      ctx.filter = 'grayscale(100%)';
      break;
    case 'invert':
      ctx.filter = 'invert(100%)';
      break;
    case 'sepia':
      ctx.filter = 'sepia(100%)';
      break;
    default:
      ctx.filter = 'none';
  }
}

async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    availableCameraDevices = videoDevices; // Almacenar los dispositivos de cámara
    
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
      }
      drawVideoFrame();
    };
  } catch (err) {
    console.error('No se pudo acceder a la cámara:', err);
    alert('No se pudo acceder a la cámara. Revisa los permisos. Error: ' + err.name);
  }
}

function drawVideoFrame() {
  // ... (Esta función se mantiene igual, ya está optimizada) ...
  if (glcanvas.width !== video.videoWidth || glcanvas.height !== video.videoHeight) {
    glcanvas.width = video.videoWidth;
    glcanvas.height = video.videoHeight;
  }

  if (selectedFilter !== 'eco-pink' && selectedFilter !== 'weird') {
    applyFilterToContext(glContext, selectedFilter);
  } else {
    glContext.filter = 'none';
  }

  glContext.save();

  const isFrontFacing = currentFacingMode === 'user' || currentFacingMode === 'unknown';

  if (isFrontFacing) {
    glContext.translate(glcanvas.width, 0);
    glContext.scale(-1, 1);
  }
  glContext.drawImage(video, 0, 0, glcanvas.width, glcanvas.height);

  if (selectedFilter === 'eco-pink' || selectedFilter === 'weird') {
    let imageData = glContext.getImageData(0, 0, glcanvas.width, glcanvas.height);
    let data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;

      if (selectedFilter === 'eco-pink') {
        if (brightness < 80) {
          data[i] = Math.min(255, r + 80);
          data[i + 1] = Math.max(0, g - 50);
          data[i + 2] = Math.min(255, b + 100);
        }
      } else if (selectedFilter === 'weird') {
        if (brightness > 180) {
          data[i] = b;
          data[i + 1] = r;
          data[i + 2] = g;
        } else if (brightness < 100) {
          data[i] = data[i] * 0.5;
          data[i + 1] = data[i + 1] * 0.5;
          data[i + 2] = data[i + 2] * 0.5;
        }
      }
    }
    glContext.putImageData(imageData, 0, 0);
  }
  glContext.restore();
  requestAnimationFrame(drawVideoFrame);
}

captureBtn.addEventListener('click', () => {
  // ... (Esta función se mantiene igual) ...
  canvas.width = glcanvas.width;
  canvas.height = glcanvas.height;
  let ctx = canvas.getContext('2d');

  if (selectedFilter === 'eco-pink' || selectedFilter === 'weird') {
    ctx.filter = 'none';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;

      if (selectedFilter === 'eco-pink') {
        if (brightness < 80) {
          data[i] = Math.min(255, r + 80);
          data[i + 1] = Math.max(0, g - 50);
          data[i + 2] = Math.min(255, b + 100);
        }
      } else if (selectedFilter === 'weird') {
        if (brightness > 180) {
          data[i] = b;
          data[i + 1] = r;
          data[i + 2] = g;
        } else if (brightness < 100) {
          data[i] = data[i] * 0.5;
          data[i + 1] = data[i + 1] * 0.5;
          data[i + 2] = data[i + 2] * 0.5;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

  } else {
    applyFilterToContext(ctx, selectedFilter);
    const isFrontFacing = currentFacingMode === 'user' || currentFacingMode === 'unknown';
    if (isFrontFacing) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  let img = new Image();
  img.src = canvas.toDataURL('image/png');
  addToGallery(img, 'img');
});

recordBtn.addEventListener('click', () => {
  // ... (Esta función se mantiene igual) ...
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
  // ... (Esta función se mantiene igual) ...
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
  // ... (Esta función se mantiene igual) ...
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
  // ... (Esta función se mantiene igual, ya tiene la revocación de URL) ...
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

  let deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.onclick = () => {
    if (type === 'video' && element.src.startsWith('blob:')) {
      URL.revokeObjectURL(element.src);
    }
    container.remove();
  };

  actions.appendChild(downloadBtn);
  actions.appendChild(deleteBtn);
  container.appendChild(actions);

  gallery.prepend(container);
}

// ELIMINAR ESTA LÓGICA DEL PANEL
// cameraPanelHeader.addEventListener('click', (e) => { ... });
// cameraPanel.addEventListener('mousedown', (e) => { ... });
// document.addEventListener('mousemove', (e) => { ... });
// document.addEventListener('mouseup', () => { ... });

// *** NUEVA LÓGICA: GESTO DE DOBLE CLICK PARA CAMBIAR DE CÁMARA ***
video.addEventListener('dblclick', () => {
  if (availableCameraDevices.length > 1) {
    const currentIdx = availableCameraDevices.findIndex(
      device => device.deviceId === currentCameraDeviceId
    );
    const nextIdx = (currentIdx + 1) % availableCameraDevices.length;
    const nextDeviceId = availableCameraDevices[nextIdx].deviceId;
    startCamera(nextDeviceId);
  } else {
    console.log("Solo hay una cámara disponible.");
    // Opcional: Mostrar un mensaje al usuario.
  }
});

listCameras();
