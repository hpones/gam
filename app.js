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
let controls = document = document.getElementById('controls');
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
let audioReactThreshold = 60; // Umbral de volumen más bajo para activar el efecto (0-255)
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
    if (audioContext && audioContext.state === 'running') {
        console.log("Audio processing already running.");
        return; // Ya inicializado y corriendo
    }

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(currentStream);
        
        // Conectar el micrófono al analizador. NO conectar al audioContext.destination
        // para evitar que el usuario escuche su propio micrófono.
        microphone.connect(analyser);
        // analyser.connect(audioContext.destination); // <-- COMENTADO para silenciar el microfono

        analyser.fftSize = 256; // Tamaño del FFT
        bufferLength = analyser.frequencyBinCount; // La mitad de fftSize
        dataArray = new Uint8Array(bufferLength); // Array para almacenar los datos de frecuencia
        console.log("Audio processing initialized and muted.");
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
    // Se puede ajustar la curva de respuesta aquí para que el efecto sea más o menos sensible
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
      bufferCanvas.width = video.videoWidth;
      bufferCanvas.height = video.videoHeight;

      // Restablecer globalAlpha para cada frame
      ctx.globalAlpha = 1.0;
      bufferCtx.globalAlpha = 1.0; 

      // 1. Dibuja el frame del video en el bufferCanvas SIEMPRE en la orientación correcta (sin espejo)
      // Este buffer será la fuente para la estela del frame anterior.
      bufferCtx.save();
      if (usingFrontCamera) {
        bufferCtx.translate(bufferCanvas.width, 0);
        bufferCtx.scale(-1, 1);
      }
      bufferCtx.drawImage(video, 0, 0, bufferCanvas.width, bufferCanvas.height);
      bufferCtx.restore();


      // 2. Lógica principal de dibujo del frame de video en glcanvas (lo que el usuario ve)
      ctx.clearRect(0, 0, glcanvas.width, glcanvas.height); // Limpiar para el nuevo frame
      
      applyFilter(ctx); // Aplica filtros CSS si corresponde
      
      ctx.save();
      if (usingFrontCamera) {
        ctx.translate(glcanvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, glcanvas.width, glcanvas.height);
      ctx.restore();

      // ***** Lógica para filtros de manipulación de píxeles y efectos especiales *****
      if (selectedFilter === 'long-exposure-shadows') {
        // En este punto:
        // - glcanvas tiene el frame actual (posiblemente espejado para cámara frontal)
        // - bufferCanvas tiene el frame actual (NO espejado, para una estela correcta)

        // Obtener los datos de píxeles del frame actual (glcanvas)
        let currentFrameData = ctx.getImageData(0, 0, glcanvas.width, glcanvas.height);
        let currentPixels = currentFrameData.data;

        // Obtener los datos de píxeles del frame anterior (bufferCanvas) para la estela
        let previousFrameData = bufferCtx.getImageData(0, 0, bufferCanvas.width, bufferCanvas.height);
        let previousPixels = previousFrameData.data;

        for (let i = 0; i < currentPixels.length; i += 4) {
            const r = currentPixels[i], g = currentPixels[i + 1], b = currentPixels[i + 2];
            const brightness = (r + g + b) / 3;

            // Ajustar el umbral de sombra y la intensidad de la estela
            const shadowThreshold = 100; // Un valor más alto para capturar más áreas como "sombra"
            const trailBlend = 0.3; // REDUCIDO para hacer la estela más LARGA y que se DEMORE más en desaparecer

            if (brightness < shadowThreshold) { 
                // Si es una zona de sombra, mezcla con el color de la estela (previousPixels)
                // Y añade una coloración azulada a la estela
                let blendedR = Math.round(currentPixels[i] * (1 - trailBlend) + previousPixels[i] * trailBlend);
                let blendedG = Math.round(currentPixels[i + 1] * (1 - trailBlend) + previousPixels[i + 1] * trailBlend);
                let blendedB = Math.round(currentPixels[i + 2] * (1 - trailBlend) + previousPixels[i + 2] * trailBlend);

                // Aplicar coloración azulada a la estela en las sombras
                blendedR = Math.min(255, blendedR * 0.8); // Reduce el rojo
                blendedG = Math.min(255, blendedG * 0.9); // Reduce ligeramente el verde
                blendedB = Math.min(255, blendedB * 1.2); // Aumenta el azul (el 1.2 es un multiplicador)

                currentPixels[i] = blendedR;
                currentPixels[i + 1] = blendedG;
                currentPixels[i + 2] = blendedB;
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
              if (brightness < 120 && audioReactIntensity > 0) { // Umbral de oscuridad ajustable
                  const effectAmount = audioReactIntensity * 255; // Escala la intensidad a 0-255

                  // Colores brillantes: mezcla entre verde y rojo
                  // Hacemos que sea más aleatorio o que alterne rápidamente
                  if (Math.random() < 0.5) { // Para un efecto parpadeante entre los dos colores
                      data[i] = Math.min(255, r + effectAmount * 0.9);     // Rojo dominante
                      data[i + 1] = Math.min(255, g + effectAmount * 0.1); // Poco verde
                      data[i + 2] = Math.min(255, b + effectAmount * 0.1); // Poco azul
                  } else {
                      data[i] = Math.min(255, r + effectAmount * 0.1); // Poco rojo
                      data[i + 1] = Math.min(255, g + effectAmount * 0.9);     // Verde dominante
                      data[i + 2] = Math.min(255, b + effectAmount * 0.1); // Poco azul
                  }
              }
          }
          ctx.putImageData(imageData, 0, 0);

      } else if (selectedFilter === 'eco-pink' || selectedFilter === 'weird' ||
          selectedFilter === 'invert-bw' || selectedFilter === 'thermal-camera') {
        
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
            if (brightness > 150) { // Zonas brillantes (verde más estallado)
              data[i] = b;
              data[i + 1] = Math.min(255, g + 100); // Aumentar aún más el verde
              data[i + 2] = g;
            } else if (brightness > 80 && brightness <= 150) { // Zonas medias (nuevo rojo)
              data[i] = Math.min(255, r + 100); // Añadir rojo
              data[i + 1] = g;
              data[i + 2] = b;
            } else if (brightness < 80) { // Zonas oscuras
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
        if (brightness > 150) { // Zonas brillantes (verde más estallado)
            data[i] = b;
            data[i + 1] = Math.min(255, g + 100); // Aumentar aún más el verde
            data[i + 2] = g;
        } else if (brightness > 80 && brightness <= 150) { // Zonas medias (nuevo rojo)
            data[i] = Math.min(255, r + 100); // Añadir rojo
            data[i + 1] = g;
            data[i + 2] = b;
        } else if (brightness < 80) { // Zonas oscuras
            data[i] = (r * 0.8) + (b * 0.2);
            data[i + 1] = (g * 0.8) + (r * 0.2);
            data[i + 2] = (b *
