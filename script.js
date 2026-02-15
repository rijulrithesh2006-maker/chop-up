window.addEventListener("DOMContentLoaded", () => {

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const webcamVideo = document.getElementById("video");
  const introVideo = document.getElementById("introVideo");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let gameState = "start"; // start, intro, playing, gameOver, levelComplete
  let level = 0;
  let fruits = [];

  let cursor = { x: canvas.width / 2, y: canvas.height / 2 };
  let targetX = cursor.x;
  let targetY = cursor.y;

  let sliceActive = false;
  let sliceTimer = 0;
  let score = 0;

  const gravity = 0.3;
  const smoothFactor = 0.2;
  const sliceRadius = 120;
  const blinkThreshold = 0.23;

  // -------- LEVEL DATA --------
  const levels = [
    { mango: 2, apple: 1 },
    { mango: 2, apple: 2, banana: 1 },
    { mango: 3, apple: 2, banana: 2 }
  ];

  let requiredRecipe;
  let cutFruits;

  function resetLevel() {
    requiredRecipe = levels[level];
    cutFruits = {};
    for (let key in requiredRecipe) cutFruits[key] = 0;
    fruits = [];
    score = 0;
  }

  resetLevel();

  // -------- LOAD IMAGES --------
  const startImg = new Image();
  startImg.src = "assets/startscreen.png";

  const backgroundImg = new Image();
  backgroundImg.src = "assets/background.png";

  const mangoImg = new Image();
  mangoImg.src = "assets/mango.png";

  const appleImg = new Image();
  appleImg.src = "assets/apple.png";

  const bananaImg = new Image();
  bananaImg.src = "assets/banana.png";

  const bombImg = new Image();
  bombImg.src = "assets/bomb.png";

  const sliceSound = new Audio("assets/slice.mp3");
  const bombSound = new Audio("assets/bomb.mp3");
  const bgMusic = new Audio("assets/bgmusic.mp3");

  const winSound = new Audio("assets/win.mp3");
  winSound.volume = 0.8;

  bgMusic.loop = true;
  bgMusic.volume = 0.4;

  const fruitTypes = ["mango", "apple", "banana", "bomb"];

  class Fruit {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height + 50;
      this.vx = (Math.random() - 0.5) * 6;
      this.vy = -15 - Math.random() * 5;
      this.size = 80;
      this.type = fruitTypes[Math.floor(Math.random() * fruitTypes.length)];
    }

    update() {
      this.vy += gravity;
      this.x += this.vx;
      this.y += this.vy;
    }

    draw() {
      let img;
      if (this.type === "mango") img = mangoImg;
      if (this.type === "apple") img = appleImg;
      if (this.type === "banana") img = bananaImg;
      if (this.type === "bomb") img = bombImg;

      ctx.drawImage(img, this.x - 40, this.y - 40, 80, 80);
    }

    sliced() {
      return Math.hypot(this.x - cursor.x, this.y - cursor.y) < 40 + sliceRadius;
    }
  }

  setInterval(() => {
    if (gameState === "playing")
      fruits.push(new Fruit());
  }, 800 - level * 150);

  canvas.addEventListener("click", () => {

    if (gameState === "start") {
      gameState = "intro";
      introVideo.style.display = "block";
      introVideo.play();
    }

    else if (gameState === "levelComplete") {
      level++;
      if (level >= levels.length) level = 0;
      resetLevel();
      gameState = "playing";
      bgMusic.currentTime = 0;
      bgMusic.play();
    }

    else if (gameState === "gameOver") {
      resetLevel();
      gameState = "playing";
      bgMusic.currentTime = 0;
      bgMusic.play();
    }

  });

  introVideo.addEventListener("ended", () => {
    introVideo.style.display = "none";
    gameState = "playing";
    bgMusic.play();
    startCamera();
  });

  function startCamera() {
    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true });
    faceMesh.onResults(onResults);

    const camera = new Camera(webcamVideo, {
      onFrame: async () => {
        await faceMesh.send({ image: webcamVideo });
      },
      width: 640,
      height: 480
    });

    camera.start();
  }

  function onResults(results) {
    if (!results.multiFaceLandmarks) return;

    const nose = results.multiFaceLandmarks[0][1];
    targetX = (1 - nose.x) * canvas.width;
    targetY = nose.y * canvas.height;

    const leftEye = [33, 160, 158, 133, 153, 144];
    const p = leftEye.map(i => results.multiFaceLandmarks[0][i]);

    const ear =
      (Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y) +
        Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y)) /
      (2 * Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y));

    if (ear < blinkThreshold && sliceTimer <= 0) {
      sliceActive = true;
      sliceTimer = 20;
    }
  }

  function checkWin() {
    for (let key in requiredRecipe) {
      if (cutFruits[key] !== requiredRecipe[key]) return false;
    }
    return true;
  }

  function gameLoop() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === "start") {
      ctx.drawImage(startImg, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "40px Arial";
      ctx.fillText("CLICK TO START", canvas.width/2 - 150, canvas.height - 80);
    }

    else if (gameState === "playing") {

      ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);

      cursor.x += (targetX - cursor.x) * smoothFactor;
      cursor.y += (targetY - cursor.y) * smoothFactor;

      fruits.forEach((fruit, index) => {
        fruit.update();
        fruit.draw();

        if (sliceActive && fruit.sliced()) {

          if (fruit.type === "bomb" ||
              !requiredRecipe.hasOwnProperty(fruit.type) ||
              cutFruits[fruit.type] >= requiredRecipe[fruit.type]) {

            bombSound.play();
            bgMusic.pause();
            gameState = "gameOver";

          } else {

            cutFruits[fruit.type]++;
            score++;
            sliceSound.play();

            if (checkWin()) {

              bgMusic.pause();

              winSound.currentTime = 0;
              winSound.play();

              gameState = "levelComplete";;
            }
          }

          fruits.splice(index, 1);
        }
      });

      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = "25px Arial";
      ctx.fillText("Level: " + (level + 1), 20, 30);
      ctx.fillText("Score: " + score, 20, 60);

      let y = 100;
      for (let key in requiredRecipe) {
        ctx.fillText(
          key + ": " + cutFruits[key] + "/" + requiredRecipe[key],
          20,
          y
        );
        y += 30;
      }
    }

    else if (gameState === "gameOver") {
      ctx.fillStyle = "red";
      ctx.font = "60px Arial";
      ctx.fillText("GAME OVER", canvas.width/2 - 170, canvas.height/2);
      ctx.font = "30px Arial";
      ctx.fillText("Click to Retry Level", canvas.width/2 - 130, canvas.height/2 + 50);
    }

    else if (gameState === "levelComplete") {
      ctx.fillStyle = "lime";
      ctx.font = "60px Arial";
      ctx.fillText("LEVEL COMPLETE!", canvas.width/2 - 230, canvas.height/2);
      ctx.font = "30px Arial";
      ctx.fillText("Click to Continue", canvas.width/2 - 120, canvas.height/2 + 50);
    }

    if (sliceTimer > 0) sliceTimer--;
    else sliceActive = false;

    requestAnimationFrame(gameLoop);
  }

  gameLoop();
});
