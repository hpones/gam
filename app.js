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
let currentFacingMode = null; // Para optimizar la detección del espejo de la cámara

let isDragging = false;
let offsetX, offsetY;

// Cache del contexto 2D del glcanvas para evitar obtenerlo en cada frame
const glContext = glcanvas.getContext('2d');

function applyFilterToContext(ctx, filterType) {
  // Aplicar filtros CSS nativos directamente al contexto
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

// Función para listar todas las cámaras disponibles en el dispositivo
async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    cameraSelect.innerHTML = '';
    if (videoDevices.length > 0) {
      videoDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Cámara ${videoDevices.indexOf(device) + 1}`;
        cameraSelect.appendChild(option);
      });

      if (!currentCameraDeviceId || !videoDevices.some(d => d.deviceId === currentCameraDeviceId)) {
        currentCameraDeviceId = videoDevices[0].deviceId;
      }
      cameraSelect.value = currentCameraDeviceId;
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
    currentFacingMode = settings.facingMode || 'unknown'; // Cache facingMode

    video.onloadedmetadata = () => {
      video.play();
      // Solo redimensionar el canvas si sus dimensiones cambian
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
  // Solo actualiza las dimensiones del canvas si el video cambia de tamaño (poco común después de loadedmetadata)
  if (glcanvas.width !== video.videoWidth || glcanvas.height !== video.videoHeight) {
    glcanvas.width = video.videoWidth;
    glcanvas.height = video.videoHeight;
  }

  // Aplicar filtros CSS si no son los filtros de píxeles personalizados
  if (selectedFilter !== 'eco-pink' && selectedFilter !== 'weird') {
    applyFilterToContext(glContext, selectedFilter);
  } else {
    // Si es un filtro personalizado de píxeles, asegúrate de que el filtro CSS nativo esté en 'none'
    glContext.filter = 'none';
  }

  glContext.save();

  // 'user' para cámara frontal, 'environment' para trasera. Si facingMode no está disponible o es 'user', asumimos frontal y aplicamos espejo.
  const isFrontFacing = currentFacingMode === 'user' || currentFacingMode === 'unknown';

  if (isFrontFacing) {
    glContext.translate(glcanvas.width, 0);
    glContext.scale(-1, 1);
  }
  glContext.drawImage(video, 0, 0, glcanvas.width, glcanvas.height);

  // Aplicar filtros de píxeles personalizados
  if (selectedFilter === 'eco-pink' || selectedFilter === 'weird') {
    let imageData = glContext.getImageData(0, 0, glcanvas.width, glcanvas.height);
    let data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;

      if (selectedFilter === 'eco-pink') {
        if (brightness < 80) {
          // Valores fijos en lugar de Math.random() para consistencia y rendimiento en cada frame
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
          // Valores fijos o precalculados para evitar Math.random() en cada frame
          // Si necesitas variación, considérala fuera del bucle de cada frame o con un generador de ruido predecible
          data[i] = data[i] * 0.5; // Ejemplo de valor fijo
          data[i + 1] = data[i + 1] * 0.5;
          data[i + 2] = data[i + 2] * 0.5;
        }
      }
    }
    glContext.putImageData(imageData, 0, 0);
  }
  glContext.restore();
  requestAnimationFrame(drawVideoFrame); // Se llama a sí misma para el siguiente frame
}

captureBtn.addEventListener('click', () => {
  canvas.width = glcanvas.width;
  canvas.height = glcanvas.height;
  let ctx = canvas.getContext('2d');

  // Aplicar filtros de píxeles personalizados si es el caso, de lo contrario aplicar el CSS filter
  if (selectedFilter === 'eco-pink' || selectedFilter === 'weird') {
    ctx.filter = 'none'; // Asegurarse de que no haya filtros CSS nativos
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height); // Dibujar primero sin filtro CSS
    // Procesar los píxeles directamente
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
    applyFilterToContext(ctx, selectedFilter); // Aplicar filtro CSS nativo
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
  if (!isRecording) {
    chunks = [];
    // Capturar el stream del canvas con los filtros aplicados por el glContext
    let streamToRecord = glcanvas.captureStream();
    mediaRecorder = new MediaRecorder(streamToRecord, { mimeType: 'video/webm; codecs=vp8' }); // Especificar codec para mejor compatibilidad

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      let vid = document.createElement('video');
      vid.src = url;
      vid.controls = true;
      // Añadir evento para revocar la URL del objeto cuando el video se cargue o se elimine del DOM
      vid.onloadedmetadata = () => {
        vid.play(); // Reproducir automáticamente si lo deseas
      };
      // Aquí el URL se revocará cuando el elemento de video sea removido del DOM por la función `deleteBtn.onclick`
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
  // Alternar la visibilidad de manera más eficiente
  filtersDropdown.style.display = (filtersDropdown.style.display === 'block') ? 'none' : 'block';
});

filterSelect.addEventListener('change', () => {
  selectedFilter = filterSelect.value;
  filtersDropdown.style.display = 'none';
  // Redibujar inmediatamente para aplicar el filtro al canvas de GL
  // (aunque drawVideoFrame ya lo hará en el siguiente requestAnimationFrame)
  // No es estrictamente necesario, pero asegura que el cambio sea instantáneo.
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

  let deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.onclick = () => {
    // Revocar la URL del objeto al eliminar el elemento de la galería
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

switchCameraButton.addEventListener('click', () => {
  const selectedDeviceId = cameraSelect.value;
  if (selectedDeviceId && selectedDeviceId !== currentCameraDeviceId) {
    startCamera(selectedDeviceId);
  }
});

cameraPanelHeader.addEventListener('click', (e) => {
  if (e.target.id === 'minimize-camera-panel' || e.target.tagName === 'SPAN') {
    cameraPanelContent.classList.toggle('hidden');
    cameraPanel.classList.toggle('minimized');
    minimizeCameraPanelBtn.textContent = cameraPanelContent.classList.contains('hidden') ? '+' : '-';
  }
});

// Lógica para arrastrar el panel de cámara
cameraPanel.addEventListener('mousedown', (e) => {
  if (e.target.id !== 'cameraSelect' && e.target.id !== 'switchCameraButton' && e.target.parentNode !== cameraPanelContent) {
    isDragging = true;
    offsetX = e.clientX - cameraPanel.getBoundingClientRect().left;
    offsetY = e.clientY - cameraPanel.getBoundingClientRect().top;
    cameraPanel.style.cursor = 'grabbing';
    e.preventDefault(); // Evitar selección de texto u otros comportamientos por defecto
  }
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  let newX = e.clientX - offsetX;
  let newY = e.clientY - offsetY;

  const containerRect = cameraContainer.getBoundingClientRect();
  const panelRect = cameraPanel.getBoundingClientRect();

  // Limitar arrastre para que el panel no salga del contenedor
  newX = Math.max(0, Math.min(newX, containerRect.width - panelRect.width));
  newY = Math.max(0, Math.min(newY, containerRect.height - panelRect.height));

  cameraPanel.style.left = newX + 'px';
  cameraPanel.style.top = newY + 'px';
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  cameraPanel.style.cursor = 'grab';
});

listCameras();
