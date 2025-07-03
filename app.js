let video = document.getElementById('video');
let glcanvas = document.getElementById('glcanvas');
let canvas = document.getElementById('canvas'); // Para la captura de imágenes estáticas
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
let cameraContainer = document.getElementById('camera-container'); // Necesario para fullscreen

let currentStream;
let mediaRecorder;
let chunks = [];
let isRecording = false;
let isPaused = false;
let selectedFilter = 'none'; // Este se usará para seleccionar el filtro en GLSL
let currentCameraDeviceId = null;
let currentFacingMode = null; // 'user' (frontal) o 'environment' (trasera)

// --- VARIABLES Y CONFIGURACIÓN DE WEBG L ---
let gl; // Contexto WebGL
let program; // Programa de shaders
let positionBuffer; // Buffer para las posiciones de los vértices
let texCoordBuffer; // Buffer para las coordenadas de textura
let videoTexture; // Textura donde se cargará el fotograma del video
let filterTypeLocation; // Ubicación del uniform para el tipo de filtro
let timeLocation; // Ubicación del uniform para el tiempo (para efectos dinámicos)

// --- NUEVOS UNIFORMS PARA EL FILTRO OJO DE PEZ ---
let fisheyeStrengthLocation;
const defaultFisheyeStrength = 0.7; // Valor inicial para la intensidad del ojo de pez

// Vertex Shader: define la posición de los vértices y las coordenadas de textura
const vsSource = `
    attribute vec4 a_position;
    attribute vec2 a_texCoord;

    varying vec2 v_texCoord;

    void main() {
        gl_Position = a_position;
        v_texCoord = a_texCoord;
    }
`;

// Fragment Shader: define el color de cada píxel, ahora con lógica de filtros
const fsSource = `
    precision mediump float;

    uniform sampler2D u_image;
    uniform bool u_flipX;
    uniform int u_filterType; // Nuevo uniform para seleccionar el filtro
    uniform vec2 u_resolution; // Nuevo uniform para la resolución del canvas
    uniform float u_time; // Nuevo uniform para el tiempo, para efectos dinámicos

    // NUEVO UNIFORM PARA EL FILTRO OJO DE PEZ
    uniform float u_fisheyeStrength;

    varying vec2 v_texCoord;

    // Enumeración de filtros (coincide con los índices en JavaScript)
    const int FILTER_NONE = 0;
    const int FILTER_GRAYSCALE = 1;
    const int FILTER_INVERT = 2;
    const int FILTER_SEPIA = 3;
    const int FILTER_ECO_PINK = 4;
    const int FILTER_WEIRD = 5;
    const int FILTER_GLOW_OUTLINE = 6;
    const int FILTER_ANGELICAL_GLITCH = 7;
    const int FILTER_MODULAR_COLOR_SHIFT = 8;
    const int FILTER_FISHEYE = 9; // Nuevo filtro

    // Función para generar ruido básico (copiada de tu fragShader anterior)
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    // Función de brillo para detectar luz (copiada de tu fragShader anterior)
    float brightness(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
    }

    void main() {
        vec2 texCoord = v_texCoord;
        if (u_flipX) {
            texCoord.x = 1.0 - texCoord.x; // Voltear horizontalmente
        }
        vec4 color = texture2D(u_image, texCoord); // Color original del píxel
        vec3 finalColor = color.rgb;
        float alpha = color.a;

        if (u_filterType == FILTER_GRAYSCALE) {
            float brightness = (color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722);
            finalColor = vec3(brightness);
        } else if (u_filterType == FILTER_INVERT) {
            finalColor = 1.0 - finalColor;
        } else if (u_filterType == FILTER_SEPIA) {
            float r = color.r;
            float g = color.g;
            float b = color.b;
            finalColor.r = (r * 0.393) + (g * 0.769) + (b * 0.189);
            finalColor.g = (r * 0.349) + (g * 0.686) + (b * 0.168);
            finalColor.b = (r * 0.272) + (g * 0.534) + (b * 0.131);
            finalColor = clamp(finalColor, 0.0, 1.0);
        } else if (u_filterType == FILTER_ECO_PINK) {
            float brightness = (color.r + color.g + color.b) / 3.0;
            if (brightness < 0.3137) {
                finalColor.r = min(1.0, color.r + (80.0/255.0));
                finalColor.g = max(0.0, color.g - (50.0/255.0));
                finalColor.b = min(1.0, color.b + (100.0/255.0));
            }
        } else if (u_filterType == FILTER_WEIRD) {
            float brightness = (color.r + color.g + color.b) / 3.0;
            if (brightness > 0.7058) {
                float temp_r = color.r;
                finalColor.r = color.b;
                finalColor.b = color.g;
                finalColor.g = temp_r;
            } else if (brightness < 0.3921) {
                finalColor *= 0.5;
            }
        } else if (u_filterType == FILTER_GLOW_OUTLINE) {
            vec2 onePixel = vec2(1.0, 1.0) / u_resolution;
            float distortionFactor = 0.005;
            vec2 offsetUp = vec2(sin(texCoord.y * 100.0) * distortionFactor, onePixel.y + cos(texCoord.x * 100.0) * distortionFactor);
            vec2 offsetDown = vec2(cos(texCoord.y * 100.0) * distortionFactor, -onePixel.y + sin(texCoord.x * 100.0) * distortionFactor);
            vec2 offsetLeft = vec2(-onePixel.x + sin(texCoord.y * 100.0) * distortionFactor, cos(texCoord.x * 100.0) * distortionFactor);
            vec2 offsetRight = vec2(onePixel.x + cos(texCoord.y * 100.0) * distortionFactor, sin(texCoord.x * 100.0) * distortionFactor);

            vec4 up = texture2D(u_image, texCoord + offsetUp);
            vec4 down = texture2D(u_image, texCoord + offsetDown);
            vec4 left = texture2D(u_image, texCoord + offsetLeft);
            vec4 right = texture2D(u_image, texCoord + offsetRight);

            float diff = abs(color.r - up.r) + abs(color.r - down.r) + abs(color.r - left.r) + abs(color.r - right.r);
            float edge = smoothstep(0.01, 0.1, diff);
            vec3 outlineColor = vec3(1.0);

            float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float glowFactor = smoothstep(0.7, 1.0, brightness) * 0.5;

            finalColor = mix(finalColor + glowFactor, outlineColor, edge);
        } else if (u_filterType == FILTER_ANGELICAL_GLITCH) {
            vec2 uv = texCoord;

            vec4 col = texture2D(u_image, uv);
            col.rgb *= 1.3;

            float b = brightness(col.rgb);

            vec2 distortion = vec2(
                (random(uv + vec2(sin(u_time * 0.1), cos(u_time * 0.1))) - 0.5) * 0.1,
                (random(uv + vec2(cos(u_time * 0.1), sin(u_time * 0.1))) - 0.5) * 0.1
            );

            vec4 distorted = texture2D(u_image, uv + distortion);

            if (b > 0.5) {
                vec3 glowColor = vec3(
                    0.5 + 0.3 * sin(u_time * 2.0),
                    0.2 + 0.5 * cos(u_time * 1.5),
                    0.6 + 0.4 * sin(u_time * 3.0)
                );

                finalColor = mix(distorted.rgb, glowColor, 0.5);
            } else {
                finalColor = distorted.rgb;
            }
            alpha = col.a;
        } else if (u_filterType == FILTER_MODULAR_COLOR_SHIFT) {
            // Paletas de color (normalizadas de 0-255 a 0-1)
            const vec3 palette0 = vec3(80.0/255.0, 120.0/255.0, 180.0/255.0); // Graves
            const vec3 palette1 = vec3(100.0/255.0, 180.0/255.0, 200.0/255.0); // Medios
            const vec3 palette2 = vec3(120.0/255.0, 150.0/255.0, 255.0/255.0); // Agudos

            float brightness_val = (color.r + color.g + color.b) / 3.0; // Brillo normalizado del píxel

            // Umbrales de brillo (normalizados de 0-255 a 0-1)
            if (brightness_val > (170.0/255.0)) { // Si es muy brillante (corresponde a "agudos")
                finalColor.rgb = mix(color.rgb, palette2, u_highAmp);
            } else if (brightness_val > (100.0/255.0)) { // Si es de brillo medio (corresponde a "medios")
                finalColor.rgb = mix(color.rgb, palette1, u_midAmp);
            } else { // Si es de brillo bajo (corresponde a "graves")
                finalColor.rgb = mix(color.rgb, palette0, u_bassAmp);
            }
            finalColor.rgb = clamp(finalColor.rgb, 0.0, 1.0); // Asegurarse de que los colores estén en el rango 0-1
        } else if (u_filterType == FILTER_FISHEYE) {
            // Convertir a coordenadas centradas
            vec2 centeredUV = texCoord - 0.5;

            // Calcular radio y ángulo
            float angle = atan(centeredUV.y, centeredUV.x);
            float radius = length(centeredUV);

            // Aplicar distorsión al radio
            float distortedRadius = radius * (1.0 + u_fisheyeStrength * radius * radius);

            // Volver a coordenadas cartesianas
            centeredUV.x = distortedRadius * cos(angle);
            centeredUV.y = distortedRadius * sin(angle);

            // Normalizar de vuelta a 0-1
            texCoord = centeredUV + 0.5;

            // Muestrear la textura con las coordenadas distorsionadas
            finalColor = texture2D(u_image, texCoord).rgb;
        }

        gl_FragColor = vec4(finalColor, alpha);
    }
`;

// Helper para compilar un shader
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error al compilar el shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Helper para enlazar shaders a un programa
function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error al enlazar el programa:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

// Configura los buffers de un cuadrado que llena el canvas
function setupQuadBuffers(gl) {
    const positions = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
    ]);
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const texCoords = new Float32Array([
        0, 1,
        1, 1,
        0, 0,
        0, 0,
        1, 1,
        1, 0,
    ]);
    texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
}

// Inicializa la textura para el video
function setupVideoTexture(gl) {
    videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

// Actualiza la textura con el fotograma actual del video
function updateVideoTexture(gl, video) {
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
}

// --- FUNCIÓN DE INICIALIZACIÓN WEBG L ---
function initWebGL() {
    gl = glcanvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
        alert('Tu navegador no soporta WebGL. No se podrán aplicar filtros avanzados.');
        console.error('WebGL no soportado.');
        return;
    }
    console.log('Contexto WebGL obtenido.');

    const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
    program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    program.positionLocation = gl.getAttribLocation(program, 'a_position');
    program.texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    program.imageLocation = gl.getUniformLocation(program, 'u_image');
    program.flipXLocation = gl.getUniformLocation(program, 'u_flipX');
    filterTypeLocation = gl.getUniformLocation(program, 'u_filterType'); // Obtener ubicación del uniform del filtro
    program.resolutionLocation = gl.getUniformLocation(program, 'u_resolution'); // Obtener ubicación del uniform de resolución
    timeLocation = gl.getUniformLocation(program, 'u_time'); // Obtener ubicación del uniform de tiempo

    // Obtener ubicaciones para los uniforms del filtro modular
    const bassAmpUniformLocation = gl.getUniformLocation(program, 'u_bassAmp');
    const midAmpUniformLocation = gl.getUniformLocation(program, 'u_midAmp');
    const highAmpUniformLocation = gl.getUniformLocation(program, 'u_highAmp');

    // Obtener ubicación para el nuevo uniform del filtro ojo de pez
    fisheyeStrengthLocation = gl.getUniformLocation(program, 'u_fisheyeStrength');

    gl.enableVertexAttribArray(program.positionLocation);
    gl.enableVertexAttribArray(program.texCoordLocation);

    setupQuadBuffers(gl);
    setupVideoTexture(gl);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(program.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(program.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(program.imageLocation, 0);

    // Establecer el filtro inicial (sin filtro) y la intensidad del ojo de pez
    gl.uniform1i(filterTypeLocation, 0); // 0 = FILTER_NONE
    gl.uniform1f(fisheyeStrengthLocation, defaultFisheyeStrength);
    console.log('WebGL inicialización completa.');
}


// --- LÓGICA DE CÁMARA Y STREAMING ---
let availableCameraDevices = [];

async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    availableCameraDevices = videoDevices;
    console.log('Cámaras disponibles:', availableCameraDevices);
    console.log('Número de cámaras disponibles:', availableCameraDevices.length);

    if (availableCameraDevices.length > 0) {
      // Si no hay una cámara actual o la cámara actual ya no está disponible, selecciona la primera
      if (!currentCameraDeviceId || !availableCameraDevices.some(d => d.deviceId === currentCameraDeviceId)) {
        currentCameraDeviceId = availableCameraDevices
