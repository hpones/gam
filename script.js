const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const photoBtn = document.getElementById("photo-btn");
const videoBtn = document.getElementById("video-btn");
const pauseBtn = document.getElementById("pause-btn");
const stopBtn = document.getElementById("stop-btn");
const filterBtn = document.getElementById("filters-btn");
const filterSelect = document.getElementById("filter-select");
const filterSelector = document.getElementById("filter-selector");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const gallery = document.getElementById("media");

let stream;
let mediaRecorder;
let chunks = [];
let currentFilter = "none";
let usingFront = true;

async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: usingFront ? "user" : "environment" },
      audio: true
    });
    video.srcObject = stream;
  } catch (e) {
    alert("Error accediendo a la cámara");
    console.error(e);
  }
}

initCamera();

document.body.ondblclick = () => {
  usingFront = !usingFront;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }
  initCamera();
};

photoBtn.onclick = () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.filter = getFilterCSS();
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = new Image();
  img.src = canvas.toDataURL("image/png");
  gallery.appendChild(img);
};

videoBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state === "recording") return;
  mediaRecorder = new MediaRecorder(stream);
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
  document.getElementById("controls").style.display = "none";
  document.getElementById("video-controls").style.display = "flex";
};

pauseBtn.onclick = () => {
  if (!mediaRecorder) return;
  if (mediaRecorder.state === "paused") {
    mediaRecorder.resume();
  } else if (mediaRecorder.state === "recording") {
    mediaRecorder.pause();
  }
};

stopBtn.onclick = () => {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  document.getElementById("controls").style.display = "flex";
  document.getElementById("video-controls").style.display = "none";
};

filterBtn.onclick = () => {
  filterSelector.classList.toggle("hidden");
};

filterSelect.oninput = () => {
  currentFilter = filterSelect.value;
  applyFilter();
};

function applyFilter() {
  video.style.filter = getFilterCSS();
}

function getFilterCSS() {
  switch (currentFilter) {
    case "grayscale": return "grayscale(1)";
    case "sepia": return "sepia(1)";
    case "invert": return "invert(1)";
    case "glitch": return "contrast(2) hue-rotate(90deg)";
    default: return "none";
  }
}

fullscreenBtn.onclick = () => {
  const container = document.getElementById("camera-container");
  if (!document.fullscreenElement) {
    container.requestFullscreen();
    fadeButtons(0.2);
  } else {
    document.exitFullscreen();
    fadeButtons(0.9);
  }
};

function fadeButtons(opacity) {
  document.querySelectorAll(".circle, .fullscreen-icon").forEach(el => {
    el.style.opacity = opacity;
  });
}
