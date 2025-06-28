let video = document.getElementById('video');
let glcanvas = document.getElementById('glcanvas');
let canvas = document.getElementById('canvas');
let bufferCanvas = document.getElementById('bufferCanvas'); // Nuevo: Referencia al buffer canvas
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
  // Los filtros de manipulación de píxeles y 'long-exposure' no usan ctx.filter
  if (selectedFilter === 'eco-pink' || selectedFilter === 'weird' ||
      selectedFilter === 'invert-bw' || selectedFilter === 'thermal-camera' ||
      selectedFilter === 'long-exposure') {
    ctx.filter = 'none';
  } else {
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
      bufferCanvas.width = video.videoWidth; // Ajustar tamaño del buffer canvas
      bufferCanvas.height = video.videoHeight; // Ajustar tamaño del buffer canvas
      drawVideoFrame();
    };
  } catch (err) {
      console.error('No se pudo acceder a la cámara:', err);
      alert('No se pudo acceder a la cámara. Revisa los permisos.');
  }
}

function drawVideoFrame() {
  const ctx = glcanvas.getContext('2d');
  const bufferCtx = bufferCanvas.getContext('2d'); // Nuevo: Contexto del buffer canvas

  function draw() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      glcanvas.width = video.videoWidth;
      glcanvas.height = video.videoHeight;

      if (selectedFilter === 'long-exposure') {
        // Lógica para el efecto de larga exposición
        // 1. Dibuja el contenido del buffer (el frame anterior con estela) en el glcanvas con opacidad.
        ctx.globalAlpha = 0.9; // Opacidad de la estela (ajusta para más/menos estela)
        ctx.drawImage(bufferCanvas, 0, 0, glcanvas.width, glcanvas.height);
        
        // 2. Restaura la opacidad y dibuja el frame de video actual sobre el glcanvas.
        ctx.globalAlpha = 1.0;
        ctx.save();
        if (usingFrontCamera) {
          ctx.translate(glcanvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, glcanvas.width, glcanvas.height);
        ctx.restore();

        // 3. Copia el estado actual del glcanvas (frame actual + estela) al bufferCanvas para el siguiente frame.
        bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
        bufferCtx.drawImage(glcanvas, 0, 0, bufferCanvas.width, bufferCanvas.height);

      } else {
        // Lógica normal para otros filtros (CSS y manipulación de píxeles)
        applyFilter(ctx); // Aplica filtros CSS si corresponde
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

  // Para la captura, simplemente dibujamos el estado actual del glcanvas (ya con estelas si aplica)
  ctx.drawImage(glcanvas, 0, 0, canvas.width, canvas.height);

  // Si es un filtro de manipulación de píxeles (excepto long-exposure, que ya está en glcanvas)
  // debemos aplicar la lógica para la imagen capturada.
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
  // Al cambiar de filtro, para "long-exposure" necesitamos limpiar el bufferCanvas
  // y reestablecer globalAlpha
  const bCtx = bufferCanvas.getContext('2d');
  bCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
  glcanvas.getContext('2d').globalAlpha = 1.0; // Siempre restablecer al cambiar de filtro
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
