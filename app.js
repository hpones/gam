let midAmpUniformLocation;
let highAmpUniformLocation;

// --- NUEVO UNIFORM PARA EL FILTRO OJO DE PEZ ---
let fisheyeStrengthLocation;
const defaultFisheyeStrength = 0.7; // Valor inicial para la intensidad del ojo de pez

// Vertex Shader: define la posición de los vértices y las coordenadas de textura
const vsSource = `
   attribute vec4 a_position;
@@ -88,9 +84,6 @@ const fsSource = `
   uniform float u_midAmp;
   uniform float u_highAmp;

    // NUEVO UNIFORM PARA EL FILTRO OJO DE PEZ
    uniform float u_fisheyeStrength;

   varying vec2 v_texCoord;

   // Enumeración de filtros (coincide con los índices en JavaScript)
@@ -103,8 +96,7 @@ const fsSource = `
   const int FILTER_GLOW_OUTLINE = 6;
   const int FILTER_ANGELICAL_GLITCH = 7;
   const int FILTER_AUDIO_COLOR_SHIFT = 8;
    const int FILTER_MODULAR_COLOR_SHIFT = 9;
    const int FILTER_FISHEYE = 10; // Nuevo filtro
    const int FILTER_MODULAR_COLOR_SHIFT = 9; // Nuevo filtro

   // Función para generar ruido básico (copiada de tu fragShader anterior)
   float random(vec2 st) {
@@ -222,26 +214,6 @@ const fsSource = `
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
@@ -323,7 +295,7 @@ function updateVideoTexture(gl, video) {

// --- FUNCIÓN DE INICIALIZACIÓN WEBG L ---
function initWebGL() {
    gl = glcanvas.getContext('webgl', { preserveDrawingBuffer: true });
    gl = glcanvas.getContext('webgl', { preserveDrawingBuffer: true }); 
if (!gl) {
alert('Tu navegador no soporta WebGL. No se podrán aplicar filtros avanzados.');
console.error('WebGL no soportado.');
@@ -350,10 +322,6 @@ function initWebGL() {
midAmpUniformLocation = gl.getUniformLocation(program, 'u_midAmp');
highAmpUniformLocation = gl.getUniformLocation(program, 'u_highAmp');

    // Obtener ubicación para el nuevo uniform del filtro ojo de pez
    fisheyeStrengthLocation = gl.getUniformLocation(program, 'u_fisheyeStrength');


gl.enableVertexAttribArray(program.positionLocation);
gl.enableVertexAttribArray(program.texCoordLocation);

@@ -368,9 +336,8 @@ function initWebGL() {

gl.uniform1i(program.imageLocation, 0);

    // Establecer el filtro inicial (sin filtro) y la intensidad del ojo de pez
    // Establecer el filtro inicial (sin filtro)
gl.uniform1i(filterTypeLocation, 0); // 0 = FILTER_NONE
    gl.uniform1f(fisheyeStrengthLocation, defaultFisheyeStrength); // Establecer la fuerza inicial del ojo de pez
console.log('WebGL inicialización completa.');
}

@@ -550,24 +517,17 @@ function drawVideoFrame() {
gl.uniform1f(highAmpUniformLocation, highAmp);
}

    // --- Pasar la fuerza del ojo de pez al shader ---
    if (selectedFilter === 'fisheye') {
        gl.uniform1f(fisheyeStrengthLocation, defaultFisheyeStrength); // Puedes hacer esto dinámico con un slider si quieres.
    }


let filterIndex = 0; // FILTER_NONE por defecto
switch (selectedFilter) {
case 'grayscale': filterIndex = 1; break; // FILTER_GRAYSCALE
case 'invert': filterIndex = 2; break;    // FILTER_INVERT
        case 'sepia': filterIndex = 3; break;      // FILTER_SEPIA
        case 'sepia': filterIndex = 3; break;     // FILTER_SEPIA
case 'eco-pink': filterIndex = 4; break;  // FILTER_ECO_PINK
        case 'weird': filterIndex = 5; break;      // FILTER_WEIRD
        case 'weird': filterIndex = 5; break;     // FILTER_WEIRD
case 'glow-outline': filterIndex = 6; break; // Filtro Glow con contorno
case 'angelical-glitch': filterIndex = 7; break; // Filtro Angelical Glitch
case 'audio-color-shift': filterIndex = 8; break; // Filtro Audio Color Shift
case 'modular-color-shift': filterIndex = 9; break; // Nuevo filtro Modular Color Shift
        case 'fisheye': filterIndex = 10; break; // NUEVO FILTRO OJO DE PEZ
default: filterIndex = 0; break;
}
gl.uniform1i(filterTypeLocation, filterIndex);
