// --- Constants ---
const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 600;
const SCALE = 30;
const ARENA_WIDTH = CANVAS_WIDTH / SCALE; // 10
const ARENA_HEIGHT = CANVAS_HEIGHT / SCALE; // 20
const INITIAL_MOVE_DELAY = 100; // ms delay before continuous move starts
const MOVE_INTERVAL_DELAY = 50; // ms for continuous move
const FAST_DROP_INTERVAL = 50; // ms for fast drop
let NORMAL_DROP_INTERVAL = 1000; // ms for normal drop (will be adjusted by stage)
const INITIAL_LINES_PER_STAGE = 2; // Lines to clear for the first stage
const STAGE_SPEED_INCREASE = 50; // ms reduction per stage
const MIN_DROP_INTERVAL = 100; // Minimum drop interval (fastest speed)

// Key Codes (Using KeyboardEvent.code is generally preferred over keyCode)
const KEY_LEFT = 'ArrowLeft';
const KEY_UP = 'ArrowUp'; // Rotate right
const KEY_RIGHT = 'ArrowRight';
const KEY_DOWN = 'ArrowDown';
const KEY_SPACE = 'Space'; // Hard drop
const KEY_Q = 'KeyQ'; // Rotate left
const KEY_W = 'KeyW'; // Rotate right (alternative)

const colors = [
    null,
    '#FF0D72', // T - Red
    '#0DC2FF', // O - Cyan
    '#0DFF72', // L - Green
    '#F538FF', // J - Purple
    '#FF8E0D', // I - Orange
    '#FFE138', // S - Yellow
    '#3877FF', // Z - Blue
];

const PIECES = {
    'T': [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
    ],
    'O': [
        [2, 2],
        [2, 2],
    ],
    'L': [
        [0, 3, 0],
        [0, 3, 0],
        [0, 3, 3],
    ],
    'J': [
        [0, 4, 0],
        [0, 4, 0],
        [4, 4, 0],
    ],
    'I': [
        [0, 5, 0, 0],
        [0, 5, 0, 0],
        [0, 5, 0, 0],
        [0, 5, 0, 0],
    ],
    'S': [
        [0, 6, 6],
        [6, 6, 0],
        [0, 0, 0],
    ],
    'Z': [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0],
    ]
};

// --- Game State ---
let canvas, context, scoreElement, stageElement, linesElement; // Added stage/lines elements
let arena;
let player;
let currentStage; // Added stage tracking
let linesClearedThisStage; // Added lines cleared in current stage
let linesPerStage; // Added lines needed for current stage
let dropCounter, dropInterval, lastTime;
let isLeftKeyDown, isRightKeyDown, isDownKeyDown;
let leftMoveTimeout, rightMoveTimeout; // Timeout IDs for initial delay
let leftMoveInterval, rightMoveInterval; // Interval IDs for continuous move
let animationFrameId = null; // To store the requestAnimationFrame ID
let isWaitingForNextStage = false; // 스테이지 클리어 전 딜레이 중인지 나타내는 플래그

// --- Utility Functions ---

let isStageClearing = false; // 스테이지 클리어 메시지 표시 및 준비 중인지 나타내는 플래그

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

// --- Stage Logic ---
function calculateDropInterval(stage) {
    // Calculate drop interval based on stage, ensuring it doesn't go below MIN_DROP_INTERVAL
    return Math.max(MIN_DROP_INTERVAL, 1000 - (stage - 1) * STAGE_SPEED_INCREASE);
}

function advanceStage() {
    // isWaitingForNextStage 딜레이 후 호출됨
    isStageClearing = true; // 스테이지 클리어 처리 시작 플래그 설정
    const clearedStage = currentStage; // 클리어된 스테이지 번호 저장
    const nextStage = currentStage + 1;
    console.log(`Stage ${clearedStage} Clear! Preparing for Stage ${nextStage}`);

    // 1. 화면 클리어 및 메시지 표시
    // 화면을 즉시 지우고 메시지를 그림
    context.fillStyle = '#000'; // 배경색으로 덮기
    context.fillRect(0, 0, context.canvas.width / SCALE, context.canvas.height / SCALE);

    context.font = 'bold 3px Arial'; // 폰트 크기 증가
    context.fillStyle = 'white';
    context.textAlign = 'center';
    // 메시지 위치 조정 (캔버스 중앙)
    context.fillText(`Stage ${clearedStage} Clear!`, ARENA_WIDTH / 2, ARENA_HEIGHT / 2 - 1);
    context.fillText(`Starting Stage ${nextStage}`, ARENA_WIDTH / 2, ARENA_HEIGHT / 2 + 2);


    // 2. 일정 시간 후 다음 스테이지 시작 (setTimeout 제거)
    isStageClearing = false; // 플래그 리셋

    // 3. 다음 스테이지 설정
    currentStage++;
    linesClearedThisStage = 0;
    linesPerStage = INITIAL_LINES_PER_STAGE + (currentStage - 1) * 2;
    NORMAL_DROP_INTERVAL = calculateDropInterval(currentStage);

    // 4. 아레나 초기화
    arena.forEach(row => row.fill(0));

    console.log(`Advanced to Stage ${currentStage}. Speed: ${NORMAL_DROP_INTERVAL}ms, Lines needed: ${linesPerStage}`);
    updateDisplay(); // 새 스테이지 정보 표시

    // 5. 새 블록 생성 및 게임 루프 재개
    if (playerReset()) { // 새 블록 생성 시도 (게임 오버 체크 포함)
         if (!animationFrameId) {
            lastTime = performance.now(); // Reset lastTime before resuming
            animationFrameId = requestAnimationFrame(update);
        }
    } else {
        // playerReset이 false를 반환하면 게임 오버 처리 (이미 playerReset 내부에 로직 있음)
        console.log("Game Over after stage clear reset.");
    }
}

// --- Display Update ---
function updateDisplay() {
    if (scoreElement) {
        scoreElement.innerText = player.score;
    }
    if (stageElement) {
        stageElement.innerText = currentStage;
    }
    // Ensure linesElement exists and linesPerStage is defined before updating
    if (linesElement && typeof linesPerStage !== 'undefined') {
        linesElement.innerText = `${linesClearedThisStage} / ${linesPerStage}`;
    } else if (linesElement) {
         linesElement.innerText = `0 / ${INITIAL_LINES_PER_STAGE}`; // Initial display before first stage setup
    }
}


// --- Piece Creation ---
function createPiece(type) {
    if (!PIECES[type]) {
        console.error("Invalid piece type:", type);
        return null; // Or handle error appropriately
    }
    // Return a deep copy to prevent modification of the original PIECES structure
    return PIECES[type].map(row => [...row]);
}

// --- Collision Detection ---

function isColliding(currentArena, currentPlayer) {
    const { matrix, pos } = currentPlayer;
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < matrix[y].length; ++x) {
            if (matrix[y][x] !== 0) {
                const newX = pos.x + x;
                const newY = pos.y + y;

                if (
                    newX < 0 || // Check left boundary
                    newX >= ARENA_WIDTH || // Check right boundary
                    newY >= ARENA_HEIGHT || // Check bottom boundary
                    (currentArena[newY] && currentArena[newY][newX] !== 0) // Check collision with existing blocks
                ) {
                    return true;
                }
            }
        }
    }
    return false;
}

// --- Game Logic Functions ---

function merge(targetArena, sourcePlayer) {
    sourcePlayer.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const arenaY = y + sourcePlayer.pos.y;
                const arenaX = x + sourcePlayer.pos.x;
                // Ensure we don't write outside the arena bounds
                if (arenaY >= 0 && arenaY < ARENA_HEIGHT && arenaX >= 0 && arenaX < ARENA_WIDTH) {
                    targetArena[arenaY][arenaX] = value;
                }
            }
        });
    });
}

function arenaSweep() {
    let rowsCleared = 0;
    outer: for (let y = arena.length - 1; y >= 0; --y) { // Iterate from bottom up
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer; // Row is not full, check next row up
            }
        }
        // Row is full if we reach here
        const row = arena.splice(y, 1)[0].fill(0); // Remove the full row
        arena.unshift(row); // Add an empty row at the top
        rowsCleared++;
        y++; // Re-check the current index since rows shifted down
    }

    if (rowsCleared > 0) {
        // Calculate score based on Tetris scoring system (example) + stage bonus
        const points = [0, 10, 30, 50, 100]; // Points for 0, 1, 2, 3, 4 lines
        player.score += (points[rowsCleared] || points[4]) * currentStage; // Score multiplier based on stage
        linesClearedThisStage += rowsCleared;

        console.log(`Lines cleared: ${rowsCleared}, Total this stage: ${linesClearedThisStage}/${linesPerStage}`); // Debug log
        updateDisplay(); // 점수/라인 수 업데이트
    }

    // 스테이지 클리어 조건 확인 (라인 스위프 후)
    if (rowsCleared > 0 && linesClearedThisStage >= linesPerStage && !isWaitingForNextStage && !isStageClearing) {
        console.log("Stage condition met. Starting 2-second delay before advancing.");
        // 스테이지 클리어 애니메이션 재생 후 2초 딜레이
        setTimeout(() => {
            isWaitingForNextStage = true; // 다음 스테이지 대기 플래그 설정
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId); // 게임 루프 중지
                animationFrameId = null;
            }
            // 2초 딜레이 후 advanceStage 호출
            setTimeout(() => {
                isWaitingForNextStage = false; // 대기 플래그 해제
                advanceStage(); // 스테이지 전환 로직 실행
            }, 2000); // 2초 딜레이
        }, 0); // 애니메이션 재생 시간 (현재는 0으로 설정)
    }
}

function rotate(matrix, dir) {
    // Transpose + Reverse = Rotate
    // Transpose
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }

    // Reverse rows (clockwise) or columns (counter-clockwise)
    if (dir > 0) { // Clockwise
        matrix.forEach(row => row.reverse());
    } else { // Counter-clockwise
        matrix.reverse();
    }
}

// --- Player Control Functions ---

function playerMove(offset) {
    player.pos.x += offset;
    if (isColliding(arena, player)) {
        player.pos.x -= offset; // Revert if collision
    }
}

function playerRotate(dir) {
    const initialX = player.pos.x;
    const currentMatrix = player.matrix; // Keep original matrix in case rotation fails
    const rotatedMatrix = currentMatrix.map(row => [...row]); // Create a copy to rotate
    rotate(rotatedMatrix, dir);
    player.matrix = rotatedMatrix; // Temporarily apply rotation

    // Wall Kick Logic (Simplified SRS-like)
    let offset = 1;
    while (isColliding(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1)); // Alternate direction, increase magnitude

        // Check if offset exceeds reasonable bounds (e.g., half the piece width)
        // Use rotatedMatrix width here as player.matrix might change
        if (Math.abs(offset) > Math.ceil(rotatedMatrix[0].length / 2) + 1) {
            player.matrix = currentMatrix; // Revert rotation
            player.pos.x = initialX; // Revert position
            return; // Rotation failed
        }
    }
    // Rotation successful (possibly with wall kick)
}


function playerDrop() {
    player.pos.y++;
    if (isColliding(arena, player)) {
        player.pos.y--; // Revert move
        merge(arena, player);
        playerReset();
        arenaSweep();
        // Score is updated in arenaSweep
    }
    dropCounter = 0; // Reset counter after any drop
}

function playerDropHard() {
    while (!isColliding(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--; // Move back up one step
    merge(arena, player);
    playerReset();
    arenaSweep();
    // Score is updated in arenaSweep
    dropCounter = 0;
}

function playerReset() {
    // 스테이지 클리어 중에는 새 블록 생성 방지 (advanceStage에서 처리)
    if (isStageClearing || isWaitingForNextStage) {
        return true; // 아직 게임 오버 아님을 나타냄
    }

    const pieceTypes = Object.keys(PIECES);
    const newPieceType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
    player.matrix = createPiece(newPieceType);

    // Center the piece horizontally
    player.pos.y = 0;
    player.pos.x = Math.floor(ARENA_WIDTH / 2) - Math.floor(player.matrix[0].length / 2);

    if (isColliding(arena, player)) {
        // Game Over
        console.log(`Game Over! Stage: ${currentStage}, Score: ${player.score}`); // Log stage too
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId); // Stop the game loop
            animationFrameId = null;
        }
        // Display stage in the alert message
        alert(`Game Over!\nStage: ${currentStage}\nFinal Score: ${player.score}`);
        // Resetting the game state (like score, stage) should happen in initGame
        // initGame()을 호출하여 게임을 완전히 리셋할 수 있음 (예: 재시작 버튼)
        return false; // 게임 오버
    }
    updateDisplay(); // 새 블록 생성 후 디스플레이 업데이트 (점수는 그대로)
    return true; // 성공
}

// --- Drawing Functions ---

function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = colors[value];
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function draw() {
    // 스테이지 클리어 중에는 아무것도 그리지 않음 (advanceStage에서 직접 그림)
    if (isStageClearing) {
        return;
    }

    // Clear canvas
    context.fillStyle = '#000';
    context.fillRect(0, 0, context.canvas.width / SCALE, context.canvas.height / SCALE); // Use scaled dimensions

    // Draw arena and player piece
    drawMatrix(arena, { x: 0, y: 0 });
    drawMatrix(player.matrix, player.pos);
}

// Removed updateScore function, replaced by updateDisplay

// --- Game Loop ---

function update(time = 0) {
    // isStageClearing 플래그 추가 확인
    if (!animationFrameId || isStageClearing || isWaitingForNextStage) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    // Use the current NORMAL_DROP_INTERVAL which is updated by advanceStage
    const currentDropInterval = isDownKeyDown ? FAST_DROP_INTERVAL : NORMAL_DROP_INTERVAL;

    dropCounter += deltaTime;
    // Use currentDropInterval for checking if player should drop
    if (dropCounter > currentDropInterval) {
        playerDrop();
        // playerDrop 내부에서 arenaSweep -> advanceStage 호출 가능성 있음
        // advanceStage가 호출되면 isStageClearing=true가 되고 루프가 멈춤
        if (isStageClearing) return; // advanceStage가 호출되었으면 여기서 중단
    }

    draw();
    // advanceStage에서 루프를 멈추므로, 여기서 다시 시작할 필요 없음
    // advanceStage의 setTimeout 콜백에서 루프를 재개함
    if (!isStageClearing) { // 스테이지 클리어 중이 아닐 때만 다음 프레임 요청
       animationFrameId = requestAnimationFrame(update);
    }
}

// --- Event Handlers ---

function handleKeyDown(event) {
    // Ignore if modifier keys are pressed (unless needed)
    if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
    }

    // Use event.code for layout-independent key identification
    const keyCode = event.code;

    // Prevent default browser actions for game keys (scrolling, etc.)
    if ([KEY_LEFT, KEY_RIGHT, KEY_DOWN, KEY_UP, KEY_SPACE, KEY_Q, KEY_W].includes(keyCode)) {
        event.preventDefault();
    }

    // Ignore automatic repeats for single-action keys (rotate, hard drop)
    if (event.repeat && [KEY_UP, KEY_Q, KEY_W, KEY_SPACE].includes(keyCode)) {
        return;
    }
    // Allow repeats for movement keys (left, right, down)

    switch (keyCode) {
        case KEY_LEFT:
            if (!isLeftKeyDown) { // Trigger on initial press
                isLeftKeyDown = true;
                playerMove(-1); // Move once immediately

                // Clear any existing opposite movement timers
                clearTimeout(rightMoveTimeout);
                clearInterval(rightMoveInterval);
                rightMoveTimeout = null;
                rightMoveInterval = null;

                // Start timeout for continuous move after initial delay
                leftMoveTimeout = setTimeout(() => {
                    if (isLeftKeyDown) { // Check if key is still down after delay
                        // Start continuous move interval
                        leftMoveInterval = setInterval(() => {
                            if (isLeftKeyDown) {
                                playerMove(-1);
                            } else {
                                clearInterval(leftMoveInterval);
                                leftMoveInterval = null;
                            }
                        }, MOVE_INTERVAL_DELAY);
                    }
                }, INITIAL_MOVE_DELAY);
            }
            break;
        case KEY_RIGHT:
             if (!isRightKeyDown) { // Trigger on initial press
                isRightKeyDown = true;
                playerMove(1); // Move once immediately

                // Clear any existing opposite movement timers
                clearTimeout(leftMoveTimeout);
                clearInterval(leftMoveInterval);
                leftMoveTimeout = null;
                leftMoveInterval = null;

                // Start timeout for continuous move after initial delay
                rightMoveTimeout = setTimeout(() => {
                    if (isRightKeyDown) { // Check if key is still down after delay
                        // Start continuous move interval
                        rightMoveInterval = setInterval(() => {
                            if (isRightKeyDown) {
                                playerMove(1);
                            } else {
                                clearInterval(rightMoveInterval);
                                rightMoveInterval = null;
                            }
                        }, MOVE_INTERVAL_DELAY);
                    }
                }, INITIAL_MOVE_DELAY);
            }
            break;
        case KEY_DOWN:
            if (!isDownKeyDown) { // Trigger on initial press
                isDownKeyDown = true;
                playerDrop(); // Drop immediately
                dropCounter = 0; // Reset counter for faster drops if held
            } else {
                // If already holding down, ensure drop interval is fast
                dropInterval = FAST_DROP_INTERVAL;
            }
            break;
        case KEY_Q:
            playerRotate(-1); // Rotate Left
            break;
        case KEY_W:
        case KEY_UP:
            playerRotate(1); // Rotate Right
            break;
        case KEY_SPACE:
            playerDropHard();
            break;
    }
}

function handleKeyUp(event) {
     // Use event.code for consistency
    const keyCode = event.code;

    switch (keyCode) {
        case KEY_LEFT:
            isLeftKeyDown = false;
            clearTimeout(leftMoveTimeout); // Clear initial delay timeout
            clearInterval(leftMoveInterval); // Clear continuous move interval
            leftMoveTimeout = null;
            leftMoveInterval = null;
            // No need to restart the opposite key's interval here,
            // as its own keyDown handler would have already started it if pressed.
            break;
        case KEY_RIGHT:
            isRightKeyDown = false;
            clearTimeout(rightMoveTimeout); // Clear initial delay timeout
            clearInterval(rightMoveInterval); // Clear continuous move interval
            rightMoveTimeout = null;
            rightMoveInterval = null;
            break;
        case KEY_DOWN:
            isDownKeyDown = false;
            // Reset drop interval to normal when key is released
            dropInterval = NORMAL_DROP_INTERVAL;
            break;
    }
}

// --- Initialization ---
function initGame() {
    canvas = document.getElementById('tetris-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    context = canvas.getContext('2d');
    scoreElement = document.getElementById('score-board');
    if (!scoreElement) {
        console.error("Score element not found!");
    }
    // Get stage and lines elements
    stageElement = document.getElementById('stage-board');
    if (!stageElement) {
        console.warn("Stage element not found!"); // Warn instead of error
    }
    linesElement = document.getElementById('lines-board');
    if (!linesElement) {
        console.warn("Lines element not found!"); // Warn instead of error
    }


    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    context.scale(SCALE, SCALE);

    arena = createMatrix(ARENA_WIDTH, ARENA_HEIGHT);
    player = {
        pos: { x: 0, y: 0 },
        matrix: null,
        score: 0,
    };

    // Initialize stage variables
    currentStage = 1;
    linesClearedThisStage = 0;
    linesPerStage = INITIAL_LINES_PER_STAGE; // Set initial lines needed
    NORMAL_DROP_INTERVAL = calculateDropInterval(currentStage); // Set initial speed
    isStageClearing = false; // 플래그 초기화
    isWaitingForNextStage = false; // 플래그 초기화

    // Reset game state variables
    dropCounter = 0;
    // dropInterval is set dynamically in update loop based on NORMAL_DROP_INTERVAL and isDownKeyDown
    lastTime = 0;
    isLeftKeyDown = false;
    isRightKeyDown = false;
    isDownKeyDown = false;
    // Clear any running move timers on game reset
    clearTimeout(leftMoveTimeout);
    clearTimeout(rightMoveTimeout);
    clearInterval(leftMoveInterval);
    clearInterval(rightMoveInterval);
    leftMoveTimeout = null;
    rightMoveTimeout = null;
    leftMoveInterval = null;
    rightMoveInterval = null;

    // Remove existing listeners before adding new ones to prevent duplicates on re-init
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    if (playerReset()) { // Start with the first piece, check if game over immediately
        updateDisplay(); // Use updateDisplay to show initial score, stage, lines
        // Start the game loop if not already running or if stopped
        if (!animationFrameId) {
            lastTime = performance.now(); // Use performance.now() for higher precision time
            animationFrameId = requestAnimationFrame(update);
        }
    }
}

// --- Start Game ---
// Use DOMContentLoaded to ensure the DOM is ready before initializing
document.addEventListener('DOMContentLoaded', initGame);

// Optional: Add a restart button functionality
// function restartGame() {
//     if (animationFrameId) {
//         cancelAnimationFrame(animationFrameId);
//         animationFrameId = null;
//     }
//     initGame();
// }
// document.getElementById('restart-button')?.addEventListener('click', restartGame);
