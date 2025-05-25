const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const filterSelect = document.getElementById('filterSelect');

const takePhotoBtn = document.getElementById('takePhoto');
const startRecordBtn = document.getElementById('startRecord');
const openGalleryBtn = document.getElementById('openGallery');

let currentFilter = 'none';
let mediaRecorder;
let recordedChunks = [];
let galleryWindow = null;
let isRecording = false;
let isPaused = false;

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      drawFrame();
    });
  } catch (e) {
    alert('Error al acceder a la cámara: ' + e.message);
  }
}

function applyFilter(frame) {
  switch (currentFilter) {
    case 'grayscale':
      return grayscaleFilter(frame);
    case 'invert':
      return invertFilter(frame);
    case 'glitch':
      return glitchFilter(frame);
    case 'sepia':
      return sepiaFilter(frame);
    default:
      return frame;
  }
}

function grayscaleFilter(frame) {
  for (let i = 0; i < frame.data.length; i += 4) {
    const avg = (frame.data[i] + frame.data[i + 1] + frame.data[i + 2]) / 3;
    frame.data[i] = frame.data[i + 1] = frame.data[i + 2] = avg;
  }
  return frame;
}

function invertFilter(frame) {
  for (let i = 0; i < frame.data.length; i += 4) {
    frame.data[i] = 255 - frame.data[i];
    frame.data[i + 1] = 255 - frame.data[i + 1];
    frame.data[i + 2] = 255 - frame.data[i + 2];
  }
  return frame;
}

function sepiaFilter(frame) {
  for (let i = 0; i < frame.data.length; i += 4) {
    const r = frame.data[i], g = frame.data[i + 1], b = frame.data[i + 2];
    frame.data[i]     = Math.min(0.393 * r + 0.769 * g + 0.189 * b, 255);
    frame.data[i + 1] = Math.min(0.349 * r + 0.686 * g + 0.168 * b, 255);
    frame.data[i + 2] = Math.min(0.272 * r + 0.534 * g + 0.131 * b, 255);
  }
  return frame;
}

function glitchFilter(frame) {
  const width = frame.width;
  const data = frame.data;
  for (let y = 0; y < frame.height; y += 5) {
    if (Math.random() > 0.8) {
      const offset = Math.floor(Math.random() * 10) * 4;
      for (let x = 0; x < width * 4 - offset; x += 4) {
        const idx = y * width * 4 + x;
        if (idx + offset < data.length) {
          for (let c = 0; c < 4; c++) {
            const tmp = data[idx + c];
            data[idx + c] = data[idx + offset + c];
            data[idx + offset + c] = tmp;
          }
        }
      }
    }
  }
  return frame;
}

function drawFrame() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  let frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  frame = applyFilter(frame);
  ctx.putImageData(frame, 0, 0);
  requestAnimationFrame(drawFrame);
}

filterSelect.addEventListener('change', (e) => {
  currentFilter = e.target.value;
});

takePhotoBtn.addEventListener('click', () => {
  const dataURL = canvas.toDataURL('image/png');
  sendToGallery({type: 'photo', dataURL});
});

startRecordBtn.addEventListener('click', () => {
  if (isRecording) return;

  recordedChunks = [];
  const stream = canvas.captureStream(30);
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    sendToGallery({type: 'video', url, blob});
    resetRecordButtons();
  };

  mediaRecorder.start();
  isRecording = true;
  isPaused = false;
  updateRecordButtons();
});

function pauseRecording() {
  if (!mediaRecorder) return;
  if (isPaused) {
    mediaRecorder.resume();
    isPaused = false;
  } else {
    mediaRecorder.pause();
    isPaused = true;
  }
  updateRecordButtons();
}

function stopRecording() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  isRecording = false;
  isPaused = false;
  updateRecordButtons();
}

function updateRecordButtons() {
  if (isRecording) {
    startRecordBtn.style.display = 'none';

    // Crear botones de pausar y detener si no existen
    if (!document.getElementById('pauseRecordBtn')) {
      const pauseBtn = document.createElement('button');
      pauseBtn.id = 'pauseRecordBtn';
      pauseBtn.className = 'btn-circle small-btn';
      pauseBtn.title = 'Pausar / Reanudar';
      pauseBtn.innerHTML = '⏸️';
      pauseBtn.onclick = pauseRecording;
      startRecordBtn.parentNode.appendChild(pauseBtn);
    }
    if (!document.getElementById('stopRecordBtn')) {
      const stopBtn = document.createElement('button');
      stopBtn.id = 'stopRecordBtn';
      stopBtn.className = 'btn-circle small-btn';
      stopBtn.title = 'Detener grabación';
      stopBtn.innerHTML = '⏹️';
      stopBtn.onclick = stopRecording;
      startRecordBtn.parentNode.appendChild(stopBtn);
    }
    // Actualizar icono pausa o play
    const pauseBtn = document.getElementById('pauseRecordBtn');
    pauseBtn.innerHTML = isPaused ? '▶️' : '⏸️';

  } else {
    startRecordBtn.style.display = 'inline-block';
    const pauseBtn = document.getElementById('pauseRecordBtn');
    const stopBtn = document.getElementById('stopRecordBtn');
    if (pauseBtn) pauseBtn.remove();
    if (stopBtn) stopBtn.remove();
  }
}

function resetRecordButtons() {
  isRecording = false;
  isPaused = false;
  updateRecordButtons();
}

// Comunicación con galería en ventana separada
function sendToGallery(data) {
  if (!galleryWindow || galleryWindow.closed) {
    galleryWindow = window.open('gallery.html', 'Galería Experimental Camera', 'width=600,height=400');
    galleryWindow.onload = () => {
      galleryWindow.postMessage({ type: 'addItem', data }, '*');
    };
  } else {
    galleryWindow.postMessage({ type: 'addItem', data }, '*');
  }
}

openGalleryBtn.addEventListener('click', () => {
  if (!galleryWindow || galleryWindow.closed) {
    galleryWindow = window.open('gallery.html', 'Galería Experimental Camera', 'width=600,height=400');
  } else {
    galleryWindow.focus();
  }
});

window.addEventListener('load', setupCamera);
