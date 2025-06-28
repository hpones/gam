const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const photoBtn = document.getElementById("capture-button");
const videoBtn = document.getElementById("record-button");
const filterToggle = document.getElementById("filter-button");
const filterMenu = document.getElementById("filters-dropdown");
const filterSelect = document.getElementById("filterSelect");
const gallery = document.getElementById("gallery");
const fullscreenBtn = document.getElementById("fullscreen-button");
const pauseBtn = document.getElementById("pause-button");
const stopBtn = document.getElementById("stop-button");
const controls = document.getElementById("controls");
const videoControls = document.getElementById("recording-controls");

let currentFilter = "none";
let mediaRecorder;
let chunks = [];
let currentStream;
let isPaused = false;
let videoDevices = [];
let currentCameraIndex = 0;

async function getVideoDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter(device => device.kind === 'videoinput');
}

async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  await getVideoDevices();

  const selectedDeviceId = videoDevices[currentCameraIndex]?.deviceId;

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: true
    });

    video.srcObject = currentStream;
    video.style.filter = getCssFilter(currentFilter);
  } catch (err) {
    alert("Error al acceder a la cámara: " + err);
  }
}

startCamera();

document.addEventListener("dblclick", () => {
  currentCameraIndex = (currentCameraIndex + 1) % videoDevices.length;
  startCamera();
});

fullscreenBtn.onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    controls.style.opacity = 0.1;
  } else {
    document.exitFullscreen();
    controls.style.opacity = 1;
  }
};

filterToggle.onclick = () => {
  filterMenu.style.display = filterMenu.style.display === "none" ? "block" : "none";
};

filterSelect.addEventListener("change", e => {
  currentFilter = e.target.value;
  video.style.filter = getCssFilter(currentFilter);
});

function getCssFilter(name) {
  switch (name) {
    case "invert": 
      return "invert(1)";
    case "grayscale": 
      return "grayscale(1)";
    case "sepia": 
      return "sepia(1)";
    case "eco-pink": 
  // Eco Pink mejorado: contraste más fuerte, tonos rosados brillantes y desenfoque suave
  return "contrast(2.5) hue-rotate(330deg) saturate(1.8) brightness(1.1) blur(1px)";
    case "weird": 
      // Potenciado: contraste fuerte, rotación más marcada y saturación
      return "contrast(3) hue-rotate(100deg) saturate(1.5)";
    default: 
      return "none";
  }
}

photoBtn.onclick = () => {
  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.filter = getCssFilter(currentFilter);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = document.createElement("img");
  img.src = canvas.toDataURL("image/png");
  const item = document.createElement("div");
  item.className = "gallery-item";
  item.appendChild(img);
  gallery.appendChild(item);
};

videoBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state === "recording") return;

  const filteredStream = video.captureStream();
  mediaRecorder = new MediaRecorder(filteredStream);
  chunks = [];

  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const videoEl = document.createElement("video");
    videoEl.src = url;
    videoEl.controls = true;
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.appendChild(videoEl);
    gallery.appendChild(item);
  };

  mediaRecorder.start();
  controls.style.display = "none";
  videoControls.style.display = "flex";
};

pauseBtn.onclick = () => {
  if (!mediaRecorder) return;
  if (!isPaused) {
    mediaRecorder.pause();
    isPaused = true;
  } else {
    mediaRecorder.resume();
    isPaused = false;
  }
};

stopBtn.onclick = () => {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  controls.style.display = "flex";
  videoControls.style.display = "none";
};
