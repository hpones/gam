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
let usingFrontCamera = true; // Variable para controlar qué cámara se está usando
let selectedFilter = 'none';

/**
 * Aplica el filtro seleccionado al contexto del lienzo.
 * @param {CanvasRenderingContext2D} ctx - El contexto de renderizado 2D del lienzo.
 */
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
      ctx.filter = 'none'; // Estos filtros se manejan a nivel de píxel
      break;
    default:
      ctx.filter = 'none';
  }
}

/**
 * Inicia la transmisión de la cámara.
 * Detiene cualquier transmisión existente antes de iniciar una nueva.
 */
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop()); // Detiene las pistas de la cámara actual
  }

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: usingFrontCamera ? 'user' : 'environment', // 'user' para frontal, 'environment' para trasera
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
      drawVideoFrame(); // Comienza a dibujar los fotogramas en el lienzo
    };
  } catch (err) {
    console.error('No se pudo acceder a la cámara:', err);
    alert('No se pudo acceder a la cámara. Revisa los permisos.');
  }
}

/**
 * Dibuja los fotogramas del video en el lienzo con filtros aplicados.
 * Esto crea el efecto de filtro en tiempo real.
 */
function drawVideoFrame() {
  const ctx = glcanvas.getContext('2d');
  function draw() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      glcanvas.width = video.videoWidth;
      glcanvas.height = video.videoHeight;
      applyFilter(ctx); // Aplica filtros CSS
      ctx.save();
      if (usingFrontCamera) {
        // Voltea horizontalmente para la cámara frontal para que no se vea como un espejo
        ctx.translate(glcanvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, glcanvas.width, glcanvas.height);

      // Lógica para filtros de píxeles personalizados
      if (selectedFilter === 'eco-pink' || selectedFilter === 'weird') {
        let imageData = ctx.getImageData(0, 0, glcanvas.width, glcanvas.height);
        let data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const brightness = (r + g + b) / 3;

          if (selectedFilter === 'eco-pink') {
            if (brightness < 80) {
              data[i] = Math.min(255, r + 80);      // Aumenta rojo
              data[i + 1] = Math.max(0, g - 50);    // Disminuye verde
              data[i + 2] = Math.min(255, b + 100); // Aumenta azul
            }
          } else if (selectedFilter === 'weird') {
            if (brightness > 180) { // Colores claros
              data[i] = b;          // Swaps R and B
              data[i + 1] = r;      // Swaps G and R
              data[i + 2] = g;      // Swaps B and G
            } else if (brightness < 100) { // Colores oscuros
              data[i] = data[i] * Math.random();
              data[i + 1] = data[i + 1] * Math.random();
              data[i + 2] = data[i + 2] * Math.random();
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
      ctx.restore(); // Restaura el estado del contexto (deshace el volteo)
    }
    requestAnimationFrame(draw); // Solicita el siguiente fotograma
  }
  draw();
}

// --- Manejadores de Eventos ---

// Capturar foto
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

// Iniciar grabación
recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    chunks = [];
    let stream = glcanvas.captureStream(); // Captura el stream del lienzo con los filtros aplicados
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

// Pausar/Reanudar grabación
pauseBtn.addEventListener('click', () => {
  if (isPaused) {
    mediaRecorder.resume();
    pauseBtn.textContent = '⏸️'; // Símbolo de pausa
  } else {
    mediaRecorder.pause();
    pauseBtn.textContent = '▶️'; // Símbolo de reproducción
  }
  isPaused = !isPaused;
});

// Detener grabación
stopBtn.addEventListener('click', () => {
  mediaRecorder.stop();
  isRecording = false;
  controls.style.display = 'flex';
  recordingControls.style.display = 'none';
});

// Mostrar/Ocultar menú de filtros
filterBtn.addEventListener('click', () => {
  filtersDropdown.style.display =
    filtersDropdown.style.display === 'block' ? 'none' : 'block';
});

// Seleccionar filtro
filterSelect.addEventListener('change', () => {
  selectedFilter = filterSelect.value;
  filtersDropdown.style.display = 'none';
});

// Modo pantalla completa
fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

/**
 * Agrega un elemento (imagen o video) a la galería.
 * @param {HTMLImageElement | HTMLVideoElement} element - El elemento a añadir.
 * @param {'img' | 'video'} type - El tipo de elemento ('img' o 'video').
 */
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

  gallery.prepend(container); // Añade al principio de la galería
}

// --- Nueva funcionalidad: Doble clic para cambiar de cámara ---
video.addEventListener('dblclick', () => {
  // Invierte el valor de usingFrontCamera (si es true, se vuelve false; si es false, se vuelve true)
  usingFrontCamera = !usingFrontCamera;
  // Reinicia la cámara con el nuevo modo de orientación (frontal/trasera)
  startCamera();
});

// --- Inicio de la aplicación ---
// Inicia la cámara automáticamente cuando la página carga
startCamera();
