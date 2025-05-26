const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const glcanvas = document.getElementById("glcanvas");
const filterBtn = document.getElementById("filter-toggle-btn");
const filterMenu = document.getElementById("filter-menu");
const filterSelect = document.getElementById("filter-select");
const photoBtn = document.getElementById("photo-btn");
const recordBtn = document.getElementById("record-btn");
const pauseBtn = document.getElementById("pause-btn");
const stopBtn = document.getElementById("stop-btn");
const recordingControls = document.getElementById("recording-controls");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const gallery = document.getElementById("gallery");
let currentStream;
let mediaRecorder;
let recordedChunks = [];
let usingFrontCamera = true;
let recording = false;
let paused = false;

// Initialize WebGL context
let gl, shaderProgram, texture, filter = 'none';
function initWebGL() {
  glcanvas.width = video.videoWidth;
  glcanvas.height = video.videoHeight;
  gl = glcanvas.getContext("webgl") || glcanvas.getContext("experimental-webgl");
  const vs = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0, 1);
      v_texCoord = a_texCoord;
    }`;
  const fsBase = {
    none: `precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
      }`,
    glitch: `precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      void main() {
        vec4 color = texture2D(u_image, v_texCoord);
        gl_FragColor = vec4(color.rg, 1.0 - color.b, color.a);
      }`,
    rgb: `precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      void main() {
        vec2 offset = vec2(0.01, 0);
        float r = texture2D(u_image, v_texCoord + offset).r;
        float g = texture2D(u_image, v_texCoord).g;
        float b = texture2D(u_image, v_texCoord - offset).b;
        gl_FragColor = vec4(r, g, b, 1.0);
      }`,
    bw: `precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      void main() {
        vec4 color = texture2D(u_image, v_texCoord);
        float gray = (color.r + color.g + color.b) / 3.0;
        gl_FragColor = vec4(gray, gray, gray, 1.0);
      }`,
    invert: `precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      void main() {
        gl_FragColor = vec4(1.0 - texture2D(u_image, v_texCoord).rgb, 1.0);
      }`
  };

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vs);
  gl.compileShader(vertexShader);

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fsBase[filter] || fsBase.none);
  gl.compileShader(fragmentShader);

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  gl.useProgram(shaderProgram);

  const vertices = new Float32Array([
    -1, -1, 0, 1,
     1, -1, 1, 1,
    -1,  1, 0, 0,
     1,  1, 1, 0
  ]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(shaderProgram, "a_position");
  const aTexCoord = gl.getAttribLocation(shaderProgram, "a_texCoord");

  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aTexCoord);
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);

  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  draw();
}

function draw() {
  if (gl && video.readyState >= 2) {
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
      gl.UNSIGNED_BYTE, video
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  requestAnimationFrame(draw);
}

async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  const constraints = {
    video: {
      facingMode: usingFrontCamera ? "user" : "environment"
    },
    audio: true
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    video.onloadedmetadata = () => {
      video.play();
      initWebGL();
    };
  } catch (err) {
    alert("Error al acceder a la cámara");
  }
}

function takePhoto() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(glcanvas, 0, 0, canvas.width, canvas.height);
  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  gallery.appendChild(image);
}

function startRecording() {
  const stream = glcanvas.captureStream(30);
  mediaRecorder = new MediaRecorder(stream);
  recordedChunks = [];
  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const videoEl = document.createElement("video");
    videoEl.controls = true;
    videoEl.src = url;
    gallery.appendChild(videoEl);
  };
  mediaRecorder.start();
  recording = true;
  document.getElementById("controls").style.display = "none";
  recordingControls.style.display = "flex";
}

function stopRecording() {
  if (mediaRecorder && recording) {
    mediaRecorder.stop();
    recording = false;
    document.getElementById("controls").style.display = "flex";
    recordingControls.style.display = "none";
  }
}

function togglePause() {
  if (!mediaRecorder) return;
  if (paused) {
    mediaRecorder.resume();
    pauseBtn.textContent = "⏸";
  } else {
    mediaRecorder.pause();
    pauseBtn.textContent = "▶";
  }
  paused = !paused;
}

// UI Event Listeners
filterBtn.addEventListener("click", () => {
  filterMenu.classList.toggle("hidden");
});

filterSelect.addEventListener("change", () => {
  filter = filterSelect.value;
  initWebGL();
  filterMenu.classList.add("hidden");
});

photoBtn.addEventListener("click", takePhoto);
recordBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
pauseBtn.addEventListener("click", togglePause);

fullscreenBtn.addEventListener("click", () => {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    el.requestFullscreen();
    document.querySelectorAll("button").forEach(b => b.style.opacity = 0.1);
  } else {
    document.exitFullscreen();
    document.querySelectorAll("button").forEach(b => b.style.opacity = 0.9);
  }
});

glcanvas.addEventListener("dblclick", () => {
  usingFrontCamera = !usingFrontCamera;
  startCamera();
});

// Start
startCamera();
