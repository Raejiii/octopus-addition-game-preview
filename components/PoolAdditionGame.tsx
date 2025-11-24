import { useEffect, useMemo, useRef, useState } from "react"
import confetti from "canvas-confetti"
import { Pause, Play, RotateCcw, Music, VolumeX, SkipForward, HelpCircle, X } from "lucide-react"
import { gameConfig } from "../config/game-config"

type Player = "left" | "right"

type Ball = {
  id: number
  value: number
  x: number
  y: number
  selected: boolean
}

type ArmAnim = {
  id: number
  x: number
  y: number
  angle: number
  width: number
  height: number
  opacity: number
  side: Player
  filter?: string
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

 

export default function PoolAdditionGame() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [balls, setBalls] = useState<Ball[]>([])
  const [target, setTarget] = useState<number>(0)
  const [activePlayer, setActivePlayer] = useState<Player>("left")
  const [scores, setScores] = useState<{ left: number; right: number }>({ left: 0, right: 0 })
  const [, setMessage] = useState<string>("")
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [showSidebar, setShowSidebar] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [showHelp, setShowHelp] = useState<boolean>(false)
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [wrapWidthPx, setWrapWidthPx] = useState<number>(760)
  const [correctPair, setCorrectPair] = useState<number[]>([])
  const roundTimerRef = useRef<number | null>(null)
  const [gameOver, setGameOver] = useState<Player | null>(null)
  const [roundResolved, setRoundResolved] = useState<boolean>(false)
  const selectedCountRef = useRef<number>(0)
  const selectedSumRef = useRef<number>(0)
  const activePlayerRef = useRef<Player>("left")
  const [arms, setArms] = useState<ArmAnim[]>([])
  const armIdRef = useRef<number>(1)

  // helpers for responsive scaling
  const baseWidth = 760
  const aspect = 3 / 2
  const scale = wrapWidthPx / baseWidth
  const clampNum = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

  // Confetti celebration (ported from ConnectTheDots)
  const playConfetti = (): void => {
    const duration = 3 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)

      confetti(
        Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 },
        }),
      )
    }, 250)
  }

  useEffect(() => {
    const computeWidth = () => {
      const vwWidth = Math.floor(window.innerWidth * 0.98)
      const capWidth = baseWidth
      const headerH = headerRef.current?.offsetHeight ?? 0
      const safety = 64 // bottom spacing, paddings, buttons
      const availableH = Math.max(240, window.innerHeight - headerH - safety)
      const widthFromH = Math.floor(availableH * aspect)
      const newWidth = Math.max(260, Math.min(vwWidth, capWidth, widthFromH))
      setWrapWidthPx(newWidth)
    }
    computeWidth()
    window.addEventListener("resize", computeWidth)
    return () => window.removeEventListener("resize", computeWidth)
  }, [])

  const selectedSum = useMemo(
    () => balls.filter((b) => b.selected).reduce((s, b) => s + b.value, 0),
    [balls]
  )
  const selectedCount = useMemo(() => balls.filter((b) => b.selected).length, [balls])
  useEffect(() => { selectedCountRef.current = selectedCount }, [selectedCount])
  useEffect(() => { selectedSumRef.current = selectedSum }, [selectedSum])
  useEffect(() => { activePlayerRef.current = activePlayer }, [activePlayer])

  const startRound = () => {
    if (gameOver) return
    const count = scale < 0.55 ? randInt(5, 7) : randInt(6, 9)
    // Generate positions that avoid overlapping the central lifebuoy
    const generatePositionsSafe = (c: number) => {
      const positions: { x: number; y: number }[] = []
      const poolHeightPx = wrapWidthPx / aspect
      const ballPx = clampNum(Math.round(56 * scale), 30, 84)
      const lifePx = clampNum(Math.round(150 * scale), 120, 200)
      const marginPx = Math.round(28 * scale)
      // Extra margin to keep balls away from pool's white walls/edges
      const extraEdgePx = Math.round(24 * scale)
      const safeFactor = scale < 0.55 ? 1.35 : 1.18
      const rx = (((lifePx / 2) * safeFactor) + (ballPx / 2) + marginPx) / wrapWidthPx * 100
      const ry = (((lifePx / 2) * safeFactor) + (ballPx / 2) + marginPx) / poolHeightPx * 100
      const rxBall = (ballPx / 2) / wrapWidthPx * 100
      const ryBall = (ballPx / 2) / poolHeightPx * 100

      // compute exclusion bands near left/right edges where octopuses overlap the pool
      const leftOffsetPx = clampNum(Math.round(wrapWidthPx * 0.09), 12, 72)
      const rightOffsetPx = clampNum(Math.round(wrapWidthPx * 0.09), 12, 72)
      const leftOctoWidthPx = clampNum(Math.round(wrapWidthPx * 0.20), 80, 140)
      const rightOctoWidthPx = clampNum(Math.round(wrapWidthPx * 0.22), 88, 150)
      const leftOverlapPx = Math.max(0, leftOctoWidthPx - leftOffsetPx)
      const rightOverlapPx = Math.max(0, rightOctoWidthPx - rightOffsetPx)
      let leftBandPercent = (leftOverlapPx / wrapWidthPx) * 100
      let rightBandPercent = (rightOverlapPx / wrapWidthPx) * 100
      // soften bands slightly to avoid overly shrinking the play area
      leftBandPercent = Math.max(0, leftBandPercent * 0.9)
      rightBandPercent = Math.max(0, rightBandPercent * 0.9)
      let minXPercent = 8 + leftBandPercent
      let maxXPercent = 92 - rightBandPercent
      if (maxXPercent - minXPercent < 20) {
        // relax bands if the area gets too narrow
        minXPercent = 8 + leftBandPercent * 0.5
        maxXPercent = 92 - rightBandPercent * 0.5
      }
      if (maxXPercent - minXPercent < 14) {
        // final fallback to defaults
        minXPercent = 8
        maxXPercent = 92
      }

      // Apply wall margins so balls don't sit on the pool's white walls
      const wallMarginXPercent = (((ballPx / 2) + marginPx + extraEdgePx) / wrapWidthPx) * 100
      const wallMarginYPercent = (((ballPx / 2) + marginPx + extraEdgePx) / poolHeightPx) * 100
      minXPercent = Math.max(minXPercent, wallMarginXPercent)
      maxXPercent = Math.min(maxXPercent, 100 - wallMarginXPercent)
      let minYPercent = Math.max(12, wallMarginYPercent)
      let maxYPercent = Math.min(88, 100 - wallMarginYPercent)
      if (maxYPercent - minYPercent < 20) {
        // soften Y margins slightly if area gets tight
        minYPercent = Math.max(10, minYPercent * 0.8)
        maxYPercent = Math.min(90, 100 - ((100 - maxYPercent) * 0.8))
      }
      if (maxYPercent - minYPercent < 14) {
        // final fallback to defaults
        minYPercent = 12
        maxYPercent = 88
      }

      const insideCenter = (xx: number, yy: number) => {
        const dx = (xx - 50) / rx
        const dy = (yy - 50) / ry
        return (dx * dx + dy * dy) <= 1
      }
      const okApartFrom = (xx: number, yy: number, sep: number) =>
        positions.every((p) => {
          const ddx = (p.x - xx) / rxBall
          const ddy = (p.y - yy) / ryBall
          const dUnits = Math.sqrt(ddx * ddx + ddy * ddy)
          return dUnits > sep
        })

      for (let i = 0; i < c; i++) {
        let x = 50
        let y = 50
        let tries = 0
        let sepUnits = 2.6 // >2 means no touch; add margin
        let found = false
        while (tries < 700) {
          x = randInt(Math.ceil(minXPercent), Math.floor(maxXPercent))
          y = randInt(Math.ceil(minYPercent), Math.floor(maxYPercent))
          tries++
          if (!insideCenter(x, y) && okApartFrom(x, y, sepUnits)) {
            found = true
            break
          }
          // if it's hard to place, slightly relax spacing after many tries
          if (tries % 120 === 0) {
            sepUnits = Math.max(2.2, sepUnits * 0.94)
          }
        }
        if (!found) {
          const anchors = [
            { x: Math.min(90, Math.max(minXPercent + 8, 16)), y: Math.min(90, Math.max(minYPercent + 4, 16)) },
            { x: Math.max(10, Math.min(maxXPercent - 8, 84)), y: Math.min(90, Math.max(minYPercent + 4, 16)) },
            { x: Math.min(90, Math.max(minXPercent + 8, 16)), y: Math.max(10, Math.min(maxYPercent - 4, 84)) },
            { x: Math.max(10, Math.min(maxXPercent - 8, 84)), y: Math.max(10, Math.min(maxYPercent - 4, 84)) },
            { x: Math.min(90, Math.max(minXPercent + 10, 18)), y: 50 },
            { x: Math.max(10, Math.min(maxXPercent - 10, 82)), y: 50 },
            { x: 50, y: Math.min(90, Math.max(minYPercent + 4, 16)) },
            { x: 50, y: Math.max(10, Math.min(maxYPercent - 4, 84)) },
          ]
          for (const a of anchors) {
            if (!insideCenter(a.x, a.y) && okApartFrom(a.x, a.y, 2.3)) {
              x = a.x
              y = a.y
              found = true
              break
            }
          }
        }
        positions.push({ x, y })
      }
      return positions
    }
    const positions = generatePositionsSafe(count)
    const values = Array.from({ length: count }, () => randInt(1, 9))
    const nextBalls: Ball[] = positions.map((p, i) => ({
      id: i + 1,
      value: values[i],
      x: p.x,
      y: p.y,
      selected: false,
    }))
    // Ensure the target is the sum of TWO balls (pair-sum guaranteed)
    let i1 = randInt(0, count - 1)
    let i2 = randInt(0, count - 1)
    while (i2 === i1) {
      i2 = randInt(0, count - 1)
    }
    const t = nextBalls[i1].value + nextBalls[i2].value
    const pairIds = [nextBalls[i1].id, nextBalls[i2].id]
    setBalls(nextBalls)
    setTarget(t)
    setCorrectPair(pairIds)
    setMessage("")
    setIsPaused(false)
    setShowSidebar(false)
    
    setRoundResolved(false)
    if (roundTimerRef.current) {
      clearTimeout(roundTimerRef.current)
      roundTimerRef.current = null
    }
    roundTimerRef.current = window.setTimeout(() => {
      if (gameOver || isPaused) return
      const ok = selectedCountRef.current === 2 && selectedSumRef.current === t && activePlayerRef.current === "left"
      if (!ok) {
        setActivePlayer("right")
        const b1 = nextBalls.find((bb) => bb.id === pairIds[0])
        const b2 = nextBalls.find((bb) => bb.id === pairIds[1])
        if (b1) {
          spawnArm("right", b1.x, b1.y)
          setBalls((prev) => prev.map((bb) => (bb.id === b1.id ? { ...bb, selected: true } : { ...bb, selected: false })))
        }
        setTimeout(() => {
          if (b2) {
            spawnArm("right", b2.x, b2.y)
            setBalls((prev) => prev.map((bb) => (bb.id === b2.id ? { ...bb, selected: true } : bb)))
          }
        }, 600)
      }
    }, 7000)
  }

  useEffect(() => {
    startRound()
  }, [])

  const spawnArm = (side: Player, txPercent: number, tyPercent: number) => {
    const poolHeightPx = wrapWidthPx / aspect
    const marginPx = Math.round(18 * scale)
    const originXPx = side === "left" ? marginPx : wrapWidthPx - marginPx
    const originYPx = poolHeightPx / 2
    const targetXPx = (txPercent / 100) * wrapWidthPx
    const targetYPx = (tyPercent / 100) * poolHeightPx
    const dx = targetXPx - originXPx
    const dy = targetYPx - originYPx
    const len = Math.sqrt(dx * dx + dy * dy)
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const h = clampNum(Math.round(30 * scale), 14, 40)
    const newId = armIdRef.current++
    const filter = "none"
    const pad = clampNum(Math.round(40 * scale), 16, 64)
    setArms((a) => [...a, { id: newId, x: originXPx, y: originYPx, angle, width: 1, height: h, opacity: 1, side, filter }])
    setTimeout(() => {
      setArms((a) => a.map((aa) => (aa.id === newId ? { ...aa, width: len + pad } : aa)))
    }, 10)
    setTimeout(() => {
      setArms((a) => a.map((aa) => (aa.id === newId ? { ...aa, opacity: 0 } : aa)))
    }, 450)
    setTimeout(() => {
      setArms((a) => a.filter((aa) => aa.id !== newId))
    }, 700)
  }

  const toggleBall = (id: number) => {
    if (isPaused) return
    setBalls((prev) => {
      const currentSelected = prev.filter((b) => b.selected).length
      const next = prev.map((b) => {
        if (b.id !== id) return b
        // Enforce selecting at most two balls
        if (!b.selected && currentSelected >= 2) {
          // Ignore selection if already two balls chosen
          return b
        }
        return { ...b, selected: !b.selected }
      })
      const chosen = prev.find((b) => b.id === id)
      const willSelect = chosen && !chosen.selected && currentSelected < 2
      if (willSelect && chosen) {
        spawnArm("left", chosen.x, chosen.y)
      }
      return next
    })
  }

  const togglePause = () => {
    setIsPaused((p) => {
      const next = !p
      setShowSidebar(next)
      return next
    })
  }

  const playAudio = (name: string, loop: boolean = false): void => {
    if (!isMuted) {
      if (!audioRefs.current[name]) {
        const src = (gameConfig.audio as unknown as Record<string, string>)[name]
        audioRefs.current[name] = new Audio(src)
        if (audioRefs.current[name]) {
          audioRefs.current[name]!.loop = loop
        }
      }

      if (audioRefs.current[name] && audioRefs.current[name]!.paused) {
        audioRefs.current[name]!
          .play()
          .catch((error) => {
            console.error(`Error playing audio ${name}:`, error)
          })
      }
    }
  }

  const pauseAudio = (name: string): void => {
    if (audioRefs.current[name]) {
      audioRefs.current[name]!.pause()
    }
  }

  const stopAllAudio = (): void => {
    Object.values(audioRefs.current).forEach((audio) => {
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    })
  }

  const toggleMute = () => {
    setIsMuted((m) => {
      const next = !m
      if (next) {
        stopAllAudio()
      } else {
        if (!isPaused) {
          playAudio("background", true)
        }
      }
      return next
    })
  }

  const resetRound = () => {
    if (gameOver) {
      setScores({ left: 0, right: 0 })
      setGameOver(null)
    }
    startRound()
  }

  const skipRound = () => {
    startRound()
  }

  const openHelp = () => {
    setShowHelp(true)
    setIsPaused(true)
    setShowSidebar(true)
    playAudio("instructions")
  }

  const closeHelp = () => {
    setShowHelp(false)
    setIsPaused(false)
    setShowSidebar(false)
    pauseAudio("instructions")
    if (!isMuted) {
      playAudio("background", true)
    }
  }

  useEffect(() => {
    // Background music management
    if (!isPaused && !isMuted) {
      playAudio("background", true)
    } else {
      pauseAudio("background")
    }
    return () => {
      // Cleanup on unmount
      stopAllAudio()
    }
  }, [isPaused, isMuted])

  useEffect(() => {
    if (!balls.length) return
    if (selectedCount === 2 && !roundResolved) {
      if (roundTimerRef.current) {
        clearTimeout(roundTimerRef.current)
        roundTimerRef.current = null
      }
      if (selectedSum === target) {
        const computer = activePlayer === "right"
        setMessage(computer ? "Computer guessed it." : "Nice! You got it.")
        setScores((s) => ({ ...s, [activePlayer]: s[activePlayer] + 1 }))
        if (!computer) playConfetti()
      } else {
        setActivePlayer("right")
        const c1 = correctPair[0]
        const c2 = correctPair[1]
        const b1 = balls.find((bb) => bb.id === c1)
        const b2 = balls.find((bb) => bb.id === c2)
        if (b1) {
          spawnArm("right", b1.x, b1.y)
          setBalls((prev) => prev.map((bb) => {
            if (bb.id === b1.id) return { ...bb, selected: true }
            if (bb.selected) return { ...bb, selected: false }
            return bb
          }))
        }
        setTimeout(() => {
          if (b2) {
            spawnArm("right", b2.x, b2.y)
            setBalls((prev) => prev.map((bb) => (bb.id === b2.id ? { ...bb, selected: true } : bb)))
          }
        }, 600)
      }
      if (selectedSum === target) {
        setRoundResolved(true)
      }
    }
    if (selectedCount === 1) {
      setMessage("Pick exactly two balls.")
    } else if (selectedCount === 0) {
      setMessage("")
    }
  }, [selectedCount, selectedSum, target, balls, activePlayer, correctPair, gameOver, roundResolved])

  useEffect(() => {
    if (!roundResolved) return
    const delay = activePlayer === "right" ? 400 : 700
    const id = setTimeout(() => {
      if (!gameOver) startRound()
    }, delay)
    return () => clearTimeout(id)
  }, [roundResolved, activePlayer, gameOver])

  // simple round timer (mm:ss) — pauses when game is paused
  useEffect(() => {
    if (isPaused) return
    const id = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [isPaused])

  useEffect(() => {
    if (scores.left >= 10 || scores.right >= 10) {
      setGameOver(scores.left >= 10 ? "left" : "right")
      setIsPaused(true)
    }
  }, [scores.left, scores.right])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  }

 

  return (
    <div
      className="h-screen w-screen overflow-hidden relative"
      style={{
        backgroundColor: "#F6E3C5",
        backgroundImage: "url('/Desktop%20Kittien%20Match.svg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* corner accents removed to avoid stray image */}
      {/* Top-right Help button */}
      <div className="fixed top-4 right-4 z-[60]">
        <button
          onClick={openHelp}
          className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-colors shadow-lg"
          aria-label="Help"
        >
          <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12 text-white" />
        </button>
      </div>
      {/* Pause Sidebar Controls */}
      <div
        className={`fixed top-4 left-4 z-[60] transition-all duration-300 ${
          showSidebar ? "w-14 sm:w-16 lg:w-20" : "w-10 sm:w-12 lg:w-16"
        }`}
      >
        <div className="flex flex-col items-center gap-2 sm:gap-4 lg:gap-6">
          <button
            onClick={togglePause}
            className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full bg-violet-500 hover:bg-violet-600 flex items-center justify-center transition-colors shadow-lg"
            aria-label={showSidebar ? "Resume game" : "Pause game"}
          >
            {showSidebar ? (
              <Play className="w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12 text-white" />
            ) : (
              <Pause className="w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12 text-white" />
            )}
          </button>
          {showSidebar && (
            <>
              <button
                onClick={toggleMute}
                className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full ${
                  isMuted ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                } flex items-center justify-center transition-colors shadow-lg`}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 sm:w-6 sm:h-6 lg:w-10 lg:h-10 text-white" />
                ) : (
                  <Music className="w-5 h-5 sm:w-6 sm:h-6 lg:w-10 lg:h-10 text-white" />
                )}
              </button>
              <button
                onClick={resetRound}
                className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center transition-colors shadow-lg"
                aria-label="Reset round"
              >
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 lg:w-10 lg:h-10 text-white" />
              </button>
              <button
                onClick={skipRound}
                className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors shadow-lg"
                aria-label="Skip round"
              >
                <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 lg:w-10 lg:h-10 text-white" />
              </button>
            </>
          )}
        </div>
      </div>
      {/* Title and timer */}
      <div className="max-w-6xl mx-auto h-full flex flex-col items-center justify-start">
        <div ref={headerRef} className="w-full px-2 sm:px-4 pt-4 sm:pt-8 pb-2 sm:pb-4 flex items-center justify-center">
          <div className="text-center">
            <div
              style={{
                color: "#252525",
                textAlign: "center",
                fontFamily: 'Luckiest Guy',
                fontSize: "38px",
                fontStyle: "normal",
                fontWeight: 400,
                lineHeight: "28px",
                letterSpacing: "3.8px",
                textTransform: "uppercase",
              }}
            >
              Octopus Number Splash
            </div>
            <div className="mt-1 inline-flex items-center gap-2 text-black font-semibold">
              <img src="/time-hourglass-H3UkbK6hVS.svg" alt="Timer" className="w-4 h-4 sm:w-5 sm:h-5" />
              <span
                style={{
                  color: "var(--black-300, #252525)",
                  fontFamily: "Nunito",
                  fontSize: clampNum(Math.round(wrapWidthPx * 0.04), 16, 30),
                  fontStyle: "normal",
                  fontWeight: 800,
                  lineHeight: "28px",
                }}
              >
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full px-0 sm:px-2 pb-4 sm:pb-8 flex items-center justify-center relative" ref={containerRef}>
          {/* Pool with side octopus wrapper */}
          <div className="relative inline-block" ref={wrapperRef} style={{ width: wrapWidthPx }}>
            {/* Swimming pool area using SVG background */}
            <div
              className="relative w-full aspect-[3/2] rounded-xl overflow-hidden"
              style={{
                backgroundImage: "url(/Group-4.svg)",
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >

            {arms.map((a) => (
              <img
                key={a.id}
                src={a.side === "right" ? "/Group%2026086546.svg" : "/Group%2026086544.svg"}
                className="absolute"
                style={{
                  left: a.x,
                  top: a.y,
                  width: a.width,
                  height: a.height,
                  maxWidth: "none",
                  objectFit: "fill",
                  transform: `translateY(-50%) rotate(${a.angle}deg)`,
                  transformOrigin: "left center",
                  transition: "width 300ms ease-out, opacity 200ms ease-in-out",
                  opacity: a.opacity,
                  filter: a.filter ?? "none",
                  zIndex: 18,
                  pointerEvents: "none",
                }}
                alt="arm"
              />
            ))}

            {balls.map((b) => (
              <button
                key={b.id}
                onClick={() => toggleBall(b.id)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md focus:outline-none`}
                style={{
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: clampNum(Math.round(56 * scale), 30, 84),
                  height: clampNum(Math.round(56 * scale), 30, 84),
                  backgroundImage: b.selected ? "url('/Group%2026086542-3.svg')" : "url('/Group%2026086542.svg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  color: "#fff",
                  zIndex: 20,
                }}
              >
                <span
                  className="font-extrabold drop-shadow"
                  style={{
                    fontSize: clampNum(Math.round(20 * scale), 12, 26),
                    color: b.selected ? "#000" : "#fff",
                    fontFamily: "Bubblegum Sans",
                  }}
                >
                  {b.value}
                </span>
              </button>
            ))}

            {/* central lifebuoy target */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              style={{ width: clampNum(Math.round(150 * scale), 120, 200), height: clampNum(Math.round(150 * scale), 120, 200), zIndex: 5 }}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/60027ad706fa8ba9ef017c53d6d8736acc3a624d?width=440"
                  alt="buoy"
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ width: '100%', height: '100%' }}
                />
                <svg
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ width: '75%', height: '75%', flexShrink: 0, aspectRatio: '1/1' }}
                  viewBox="0 0 172 172"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="86" cy="86" r="86" fill="#009EC9" fillOpacity="0.8"/>
                </svg>
                <div className="relative flex flex-col items-center justify-center" style={{ marginTop: clampNum(Math.round(12 * scale), 8, 16) }}>
                  <div
                    className="uppercase text-white font-bold drop-shadow"
                    style={{
                      fontSize: clampNum(Math.round(24 * scale), 12, 28),
                      fontFamily: "Bubblegum Sans",
                      lineHeight: 1.1,
                    }}
                  >
                    MAKE
                  </div>
                  <div
                    className="font-black drop-shadow-lg"
                    style={{ fontSize: clampNum(Math.round(56 * scale), 36, 72), fontFamily: "Bubblegum Sans", color: "#FFF600" }}
                  >
                    {target}
                  </div>
                </div>
              </div>
            </div>

            </div>

            {/* left player (You) */}
            <button
              className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-10 cursor-pointer"
              style={{ left: -clampNum(Math.round(wrapWidthPx * 0.09), 12, 72) }}
              onClick={() => setActivePlayer("left")}
              aria-label="Select left player"
            >
              <img
                src="/Group-2.svg"
                alt="You"
                className="h-auto"
                style={{ width: clampNum(Math.round(wrapWidthPx * 0.20), 80, 140) }}
              />
              <div
                className="mt-1 text-[#8B0000] font-semibold"
                style={{ fontSize: clampNum(Math.round(wrapWidthPx * 0.024), 11, 16), lineHeight: 1.1, fontFamily: "Bubblegum Sans" }}
              >
                You
              </div>
              <div
                className="text-[#8B0000]"
                style={{ fontSize: clampNum(Math.round(wrapWidthPx * 0.022), 10, 14), lineHeight: 1.1, fontFamily: "Bubblegum Sans" }}
              >
                Score {scores.left}
              </div>
            </button>

            {/* right player (Computer 1) */}
            <button
              className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-10 cursor-pointer"
              style={{ right: -clampNum(Math.round(wrapWidthPx * 0.09), 12, 72) }}
              onClick={() => setActivePlayer("right")}
              aria-label="Select right player"
            >
              <img
                src="/Group-3.svg"
                alt="Computer 1"
                className="h-auto"
                style={{ width: clampNum(Math.round(wrapWidthPx * 0.22), 88, 150) }}
              />
              <div
                className="mt-1 text-indigo-700 font-semibold"
                style={{ fontSize: clampNum(Math.round(wrapWidthPx * 0.024), 11, 16), lineHeight: 1.1, fontFamily: "Bubblegum Sans" }}
              >
                Computer 1
              </div>
              <div
                className="text-indigo-700"
                style={{ fontSize: clampNum(Math.round(wrapWidthPx * 0.022), 10, 14), lineHeight: 1.1, fontFamily: "Bubblegum Sans" }}
              >
                Score {scores.right}
              </div>
            </button>
          </div>

          
        </div>
      </div>

      {/* Help Overlay */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80]">
          <div className="bg-white rounded-xl p-6 sm:p-8 max-w-md w-11/12 text-black relative">
            <button
              onClick={closeHelp}
              className="absolute top-3 right-3 p-2 rounded-full bg-gray-200 hover:bg-gray-300"
              aria-label="Close help"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold mb-4 text-center">How to Play</h2>
            <ul className="space-y-2 text-sm">
              <li>- Pick exactly two balls to make the target.</li>
              <li>- Wrong pair gives the computer an automatic point.</li>
              <li>- Tap balls to select/deselect them.</li>
              <li>- The selected sum shows under the target.</li>
              <li>- Switch octopus sides to change the active player.</li>
              <li>- Pause disables ball selection; use the left button.</li>
            </ul>
            <div className="mt-5 flex items-center justify-center">
              <button
                onClick={closeHelp}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      {gameOver && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90]">
          <div className="bg-white rounded-xl p-6 sm:p-8 max-w-sm w-11/12 text-black text-center">
            <div className="text-2xl font-bold mb-3">{gameOver === "left" ? "You win!" : "Computer wins!"}</div>
            <div className="mb-5 text-sm">First to 10 points wins.</div>
            <button
              onClick={() => {
                setScores({ left: 0, right: 0 })
                setGameOver(null)
                setIsPaused(false)
                startRound()
              }}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
            >
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
