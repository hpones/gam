const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoBtn = document.getElementById('photo-btn');
const videoBtn = document.getElementById('video-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const filterBtn = document.getElementById('filter-btn');
const filterMenu = document.getElementById('filter-menu');
const filterSelect = document.getElementById('filter-select');
const recordingControls = document.getElementById('recording-controls');
const mainControls = document.getElementById('controls');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const gallery = document.getElementById('gallery');

let currentStream;
let mediaRecorder;
let recordedChunks = [];
let isPaused = false;
let currentFilter = 'none';

function applyFilter(ctx, width, height) {
  let imageData = ctx.getImageData(0, 0, width, height);
  let data = imageData.data;

  switch (currentFilter) {
    case 'invert':
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
      break;
    case 'grayscale':
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = data[i + 1] = data[i + 2] = avg;
      }
      break;
    case 'sepia':
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        data[i]     = 0.393 * r + 0.769 * g + 0.189 * b;
        data[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
        data[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
      }
      break;
    case 'glitch':
      for (let i = 0; i < data.length; i += 4 * 4) {
        data[i] = data[i + 4];
      }
      break;
  }

  ctx.putImageData(imageData, 0, 0);
}

async function initCamera() {
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
    video.srcObject = currentStream;
  } catch (err) {
    alert("No se pudo acceder a la cámara");
  }
}

photoBtn.addEventListener('click', () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  applyFilter(context, canvas.width, canvas.height);

  const img = new Image();
  img.src = canvas.toDataURL('image/png');
  gallery.appendChild(img);
});

videoBtn.addEventListener('click', () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const stream = canvas.captureStream(30);
  mediaRecorder = new MediaRecorder(stream);
  recordedChunks = [];

  const context = canvas.getContext('2d');
  const drawLoop = () => {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    applyFilter(context, canvas.width, canvas.height);
    if (mediaRecorder.state === "recording") {
      requestAnimationFrame(drawLoop);
    }
  };
  drawLoop();

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const videoElem = document.createElement('video');
    videoElem.controls = true;
    videoElem.src = URL.createObjectURL(blob);
    gallery.appendChild(videoElem);
  };

  mediaRecorder.start();
  mainControls.classList.add('hidden');
  recordingControls.classList.remove('hidden');
});

pauseBtn.addEventListener('click', () => {
  if (isPaused) {
    mediaRecorder.resume();
    pauseBtn.textContent = '⏸';
  } else {
    mediaRecorder.pause();
    pauseBtn.textContent = '▶';
  }
  isPaused = !isPaused;
});

stopBtn.addEventListener('click', () => {
  mediaRecorder.stop();
  mainControls.classList.remove('hidden');
  recordingControls.classList.add('hidden');
});

filterBtn.addEventListener('click', () => {
  filterMenu.classList.toggle('hidden');
});

filterSelect.addEventListener('change', () => {
  currentFilter = filterSelect.value;
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    document.getElementById('controls').style.opacity = 0.1;
  } else {
    document.exitFullscreen();
    document.getElementById('controls').style.opacity = 1;
  }
});

video.addEventListener('dblclick', () => {
  const facing = video.srcObject.getVideoTracks()[0].getSettings().facingMode;
  const newMode = facing === 'user' ? 'environment' : 'user';
  currentStream.getTracks().forEach(track => track.stop());
  navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode }, audio: true })
    .then(stream => {
      currentStream = stream;
      video.srcObject = stream;
    });
});

initCamera();
