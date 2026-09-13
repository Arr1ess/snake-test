import { useState, useEffect, useCallback, useRef } from 'react';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

// Constants
const GRID_SIZE = 20;
const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 60,
};
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Лёгкий',
  medium: 'Средний',
  hard: 'Сложный',
};

// Helper functions
function getRandomPosition(gridSize: number, snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };
  } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));
  return pos;
}

function getInitialSnake(): Position[] {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [snake, setSnake] = useState<Position[]>(getInitialSnake());
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [foodPulse, setFoodPulse] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const directionRef = useRef<Direction>('RIGHT');
  const gameStateRef = useRef<GameState>('idle');
  const snakeRef = useRef<Position[]>(getInitialSnake());
  const foodRef = useRef<Position>({ x: 15, y: 10 });
  const scoreRef = useRef(0);
  const lastDirectionRef = useRef<Direction>('RIGHT');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastMoveTimeRef = useRef<number>(0);

  // Sync refs
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { directionRef.current = direction; }, [direction]);

  // Food pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setFoodPulse(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Get canvas size based on container
  const getCanvasSize = useCallback(() => {
    const maxSize = Math.min(window.innerWidth - 32, 500);
    return Math.floor(maxSize / GRID_SIZE) * GRID_SIZE;
  }, []);

  const [canvasSize, setCanvasSize] = useState(getCanvasSize());

  useEffect(() => {
    const handleResize = () => setCanvasSize(getCanvasSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getCanvasSize]);

  // Draw game
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvasSize / GRID_SIZE;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvasSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvasSize, i * cellSize);
      ctx.stroke();
    }

    // Draw food with glow
    const foodPos = foodRef.current;
    const pulse = foodPulse ? 1.2 : 1;
    const foodX = foodPos.x * cellSize + cellSize / 2;
    const foodY = foodPos.y * cellSize + cellSize / 2;
    const foodRadius = (cellSize / 2 - 2) * pulse;

    // Glow effect
    const gradient = ctx.createRadialGradient(foodX, foodY, 0, foodX, foodY, foodRadius * 2);
    gradient.addColorStop(0, 'rgba(255, 82, 82, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 82, 82, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(foodX, foodY, foodRadius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Food body
    ctx.fillStyle = '#ff5252';
    ctx.shadowColor = '#ff5252';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw snake
    const currentSnake = snakeRef.current;
    currentSnake.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const padding = 1;

      if (index === 0) {
        // Head
        const headGradient = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
        headGradient.addColorStop(0, '#4ade80');
        headGradient.addColorStop(1, '#22c55e');
        ctx.fillStyle = headGradient;
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 5);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Eyes
        const eyeSize = cellSize / 6;
        ctx.fillStyle = '#1a1a2e';
        const dir = directionRef.current;
        let eye1X = x + cellSize * 0.3;
        let eye1Y = y + cellSize * 0.3;
        let eye2X = x + cellSize * 0.7;
        let eye2Y = y + cellSize * 0.3;

        if (dir === 'DOWN') {
          eye1Y = y + cellSize * 0.7;
          eye2Y = y + cellSize * 0.7;
        } else if (dir === 'LEFT') {
          eye1X = x + cellSize * 0.3;
          eye1Y = y + cellSize * 0.3;
          eye2X = x + cellSize * 0.3;
          eye2Y = y + cellSize * 0.7;
        } else if (dir === 'RIGHT') {
          eye1X = x + cellSize * 0.7;
          eye1Y = y + cellSize * 0.3;
          eye2X = x + cellSize * 0.7;
          eye2Y = y + cellSize * 0.7;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Body segments with gradient
        const alpha = 1 - (index / currentSnake.length) * 0.4;
        ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x + padding + 1, y + padding + 1, cellSize - (padding + 1) * 2, cellSize - (padding + 1) * 2, 4);
        ctx.fill();
      }
    });

    // Draw overlay for non-playing states
    if (gameStateRef.current === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${cellSize * 1.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ПАУЗА', canvasSize / 2, canvasSize / 2);
      ctx.font = `${cellSize * 0.7}px sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('Нажмите для продолжения', canvasSize / 2, canvasSize / 2 + cellSize * 2);
    }

    if (gameStateRef.current === 'gameover') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.fillStyle = '#ff5252';
      ctx.font = `bold ${cellSize * 1.3}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ИГРА ОКОНЧЕНА', canvasSize / 2, canvasSize / 2 - cellSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${cellSize * 0.8}px sans-serif`;
      ctx.fillText(`Счёт: ${scoreRef.current}`, canvasSize / 2, canvasSize / 2 + cellSize * 0.5);
      ctx.font = `${cellSize * 0.6}px sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('Нажмите для перезапуска', canvasSize / 2, canvasSize / 2 + cellSize * 2.5);
    }

    if (gameStateRef.current === 'idle') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.fillStyle = '#4ade80';
      ctx.font = `bold ${cellSize * 1.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🐍 ЗМЕЙКА', canvasSize / 2, canvasSize / 2 - cellSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${cellSize * 0.7}px sans-serif`;
      ctx.fillText('Нажмите для начала', canvasSize / 2, canvasSize / 2 + cellSize * 1.5);
    }
  }, [canvasSize, foodPulse]);

  // Game loop
  const gameLoop = useCallback((timestamp: number) => {
    if (gameStateRef.current !== 'playing') {
      draw();
      animFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const speed = DIFFICULTY_SPEEDS[difficulty];

    if (timestamp - lastMoveTimeRef.current >= speed) {
      lastMoveTimeRef.current = timestamp;

      const currentSnake = [...snakeRef.current];
      const head = { ...currentSnake[0] };
      const dir = directionRef.current;

      switch (dir) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Check wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameState('gameover');
        const finalScore = scoreRef.current;
        if (finalScore > highScore) {
          setHighScore(finalScore);
          localStorage.setItem('snake-high-score', finalScore.toString());
        }
        draw();
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Check self collision
      if (currentSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
        setGameState('gameover');
        const finalScore = scoreRef.current;
        if (finalScore > highScore) {
          setHighScore(finalScore);
          localStorage.setItem('snake-high-score', finalScore.toString());
        }
        draw();
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const newSnake = [head, ...currentSnake];
      const currentFood = foodRef.current;

      // Check food collision
      if (head.x === currentFood.x && head.y === currentFood.y) {
        const newScore = scoreRef.current + 1;
        setScore(newScore);
        const newFood = getRandomPosition(GRID_SIZE, newSnake);
        setFood(newFood);
        foodRef.current = newFood;
      } else {
        newSnake.pop();
      }

      setSnake(newSnake);
      snakeRef.current = newSnake;
      lastDirectionRef.current = dir;
    }

    draw();
    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [difficulty, draw, highScore]);

  // Start game loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [gameLoop]);

  // Change direction
  const changeDirection = useCallback((newDir: Direction) => {
    const current = lastDirectionRef.current;
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT'
    };
    if (newDir !== opposites[current]) {
      setDirection(newDir);
      directionRef.current = newDir;
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current === 'idle') {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' '].includes(e.key)) {
          e.preventDefault();
          startGame();
          return;
        }
      }

      if (gameStateRef.current === 'gameover') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          restartGame();
          return;
        }
      }

      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        if (gameStateRef.current === 'playing') {
          setGameState('paused');
        } else if (gameStateRef.current === 'paused') {
          setGameState('playing');
        }
        return;
      }

      if (gameStateRef.current !== 'playing') return;

      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          e.preventDefault();
          changeDirection('UP');
          break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault();
          changeDirection('DOWN');
          break;
        case 'ArrowLeft': case 'a': case 'A':
          e.preventDefault();
          changeDirection('LEFT');
          break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault();
          changeDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection]);

  // Touch controls
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 30;

    if (gameStateRef.current === 'idle') {
      startGame();
      touchStartRef.current = null;
      return;
    }

    if (gameStateRef.current === 'gameover') {
      restartGame();
      touchStartRef.current = null;
      return;
    }

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) {
      // Tap - toggle pause
      if (gameStateRef.current === 'playing') {
        setGameState('paused');
      } else if (gameStateRef.current === 'paused') {
        setGameState('playing');
      }
      touchStartRef.current = null;
      return;
    }

    if (gameStateRef.current !== 'playing') {
      touchStartRef.current = null;
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      changeDirection(dy > 0 ? 'DOWN' : 'UP');
    }

    touchStartRef.current = null;
  };

  // Canvas click handler
  const handleCanvasClick = () => {
    if (gameStateRef.current === 'idle') {
      startGame();
    } else if (gameStateRef.current === 'gameover') {
      restartGame();
    } else if (gameStateRef.current === 'playing') {
      setGameState('paused');
    } else if (gameStateRef.current === 'paused') {
      setGameState('playing');
    }
  };

  // Start game
  const startGame = () => {
    const initialSnake = getInitialSnake();
    setSnake(initialSnake);
    snakeRef.current = initialSnake;
    const newFood = getRandomPosition(GRID_SIZE, initialSnake);
    setFood(newFood);
    foodRef.current = newFood;
    setScore(0);
    scoreRef.current = 0;
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    lastDirectionRef.current = 'RIGHT';
    lastMoveTimeRef.current = 0;
    setGameState('playing');
  };

  // Restart game
  const restartGame = () => {
    startGame();
  };

  // Toggle pause
  const togglePause = () => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  };

  // Handle difficulty change
  const handleDifficultyChange = (newDifficulty: Difficulty) => {
    setDifficulty(newDifficulty);
    if (gameState === 'idle') {
      // Just change difficulty
    } else {
      restartGame();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex flex-col items-center justify-center p-4 select-none">
      {/* Header */}
      <div className="w-full max-w-[520px] mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-white mb-2">
          🐍 <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">Змейка</span>
        </h1>

        {/* Score Panel */}
        <div className="flex justify-between items-center bg-slate-800/80 backdrop-blur rounded-xl px-4 py-3 mb-3 border border-slate-700/50">
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Счёт</div>
            <div className="text-2xl font-bold text-white">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Рекорд</div>
            <div className="text-2xl font-bold text-yellow-400">🏆 {highScore}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 justify-center flex-wrap">
          {/* Difficulty selector */}
          <div className="flex bg-slate-800/80 rounded-lg overflow-hidden border border-slate-700/50">
            {(Object.keys(DIFFICULTY_SPEEDS) as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => handleDifficultyChange(d)}
                className={`px-3 py-2 text-xs md:text-sm font-medium transition-all duration-200 ${
                  difficulty === d
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>

          {/* Pause button */}
          {gameState !== 'idle' && (
            <button
              onClick={togglePause}
              className="px-4 py-2 bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200 text-sm font-medium"
            >
              {gameState === 'paused' ? '▶ Продолжить' : '⏸ Пауза'}
            </button>
          )}

          {/* Restart button */}
          {gameState !== 'idle' && (
            <button
              onClick={restartGame}
              className="px-4 py-2 bg-slate-800/80 border border-slate-700/50 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200 text-sm font-medium"
            >
              🔄 Заново
            </button>
          )}
        </div>
      </div>

      {/* Game Canvas */}
      <div
        className="relative rounded-xl overflow-hidden shadow-2xl shadow-green-500/10 border-2 border-slate-700/50"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          onClick={handleCanvasClick}
          className="block cursor-pointer"
          style={{ width: canvasSize, height: canvasSize }}
        />
      </div>

      {/* Mobile D-Pad */}
      <div className="mt-4 md:hidden">
        <div className="grid grid-cols-3 gap-1 w-36 mx-auto">
          <div></div>
          <button
            onTouchStart={(e) => { e.preventDefault(); if (gameStateRef.current === 'playing') changeDirection('UP'); }}
            className="bg-slate-700/80 rounded-lg p-3 text-white text-xl active:bg-green-500 transition-colors flex items-center justify-center"
          >
            ▲
          </button>
          <div></div>
          <button
            onTouchStart={(e) => { e.preventDefault(); if (gameStateRef.current === 'playing') changeDirection('LEFT'); }}
            className="bg-slate-700/80 rounded-lg p-3 text-white text-xl active:bg-green-500 transition-colors flex items-center justify-center"
          >
            ◀
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); if (gameStateRef.current === 'playing') changeDirection('DOWN'); }}
            className="bg-slate-700/80 rounded-lg p-3 text-white text-xl active:bg-green-500 transition-colors flex items-center justify-center"
          >
            ▼
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); if (gameStateRef.current === 'playing') changeDirection('RIGHT'); }}
            className="bg-slate-700/80 rounded-lg p-3 text-white text-xl active:bg-green-500 transition-colors flex items-center justify-center"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-slate-500 text-xs md:text-sm max-w-md">
        <p className="hidden md:block">
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-600">↑↓←→</kbd> или <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-600">WASD</kbd> — управление &nbsp;|&nbsp; <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-600">Пробел</kbd> — пауза
        </p>
        <p className="md:hidden">
          Свайп для управления • Тап — пауза
        </p>
      </div>
    </div>
  );
}
