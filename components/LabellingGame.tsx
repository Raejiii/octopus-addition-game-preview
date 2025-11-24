// @ts-nocheck
import { useState, useEffect, useRef } from "react"
import { Pause, Play, RotateCcw, HelpCircle, Music, VolumeX, SkipForward } from "lucide-react"
import confetti from "canvas-confetti"
import { gameConfig } from "../config/game-config"
import { useNavigate } from "react-router-dom"

// Types for scenarios, labels, drag and misc helpers
type Difficulty = "easy" | "medium" | "hard" | "all"

interface LabelPosition {
  id: string
  x: number
  y: number
  label: string
  targetX: number
  targetY: number
}

interface Scenario {
  id: number
  name: string
  difficulty: Difficulty | string
  title: string
  image: string
  labelPositions: LabelPosition[]
  labels: string[]
}

type GameState = "start" | "playing" | "paused" | "help" | "allComplete"

interface FloatingText {
  text: string
  show: boolean
}

type DragPoint = { x: number; y: number }
type DragEvt = MouseEvent | TouchEvent | React.MouseEvent<Element> | React.TouchEvent<Element>
interface Bounds { left: number; top: number; width: number; height: number }

export function LabellingGame() {
  const [showSplash, setShowSplash] = useState<boolean>(true)
  const [gameState, setGameState] = useState<GameState>("start")
  const [showOverlay, setShowOverlay] = useState<boolean>(true)
  const [showSidebar, setShowSidebar] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [floatingText, setFloatingText] = useState<FloatingText>({ text: "", show: false })
  const [isSplashFading, setIsSplashFading] = useState<boolean>(false)
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState<number>(0)
  const [currentScenario, setCurrentScenario] = useState<Scenario>(gameConfig.scenarios[0] as Scenario)
  const [placedLabels, setPlacedLabels] = useState<Record<string, LabelPosition>>({})
  const [draggedLabel, setDraggedLabel] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<DragPoint>({ x: 0, y: 0 })
  const [dragPosition, setDragPosition] = useState<DragPoint>({ x: 0, y: 0 })
  const [isComplete, setIsComplete] = useState<boolean>(false)
  const [currentLevel, setCurrentLevel] = useState<number>(1)
  const [totalLevels] = useState<number>(gameConfig.scenarios.length)
  const [difficulty, setDifficulty] = useState<Difficulty>("all")
  const [filteredScenarios, setFilteredScenarios] = useState<Scenario[]>(gameConfig.scenarios as Scenario[])
  const [eKeyPresses, setEKeyPresses] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState<number>(120) // 2 minutes in seconds
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false)
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const gameAreaRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const labelsAreaRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "e") {
        const now = Date.now()
        setEKeyPresses((prev) => {
          // Keep only presses from the last 2 seconds
          const recentPresses = prev.filter((time) => now - time < 2000)
          const newPresses = [...recentPresses, now]

          // If we have 5 presses in 2 seconds, navigate to editor
          if (newPresses.length >= 5) {
            navigate("/editor")
            return []
          }

          return newPresses
        })
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [navigate])

  // Global drag event listeners for smooth dragging across entire viewport
  useEffect(() => {
    const handleGlobalDragMove = (e: MouseEvent | TouchEvent) => {
      if (draggedLabel) {
        e.preventDefault()
        handleDragMove(e)
      }
    }

    const handleGlobalDragEnd = (e: MouseEvent | TouchEvent) => {
      if (draggedLabel) {
        e.preventDefault()
        handleDragEnd(e)
      }
    }

    const preventDefaultDrag = (e: Event) => {
      if (draggedLabel) {
        e.preventDefault()
      }
    }

    if (draggedLabel) {
      document.addEventListener("mousemove", handleGlobalDragMove, { passive: false })
      document.addEventListener("mouseup", handleGlobalDragEnd)
      document.addEventListener("touchmove", handleGlobalDragMove, { passive: false })
      document.addEventListener("touchend", handleGlobalDragEnd)
      document.addEventListener("dragstart", preventDefaultDrag)
      document.addEventListener("selectstart", preventDefaultDrag)
    }

    return () => {
      document.removeEventListener("mousemove", handleGlobalDragMove)
      document.removeEventListener("mouseup", handleGlobalDragEnd)
      document.removeEventListener("touchmove", handleGlobalDragMove)
      document.removeEventListener("touchend", handleGlobalDragEnd)
      document.removeEventListener("dragstart", preventDefaultDrag)
      document.removeEventListener("selectstart", preventDefaultDrag)
    }
  }, [draggedLabel])

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsSplashFading(true)
    }, gameConfig.splashScreen.duration - 500)

    const removeTimer = setTimeout(() => {
      setShowSplash(false)
    }, gameConfig.splashScreen.duration)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  useEffect(() => {
    if (!showSplash) {
      resetGame()
    }
    return () => {
      Object.values(audioRefs.current).forEach((audio) => {
        if (audio) {
          audio.pause()
          audio.currentTime = 0
        }
      })
    }
  }, [showSplash])

  useEffect(() => {
    if (gameState === "playing" && !isMuted) {
      playAudio("background", true)
    } else {
      pauseAudio("background")
    }
  }, [gameState, isMuted])

  useEffect(() => {
    if (difficulty === "all") {
      setFilteredScenarios(gameConfig.scenarios)
    } else {
      setFilteredScenarios(gameConfig.scenarios.filter((scenario) => scenario.difficulty === difficulty))
    }
  }, [difficulty])

  // Timer countdown effect
  useEffect(() => {
    if (isTimerActive && timeLeft > 0 && !isComplete) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerActive(false)
            // Handle time up - could show message or move to next level
            setFloatingText({ text: "Time's up!", show: true })
            setTimeout(() => nextScenario(), 2000)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isTimerActive, timeLeft, isComplete])

  // Ensure timer active when a new scenario index loads; don't reset on resume
  useEffect(() => {
    if (gameState === "playing" && !showOverlay) {
      // timeLeft is already set in loadScenario; avoid resetting on pause/resume
      setIsTimerActive(true)
    }
  }, [currentScenarioIndex])

  // Stop timer when level is completed
  useEffect(() => {
    if (isComplete) {
      setIsTimerActive(false)
    }
  }, [isComplete])

  const playAudio = (name: string, loop: boolean = false): void => {
    if (!isMuted) {
      if (!audioRefs.current[name]) {
        const src = (gameConfig.audio as Record<string, string>)[name]
        audioRefs.current[name] = new Audio(src)
        if (audioRefs.current[name]) {
          audioRefs.current[name]!.loop = loop
        }
      }

      if (audioRefs.current[name] && (audioRefs.current[name]!.paused || name === "connect")) {
        if (name === "connect") {
          audioRefs.current[name]!.currentTime = 0
        }
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

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Helper function to get actual image bounds within container
  const getImageBounds = (): Bounds | null => {
    if (!gameAreaRef.current || !imageRef.current) return null
    
    const container = gameAreaRef.current.getBoundingClientRect()
    const image = imageRef.current
    
    // Get natural image dimensions
    const naturalWidth = image.naturalWidth
    const naturalHeight = image.naturalHeight
    const naturalAspectRatio = naturalWidth / naturalHeight
    
    // Get container dimensions
    const containerWidth = container.width
    const containerHeight = container.height
    const containerAspectRatio = containerWidth / containerHeight
    
    let imageWidth, imageHeight, offsetX, offsetY
    
    // Calculate actual image size within container (object-contain behavior)
    if (naturalAspectRatio > containerAspectRatio) {
      // Image is wider - fit to container width
      imageWidth = containerWidth
      imageHeight = containerWidth / naturalAspectRatio
      offsetX = 0
      offsetY = (containerHeight - imageHeight) / 2
    } else {
      // Image is taller - fit to container height
      imageHeight = containerHeight
      imageWidth = containerHeight * naturalAspectRatio
      offsetX = (containerWidth - imageWidth) / 2
      offsetY = 0
    }
    
    return {
      left: container.left + offsetX,
      top: container.top + offsetY,
      width: imageWidth,
      height: imageHeight
    }
  }

  const toggleMute = () => {
    setIsMuted((prev) => !prev)
    if (isMuted) {
      if (gameState === "playing") {
        playAudio("background", true)
      }
    } else {
      stopAllAudio()
    }
  }

  const resetGame = (): void => {
    setCurrentScenarioIndex(0)
    setCurrentLevel(1)
    loadScenario(0)
    setGameState("start")
    setShowOverlay(true)
    setShowSidebar(false)
    setTimeLeft(120)
    setIsTimerActive(false)
    stopAllAudio()
  }

  const loadScenario = (scenarioIndex: number): void => {
    const scenariosToUse = filteredScenarios.length > 0 ? filteredScenarios : gameConfig.scenarios
    if (!scenariosToUse || !scenariosToUse[scenarioIndex]) {
      console.error("Scenario not found at index:", scenarioIndex)
      return
    }

    const scenario = scenariosToUse[scenarioIndex]
    setCurrentScenario(scenario)
    setPlacedLabels({})
    setDraggedLabel(null)
    setIsComplete(false)
    setTimeLeft(120)
    setIsTimerActive(true)
  }

  const nextScenario = (): void => {
    const scenariosToUse = filteredScenarios.length > 0 ? filteredScenarios : gameConfig.scenarios
    if (!scenariosToUse || !scenariosToUse.length) return

    const nextIndex = (currentScenarioIndex + 1) % scenariosToUse.length
    setCurrentScenarioIndex(nextIndex)
    setCurrentLevel(nextIndex + 1)
    loadScenario(nextIndex)
    playAudio("uiClick")
  }

  const autoAdvanceToNextLevel = (): void => {
    const scenariosToUse = filteredScenarios.length > 0 ? filteredScenarios : gameConfig.scenarios
    if (!scenariosToUse || !scenariosToUse.length) return

    if (currentScenarioIndex + 1 < scenariosToUse.length) {
      setTimeout(() => {
        const nextIndex = currentScenarioIndex + 1
        setCurrentScenarioIndex(nextIndex)
        setCurrentLevel(nextIndex + 1)
        loadScenario(nextIndex)
        setGameState("playing")
        setShowOverlay(false)
        playAudio("uiClick")

        setFloatingText({ text: `Level ${nextIndex + 1}!`, show: true })
        setTimeout(() => {
          setFloatingText({ text: "", show: false })
        }, 2000)
      }, 3000)
    } else {
      setTimeout(() => {
        setGameState("allComplete")
        setShowOverlay(true)
      }, 3000)
    }
  }

  const setDifficultyLevel = (newDifficulty: Difficulty): void => {
    setDifficulty(newDifficulty)
    setCurrentScenarioIndex(0)
    setCurrentLevel(1)

    setTimeout(() => {
      loadScenario(0)
    }, 100)

    playAudio("uiClick")
  }

  const startGame = (): void => {
    setGameState("playing")
    setShowOverlay(false)
    setShowSidebar(false)
    setTimeLeft(120)
    setIsTimerActive(true)
    playAudio("uiClick")
    playAudio("start")
  }

  const playConfetti = (): void => {
    const duration = 3 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 }

    function randomInRange(min: number, max: number): number {
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

  const getEventPoint = (e: DragEvt): DragPoint => {
    if ("touches" in e && (e as any).touches && (e as any).touches.length > 0) {
      const t = (e as any).touches[0]
      return { x: t.clientX, y: t.clientY }
    } else if ("changedTouches" in e && (e as any).changedTouches && (e as any).changedTouches.length > 0) {
      const t = (e as any).changedTouches[0]
      return { x: t.clientX, y: t.clientY }
    }
    if ("clientX" in e && "clientY" in e) {
      return { x: (e as any).clientX, y: (e as any).clientY }
    }
    return { x: 0, y: 0 }
  }

  const handleLabelDragStart = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
    label: string,
  ): void => {
    e.preventDefault()
    const point = getEventPoint(e)
    const labelElement = e.currentTarget
    const rect = labelElement.getBoundingClientRect()

    const newOffset = {
      x: point.x - rect.left,
      y: point.y - rect.top,
    }

    setDraggedLabel(label)
    setDragOffset(newOffset)
    setDragPosition({
      x: point.x - newOffset.x,
      y: point.y - newOffset.y,
    })
    playAudio("connect")
  }

  const handleDragMove = (e: DragEvt): void => {
    e.preventDefault()
    if (!draggedLabel) return

    const point = getEventPoint(e)
    setDragPosition({
      x: point.x - dragOffset.x,
      y: point.y - dragOffset.y,
    })
  }

  const handleDragEnd = (e: DragEvt): void => {
    e.preventDefault()
    if (!draggedLabel || !gameAreaRef.current) return

    const point = getEventPoint(e)
    const imageBounds = getImageBounds()
    
    if (!imageBounds) return

    const relativeX = ((point.x - imageBounds.left) / imageBounds.width) * 100
    const relativeY = ((point.y - imageBounds.top) / imageBounds.height) * 100

    let closestPosition: LabelPosition | null = null
    let minDistance = Number.POSITIVE_INFINITY

    currentScenario.labelPositions.forEach((position: LabelPosition) => {
      const distance = Math.sqrt(Math.pow(position.x - relativeX, 2) + Math.pow(position.y - relativeY, 2))
      if (distance < minDistance && distance < 15) {
        minDistance = distance
        closestPosition = position
      }
    })

    const dragged = draggedLabel as string
    if (closestPosition !== null) {
      const pos: LabelPosition = closestPosition
      if (pos.label === dragged) {
        setPlacedLabels((prev) => {
          const next: Record<string, LabelPosition> = { ...prev }
          next[dragged] = pos
          return next
        })
        playAudio("success")

        const newPlacedLabels: Record<string, LabelPosition> = { ...placedLabels }
        newPlacedLabels[dragged] = pos
        if (Object.keys(newPlacedLabels).length === currentScenario.labels.length) {
          setIsComplete(true)
          playAudio("levelWin")
          playConfetti()
          setFloatingText({ text: `${currentScenario.name} Complete!`, show: true })
          setTimeout(() => {
            setFloatingText({ text: "", show: false })
          }, 2000)
          autoAdvanceToNextLevel()
        }
      } else {
        playAudio("incorrect")
        setFloatingText({ text: "Try again!", show: true })
        setTimeout(() => {
          setFloatingText({ text: "", show: false })
        }, 1500)
      }
    } else {
      playAudio("incorrect")
    }

    setDraggedLabel(null)
    setDragOffset({ x: 0, y: 0 })
    setDragPosition({ x: 0, y: 0 })
  }

  const togglePause = () => {
    if (gameState === "playing") {
      setGameState("paused")
      setShowSidebar(true)
      setIsTimerActive(false)
      pauseAudio("background")
    } else if (gameState === "paused") {
      setGameState("playing")
      setShowSidebar(false)
      setIsTimerActive(true)
      if (!isMuted) {
        playAudio("background", true)
      }
    }
    playAudio("uiClick")
  }

  const showHelp = () => {
    setGameState("help")
    setShowOverlay(true)
    playAudio("instructions")
  }

  if (showSplash) {
    return (
      <div
        className={`fixed inset-0 bg-white flex items-center justify-center ${isSplashFading ? "animate-fade-out" : ""}`}
      >
        <div className="w-64 h-64 relative flex items-center justify-center">
          <img
            src={gameConfig.splashScreen.logo || "/placeholder.svg?height=256&width=256"}
            alt="eklavya - making learning accessible"
            className="w-full h-full object-contain animate-fade-in"
          />
        </div>
      </div>
    )
  }

  if (!currentScenario) {
    console.error("Current scenario is null")
    return (
      <div className="fixed inset-0 bg-[#000B18] flex items-center justify-center">
        <div className="text-black text-xl">Loading game...</div>
      </div>
    )
  }

  return (
    <div className="game-container animate-fade-in">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `url('/image.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      <div className="responsive-container h-full relative flex flex-col z-10 px-2 sm:px-4">
        {/* Header Section - Responsive positioning */}
        <div className="w-full pt-4 pb-2 sm:pb-4 z-50">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="responsive-text-lg luckiest-guy-regular text-black" style={{
              letterSpacing: "0.02em"
            }}>
              LABELLING GAME
            </h1>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mt-1">
              </div>
            {/* Timer Component - Responsive sizing */}
            {!isComplete && (gameState === "playing" || gameState === "paused") && !showOverlay && (
              <div className="flex items-center justify-center mt-1 sm:mt-2">
                <div className="px-3 sm:px-4 py-1 sm:py-2 rounded-lg font-bold text-sm sm:text-lg text-black flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    aria-hidden="true"
                    role="img"
                  >
                    <path d="M6 3h12M6 21h12" stroke="#222222" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M7 4c0 4 4 5 5 8-1 3-5 4-5 8" fill="none" stroke="#222222" strokeWidth="2"/>
                    <path d="M17 4c0 4-4 5-5 8 1 3 5 4 5 8" fill="none" stroke="#222222" strokeWidth="2"/>
                    <path d="M9 7h6l-3 3z" fill="#8B5CF6"/>
                    <path d="M9 17h6l-3-2z" fill="#8B5CF6"/>
                  </svg>
                  {formatTime(timeLeft)}
                </div>
              </div>
            )}
            
            <div className="inline-block bg-white rounded-lg px-3 py-2 mt-2 border-2 border-gray-300" style={{
              boxShadow: "0 8px 16px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)"
            }}>
              <p className="text-sm sm:text-base lg:text-lg luckiest-guy-regular text-black tracking-wide" style={{
                letterSpacing: "0.05em"
              }}>
                {isComplete
                  ? "GREAT JOB! MOVING TO NEXT LEVEL..."
                  : `DRAG LABELS TO CORRECT POSITIONS (${Object.keys(placedLabels).length}/${currentScenario.labels.length})`}
              </p>
            </div>
          </div>
        </div>

        {!showOverlay && (
          <div className="fixed bottom-0 left-0 z-[70] pointer-events-none select-none transform translate-y-[8px]">
            <div className="relative w-36 h-36 sm:w-40 sm:h-40">
              <img
                src={"/wood_board 1.svg"}
                alt="Level signpost"
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-white font-black uppercase text-base sm:text-lg lg:text-xl transform -translate-y-[22px] luckiest-guy-regular"
                  style={{
                    letterSpacing: "0.03em",
                    textShadow: "0 2px 0 rgba(0,0,0,0.25)"
                  }}
                >
                  Level {currentLevel}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Main Game Area - Flexible layout */}
        <div className="flex-1 flex flex-col lg:flex-row w-full max-w-7xl mx-auto gap-2 sm:gap-4 items-center justify-center min-h-0">
          {/* Core Window with golden frame */}
          <div className="relative mx-auto z-20">
            <div className="relative rounded-[32px] bg-yellow-400 p-2 sm:p-3 shadow-lg">
              <div className="relative rounded-[28px] bg-yellow-300 p-2">
                <div
                  ref={gameAreaRef}
                  className="game-image-container relative mx-auto transition-all duration-300 bg-white rounded-[24px] shadow-inner"
                  style={{ touchAction: "none" }}
                  onMouseMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                  onTouchMove={handleDragMove}
                  onTouchEnd={handleDragEnd}
                >
                  <img
                    ref={imageRef}
                    src={currentScenario.image || "/placeholder.svg"}
                    alt={currentScenario.title}
                    className="responsive-image rounded-[20px]"
                  />

                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {currentScenario.labelPositions.map((position) => {
                console.log(
                  `[v0] Drawing line for ${position.label}: from (${position.x}%, ${position.y}%) to (${position.targetX}%, ${position.targetY}%)`,
                )
                return (
                  <line
                    key={`line-${position.id}`}
                    x1={`${position.x}%`}
                    y1={`${position.y}%`}
                    x2={`${position.targetX}%`}
                    y2={`${position.targetY}%`}
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeDasharray={placedLabels[position.label] ? "0" : "5,5"}
                    className="transition-all duration-300"
                  />
                )
              })}
            </svg>

            {currentScenario.labelPositions.map((position) => (
              <div
                key={position.id}
                className={"absolute w-20 h-8 rounded border-2 border-dashed transition-all duration-300 bg-green-500/20 border-green-500/50"}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}

            {Object.entries(placedLabels).map(([label, position]) => (
              <div
                key={`placed-${label}`}
                className="absolute btn-3d-red btn-compact luckiest-guy-regular text-white text-sm flex items-center justify-center text-center"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  transform: "translate(-50%, -50%)",
                  minWidth: "60px",
                  minHeight: "24px"
                }}
              >
                {label}
              </div>
            ))}
                </div>
                {/* Bottom pill title centered on the frame */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white text-green-700 px-4 py-2 rounded-full border-2 border-yellow-400 pointer-events-none">
                  <span className="font-black text-sm sm:text-base tracking-wide" style={{
                    fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Bradley Hand', cursive",
                  }}>
                    {(currentScenario.title || currentScenario.name || "").toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Labels Area - Responsive design */}
          <div
            ref={labelsAreaRef}
            className="game-labels-area lg:w-[30%] max-w-full lg:max-w-[250px] flex flex-col gap-2 sm:gap-3 responsive-padding bg-white/10 rounded-xl backdrop-blur-sm order-first lg:order-last"
          >
            <div className="relative mb-1 sm:mb-2 flex items-center justify-center" style={{ height: '72px' }}>
              <img
                src={'/Picsart_25-09-22_16-28-25-549%201.png'}
                alt="Cloud background"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                style={{ zIndex: 0, filter: 'grayscale(1) contrast(0) brightness(2)' }}
              />
              <h3 className="text-black luckiest-guy-regular text-center responsive-text-sm relative" style={{ zIndex: 1 }}>Labels</h3>
            </div>
            <div className="flex flex-row lg:flex-col gap-2 sm:gap-3 flex-wrap lg:flex-nowrap">
              {currentScenario.labels
                .filter((label) => !placedLabels[label])
                .map((label) => (
                  <div
                    key={label}
                    className="btn-3d-red btn-compact luckiest-guy-regular cursor-grab active:cursor-grabbing flex-shrink-0 flex items-center justify-center text-center"
                    onMouseDown={(e) => handleLabelDragStart(e, label)}
                    onTouchStart={(e) => handleLabelDragStart(e, label)}
                    draggable="false"
                    style={{ 
                      touchAction: "none", 
                      userSelect: "none"
                    }}
                  >
                    {label}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {draggedLabel && (
          <div
            className="fixed btn-3d-red btn-compact luckiest-guy-regular pointer-events-none z-[100] flex items-center justify-center text-center"
            style={{
              left: `${dragPosition.x}px`,
              top: `${dragPosition.y}px`,
              touchAction: "none"
            }}
          >
            {draggedLabel}
          </div>
        )}

        {/* Responsive Sidebar - Better mobile positioning */}
        <div
          className={`fixed top-2 sm:top-4 left-2 sm:left-4 z-[60] transition-all duration-300 ${
            showSidebar ? "w-14 sm:w-16 lg:w-20" : "w-10 sm:w-12 lg:w-16"
          }`}
        >
          <div className="flex flex-col items-center gap-2 sm:gap-4 lg:gap-6">
            <button
              onClick={togglePause}
              className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full bg-violet-500 hover:bg-violet-600 flex items-center justify-center transition-colors shadow-lg touch-none"
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
                  } flex items-center justify-center transition-colors shadow-lg touch-none`}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 sm:w-6 sm:h-6 lg:w-10 lg:h-10 text-white" />
                  ) : (
                    <Music className="w-5 h-5 sm:w-6 sm:h-6 lg:w-10 lg:h-10 text-white" />
                  )}
                </button>
                <button
                  onClick={resetGame}
                  className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center transition-colors shadow-lg touch-none"
                  aria-label="Reset game"
                >
                  <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 lg:w-10 lg:h-10 text-white" />
                </button>
                <button
                  onClick={nextScenario}
                  className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors shadow-lg touch-none"
                  aria-label="Next scenario"
                >
                  <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 lg:w-10 lg:h-10 text-white" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Help Button - Responsive positioning */}
        <button
          onClick={showHelp}
          className="fixed top-2 sm:top-4 right-2 sm:right-4 w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg touch-none z-[60]"
          aria-label="Show help"
        >
          <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12 text-white" />
        </button>

        {/* Floating Text - Responsive sizing */}
        {floatingText.show && (
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[70] px-4">
            <div
              className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-green-400 animate-float-fade text-center"
              style={{
                textShadow: "4px 4px 8px rgba(128, 0, 128, 0.8), -2px -2px 4px rgba(0, 0, 0, 0.6)",
                filter: "drop-shadow(0 0 10px rgba(0, 255, 0, 0.7))",
              }}
            >
              {floatingText.text}
            </div>
          </div>
        )}

        {/* Overlay - Improved responsive design */}
        {showOverlay && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4">
            <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl max-w-xs sm:max-w-sm lg:max-w-md w-full text-center max-h-[90vh] overflow-y-auto">
              {gameState === "start" && (
                <>
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-black">{gameConfig.gameTitle}</h2>
                  <p className="mb-4 text-black">{gameConfig.instructions}</p>


                  <button
                    onClick={startGame}
                    className="px-6 py-2 bg-blue-500 text-black rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Start Game
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
// @ts-nocheck
