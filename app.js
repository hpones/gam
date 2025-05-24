const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const filterSelect = document.getElementById('filterSelect');

const takePhotoBtn = document.getElementById('takePhoto');
const startRecordBtn = document.getElementById('startRecord');
const stopRecordBtn = document.getElementById('stopRecord');
const gallery = document.getElementById('gallery');

let currentFilter = 'none';
let mediaRecorder;
let recordedChunks = [];

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
  const img = document.createElement('img');
  img.src = dataURL;

  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.appendChild(img);

  const del = document.createElement('button');
  del.textContent = '🗑 Eliminar';
  del.onclick = () => item.remove();
  item.appendChild(del);

  gallery.appendChild(item);
});

startRecordBtn.addEventListener('click', () => {
  recordedChunks = [];
  const stream = canvas.captureStream(30);
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);

    const videoEl = document.createElement('video');
    videoEl.src = url;
    videoEl.controls = true;

    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.appendChild(videoEl);

    const del = document.createElement('button');
    del.textContent = '🗑 Eliminar';
    del.onclick = () => item.remove();
    item.appendChild(del);

    gallery.appendChild(item);
  };

  mediaRecorder.start();
  startRecordBtn.disabled = true;
  stopRecordBtn.disabled = false;
});

stopRecordBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  startRecordBtn.disabled = false;
  stopRecordBtn.disabled = true;
});

setupCamera();
