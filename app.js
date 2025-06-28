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
      ctx.filter = 'invert(100%) solarize(50%)'; // Añadido solarizar al filtro de inversión
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
        let imageData = ctx.getImageData(0, 0, glcanvas.width, glcanvas.height);
        let data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];          const brightness = (r + g + b) / 3;

          if (selectedFilter === 'eco-pink') {
            if (brightness < 120) { // Ajustado el umbral para más fluidez
              // Añadir verdes claros en zonas oscuras
              data[i] = Math.min(255, r + 50 + (Math.sin(i * 0.001 + performance.now() * 0.01) * 30)); // Rojo
              data[i + 1] = Math.min(255, g + 100 + (Math.cos(i * 0.001 + performance.now() * 0.01) * 30)); // Verde
              data[i + 2] = Math.min(255, b + 50 + (Math.sin(i * 0.001 + performance.now() * 0.01) * 30)); // Azul

              // Generar distorsión o movimiento en estas zonas
              const offset = Math.sin(i * 0.005 + performance.now() * 0.02) * 10;
              const x = (i / 4) % glcanvas.width;
              const y = Math.floor((i / 4) / glcanvas.width);
              const newX = x + offset;
              const newY = y + offset;

              if (newX >= 0 && newX < glcanvas.width && newY >= 0 && newY < glcanvas.height) {
                const newIndex = (Math.floor(newY) * glcanvas.width + Math.floor(newX)) * 4;
                if (newIndex >= 0 && newIndex < data.length) {
                  data[i] = data[newIndex];
                  data[i + 1] = data[newIndex + 1];
                  data[i + 2] = data[newIndex + 2];
                  data[i + 3] = data[newIndex + 3];
                }
              }

            }
          } else if (selectedFilter === 'weird') {
            // Paleta de colores fríos y complementarios
            if (brightness > 180) {
              // Intercambio de colores primarios para un efecto "weird"
              data[i] = b;     // Rojo <- Azul
              data[i + 1] = r; // Verde <- Rojo
              data[i + 2] = g; // Azul <- Verde
            } else if (brightness < 100) {
              // Difuminar el ruido en áreas oscuras para "distorsión angelical"
              const blurRadius = 2; // Ajusta el radio de difuminado
              let avgR = 0, avgG = 0, avgB = 0, count = 0;

              for (let dy = -blurRadius; dy <= blurRadius; dy++) {
                for (let dx = -blurRadius; dx <= blurRadius; dx++) {
                  const x = ((i / 4) % glcanvas.width) + dx;
                  const y = Math.floor((i / 4) / glcanvas.width) + dy;

                  if (x >= 0 && x < glcanvas.width && y >= 0 && y < glcanvas.height) {
                    const neighborIndex = (y * glcanvas.width + x) * 4;
                    if (neighborIndex >= 0 && neighborIndex < data.length) {
                      avgR += data[neighborIndex];
                      avgG += data[neighborIndex + 1];
                      avgB += data[neighborIndex + 2];
                      count++;
                    }
                  }
                }
              }

              if (count > 0) {
                data[i] = avgR / count;
                data[i + 1] = avgG / count;
                data[i + 2] = avgB / count;
              }

              // Aplicar un ligero desplazamiento para "distorsión angelical"
              const displacement = (Math.sin(i * 0.001 + performance.now() * 0.005) * 5);
              const originalX = (i / 4) % glcanvas.width;
              const originalY = Math.floor((i / 4) / glcanvas.width);
              const newX = originalX + displacement;
              const newY = originalY + displacement;

              if (newX >= 0 && newX < glcanvas.width && newY >= 0 && newY < glcanvas.height) {
                const newIndex = (Math.floor(newY) * glcanvas.width + Math.floor(newX)) * 4;
                if (newIndex >= 0 && newIndex < data.length) {
                  data[i] = data[newIndex];
                  data[i + 1] = data[newIndex + 1];
                  data[i + 2] = data[newIndex + 2];
                  data[i + 3] = data[newIndex + 3];
                }
              }
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
