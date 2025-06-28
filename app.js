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
let invertControls = document.getElementById('invert-controls'); // Nuevo: Referencia al contenedor del slider
let invertAmountSlider = document.getElementById('invertAmount'); // Nuevo: Referencia al slider

let currentStream;
let mediaRecorder;
let chunks = [];
let isRecording = false;
let isPaused = false;
let usingFrontCamera = true;
let selectedFilter = 'none';
let currentInvertAmount = 100; // Nuevo: Valor inicial para el slider de inversión

function applyFilter(ctx) {
  switch (selectedFilter) {
    case 'grayscale':
      ctx.filter = 'grayscale(100%)';
      break;
    case 'invert':
      ctx.filter = `invert(${currentInvertAmount}%)`; // Usa el valor del slider
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
  // Cuando se abre el dropdown, ajusta la opacidad
  if (filtersDropdown.style.display === 'block') {
    filtersDropdown.style.display = 'none';
  } else {
    filtersDropdown.style.display = 'block';
    filtersDropdown.style.opacity = '0.7'; // Opacidad baja para el panel
  }
});

filterSelect.addEventListener('change', () => {
  selectedFilter = filterSelect.value;
  // Muestra u oculta el slider de inversión según el filtro seleccionado
  if (selectedFilter === 'invert') {
    invertControls.style.display = 'block';
    invertAmountSlider.value = currentInvertAmount; // Restaura el último valor
  } else {
    invertControls.style.display = 'none';
  }
  // Puedes decidir si cerrar el dropdown al cambiar el filtro
  // filtersDropdown.style.display = 'none';
});

// Nuevo: Listener para el slider de inversión
invertAmountSlider.addEventListener('input', () => {
  currentInvertAmount = invertAmountSlider.value;
  // No es necesario llamar a drawVideoFrame() directamente,
  // requestAnimationFrame ya se encarga de redibujar con el nuevo filtro.
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    controls.style.opacity = '0.2';
    recordingControls.style.opacity = '0.2';
    // También aplicar opacidad al dropdown si está abierto
    if (filtersDropdown.style.display === 'block') {
      filtersDropdown.style.opacity = '0.2';
    }
  } else {
    document.exitFullscreen();
    controls.style.opacity = '1';
    recordingControls.style.opacity = '1';
    // Restaurar opacidad del dropdown
    if (filtersDropdown.style.display === 'block') {
      filtersDropdown.style.opacity = '0.7'; // Opacidad normal del panel
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
