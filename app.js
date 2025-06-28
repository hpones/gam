let video = document.getElementById('video');
let glcanvas = document.getElementById('glcanvas');
let canvas = document.getElementById('canvas');
let bufferCanvas = document.getElementById('bufferCanvas');
let filterSelect = document.getElementById('filterSelect');
let captureBtn = document.getElementById('capture-button');
let recordBtn = document.getElementById('record-button');
let pauseBtn = document.getElementById('pause-button');
let stopBtn = document.getElementById('stop-button');
let fullscreenBtn = document.getElementById('fullscreen-button');
let filterBtn = document.getElementById('filter-button');
let filtersDropdown = document.getElementById('filters-dropdown');
let gallery = document.getElementById('gallery');
let controls = document.getElementById('controls');
let recordingControls = document.getElementById('recording-controls');

let currentStream;
let mediaRecorder;
let chunks = [];
let isRecording = false;
let isPaused = false;
let usingFrontCamera = true;
let selectedFilter = 'none';

// Variables para el filtro de Audio Reactivo
let audioContext;
let analyser;
let microphone;
let dataArray;
let bufferLength;
let audioReactThreshold = 100; // Umbral de volumen para activar el efecto (0-255)
let audioReactIntensity = 0; // Intensidad actual basada en el volumen

function applyFilter(ctx) {
  // Los filtros de manipulación de píxeles y 'long-exposure-shadows', 'audio-reactive' no usan ctx.filter
  if (selectedFilter === 'eco-pink' || selectedFilter === 'weird' ||
      selectedFilter === 'invert-bw' || selectedFilter === 'thermal-camera' ||
      selectedFilter === 'long-exposure-shadows' || selectedFilter === 'audio-reactive') {
    ctx.filter = 'none';
  } else {
    switch (selectedFilter) {
      case 'grayscale':
        ctx.filter = 'grayscale(100%)';
        break;
      case 'invert':
        ctx.filter = 'invert(100%)';
        break;
      case 'sepia':
        ctx.filter = 'sepia(100%)';
        break;
      default:
        ctx.filter = 'none';
    }
  }
}

async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  // Detener el micrófono si estaba activo para un filtro de audio anterior
  if (microphone) {
    microphone.disconnect();
    microphone = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: usingFrontCamera ? 'user' : 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: true // Pedir acceso al audio para el filtro de sonido
    });

    video.srcObject = currentStream;

    video.onloadedmetadata = () => {
      video.play();
      glcanvas.width = video.videoWidth;
      glcanvas.height = video.videoHeight;
      bufferCanvas.width = video.videoWidth;
      bufferCanvas.height = video.videoHeight;
      drawVideoFrame();
    };
  } catch (err) {
      console.error('No se pudo acceder a la cámara o al micrófono:', err);
      alert('No se pudo acceder a la cámara o al micrófono. Revisa los permisos.');
  }
}

// Función para inicializar el procesamiento de audio
async function setupAudioProcessing() {
    if (audioContext) return; // Ya inicializado

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(currentStream);
        
        // Conectar el micrófono al analizador y luego al destino del audio (para que el usuario escuche)
        // Opcional: no conectar al destino si no quieres escuchar el micrófono directamente
        microphone.connect(analyser);
        analyser.connect(audioContext.destination); 

        analyser.fftSize = 256; // Tamaño del FFT, cuanto más grande, más detalle, más lento. 256 o 512 es buen equilibrio.
        bufferLength = analyser.frequencyBinCount; // La mitad de fftSize
        dataArray = new Uint8Array(bufferLength); // Array para almacenar los datos de frecuencia
        console.log("Audio processing initialized.");
    } catch (err) {
        console.error('Error al configurar el procesamiento de audio:', err);
        alert('No se pudo configurar el procesamiento de audio. ¿Permisos de micrófono?');
    }
}

function processAudio() {
    if (!analyser || !dataArray) {
        audioReactIntensity = 0;
        return;
    }
    analyser.getByteFrequencyData(dataArray); // Obtiene los datos de frecuencia en dataArray
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    let average = sum / bufferLength;

    // Escala la intensidad en base al promedio de volumen
    if (average > audioReactThreshold) {
        audioReactIntensity = (average - audioReactThreshold) / (255 - audioReactThreshold);
        audioReactIntensity = Math.min(1, Math.max(0, audioReactIntensity)); // Asegurar entre 0 y 1
    } else {
        audioReactIntensity = 0;
    }
}


function drawVideoFrame() {
  const ctx = glcanvas.getContext('2d');
  const bufferCtx = bufferCanvas.getContext('2d');

  function draw() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      glcanvas.width = video.videoWidth;
      glcanvas.height = video.videoHeight;

      // Restablecer globalAlpha para cada frame
      ctx.globalAlpha = 1.0;
      bufferCtx.globalAlpha = 1.0; // Asegurarse de que el buffer también esté en 1.0 por defecto

      // Lógica principal de dibujo del frame de video
      ctx.save();
      if (usingFrontCamera) {
        ctx.translate(glcanvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, glcanvas.width, glcanvas.height);
      ctx.restore();

      // ***** Lógica para filtros de manipulación de píxeles y efectos especiales *****
      if (selectedFilter === 'long-exposure-shadows') {
        // 1. Dibuja el contenido actual del glcanvas en el buffer.
        bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
        bufferCtx.drawImage(glcanvas, 0, 0, bufferCanvas.width, bufferCanvas.height);

        // 2. Limpia el glcanvas.
        ctx.clearRect(0, 0, glcanvas.width, glcanvas.height);

        // 3. Dibuja el buffer (frame anterior) con opacidad reducida.
        ctx.globalAlpha = 0.9; // Opacidad de la estela
        ctx.drawImage(bufferCanvas, 0, 0, glcanvas.width, glcanvas.height);
        ctx.globalAlpha = 1.0; // Restaurar para el frame actual

        // 4. Obtiene los datos de píxeles del frame de video actual para identificar las sombras.
        let currentFrameData = ctx.getImageData(0, 0, glcanvas.width, glcanvas.height);
        let currentPixels = currentFrameData.data;

        // 5. Obtiene los datos de píxeles del buffer (estela de frames anteriores).
        let previousFrameData = bufferCtx.getImageData(0, 0, bufferCanvas.width, bufferCanvas.height);
        let previousPixels = previousFrameData.data;

        // 6. Combina los píxeles: si es sombra en el frame actual, usa el píxel del buffer (estela).
        for (let i = 0; i < currentPixels.length; i += 4) {
            const r = currentPixels[i], g = currentPixels[i + 1], b = currentPixels[i + 2];
            const brightness = (r + g + b) / 3;

            // Umbral de sombra (ajustar si es necesario)
            if (brightness < 80) { // Si es una zona oscura (sombra)
                // Mantener el píxel de la estela
                currentPixels[i] = previousPixels[i];
                currentPixels[i + 1] = previousPixels[i + 1];
                currentPixels[i + 2] = previousPixels[i + 2];
                // currentPixels[i + 3] = previousPixels[i + 3]; // Mantener el alfa del anterior si se desea
            }
        }
        ctx.putImageData(currentFrameData, 0, 0); // Dibuja el resultado combinado en glcanvas

      } else if (selectedFilter === 'audio-reactive') {
          processAudio(); // Actualiza audioReactIntensity

          let imageData = ctx.getImageData(0, 0, glcanvas.width, glcanvas.height);
          let data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const brightness = (r + g + b) / 3;

              // Aplicar efecto solo en zonas oscuras y si hay sonido suficiente
              if (brightness < 80 && audioReactIntensity > 0) { // Umbral de oscuridad ajustable
                  const effectAmount = audioReactIntensity * 255; // Escala la intensidad a 0-255

                  // Colores brillantes: mezcla entre verde y rojo dependiendo de la intensidad o un patrón
                  // Para un efecto simple, hagamos que las sombras parpadeen entre verde y rojo
                  if (Math.random() < 0.5) { // Aleatorio para un efecto "chispeante"
                      data[i] = Math.min(255, r + effectAmount);     // Más rojo
                      data[i + 1] = Math.min(255, g + effectAmount * 0.2); // Poco verde
                      data[i + 2] = Math.min(255, b + effectAmount * 0.2); // Poco azul
                  } else {
                      data[i] = Math.min(255, r + effectAmount * 0.2); // Poco rojo
                      data[i + 1] = Math.min(255, g + effectAmount);     // Más verde
                      data[i + 2] = Math.min(255, b + effectAmount * 0.2); // Poco azul
                  }
              }
          }
          ctx.putImageData(imageData, 0, 0);

      } else if (selectedFilter === 'eco-pink' || selectedFilter === 'weird' ||
          selectedFilter === 'invert-bw' || selectedFilter === 'thermal-camera') {
        
        // Estos filtros ya usan la imagen inicial dibujada en el glcanvas.
        let imageData = ctx.getImageData(0, 0, glcanvas.width, glcanvas.height);
        let data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const brightness = (r + g + b) / 3;

          if (selectedFilter === 'eco-pink') {
            if (brightness < 100) {
              data[i] = Math.min(255, r + 60);
              data[i + 1] = Math.min(255, g + 80);
              data[i + 2] = Math.min(255, b + 60);
            }
          } else if (selectedFilter === 'weird') {
            if (brightness > 150) {
              data[i] = b;
              data[i + 1] = r;
              data[i + 2] = g;
            } else if (brightness < 80) {
              data[i] = (r * 0.8) + (b * 0.2);
              data[i + 1] = (g * 0.8) + (r * 0.2);
              data[i + 2] = (b * 0.8) + (g * 0.2);
            }
          } else if (selectedFilter === 'invert-bw') {
            const avg = (r + g + b) / 3;
            data[i] = 255 - avg;
            data[i + 1] = 255 - avg;
            data[i + 2] = 255 - avg;
          } else if (selectedFilter === 'thermal-camera') {
            if (brightness < 50) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 255 - (brightness * 5);
            } else if (brightness < 100) {
              data[i] = 0;
              data[i + 1] = (brightness - 50) * 5;
              data[i + 2] = 255;
            } else if (brightness < 150) {
              data[i] = 0;
              data[i + 1] = 255;
              data[i + 2] = 255 - ((brightness - 100) * 5);
            } else if (brightness < 200) {
              data[i] = (brightness - 150) * 5;
              data[i + 1] = 255;
              data[i + 2] = 0;
            } else {
              data[i] = 255;
              data[i + 1] = 255 - ((brightness - 200) * 5);
              data[i + 2] = 0;
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}

captureBtn.addEventListener('click', () => {
  canvas.width = glcanvas.width;
  canvas.height = glcanvas.height;
  let ctx = canvas.getContext('2d');

  // Para la captura, simplemente dibujamos el estado actual del glcanvas
  // (ya con estelas, audio-reactivo, etc., aplicados si corresponde)
  ctx.drawImage(glcanvas, 0, 0, canvas.width, canvas.height);

  // NOTA: Para filtros de manipulación de píxeles (eco-pink, weird, invert-bw, thermal-camera),
  // la lógica de re-aplicación ya no es estrictamente necesaria aquí si el drawVideoFrame
  // ya los aplica directamente al glcanvas antes de la captura.
  // Sin embargo, si quieres asegurar que la captura es idéntica pixel a pixel,
  // mantener esta lógica aquí es más robusto para esos filtros específicos.
  // Para 'long-exposure-shadows' y 'audio-reactive', ya se procesan en glcanvas.
  if (selectedFilter === 'eco-pink' || selectedFilter === 'weird' ||
      selectedFilter === 'invert-bw' || selectedFilter === 'thermal-camera') {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;

      if (selectedFilter === 'eco-pink') {
        if (brightness < 100) {
          data[i] = Math.min(255, r + 60);
          data[i + 1] = Math.min(255, g + 80);
          data[i + 2] = Math.min(255, b + 60);
        }
      } else if (selectedFilter === 'weird') {
        if (brightness > 150) {
          data[i] = b;
          data[i + 1] = r;
          data[i + 2] = g;
        } else if (brightness < 80) {
          data[i] = (r * 0.8) + (b * 0.2);
          data[i + 1] = (g * 0.8) + (r * 0.2);
          data[i + 2] = (b * 0.8) + (g * 0.2);
        }
      } else if (selectedFilter === 'invert-bw') {
        const avg = (r + g + b) / 3;
        data[i] = 255 - avg;
        data[i + 1] = 255 - avg;
        data[i + 2] = 255 - avg;
      } else if (selectedFilter === 'thermal-camera') {
        if (brightness < 50) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 255 - (brightness * 5);
        } else if (brightness < 100) {
          data[i] = 0;
          data[i + 1] = (brightness - 50) * 5;
          data[i + 2] = 255;
        } else if (brightness < 150) {
          data[i] = 0;
          data[i + 1] = 255;
          data[i + 2] = 255 - ((brightness - 100) * 5);
        } else if (brightness < 200) {
          data[i] = (brightness - 150) * 5;
          data[i + 1] = 255;
          data[i + 2] = 0;
        } else {
          data[i] = 255;
          data[i + 1] = 255 - ((brightness - 200) * 5);
          data[i + 2] = 0;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  let img = new Image();
  img.src = canvas.toDataURL('image/png');
  addToGallery(img, 'img');
});

recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    chunks = [];
    let streamToRecord = glcanvas.captureStream();
    mediaRecorder = new MediaRecorder(streamToRecord);
    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      let vid = document.createElement('video');
      vid.src = url;
      vid.controls = true;
      addToGallery(vid, 'video');
    };
    mediaRecorder.start();
    isRecording = true;
    controls.style.display = 'none';
    recordingControls.style.display = 'flex';
  }
});

pauseBtn.addEventListener('click', () => {
  if (isPaused) {
    mediaRecorder.resume();
    pauseBtn.textContent = '⏸️';
  } else {
    mediaRecorder.pause();
    pauseBtn.textContent = '▶️';
  }
  isPaused = !isPaused;
});

stopBtn.addEventListener('click', () => {
  mediaRecorder.stop();
  isRecording = false;
  controls.style.display = 'flex';
  recordingControls.style.display = 'none';
});

filterBtn.addEventListener('click', () => {
  if (filtersDropdown.style.display === 'block') {
    filtersDropdown.style.display = 'none';
  } else {
    filtersDropdown.style.display = 'block';
    filtersDropdown.style.opacity = '0.7';
  }
});

filterSelect.addEventListener('change', () => {
  selectedFilter = filterSelect.value;
  
  // Limpiar bufferCanvas y restablecer globalAlpha al cambiar de filtro
  const bCtx = bufferCanvas.getContext('2d');
  bCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
  glcanvas.getContext('2d').globalAlpha = 1.0;

  // Lógica para iniciar/detener el procesamiento de audio
  if (selectedFilter === 'audio-reactive') {
      setupAudioProcessing();
  } else {
      // Detener procesamiento de audio si se cambia a otro filtro
      if (microphone) {
          microphone.disconnect();
          microphone = null;
      }
      if (audioContext) {
          audioContext.close();
          audioContext = null;
      }
  }
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    controls.style.opacity = '0.2';
    recordingControls.style.opacity = '0.2';
    if (filtersDropdown.style.display === 'block') {
      filtersDropdown.style.opacity = '0.2';
    }
  } else {
    document.exitFullscreen();
    controls.style.opacity = '1';
    recordingControls.style.opacity = '1';
    if (filtersDropdown.style.display === 'block') {
      filtersDropdown.style.opacity = '0.7';
    }
  }
});

function addToGallery(element, type) {
  let container = document.createElement('div');
  container.className = 'gallery-item';
  container.appendChild(element);

  let actions = document.createElement('div');
  actions.className = 'gallery-actions';

  let downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'Descargar';
  downloadBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = element.src;
    a.download = type === 'img' ? 'foto.png' : 'video.webm';
    a.click();
  };

  let deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.onclick = () => container.remove();

  actions.appendChild(downloadBtn);
  actions.appendChild(deleteBtn);
  container.appendChild(actions);

  gallery.prepend(container);
}

video.addEventListener('dblclick', () => {
  usingFrontCamera = !usingFrontCamera;
  startCamera();
});

startCamera();
