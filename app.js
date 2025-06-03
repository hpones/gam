let currentCamera = 'user';
let video = document.getElementById('video');
let glcanvas = document.getElementById('glcanvas');
let photoGallery = document.getElementById('photo-gallery');
let mediaRecorder;
let recordedChunks = [];
let filter = 'none';
let isRecording = false;
let stream;
let isPaused = false;

// Iniciar cámara con facingMode
async function startCamera(facingMode = 'user') {
  if (window.stream) {
    window.stream.getTracks().forEach(track => track.stop());
  }

  try {
    const constraints = {
      video: {
        facingMode: { exact: facingMode }
      },
      audio: true
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    window.stream = stream;
    video.srcObject = stream;
    video.play();
  } catch (err) {
    console.error('No se pudo acceder a la cámara:', err);
    alert('No se pudo acceder a la cámara.');
  }
}

// Doble clic para cambiar entre cámara frontal y trasera
glcanvas.addEventListener('dblclick', () => {
  currentCamera = currentCamera === 'user' ? 'environment' : 'user';
  startCamera(currentCamera);
});

// Aplicar filtro seleccionado
function applyFilter(newFilter) {
  filter = newFilter;
  glcanvas.className = filter;
}

// Capturar foto
function capturePhoto() {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');

  context.filter = getComputedStyle(glcanvas).filter;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/png');
  photoGallery.appendChild(img);
}

// Iniciar grabación
function startRecording() {
  if (!stream) return;

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = event => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };
  mediaRecorder.onstop = saveRecording;
  mediaRecorder.start();
  isRecording = true;
}

// Pausar o reanudar grabación
function togglePause() {
  if (!mediaRecorder) return;

  if (!isPaused) {
    mediaRecorder.pause();
    isPaused = true;
  } else {
    mediaRecorder.resume();
    isPaused = false;
  }
}

// Detener grabación
function stopRecording() {
  if (!mediaRecorder) return;

  mediaRecorder.stop();
  isRecording = false;
  isPaused = false;
}

// Guardar video
function saveRecording() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const videoElement = document.createElement('video');
  videoElement.controls = true;
  videoElement.src = url;
  photoGallery.appendChild(videoElement);
}

document.getElementById('photo-btn').addEventListener('click', capturePhoto);
document.getElementById('video-btn').addEventListener('click', () => {
  document.getElementById('photo-btn').style.display = 'none';
  document.getElementById('video-btn').style.display = 'none';
  document.getElementById('pause-btn').style.display = 'inline-block';
  document.getElementById('stop-btn').style.display = 'inline-block';
  startRecording();
});
document.getElementById('pause-btn').addEventListener('click', () => {
  togglePause();
  document.getElementById('pause-btn').classList.toggle('paused', isPaused);
});
document.getElementById('stop-btn').addEventListener('click', () => {
  stopRecording();
  document.getElementById('photo-btn').style.display = 'inline-block';
  document.getElementById('video-btn').style.display = 'inline-block';
  document.getElementById('pause-btn').style.display = 'none';
  document.getElementById('stop-btn').style.display = 'none';
});
document.getElementById('filter-select').addEventListener('change', (e) => {
  applyFilter(e.target.value);
  document.getElementById('filter-select').style.display = 'none';
});

document.getElementById('filter-btn').addEventListener('click', () => {
  const filterSelect = document.getElementById('filter-select');
  filterSelect.style.display = filterSelect.style.display === 'block' ? 'none' : 'block';
});

document.getElementById('fullscreen-btn').addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    glcanvas.requestFullscreen();
  }
});

startCamera(currentCamera);
