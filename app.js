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

let currentStream;
let mediaRecorder;
let chunks = [];
let isRecording = false;
let isPaused = false;
let usingFrontCamera = true;
let selectedFilter = 'none';

function applyFilter(ctx) {
  switch (selectedFilter) {
    case 'grayscale':
      ctx.filter = 'grayscale(100%)';
      break;
    case 'invert':
      ctx.filter = 'invert(100%)'; // Eliminado solarize para asegurar visibilidad
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

async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: usingFrontCamera ? 'user' : 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: true
    });

    video.srcObject = currentStream;

    video.onloadedmetadata = () => {
      video.play();
      glcanvas.width = video.videoWidth;
      glcanvas.height = video.videoHeight;
      drawVideoFrame();
    };
  } catch (err) {
      console.error('No se pudo acceder a la cámara:', err);
      alert('No se pudo acceder a la cámara. Revisa los permisos.');
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
      if (usingFrontCamera) {
        ctx.translate(glcanvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, glcanvas.width, glcanvas.height);

      if (selectedFilter === 'eco-pink' || selectedFilter === 'weird') {
        // Reducir el área de procesamiento para mejorar la fluidez
        const processWidth = glcanvas.width; // Se mantiene el ancho completo para no distorsionar demasiado
        const processHeight = glcanvas.height; // Se mantiene el alto completo
        let imageData = ctx.getImageData(0, 0, processWidth, processHeight);
        let data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const brightness = (r + g + b) / 3;

          if (selectedFilter === 'eco-pink') {
            if (brightness < 100) { // Umbral ligeramente ajustado para balance
              // Colores más simples para fluidez: verdes/rosas básicos
              data[i] = Math.min(255, r + 60); // Rojo
              data[i + 1] = Math.min(255, g + 80); // Verde (más prominente)
              data[i + 2] = Math.min(255, b + 60); // Azul
            }
          } else if (selectedFilter === 'weird') {
            // Paleta de colores fríos y complementarios simplificada
            if (brightness > 150) { // Umbral ajustado
              // Intercambio de colores básicos para un efecto de color frío
              data[i] = b; // Rojo <- Azul
              data[i + 1] = r; // Verde <- Rojo
              data[i + 2] = g; // Azul <- Verde
            } else if (brightness < 80) { // Umbral ajustado
              // Ligero difuminado y ajuste de color en zonas oscuras (menos intensivo)
              data[i] = (r * 0.8) + (b * 0.2); // Mezcla para tonos azulados/verdosos
              data[i + 1] = (g * 0.8) + (r * 0.2);
              data[i + 2] = (b * 0.8) + (g * 0.2);
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
  if (usingFrontCamera) {
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
    let stream = glcanvas.captureStream();
    mediaRecorder = new MediaRecorder(stream);
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
    // Ajustar opacidad de los controles cuando está en pantalla completa
    controls.style.opacity = '0.2';
    recordingControls.style.opacity = '0.2';
  } else {
    document.exitFullscreen();
    // Restaurar opacidad de los controles al salir de pantalla completa
    controls.style.opacity = '1';
    recordingControls.style.opacity = '1';
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

video.addEventListener('dblclick', () => {
  usingFrontCamera = !usingFrontCamera;
  startCamera();
});

startCamera();
