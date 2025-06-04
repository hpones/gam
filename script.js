const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const photoBtn = document.getElementById("photoBtn");
const videoBtn = document.getElementById("videoBtn");
const filterToggle = document.getElementById("filterToggle");
const filterMenu = document.getElementById("filterMenu");
const gallery = document.getElementById("gallery");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const controls = document.getElementById("controls");
const videoControls = document.getElementById("video-controls");

let currentFilter = "none";
let mediaRecorder;
let chunks = [];
let stream;
let isPaused = false;
let usingFrontCamera = true;

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: usingFrontCamera ? "user" : "environment" },
      audio: true
    });

    const filteredStream = new MediaStream();
    stream.getVideoTracks().forEach(track => filteredStream.addTrack(track));
    stream.getAudioTracks().forEach(track => filteredStream.addTrack(track));

    video.srcObject = filteredStream;
    video.style.filter = getCssFilter(currentFilter);
  } catch (err) {
    alert("Error al acceder a la cámara: " + err);
  }
}

startCamera();

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

filterToggle.onclick = () => {
  filterMenu.classList.toggle("hidden");
};

filterMenu.addEventListener("click", e => {
  if (e.target.dataset.filter) {
    currentFilter = e.target.dataset.filter;
    video.style.filter = getCssFilter(currentFilter);
  }
});

function getCssFilter(name) {
  switch (name) {
    case "invert": return "invert(1)";
    case "grayscale": return "grayscale(1)";
    case "sepia": return "sepia(1)";
    case "glitch": return "contrast(2) hue-rotate(90deg)";
    default: return "none";
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
  gallery.appendChild(img);
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
    gallery.appendChild(videoEl);
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

video.addEventListener("dblclick", async () => {
  usingFrontCamera = !usingFrontCamera;
  if (stream) stream.getTracks().forEach(track => track.stop());
  await startCamera();
});

