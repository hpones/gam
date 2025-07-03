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

// Nuevos elementos para la selección de cámara y el panel
let cameraPanel = document.getElementById('camera-panel'); // Reference to the new panel
let cameraPanelHeader = document.getElementById('camera-panel-header'); // Reference to the panel header
let minimizeCameraPanelBtn = document.getElementById('minimize-camera-panel'); // Reference to the minimize button
let cameraPanelContent = document.getElementById('camera-panel-content'); // Reference to the panel content
let cameraSelect = document.getElementById('cameraSelect');
let switchCameraButton = document.getElementById('switchCameraButton');

let currentStream;
let mediaRecorder;
let chunks = [];
let isRecording = false;
let isPaused = false;
let selectedFilter = 'none';
let currentCameraDeviceId = null; // Almacena el ID del dispositivo de la cámara actual

function applyFilter(ctx) {
  switch (selectedFilter) {
    case 'grayscale':
      ctx.filter = 'grayscale(100%)';
      break;
    case 'invert':
      ctx.filter = 'invert(100%)';
      break;
    case 'sepia':
      ctx.filter = 'sepia(100%)';
      break;
    case 'eco-pink':
    case 'weird':
      ctx.filter = 'none';
      break;
    default:
      ctx.filter = 'none';
  }
}

// Función para listar las cámaras disponibles
async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    cameraSelect.innerHTML = ''; // Limpiar opciones anteriores
    if (videoDevices.length > 0) {
      videoDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Cámara ${videoDevices.indexOf(device) + 1}`;
        cameraSelect.appendChild(option);
      });
      // Seleccionar la cámara que se está usando si ya hay una
      if (currentCameraDeviceId) {
        cameraSelect.value = currentCameraDeviceId;
      } else {
        // Si no hay una cámara seleccionada, intenta iniciar con la primera disponible
        currentCameraDeviceId = videoDevices[0].deviceId;
        cameraSelect.value = currentCameraDeviceId;
      }
      startCamera(currentCameraDeviceId); // Iniciar la cámara con la primera o la seleccionada
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
    currentCameraDeviceId = deviceId || currentStream.getVideoTracks()[0].getSettings().deviceId; // Guardar el ID de la cámara activa

    video.onloadedmetadata = () => {
      video.play();
      glcanvas.width = video.videoWidth;
      glcanvas.height = video.videoHeight;
      drawVideoFrame();
    };
  } catch (err) {
    console.error('No se pudo acceder a la cámara:', err);
    alert('No se pudo acceder a la cámara. Revisa los permisos. Error: ' + err.name);
  }
}

function drawVideoFrame() {
  const ctx = glcanvas.getContext('2d');
  function draw() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      glcanvas.width = video.videoWidth;
      glcanvas.height = video.videoHeight;
      applyFilter(ctx);
      ctx.save();

      // Determinar si la cámara es frontal o trasera para aplicar el espejo
      const videoTrack = currentStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const isFrontFacing = settings.facingMode === 'user';

      if (isFrontFacing) {
        ctx.translate(glcanvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, glcanvas.width, glcanvas.height);

      if (selectedFilter === 'eco-pink' || selectedFilter === 'weird') {
        let imageData = ctx.getImageData(0, 0, glcanvas.width, glcanvas.height);
        let data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const brightness = (r + g + b) / 3;

          if (selectedFilter === 'eco-pink') {
            if (brightness < 80) {
              const noise = (Math.random() - 0.5) * 100;
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
              data[i] = data[i] * Math.random();
              data[i + 1] = data[i + 1] * Math.random();
              data[i + 2] = data[i + 2] * Math.random();
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
      ctx.restore();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

captureBtn.addEventListener('click', () => {
  canvas.width = glcanvas.width;
  canvas.height = glcanvas.height;
  let ctx = canvas.getContext('2d');
  applyFilter(ctx);

  const videoTrack = currentStream.getVideoTracks()[0];
  const settings = videoTrack.getSettings();
  const isFrontFacing = settings.facingMode === 'user';

  if (isFrontFacing) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  let img = new Image();
  img.src = canvas.toDataURL('image/png');
  addToGallery(img, 'img');
});

recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    chunks = [];
    let streamToRecord = glcanvas.captureStream(); // Capturar el stream del canvas con los filtros
    mediaRecorder = new MediaRecorder(streamToRecord);
    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      let vid = document.createElement('video');
      vid.src = url;
      vid.controls = true;
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
  filtersDropdown.style.display =
    filtersDropdown.style.display === 'block' ? 'none' : 'block';
});

filterSelect.addEventListener('change', () => {
  selectedFilter = filterSelect.value;
  filtersDropdown.style.display = 'none';
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
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

  let deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.onclick = () => container.remove();

  actions.appendChild(downloadBtn);
  actions.appendChild(deleteBtn);
  container.appendChild(actions);

  gallery.prepend(container);
}

// Event listener para el cambio de cámara
switchCameraButton.addEventListener('click', () => {
  const selectedDeviceId = cameraSelect.value;
  if (selectedDeviceId && selectedDeviceId !== currentCameraDeviceId) {
    startCamera(selectedDeviceId);
  }
});

// Logic for the new camera panel (minimizing/maximizing)
cameraPanelHeader.addEventListener('click', () => {
  cameraPanelContent.classList.toggle('hidden');
  cameraPanel.classList.toggle('minimized');
  if (cameraPanelContent.classList.contains('hidden')) {
    minimizeCameraPanelBtn.textContent = '+'; // Change to plus when minimized
  } else {
    minimizeCameraPanelBtn.textContent = '-'; // Change to minus when maximized
  }
});

// Inicializar la lista de cámaras al cargar la página
listCameras();
