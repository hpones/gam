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
  // Los filtros de manipulación de píxeles no usan ctx.filter
  if (selectedFilter === 'eco-pink' || selectedFilter === 'weird' ||
      selectedFilter === 'invert-bw' || selectedFilter === 'thermal-camera') {
    ctx.filter = 'none';
  } else {
    switch (selectedFilter) {
      case 'grayscale':
        ctx.filter = 'grayscale(100%)';
        break;
      case 'invert': // Vuelve a ser solo invert(100%) sin slider
        ctx.filter = 'invert(100%)';
        break;
      case 'sepia':
        ctx.filter = 'sepia(100%)';
        break;
      default:
        ctx.filter = 'none';
    }
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

      // Aplicar ctx.filter si no es un filtro de manipulación de píxeles
      // Se hace antes del drawImage y el save/restore para que los efectos de CSS se apliquen
      // y luego podamos manipular los píxeles resultantes si es necesario.
      applyFilter(ctx);
      ctx.save();
      if (usingFrontCamera) {
        ctx.translate(glcanvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, glcanvas.width, glcanvas.height);
      ctx.restore(); // Restaurar el contexto después de dibujar la imagen (importante para ImageData)

      // Procesamiento de píxeles para filtros específicos
      if (selectedFilter === 'eco-pink' || selectedFilter === 'weird' ||
          selectedFilter === 'invert-bw' || selectedFilter === 'thermal-camera') {
        
        let imageData = ctx.getImageData(0, 0, glcanvas.width, glcanvas.height);
        let data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const brightness = (r + g + b) / 3;

          if (selectedFilter === 'eco-pink') {
            if (brightness < 100) {
              data[i] = Math.min(255, r + 60);
              data[i + 1] = Math.min(255, g + 80);
              data[i + 2] = Math.min(255, b + 60);
            }
          } else if (selectedFilter === 'weird') {
            if (brightness > 150) {
              data[i] = b;
              data[i + 1] = r;
              data[i + 2] = g;
            } else if (brightness < 80) {
              data[i] = (r * 0.8) + (b * 0.2);
              data[i + 1] = (g * 0.8) + (r * 0.2);
              data[i + 2] = (b * 0.8) + (g * 0.2);
            }
          } else if (selectedFilter === 'invert-bw') {
            // Negativo en blanco y negro
            const avg = (r + g + b) / 3; // Calcula el promedio para convertir a escala de grises
            data[i] = 255 - avg;     // Invierte el valor de gris para Rojo
            data[i + 1] = 255 - avg; // Invierte el valor de gris para Verde
            data[i + 2] = 255 - avg; // Invierte el valor de gris para Azul
          } else if (selectedFilter === 'thermal-camera') {
            // Simulación de cámara térmica
            // Mapping de brillo a colores (azul -> verde -> amarillo -> rojo)
            if (brightness < 50) { // Muy frío - Azul profundo
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 255 - (brightness * 5); // Más azul cuanto más oscuro
            } else if (brightness < 100) { // Frío - Azul a cian
              data[i] = 0;
              data[i + 1] = (brightness - 50) * 5; // Añade verde
              data[i + 2] = 255;
            } else if (brightness < 150) { // Templado - Cian a verde
              data[i] = 0;
              data[i + 1] = 255;
              data[i + 2] = 255 - ((brightness - 100) * 5); // Quita azul
            } else if (brightness < 200) { // Cálido - Verde a amarillo
              data[i] = (brightness - 150) * 5; // Añade rojo
              data[i + 1] = 255;
              data[i + 2] = 0;
            } else { // Muy cálido - Amarillo a rojo
              data[i] = 255;
              data[i + 1] = 255 - ((brightness - 200) * 5); // Quita verde
              data[i + 2] = 0;
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}

captureBtn.addEventListener('click', () => {
  canvas.width = glcanvas.width;
  canvas.height = glcanvas.height;
  let ctx = canvas.getContext('2d');

  // Asegurarse de que el filtro se aplique correctamente para la captura
  applyFilter(ctx);
  ctx.save();
  if (usingFrontCamera) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Si es un filtro de manipulación de píxeles, re-aplicar aquí para la captura
  if (selectedFilter === 'eco-pink' || selectedFilter === 'weird' ||
      selectedFilter === 'invert-bw' || selectedFilter === 'thermal-camera') {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;

      if (selectedFilter === 'eco-pink') {
        if (brightness < 100) {
          data[i] = Math.min(255, r + 60);
          data[i + 1] = Math.min(255, g + 80);
          data[i + 2] = Math.min(255, b + 60);
        }
      } else if (selectedFilter === 'weird') {
        if (brightness > 150) {
          data[i] = b;
          data[i + 1] = r;
          data[i + 2] = g;
        } else if (brightness < 80) {
          data[i] = (r * 0.8) + (b * 0.2);
          data[i + 1] = (g * 0.8) + (r * 0.2);
          data[i + 2] = (b * 0.8) + (g * 0.2);
        }
      } else if (selectedFilter === 'invert-bw') {
        const avg = (r + g + b) / 3;
        data[i] = 255 - avg;
        data[i + 1] = 255 - avg;
        data[i + 2] = 255 - avg;
      } else if (selectedFilter === 'thermal-camera') {
        if (brightness < 50) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 255 - (brightness * 5);
        } else if (brightness < 100) {
          data[i] = 0;
          data[i + 1] = (brightness - 50) * 5;
          data[i + 2] = 255;
        } else if (brightness < 150) {
          data[i] = 0;
          data[i + 1] = 255;
          data[i + 2] = 255 - ((brightness - 100) * 5);
        } else if (brightness < 200) {
          data[i] = (brightness - 150) * 5;
          data[i + 1] = 255;
          data[i + 2] = 0;
        } else {
          data[i] = 255;
          data[i + 1] = 255 - ((brightness - 200) * 5);
          data[i + 2] = 0;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  let img = new Image();
  img.src = canvas.toDataURL('image/png');
  addToGallery(img, 'img');
});

recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    chunks = [];
    // Para grabar los filtros de manipulación de píxeles, el stream debe capturar el canvas
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
  if (filtersDropdown.style.display === 'block') {
    filtersDropdown.style.display = 'none';
  } else {
    filtersDropdown.style.display = 'block';
    filtersDropdown.style.opacity = '0.7';
  }
});

filterSelect.addEventListener('change', () => {
  selectedFilter = filterSelect.value;
  // Ya no hay slider, así que no se necesita lógica para ocultar/mostrar invertControls
  // filtersDropdown.style.display = 'none'; // Puedes decidir si quieres que se cierre automáticamente
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    controls.style.opacity = '0.2';
    recordingControls.style.opacity = '0.2';
    if (filtersDropdown.style.display === 'block') {
      filtersDropdown.style.opacity = '0.2';
    }
  } else {
    document.exitFullscreen();
    controls.style.opacity = '1';
    recordingControls.style.opacity = '1';
    if (filtersDropdown.style.display === 'block') {
      filtersDropdown.style.opacity = '0.7';
    }
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
