<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Filtros de Cámara Avanzados</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #1a202c; /* Dark background */
            color: #e2e8f0; /* Light text */
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }
        .container {
            background-color: #2d3748; /* Darker container */
            border-radius: 15px;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25);
            padding: 30px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            max-width: 900px;
            width: 100%;
            border: 1px solid #4a5568;
        }
        .video-container {
            position: relative;
            width: 100%;
            padding-bottom: 75%; /* 4:3 Aspect Ratio (adjust as needed) */
            height: 0;
            background-color: #000;
            border-radius: 10px;
            overflow: hidden;
        }
        video, canvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: contain; /* Keep aspect ratio without cropping */
            transform: scaleX(-1); /* Mirror effect for webcam */
            border-radius: 10px;
        }
        /* Style for glcanvas specifically to prevent mirroring on its output */
        #glcanvas {
            transform: none; /* No mirroring for the output canvas */
        }
        .controls {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            justify-content: center;
        }
        .control-button {
            background-color: #4299e1; /* Blue */
            color: white;
            padding: 12px 25px;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 8px;
            border: none;
        }
        .control-button:hover {
            background-color: #3182ce; /* Darker Blue */
            transform: translateY(-2px);
            box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15);
        }
        .control-button:active {
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .control-button.active {
            background-color: #38a169; /* Green for active filter */
        }
        .control-button.active:hover {
            background-color: #2f855a;
        }
        input[type="range"] {
            -webkit-appearance: none;
            width: 100%;
            height: 8px;
            background: #4a5568;
            border-radius: 5px;
            outline: none;
            opacity: 0.7;
            transition: opacity .2s;
        }
        input[type="range"]:hover {
            opacity: 1;
        }
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #4299e1;
            cursor: pointer;
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
        }
        input[type="range"]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #4299e1;
            cursor: pointer;
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
        }
        .slider-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
            width: 100%;
            max-width: 300px; /* Limit slider width */
        }
        .message-box {
            background-color: #fbd38d;
            color: #9c4221;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            text-align: center;
            font-weight: bold;
            display: none; /* Hidden by default */
        }
        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #4a5568;
        }
        .gallery-item {
            background-color: #4a5568;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 10px;
        }
        .gallery-item img, .gallery-item video {
            max-width: 100%;
            height: auto;
            border-radius: 5px;
            object-fit: cover;
            margin-bottom: 10px;
        }
        .gallery-actions {
            display: flex;
            gap: 10px;
            width: 100%;
            justify-content: center;
        }
        .gallery-actions button {
            background-color: #63b3ed;
            color: white;
            padding: 8px 12px;
            border-radius: 5px;
            border: none;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .gallery-actions button:hover {
            background-color: #4299e1;
        }
        #filters-dropdown {
            background-color: #2d3748;
            border-radius: 8px;
            padding: 10px;
            position: absolute; /* Changed to absolute for overlay effect */
            z-index: 10;
            top: 100%; /* Position below the filter button */
            left: 50%;
            transform: translateX(-50%);
            width: fit-content;
            min-width: 200px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            display: none; /* Hidden by default */
        }
        #filters-dropdown select {
            width: 100%;
            padding: 8px;
            border-radius: 5px;
            background-color: #4a5568;
            color: #e2e8f0;
            border: 1px solid #63b3ed;
        }
        #controls {
            position: relative; /* Needed for dropdown positioning */
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="text-3xl font-bold text-center mb-6">Filtros de Cámara Avanzados</h1>

        <div class="video-container">
            <!-- Video element for camera feed -->
            <video id="video" autoplay muted playsinline style="display: none;"></video>
            <!-- Canvas for WebGL or 2D rendering with filters -->
            <canvas id="glcanvas"></canvas>
            <!-- Hidden buffer canvas for specific filter operations like long-exposure -->
            <canvas id="bufferCanvas" style="display: none;"></canvas>
            <!-- Canvas for capturing images (not always visible) -->
            <canvas id="canvas" style="display: none;"></canvas>
        </div>

        <div id="controls" class="controls relative">
            <button id="startCameraButton" class="control-button">
                <i class="fas fa-video"></i> Iniciar Cámara
            </button>
            <button id="capture-button" class="control-button bg-orange-500 hover:bg-orange-600">
                <i class="fas fa-camera"></i> Capturar
            </button>
            <button id="record-button" class="control-button bg-red-500 hover:bg-red-600">
                <i class="fas fa-circle"></i> Grabar
            </button>
            <button id="filter-button" class="control-button bg-green-500 hover:bg-green-600">
                <i class="fas fa-magic"></i> Filtros
            </button>
            <button id="fullscreen-button" class="control-button bg-indigo-500 hover:bg-indigo-600">
                <i class="fas fa-expand"></i> Pantalla Completa
            </button>

            <!-- Filters Dropdown -->
            <div id="filters-dropdown" class="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 w-48 bg-gray-700 rounded-lg shadow-lg p-2 z-10 hidden">
                <select id="filterSelect" class="w-full p-2 bg-gray-800 text-white rounded">
                    <option value="none">Ninguno</option>
                    <option value="grayscale">Escala de Grises</option>
                    <option value="invert">Invertir</option>
                    <option value="sepia">Sepia</option>
                    <option value="eco-pink">Eco Rosa</option>
                    <option value="weird">Extraño</option>
                    <option value="invert-bw">Invertir B/N</option>
                    <option value="thermal-camera">Cámara Térmica</option>
                    <option value="long-exposure-shadows">Estelas</option>
                    <option value="audio-reactive">Audio Reactivo</option>
                    <option value="invisibility">Invisibilidad</option> <!-- Nuevo filtro -->
                    <option value="light">Luz</option> <!-- Nuevo filtro de Luz -->
                </select>
                <!-- Slider for Invisibility filter -->
                <div id="invisibilityControls" class="slider-group mt-2" style="display: none;">
                    <label for="thresholdSlider" class="text-sm">Umbral de Invisibilidad:</label>
                    <input type="range" id="thresholdSlider" min="0" max="255" value="255">
                </div>
                <!-- Slider for Light filter -->
                <div id="lightControls" class="slider-group mt-2" style="display: none;">
                    <label for="lightIntensitySlider" class="text-sm">Intensidad de Luz:</label>
                    <input type="range" id="lightIntensitySlider" min="0" max="200" value="100">
                </div>
            </div>
        </div>

        <div id="recording-controls" class="controls" style="display: none;">
            <button id="pause-button" class="control-button bg-yellow-500 hover:bg-yellow-600">
                <i class="fas fa-pause"></i> Pausar
            </button>
            <button id="stop-button" class="control-button bg-red-500 hover:bg-red-600">
                <i class="fas fa-stop"></i> Detener
            </button>
        </div>

        <div id="messageBox" class="message-box"></div>

        <div id="gallery" class="gallery">
            <!-- Captured photos and videos will be displayed here -->
        </div>
    </div>

    <script>
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
        let messageBox = document.getElementById('messageBox'); // Get the message box

        // New elements for invisibility filter
        let invisibilityControls = document.getElementById('invisibilityControls');
        let thresholdSlider = document.getElementById('thresholdSlider');
        // New elements for light filter
        let lightControls = document.getElementById('lightControls');
        let lightIntensitySlider = document.getElementById('lightIntensitySlider');

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

        // Variables para el filtro de Invisibilidad (Chroma Key)
        let chromaKeyColor = { r: 0, g: 255, b: 0 }; // Color clave predeterminado (verde brillante)
        let invisibilityThreshold = parseInt(thresholdSlider.value); // Umbral de diferencia de color para invisibilidad
        // Variables for Light filter
        let lightIntensity = parseInt(lightIntensitySlider.value);


        // Function to show messages to the user (re-added from previous context)
        function showMessage(message, type = 'info') {
            messageBox.textContent = message;
            messageBox.style.display = 'block';
            messageBox.className = `message-box mt-4 ${type === 'error' ? 'bg-red-300 text-red-900' : 'bg-yellow-300 text-yellow-900'}`;
            setTimeout(() => {
                messageBox.style.display = 'none';
            }, 5000);
        }

        function applyFilter(ctx) {
            // Los filtros de manipulación de píxeles y 'long-exposure-shadows', 'audio-reactive', 'invisibility', 'light' no usan ctx.filter
            if (selectedFilter === 'eco-pink' || selectedFilter === 'weird' ||
                selectedFilter === 'invert-bw' || selectedFilter === 'thermal-camera' ||
                selectedFilter === 'long-exposure-shadows' || selectedFilter === 'audio-reactive' ||
                selectedFilter === 'invisibility' || selectedFilter === 'light') { // Add invisibility and light here
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
                    showMessage('Cámara iniciada.', 'info'); // Use showMessage
                };
            } catch (err) {
                console.error('No se pudo acceder a la cámara o al micrófono:', err);
                showMessage('No se pudo acceder a la cámara o al micrófono. Revisa los permisos.', 'error'); // Use showMessage
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
                showMessage('No se pudo configurar el procesamiento de audio. ¿Permisos de micrófono?', 'error'); // Use showMessage
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
            const ctx = glcanvas.getContext('2d', { willReadFrequently: true });
            const bufferCtx = bufferCanvas.getContext('2d', { willReadFrequently: true });

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

                            const shadowThreshold = 100; // Un valor más alto para capturar más áreas como "sombra"
                            const trailBlend = 0.6; // Mayor valor = estela más visible y persistente

                            if (brightness < shadowThreshold) { 
                                currentPixels[i] = Math.round(currentPixels[i] * (1 - trailBlend) + previousPixels[i] * trailBlend);
                                currentPixels[i + 1] = Math.round(currentPixels[i + 1] * (1 - trailBlend) + previousPixels[i + 1] * trailBlend);
                                currentPixels[i + 2] = Math.round(currentPixels[i + 2] * (1 - trailBlend) + previousPixels[i + 2] * trailBlend);
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
                                if (Math.random() < 0.5) { // Para un efecto parpadeante entre los dos colores
                                    data[i] = Math.min(255, r + effectAmount * 0.9);      // Rojo dominante
                                    data[i + 1] = Math.min(255, g + effectAmount * 0.1); // Poco verde
                                    data[i + 2] = Math.min(255, b + effectAmount * 0.1); // Poco azul
                                } else {
                                    data[i] = Math.min(255, r + effectAmount * 0.1); // Poco rojo
                                    data[i + 1] = Math.min(255, g + effectAmount * 0.9);      // Verde dominante
                                    data[i + 2] = Math.min(255, b + effectAmount * 0.1); // Poco azul
                                }
                            }
                        }
                        ctx.putImageData(imageData, 0, 0);

                    } else if (selectedFilter === 'invisibility') { // Nuevo filtro de invisibilidad
                        let imageData = ctx.getImageData(0, 0, glcanvas.width, glcanvas.height);
                        let data = imageData.data;

                        const rKey = chromaKeyColor.r;
                        const gKey = chromaKeyColor.g;
                        const bKey = chromaKeyColor.b;

                        for (let i = 0; i < data.length; i += 4) {
                            const r = data[i];
                            const g = data[i + 1];
                            const b = data[i + 2];

                            // Calcular la diferencia de color usando distancia euclidiana
                            const diff = Math.sqrt(
                                Math.pow(r - rKey, 2) +
                                Math.pow(g - gKey, 2) +
                                Math.pow(b - bKey, 2)
                            );

                            // Si la diferencia es menor que el umbral, hacer el píxel transparente
                            if (diff < invisibilityThreshold) {
                                data[i + 3] = 0; // Alpha a 0 para transparencia total
                            }
                        }
                        ctx.putImageData(imageData, 0, 0);
                    } else if (selectedFilter === 'light') { // New light filter
                        let imageData = ctx.getImageData(0, 0, glcanvas.width, glcanvas.height);
                        let data = imageData.data;
                        const intensityFactor = lightIntensity / 100; // Normalize intensity to 0-2 (1.0 is original)
                        for (let i = 0; i < data.length; i += 4) {
                            data[i] = Math.min(255, data[i] * intensityFactor);     // Red
                            data[i + 1] = Math.min(255, data[i + 1] * intensityFactor); // Green
                            data[i + 2] = Math.min(255, data[i + 2] * intensityFactor); // Blue
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
            // (ya con estelas, audio-reactivo, invisibilidad, etc., aplicados si corresponde)
            ctx.drawImage(glcanvas, 0, 0, canvas.width, canvas.height);

            // Nota: La lógica de re-aplicación de filtros pixel a pixel directamente en la captura
            // ya no es estrictamente necesaria aquí si el drawVideoFrame ya los aplica
            // directamente al glcanvas antes de la captura. Sin embargo, para mayor robustez
            // o si hubiera algún efecto de "mezcla" adicional al final, se podría reintroducir.
            // Por ahora, asumimos que glcanvas ya tiene el efecto final.

            let img = new Image();
            img.src = canvas.toDataURL('image/png');
            addToGallery(img, 'img');
            showMessage('Foto capturada.', 'info');
        });

        recordBtn.addEventListener('click', () => {
            if (!currentStream) {
                showMessage('Inicia la cámara primero para grabar.', 'error');
                return;
            }

            if (!isRecording) {
                chunks = [];
                // Usamos glcanvas.captureStream() para grabar el contenido con los filtros aplicados
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
                    showMessage('Grabación finalizada y guardada en la galería.', 'info');
                };
                mediaRecorder.start();
                isRecording = true;
                controls.style.display = 'none';
                recordingControls.style.display = 'flex';
                showMessage('Grabando...', 'info');
            }
        });

        pauseBtn.addEventListener('click', () => {
            if (!mediaRecorder) return;

            if (isPaused) {
                mediaRecorder.resume();
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
                showMessage('Grabación reanudada.', 'info');
            } else {
                mediaRecorder.pause();
                pauseBtn.innerHTML = '<i class="fas fa-play"></i> Reanudar';
                showMessage('Grabación pausada.', 'info');
            }
            isPaused = !isPaused;
        });

        stopBtn.addEventListener('click', () => {
            if (!mediaRecorder) return;
            
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

            // Lógica para mostrar/ocultar controles de filtros específicos
            invisibilityControls.style.display = 'none';
            lightControls.style.display = 'none';

            if (selectedFilter === 'invisibility') {
                invisibilityControls.style.display = 'flex';
                // Al seleccionar invisibilidad, establecer el umbral al máximo para "máxima potencia"
                thresholdSlider.value = 255;
                invisibilityThreshold = 255;
                showMessage('Filtro de Invisibilidad activado (máxima potencia).', 'info');
            } else if (selectedFilter === 'light') {
                lightControls.style.display = 'flex';
                lightIntensitySlider.value = 100; // Reset light intensity
                lightIntensity = 100;
                showMessage('Filtro de Luz activado.', 'info');
            }
            
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
                    if (audioContext.state === 'running') {
                        audioContext.close();
                    }
                    audioContext = null;
                }
            }
        });

        thresholdSlider.addEventListener('input', (event) => {
            invisibilityThreshold = parseInt(event.target.value);
            showMessage(`Umbral de Invisibilidad: ${invisibilityThreshold}`, 'info');
        });

        lightIntensitySlider.addEventListener('input', (event) => {
            lightIntensity = parseInt(event.target.value);
            showMessage(`Intensidad de Luz: ${lightIntensity}%`, 'info');
        });

        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                controls.style.opacity = '0.2';
                recordingControls.style.opacity = '0.2';
                if (filtersDropdown.style.display === 'block') {
                    filtersDropdown.style.opacity = '0.2';
                }
                showMessage('Modo pantalla completa activado.', 'info');
            } else {
                document.exitFullscreen();
                controls.style.opacity = '1';
                recordingControls.style.opacity = '1';
                if (filtersDropdown.style.display === 'block') {
                    filtersDropdown.style.opacity = '0.7';
                }
                showMessage('Modo pantalla completa desactivado.', 'info');
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
                a.download = type === 'img' ? `foto-${Date.now()}.png` : `video-${Date.now()}.webm`; // Unique filenames
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

        // Función para cambiar de camara con doble click
        video.addEventListener('dblclick', () => {
            usingFrontCamera = !usingFrontCamera;
            startCamera();
            showMessage(`Cambiando a cámara ${usingFrontCamera ? 'frontal' : 'trasera'}.`, 'info');
        });

        // Add a global error handler for any uncaught errors
        window.onerror = function(message, source, lineno, colno, error) {
            console.error("Uncaught error: ", message, source, lineno, colno, error);
            showMessage('Ha ocurrido un error inesperado. Revisa la consola.', 'error');
            return true; // Prevent default error handling
        };

        // Iniciar la cámara automáticamente al cargar la página
        startCamera();
    </script>
</body>
</html>
