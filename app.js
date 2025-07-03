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
let cameraContainer = document.getElementById('camera-container'); // Nueva referencia para el contenedor de la cámara

// Nuevos elementos para la selección de cámara y el panel
let cameraPanel = document.getElementById('camera-panel');
let cameraPanelHeader = document.getElementById('camera-panel-header');
let minimizeCameraPanelBtn = document.getElementById('minimize-camera-panel');
let cameraPanelContent = document.getElementById('camera-panel-content');
let cameraSelect = document.getElementById('cameraSelect');
let switchCameraButton = document.getElementById('switchCameraButton');

let currentStream;
let mediaRecorder;
let chunks = [];
let isRecording = false;
let isPaused = false;
let selectedFilter = 'none';
let currentCameraDeviceId = null;

// Variables para el arrastre del panel
let isDragging = false;
let offsetX, offsetY;

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

// Función para listar todas las cámaras disponibles en el dispositivo
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

      // Si no hay una cámara seleccionada, o si la cámara actual ya no está disponible,
      // selecciona la primera disponible.
      if (!currentCameraDeviceId || !videoDevices.some(d => d.deviceId === currentCameraDeviceId)) {
        currentCameraDeviceId = videoDevices[0].deviceId;
      }
      cameraSelect.value = currentCameraDeviceId; // Asegura que el select muestre la cámara activa
      startCamera(currentCameraDeviceId); // Iniciar la cámara con la seleccionada
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
      deviceId: deviceId ? { exact: deviceId } : undefined, // Usa el ID de dispositivo exacto
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: true
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    currentCameraDeviceId = deviceId || currentStream.getVideoTracks()[0].getSettings().deviceId;

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

      const videoTrack = currentStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      // 'user' para cámara frontal, 'environment' para trasera.
      // Si facingMode no está disponible o es 'user', asumimos frontal y aplicamos espejo.
      const isFrontFacing = settings.facingMode === 'user' || !settings.facingMode;

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
  const isFrontFacing = settings.facingMode === 'user' || !settings.facingMode;

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
    let streamToRecord = glcanvas.captureStream();
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
    cameraContainer.requestFullscreen(); // Entra en fullscreen el contenedor principal
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

// Lógica para el panel de cámara (minimizar/maximizar)
cameraPanelHeader.addEventListener('click', (e) => {
  // Evitar que el click en el header para minimizar/maximizar inicie el arrastre
  if (e.target.id === 'minimize-camera-panel' || e.target.tagName === 'SPAN') {
    cameraPanelContent.classList.toggle('hidden');
    cameraPanel.classList.toggle('minimized');
    if (cameraPanelContent.classList.contains('hidden')) {
      minimizeCameraPanelBtn.textContent = '+';
    } else {
      minimizeCameraPanelBtn.textContent = '-';
    }
  }
});

// Lógica para arrastrar el panel de cámara
cameraPanel.addEventListener('mousedown', (e) => {
  // Solo arrastrar si no se hizo click en el select o el botón de cambiar cámara
  if (e.target.id !== 'cameraSelect' && e.target.id !== 'switchCameraButton') {
    isDragging = true;
    offsetX = e.clientX - cameraPanel.getBoundingClientRect().left;
    offsetY = e.clientY - cameraPanel.getBoundingClientRect().top;
    cameraPanel.style.cursor = 'grabbing';
  }
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  // Calcula las nuevas posiciones
  let newX = e.clientX - offsetX;
  let newY = e.clientY - offsetY;

  // Limita el arrastre dentro del contenedor de la cámara
  const containerRect = cameraContainer.getBoundingClientRect();
  const panelRect = cameraPanel.getBoundingClientRect();

  // Limitar en X
  if (newX < 0) newX = 0;
  if (newX + panelRect.width > containerRect.width) newX = containerRect.width - panelRect.width;

  // Limitar en Y
  if (newY < 0) newY = 0;
  if (newY + panelRect.height > containerRect.height) newY = containerRect.height - panelRect.height;


  cameraPanel.style.left = newX + 'px';
  cameraPanel.style.top = newY + 'px';
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  cameraPanel.style.cursor = 'grab';
});


// Inicializar la lista de cámaras al cargar la página
listCameras();
