/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, AlertTriangle, RefreshCw, Play } from 'lucide-react';

// 游戏常量配置
const CONFIG = {
  TOTAL_MISSILES: { left: 15, center: 30, right: 15 },
  EXPLOSION_RADIUS: 40,
  SCORE_PER_KILL: 25,
  WIN_SCORE: 1500,
  ROCKET_SPEED: 0.7,
  MISSILE_SPEED: 7,
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
};

interface Point {
  x: number;
  y: number;
}

interface Enemy extends Point {
  tx: number;
  ty: number;
  speed: number;
  id: number;
}

interface Missile extends Point {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  id: number;
}

interface Explosion extends Point {
  r: number;
  isFriendly: boolean;
  id: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'WIN' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [ammo, setAmmo] = useState({ ...CONFIG.TOTAL_MISSILES });
  const [cities, setCities] = useState([true, true, true, true, true, true]); // 6 cities
  const [towers, setTowers] = useState([true, true, true]); // 3 towers

  // 内部游戏对象池
  const enemies = useRef<Enemy[]>([]);
  const missiles = useRef<Missile[]>([]);
  const explosions = useRef<Explosion[]>([]);
  const nextId = useRef(0);
  const lastSpawnTime = useRef(0);

  const resetGame = useCallback(() => {
    setScore(0);
    setAmmo({ ...CONFIG.TOTAL_MISSILES });
    setCities([true, true, true, true, true, true]);
    setTowers([true, true, true]);
    enemies.current = [];
    missiles.current = [];
    explosions.current = [];
    lastSpawnTime.current = Date.now();
    setGameState('PLAYING');
  }, []);

  const createExplosion = (x: number, y: number, isFriendly: boolean) => {
    explosions.current.push({ x, y, r: 0, isFriendly, id: nextId.current++ });
  };

  const checkBuildingHit = (x: number) => {
    const width = CONFIG.CANVAS_WIDTH;
    const section = width / 9;
    
    // Positions: 
    // T0: section * 0.5
    // C0: section * 1.5
    // C1: section * 2.5
    // C2: section * 3.5
    // T1: section * 4.5
    // C3: section * 5.5
    // C4: section * 6.5
    // C5: section * 7.5
    // T2: section * 8.5

    const hitRadius = 25;

    // Check Towers
    const towerPos = [0.5, 4.5, 8.5].map(m => m * section);
    towerPos.forEach((pos, i) => {
      if (Math.abs(x - pos) < hitRadius) {
        setTowers(prev => {
          const next = [...prev];
          next[i] = false;
          return next;
        });
      }
    });

    // Check Cities
    const cityPos = [1.5, 2.5, 3.5, 5.5, 6.5, 7.5].map(m => m * section);
    cityPos.forEach((pos, i) => {
      if (Math.abs(x - pos) < hitRadius) {
        setCities(prev => {
          const next = [...prev];
          next[i] = false;
          return next;
        });
      }
    });
  };

  const handleFire = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Scale coordinates if canvas is resized by CSS
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const tx = (clientX - rect.left) * scaleX;
    const ty = (clientY - rect.top) * scaleY;

    // Don't fire below ground
    if (ty > CONFIG.CANVAS_HEIGHT - 40) return;

    const section = CONFIG.CANVAS_WIDTH / 9;
    const towerX = [0.5 * section, 4.5 * section, 8.5 * section];
    const towerKeys: (keyof typeof ammo)[] = ['left', 'center', 'right'];

    // Find nearest active tower with ammo
    let bestTower = -1;
    let minDist = Infinity;

    towerX.forEach((x, i) => {
      if (towers[i] && ammo[towerKeys[i]] > 0) {
        const d = Math.abs(x - tx);
        if (d < minDist) {
          minDist = d;
          bestTower = i;
        }
      }
    });

    if (bestTower !== -1) {
      const key = towerKeys[bestTower];
      setAmmo(prev => ({ ...prev, [key]: prev[key] - 1 }));
      missiles.current.push({
        sx: towerX[bestTower],
        sy: CONFIG.CANVAS_HEIGHT - 40,
        x: towerX[bestTower],
        y: CONFIG.CANVAS_HEIGHT - 40,
        tx,
        ty,
        id: nextId.current++
      });
    }
  };

  useEffect(() => {
    if (gameState === 'PLAYING' && cities.every(c => !c)) {
      setGameState('GAMEOVER');
    }
  }, [cities, gameState]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = () => {
      // 1. Clear & Background
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Ground
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

      const section = canvas.width / 9;

      // Draw Cities
      const cityPos = [1.5, 2.5, 3.5, 5.5, 6.5, 7.5];
      cityPos.forEach((m, i) => {
        if (cities[i]) {
          ctx.fillStyle = '#4cc9f0';
          ctx.fillRect(m * section - 15, canvas.height - 55, 30, 15);
          ctx.fillStyle = '#4895ef';
          ctx.fillRect(m * section - 10, canvas.height - 65, 20, 10);
        } else {
          ctx.fillStyle = '#333';
          ctx.fillRect(m * section - 15, canvas.height - 45, 30, 5);
        }
      });

      // Draw Towers
      const towerPos = [0.5, 4.5, 8.5];
      towerPos.forEach((m, i) => {
        if (towers[i]) {
          // Base
          ctx.fillStyle = '#f72585';
          ctx.beginPath();
          ctx.moveTo(m * section - 40, canvas.height - 40);
          ctx.lineTo(m * section, canvas.height - 100);
          ctx.lineTo(m * section + 40, canvas.height - 40);
          ctx.fill();
          
          // Glowing top
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#f72585';
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(m * section, canvas.height - 100, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = '#333';
          ctx.fillRect(m * section - 20, canvas.height - 45, 40, 5);
        }
      });

      // 2. Spawn Enemies
      const now = Date.now();
      if (now - lastSpawnTime.current > 5000) {
        lastSpawnTime.current = now;
        for (let i = 0; i < 3; i++) {
          const targetX = Math.random() * canvas.width;
          enemies.current.push({
            x: Math.random() * canvas.width,
            y: 0,
            tx: targetX,
            ty: canvas.height - 40,
            speed: CONFIG.ROCKET_SPEED + (score / 3000),
            id: nextId.current++
          });
        }
      }

      // 3. Update Enemies
      for (let i = enemies.current.length - 1; i >= 0; i--) {
        const enemy = enemies.current[i];
        const angle = Math.atan2(enemy.ty - enemy.y, enemy.tx - enemy.x);
        enemy.x += Math.cos(angle) * enemy.speed;
        enemy.y += Math.sin(angle) * enemy.speed;

        // Draw Enemy Trail
        ctx.strokeStyle = 'rgba(255, 77, 77, 0.3)';
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(enemy.x - Math.cos(angle) * 1000, enemy.y - Math.sin(angle) * 1000);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Enemy (Dongfeng Missile Style)
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(angle);
        
        const scale = 5; // 5x linear scale = 25x area/volume feel
        const length = 12 * scale;
        const width = 2 * scale;
        
        // Tail Fins
        ctx.fillStyle = '#ff4d4d';
        ctx.beginPath();
        ctx.moveTo(-length, -width);
        ctx.lineTo(-length - 5, -width - 5);
        ctx.lineTo(-length + 5, -width);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-length, width);
        ctx.lineTo(-length - 5, width + 5);
        ctx.lineTo(-length + 5, width);
        ctx.fill();

        // Missile Body
        ctx.fillStyle = '#e0e0e0'; // Light grey body
        ctx.fillRect(-length, -width/2, length, width);
        
        // Red Stripe Markings
        ctx.fillStyle = '#ff4d4d';
        ctx.fillRect(-length * 0.7, -width/2, length * 0.1, width);
        ctx.fillRect(-length * 0.4, -width/2, length * 0.1, width);

        // Nose Cone
        ctx.fillStyle = '#333'; // Black nose cone
        ctx.beginPath();
        ctx.moveTo(0, -width/2);
        ctx.lineTo(width * 1.5, 0);
        ctx.lineTo(0, width/2);
        ctx.fill();

        ctx.restore();

        if (enemy.y >= canvas.height - 40) {
          createExplosion(enemy.x, enemy.y, false);
          checkBuildingHit(enemy.x);
          enemies.current.splice(i, 1);
        }
      }

      // 4. Update Player Missiles
      for (let i = missiles.current.length - 1; i >= 0; i--) {
        const m = missiles.current[i];
        const dist = Math.hypot(m.tx - m.x, m.ty - m.y);
        
        // Direct destruction check
        let hitEnemy = false;
        for (let j = enemies.current.length - 1; j >= 0; j--) {
          const enemy = enemies.current[j];
          if (Math.hypot(enemy.x - m.x, enemy.y - m.y) < 20) {
            createExplosion(enemy.x, enemy.y, true);
            enemies.current.splice(j, 1);
            setScore(s => s + CONFIG.SCORE_PER_KILL);
            hitEnemy = true;
            break;
          }
        }

        if (hitEnemy || dist < CONFIG.MISSILE_SPEED) {
          createExplosion(m.tx, m.ty, true);
          missiles.current.splice(i, 1);
        } else {
          const angle = Math.atan2(m.ty - m.y, m.tx - m.x);
          m.x += Math.cos(angle) * CONFIG.MISSILE_SPEED;
          m.y += Math.sin(angle) * CONFIG.MISSILE_SPEED;
          
          // Draw Missile Trail
          ctx.strokeStyle = 'rgba(77, 234, 255, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(m.sx, m.sy);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();

          // Draw Bullet (Better visuals)
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.rotate(angle);
          
          // Glow
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#4deaff';
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Core
          ctx.fillStyle = '#4deaff';
          ctx.beginPath();
          ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Draw Target Cross
          ctx.strokeStyle = 'rgba(77, 234, 255, 0.6)';
          ctx.beginPath();
          ctx.moveTo(m.tx - 8, m.ty - 8);
          ctx.lineTo(m.tx + 8, m.ty + 8);
          ctx.moveTo(m.tx + 8, m.ty - 8);
          ctx.lineTo(m.tx - 8, m.ty + 8);
          ctx.stroke();
        }
      }

      // 5. Update Explosions
      for (let i = explosions.current.length - 1; i >= 0; i--) {
        const exp = explosions.current[i];
        exp.r += 1.5;
        
        if (exp.r > CONFIG.EXPLOSION_RADIUS) {
          explosions.current.splice(i, 1);
          continue;
        }
        
        const alpha = 1 - (exp.r / CONFIG.EXPLOSION_RADIUS);
        
        // Main explosion body
        const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.r);
        if (exp.isFriendly) {
          gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          gradient.addColorStop(0.2, `rgba(77, 234, 255, ${alpha})`);
          gradient.addColorStop(0.5, `rgba(0, 100, 255, ${alpha * 0.5})`);
          gradient.addColorStop(1, `rgba(0, 0, 50, 0)`);
        } else {
          gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
          gradient.addColorStop(0.3, `rgba(255, 150, 0, ${alpha})`);
          gradient.addColorStop(0.6, `rgba(255, 50, 0, ${alpha * 0.7})`);
          gradient.addColorStop(1, `rgba(50, 0, 0, 0)`);
        }

        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Extra shockwave ring
        if (exp.r > 10) {
          ctx.beginPath();
          ctx.arc(exp.x, exp.y, exp.r * 0.8, 0, Math.PI * 2);
          ctx.strokeStyle = exp.isFriendly ? `rgba(77, 234, 255, ${alpha * 0.5})` : `rgba(255, 100, 0, ${alpha * 0.5})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Particles/Sparks
        if (exp.r < CONFIG.EXPLOSION_RADIUS * 0.5) {
          for (let p = 0; p < 5; p++) {
            const pAngle = Math.random() * Math.PI * 2;
            const pDist = Math.random() * exp.r;
            ctx.fillStyle = '#fff';
            ctx.fillRect(exp.x + Math.cos(pAngle) * pDist, exp.y + Math.sin(pAngle) * pDist, 2, 2);
          }
        }

        // Damage detection
        if (exp.isFriendly) {
          for (let j = enemies.current.length - 1; j >= 0; j--) {
            const enemy = enemies.current[j];
            if (Math.hypot(enemy.x - exp.x, enemy.y - exp.y) < exp.r) {
              enemies.current.splice(j, 1);
              setScore(s => s + CONFIG.SCORE_PER_KILL);
            }
          }
        }
      }

      // Win Condition
      if (score >= CONFIG.WIN_SCORE) {
        setGameState('WIN');
      }

      animationFrameId = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, score, cities, towers]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4 font-mono select-none">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-1">
          <Shield className="text-cyan-400 w-8 h-8" />
          <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            TINA NOVA DEFENSE
          </h1>
        </div>
        <div className="flex items-center justify-center gap-6 text-sm font-bold">
          <span className="flex items-center gap-1 text-cyan-400">
            <Target className="w-4 h-4" /> SCORE: {score}
          </span>
          <span className="text-slate-500">/</span>
          <span className="flex items-center gap-1 text-yellow-500">
            <Trophy className="w-4 h-4" /> GOAL: {CONFIG.WIN_SCORE}
          </span>
        </div>
      </motion.div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        <div className="relative border-4 border-slate-800 rounded-lg overflow-hidden shadow-2xl bg-black">
          <canvas 
            ref={canvasRef}
            width={CONFIG.CANVAS_WIDTH}
            height={CONFIG.CANVAS_HEIGHT}
            className="cursor-crosshair max-w-full h-auto touch-none"
            onMouseDown={handleFire}
            onTouchStart={(e) => {
              e.preventDefault();
              handleFire(e);
            }}
          />

          <AnimatePresence>
            {gameState !== 'PLAYING' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
              >
                {gameState === 'START' && (
                  <>
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="mb-8"
                    >
                      <Shield className="w-24 h-24 text-cyan-400 mx-auto mb-4" />
                      <h2 className="text-5xl font-black mb-2">PLANETARY DEFENSE</h2>
                      <p className="text-slate-400 max-w-md">Protect the 6 cities of Tina Nova from incoming orbital strikes. Use your 3 missile batteries to intercept threats.</p>
                    </motion.div>
                    <button 
                      onClick={resetGame}
                      className="group relative px-12 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-full text-2xl font-black transition-all hover:scale-105 flex items-center gap-3"
                    >
                      <Play className="fill-current" /> START MISSION
                    </button>
                  </>
                )}

                {gameState === 'WIN' && (
                  <>
                    <Trophy className="w-24 h-24 text-yellow-400 mb-4" />
                    <h2 className="text-6xl font-black mb-2 text-yellow-400">MISSION SUCCESS</h2>
                    <p className="text-2xl mb-8">Final Score: {score}</p>
                    <button 
                      onClick={resetGame}
                      className="px-12 py-4 bg-yellow-600 hover:bg-yellow-500 rounded-full text-2xl font-black transition-all hover:scale-105 flex items-center gap-3"
                    >
                      <RefreshCw /> RETRY
                    </button>
                  </>
                )}

                {gameState === 'GAMEOVER' && (
                  <>
                    <AlertTriangle className="w-24 h-24 text-red-500 mb-4" />
                    <h2 className="text-6xl font-black mb-2 text-red-500">PLANET LOST</h2>
                    <p className="text-2xl mb-8 text-slate-400">All cities have been destroyed.</p>
                    <button 
                      onClick={resetGame}
                      className="px-12 py-4 bg-red-600 hover:bg-red-500 rounded-full text-2xl font-black transition-all hover:scale-105 flex items-center gap-3"
                    >
                      <RefreshCw /> REBOOT SYSTEM
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 底部弹药指示器 */}
      <div className="mt-8 grid grid-cols-3 gap-12 w-full max-w-2xl">
        <AmmoTower label="BATTERY ALPHA" count={ammo.left} active={towers[0]} color="cyan" />
        <AmmoTower label="CENTRAL COMMAND" count={ammo.center} active={towers[1]} color="yellow" />
        <AmmoTower label="BATTERY OMEGA" count={ammo.right} active={towers[2]} countMax={CONFIG.TOTAL_MISSILES.right} color="cyan" />
      </div>

      <div className="mt-8 text-slate-600 text-[10px] uppercase tracking-[0.2em]">
        System Status: {gameState === 'PLAYING' ? 'Active Defense' : 'Standby'} | Version 1.0.4-Nova
      </div>
    </div>
  );
}

function AmmoTower({ label, count, active, color }: { label: string, count: number, active: boolean, color: 'cyan' | 'yellow', countMax?: number }) {
  const colorClass = color === 'cyan' ? 'text-cyan-400' : 'text-yellow-400';
  const bgClass = color === 'cyan' ? 'bg-cyan-400/20' : 'bg-yellow-400/20';
  const borderClass = color === 'cyan' ? 'border-cyan-400/30' : 'border-yellow-400/30';

  return (
    <div className={`flex flex-col items-center p-3 rounded-xl border ${active ? borderClass : 'border-slate-800 opacity-40'} transition-all`}>
      <p className="text-[10px] font-bold text-slate-500 mb-2 tracking-widest">{label}</p>
      <div className={`text-3xl font-black ${active ? colorClass : 'text-slate-700'}`}>
        {active ? count : 'OFFLINE'}
      </div>
      {active && (
        <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
          <motion.div 
            initial={{ width: '100%' }}
            animate={{ width: `${(count / 15) * 100}%` }}
            className={`h-full ${bgClass.replace('/20', '')}`}
          />
        </div>
      )}
    </div>
  );
}
