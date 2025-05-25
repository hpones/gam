const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const takePhotoBtn = document.getElementById("takePhoto");
const startRecordBtn = document.getElementById("startRecord");
const filterToggle = document.getElementById("filterToggle");
const filterList = document.getElementById("filterList");
const openGalleryBtn = document.getElementById("openGallery");

let currentFilter = "none";
let galleryItems = [];

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let pauseBtn = null;
let stopBtn = null;

// Inicializar cámara
async function initCamera() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
    video.srcObject = mediaStream;
  } catch (err) {
    alert("No se pudo acceder a la cámara.");
    console.error(err);
  }
}

// Aplicar filtro visual
function applyFilter(filter) {
  video.style.filter = "";
  canvas.style.filter = "";

  switch (filter) {
    case "grayscale":
      video.style.filter = "grayscale(1)";
      break;
    case "invert":
      video.style.filter = "invert(1)";
      break;
    case "sepia":
      video.style.filter = "sepia(1)";
      break;
    case "glitch":
      // Aquí podrías implementar efectos con shaders o WebGL si quieres.
      break;
    default:
      break;
  }
}

// Captura de foto
takePhotoBtn.addEventListener("click", () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.translate(canvas.width, 0); // reflejo horizontal
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageUrl = canvas.toDataURL("image/png");
  galleryItems.push({ type: "image", src: imageUrl });
  alert("Foto capturada. Puedes verla en la galería.");
});

// Grabación de video
startRecordBtn.addEventListener("click", () => {
  if (!isRecording) {
    mediaRecorder = new MediaRecorder(mediaStream);
    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const videoUrl = URL.createObjectURL(blob);
      galleryItems.push({ type: "video", src: videoUrl });
      alert("Video guardado. Puedes verlo en la galería.");
    };

    mediaRecorder.start();
    isRecording = true;
    toggleRecordButtons();
  }
});

function toggleRecordButtons() {
  startRecordBtn.remove();

  pauseBtn = document.createElement("button");
  pauseBtn.className = "btn-circle small-btn";
  pauseBtn.innerText = "⏸️";
  pauseBtn.onclick = () => {
    if (mediaRecorder.state === "recording") {
      mediaRecorder.pause();
      pauseBtn.innerText = "▶️";
    } else {
      mediaRecorder.resume();
      pauseBtn.innerText = "⏸️";
    }
  };

  stopBtn = document.createElement("button");
  stopBtn.className = "btn-circle small-btn";
  stopBtn.innerText = "⏹️";
  stopBtn.onclick = () => {
    mediaRecorder.stop();
    isRecording = false;
    pauseBtn.remove();
    stopBtn.remove();
    document.querySelector(".capture-section").appendChild(startRecordBtn);
  };

  document.querySelector(".capture-section").appendChild(pauseBtn);
  document.querySelector(".capture-section").appendChild(stopBtn);
}

// Mostrar / ocultar filtros
filterToggle.addEventListener("click", () => {
  filterList.classList.toggle("hidden");
});

// Elegir filtro
filterList.querySelectorAll("li").forEach((item) => {
  item.addEventListener("click", () => {
    currentFilter = item.dataset.filter;
    applyFilter(currentFilter);
    filterList.classList.add("hidden");
  });
});

// Galería
openGalleryBtn.addEventListener("click", () => {
  const galleryWindow = window.open("", "_blank");
  galleryWindow.document.write(`
    <html>
    <head>
      <title>Galería</title>
      <style>
        body {
          background: #111;
          color: white;
          font-family: sans-serif;
          padding: 1rem;
        }
        .item {
          margin-bottom: 20px;
        }
        img, video {
          max-width: 100%;
          height: auto;
          border: 2px solid white;
        }
        button {
          margin-right: 10px;
          margin-top: 5px;
        }
      </style>
    </head>
    <body>
      <h2>Galería Experimental</h2>
      <div id="gallery-content">
        ${galleryItems
          .map((item, index) => {
            const media = item.type === "image"
              ? `<img src="${item.src}" alt="foto ${index}"/>`
              : `<video src="${item.src}" controls></video>`;
            return `
              <div class="item">
                ${media}<br/>
                <button onclick="downloadMedia(${index})">Descargar</button>
                <button onclick="deleteMedia(${index})">Eliminar</button>
              </div>
            `;
          })
          .join("")}
      </div>
      <script>
        function downloadMedia(index) {
          const a = document.createElement('a');
          a.href = ${JSON.stringify(galleryItems)}[index].src;
          a.download = ${JSON.stringify(galleryItems)}[index].type === 'image' ? 'foto.png' : 'video.webm';
          a.click();
        }
        function deleteMedia(index) {
          ${JSON.stringify(galleryItems)}.splice(index, 1);
          location.reload();
        }
      </script>
    </body>
    </html>
  `);
});

// Inicia cámara al cargar
initCamera();
