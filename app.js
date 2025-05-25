const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const filterToggle = document.getElementById('filterToggle');
const filterList = document.getElementById('filterList');
let currentFilter = 'none';

const takePhotoBtn = document.getElementById('takePhoto');
const startRecordBtn = document.getElementById('startRecord');
const openGalleryBtn = document.getElementById('openGallery');

let mediaRecorder;
let recordedChunks = [];
let galleryWindow = null;
let isRecording = false;
let isPaused = false;

// Para alternar cámara
let useFrontCamera = true;

// Detectar swipe para cambiar cámara
let touchStartX = 0;

document.body.addEventListener('touchstart', e => {
  if(e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
  }
});

document.body.addEventListener('touchend', e => {
  if(e.changedTouches.length === 1) {
    let touchEndX = e.changedTouches[0].clientX;
    if(touchEndX - touchStartX > 50) { // swipe derecha > 50px
      useFrontCamera = !useFrontCamera;
      setupCamera();
      updateMirrorClass();
    }
  }
});

function updateMirrorClass() {
  if(useFrontCamera) {
    video.classList.add('video-mirrored');
  } else {
    video.classList.remove('video-mirrored');
  }
}

async function setupCamera() {
  if(mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  if(video.srcObject){
    video.srcObject.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    audio: false,
    video: {
      facingMode: useFrontCamera ? "user" : "environment"
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      drawFrame();
      updateMirrorClass();
    }, { once: true });
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

// FILTROS

filterToggle.addEventListener('click', () => {
  filterList.classList.toggle('hidden');
});

filterList.querySelectorAll('li').forEach(li => {
  li.addEventListener('click', () => {
    currentFilter = li.dataset.filter;
    filterList.classList.add('hidden');
  });
});

// FOTOS

takePhotoBtn.addEventListener('click', () => {
  const dataURL = canvas.toDataURL('image/png');
  sendToGallery({type: 'photo', dataURL});
});

// GRABAR VIDEO

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
    sendToGallery({type: 'video', blob});
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

    if (!document.getElementById('pauseBtn')) {
      const pauseBtn = document.createElement('button');
      pauseBtn.id = 'pauseBtn';
      pauseBtn.textContent = '⏸️';
      pauseBtn.className = 'btn-circle small-btn';
      pauseBtn.title = 'Pausar / Reanudar';
      pauseBtn.onclick = pauseRecording;
      startRecordBtn.parentNode.insertBefore(pauseBtn, startRecordBtn.nextSibling);
    }

    if (!document.getElementById('stopBtn')) {
      const stopBtn = document.createElement('button');
      stopBtn.id = 'stopBtn';
      stopBtn.textContent = '⏹️';
      stopBtn.className = 'btn-circle small-btn';
      stopBtn.title = 'Detener Grabación';
      stopBtn.onclick = stopRecording;
      const pauseBtn = document.getElementById('pauseBtn');
      pauseBtn.parentNode.insertBefore(stopBtn, pauseBtn.nextSibling);
    }
  } else {
    startRecordBtn.style.display = 'inline-flex';
    removeRecordExtraButtons();
  }
}

function removeRecordExtraButtons() {
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  if (pauseBtn) pauseBtn.remove();
  if (stopBtn) stopBtn.remove();
}

function resetRecordButtons() {
  isRecording = false;
  isPaused = false;
  updateRecordButtons();
}

// GALERÍA

function sendToGallery(item) {
  if (galleryWindow && !galleryWindow.closed) {
    // Para fotos mandamos dataURL, para videos mandamos blob y creamos URL en la galería
    galleryWindow.postMessage({type: 'addItem', data: item}, '*');
  }
}

openGalleryBtn.addEventListener('click', () => {
  if (!galleryWindow || galleryWindow.closed) {
    galleryWindow = window.open('gallery.html', 'gallery', 'width=600,height=600');
  } else {
    galleryWindow.focus();
  }
});

// INICIALIZA TODO

setupCamera();
