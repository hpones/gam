const captureBtn = document.getElementById("capture-button");
const recordBtn = document.getElementById("record-button");
const filterBtn = document.getElementById("filter-button");
const pauseBtn = document.getElementById("pause-button");
const stopBtn = document.getElementById("stop-button");
const fullscreenBtn = document.getElementById("fullscreen-button");
const filterSelect = document.getElementById("filterSelect");
const gallery = document.getElementById("gallery");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const controls = document.getElementById("controls");
const recordingControls = document.getElementById("recording-controls");

let currentFilter = "none";
let stream;
let mediaRecorder;
let chunks = [];
let isPaused = false;
let usingFrontCamera = true;

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: usingFrontCamera ? "user" : "environment" },
      audio: true,
    });

    video.srcObject = stream;
    video.style.filter = getCssFilter(currentFilter);
  } catch (err) {
    alert("Error al acceder a la cámara: " + err);
  }
}

function getCssFilter(name) {
  switch (name) {
    case "invert": return "invert(1)";
    case "grayscale": return "grayscale(1)";
    case "sepia": return "sepia(1)";
    case "eco-pink": return "contrast(1.5) hue-rotate(290deg)";
    case "weird": return "blur(2px) saturate(1.5) hue-rotate(180deg)";
    case "x": return "blur(1.5px) contrast(1.2) brightness(1.1) hue-rotate(45deg) saturate(1.4)";
    default: return "none";
  }
}

video.addEventListener("dblclick", async () => {
  usingFrontCamera = !usingFrontCamera;
  if (stream) stream.getTracks().forEach(track => track.stop());
  await startCamera();
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

filterSelect.onchange = () => {
  currentFilter = filterSelect.value;
  video.style.filter = getCssFilter(currentFilter);
};

captureBtn.onclick = () => {
  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.filter = getCssFilter(currentFilter);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = document.createElement("img");
  img.src = canvas.toDataURL("image/png");
  img.className = "gallery-item";
  gallery.appendChild(img);
};

recordBtn.onclick = () => {
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
    videoEl.className = "gallery-item";
    gallery.appendChild(videoEl);
  };

  mediaRecorder.start();
  controls.style.display = "none";
  recordingControls.style.display = "flex";
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
  recordingControls.style.display = "none";
};

startCamera();
