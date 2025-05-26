let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let glcanvas = document.getElementById("glcanvas");
let filterSelect = document.getElementById("filterSelect");
let filterButton = document.getElementById("filter-button");
let fullscreenBtn = document.getElementById("fullscreen-button");
let captureBtn = document.getElementById("capture-button");
let recordBtn = document.getElementById("record-button");
let pauseBtn = document.getElementById("pause-button");
let stopBtn = document.getElementById("stop-button");
let filtersDropdown = document.getElementById("filters-dropdown");
let gallery = document.getElementById("gallery");

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recording = false;
let paused = false;
let useFrontCamera = true;
let currentFilter = "none";

// WebGL context setup
let gl = glcanvas.getContext("webgl") || glcanvas.getContext("experimental-webgl");
let videoTexture, shaderProgram, positionBuffer;
let filterPrograms = {};

// Vertex shader
const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0, 1);
  }
`;

// Fragment shaders
const fragmentShaders = {
  none: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    void main() {
      gl_FragColor = texture2D(u_image, v_texCoord);
    }
  `,
  grayscale: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    void main() {
      vec4 color = texture2D(u_image, v_texCoord);
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      gl_FragColor = vec4(vec3(gray), 1.0);
    }
  `,
  invert: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    void main() {
      vec4 color = texture2D(u_image, v_texCoord);
      gl_FragColor = vec4(vec3(1.0) - color.rgb, 1.0);
    }
  `,
  sepia: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    void main() {
      vec4 color = texture2D(u_image, v_texCoord);
      float r = dot(color.rgb, vec3(0.393, 0.769, 0.189));
      float g = dot(color.rgb, vec3(0.349, 0.686, 0.168));
      float b = dot(color.rgb, vec3(0.272, 0.534, 0.131));
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
};

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function createProgram(vertexSrc, fragmentSrc) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  return program;
}

function setupGL() {
  for (let name in fragmentShaders) {
    filterPrograms[name] = createProgram(vertexShaderSource, fragmentShaders[name]);
  }
  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  videoTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
}

function drawGL() {
  glcanvas.width = video.videoWidth;
  glcanvas.height = video.videoHeight;
  gl.viewport(0, 0, glcanvas.width, glcanvas.height);
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

  gl.useProgram(filterPrograms[currentFilter]);
  const posLoc = gl.getAttribLocation(filterPrograms[currentFilter], "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(drawGL);
}

async function initCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: useFrontCamera ? "user" : "environment" },
      audio: true
    });
    video.srcObject = mediaStream;
    video.play();
    setupGL();
    requestAnimationFrame(drawGL);
  } catch (err) {
    alert("No se puede acceder a la cámara.");
  }
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

function createGalleryItem(element, blob = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "gallery-item";

  const actions = document.createElement("div");
  actions.className = "gallery-actions";

  const delBtn = document.createElement("button");
  delBtn.textContent = "Eliminar";
  delBtn.onclick = () => wrapper.remove();

  const dlBtn = document.createElement("button");
  dlBtn.textContent = "Descargar";
  dlBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = blob ? URL.createObjectURL(blob) : element.src;
    a.download = blob ? "video.webm" : "photo.png";
    a.click();
  };

  actions.appendChild(dlBtn);
  actions.appendChild(delBtn);
  wrapper.appendChild(element);
  wrapper.appendChild(actions);
  gallery.appendChild(wrapper);
}

function takePhoto() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(glcanvas, 0, 0, canvas.width, canvas.height);
  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  createGalleryItem(image);
}

function startRecording() {
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(canvas.captureStream());
  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const videoEl = document.createElement("video");
    videoEl.controls = true;
    videoEl.src = url;
    createGalleryItem(videoEl, blob);
  };
  mediaRecorder.start();
  recording = true;
  pauseBtn.style.display = "inline-block";
  stopBtn.style.display = "inline-block";
  captureBtn.style.display = "none";
  recordBtn.style.display = "none";
  filterButton.style.display = "none";
}

function pauseRecording() {
  if (!mediaRecorder) return;
  if (!paused) {
    mediaRecorder.pause();
    pauseBtn.textContent = "▶️";
    paused = true;
  } else {
    mediaRecorder.resume();
    pauseBtn.textContent = "⏸️";
    paused = false;
  }
}

function stopRecording() {
  if (mediaRecorder && recording) {
    mediaRecorder.stop();
    recording = false;
    paused = false;
    pauseBtn.textContent = "⏸️";
    pauseBtn.style.display = "none";
    stopBtn.style.display = "none";
    captureBtn.style.display = "inline-block";
    recordBtn.style.display = "inline-block";
    filterButton.style.display = "inline-block";
  }
}

captureBtn.onclick = takePhoto;
recordBtn.onclick = startRecording;
pauseBtn.onclick = pauseRecording;
stopBtn.onclick = stopRecording;
fullscreenBtn.onclick = toggleFullScreen;
filterButton.onclick = () => {
  filtersDropdown.style.display =
    filtersDropdown.style.display === "block" ? "none" : "block";
};

filterSelect.onchange = () => {
  currentFilter = filterSelect.value;
  filtersDropdown.style.display = "none";
};

video.ondblclick = () => {
  useFrontCamera = !useFrontCamera;
  initCamera();
};

window.onload = initCamera;
