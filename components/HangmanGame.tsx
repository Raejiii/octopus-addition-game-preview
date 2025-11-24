// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react"
import { Pause, Play, RotateCcw, Music, VolumeX, SkipForward } from "lucide-react"

type GameStatus = "start" | "playing" | "won" | "lost"

const LEVELS: { name: string; words: string[] }[] = [
  { name: "Easy", words: ["CAT", "DOG", "SUN", "BALL"] },
  { name: "Medium", words: ["BIRD", "FISH", "TREE", "MOON"] },
  { name: "Hard", words: ["APPLE", "HOUSE"] },
]

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
const MAX_WRONG = 6

const HINTS: Record<string, string> = {
  CAT: "A small animal that says meow",
  DOG: "A friendly pet that barks",
  BIRD: "An animal that can fly",
  FISH: "An animal that swims",
  APPLE: "A round red or green fruit",
  BALL: "A round toy you can throw",
  HOUSE: "A place where people live",
  TREE: "A tall plant with leaves",
  SUN: "The bright star in the sky",
  MOON: "The big round rock in the night sky",
}

export default function HangmanGame() {
  const [targetWord, setTargetWord] = useState<string>("")
  const [guessed, setGuessed] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState<number>(0)
  const [status, setStatus] = useState<GameStatus>("start")
  const [scale, setScale] = useState<number>(1)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [showSidebar, setShowSidebar] = useState<boolean>(false)
  const [levelIndex, setLevelIndex] = useState<number>(0)
  const [wordIndex, setWordIndex] = useState<number>(0)
  const [isPortrait, setIsPortrait] = useState<boolean>(false)
  const [isSmallLandscape, setIsSmallLandscape] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const BASE_WIDTH = 1100
  const BASE_HEIGHT = 750
  const PORTRAIT_BASE_WIDTH = 540
  const PORTRAIT_BASE_HEIGHT = 960
  const SMALL_LANDSCAPE_BASE_WIDTH = 780
  const SMALL_LANDSCAPE_BASE_HEIGHT = 520
  const PADDING = 12 // small margin so content never touches edges

  // Pick a word for given level and word index
  const pickWord = (lvlIdx: number, wIdx: number) => {
    const words = LEVELS[lvlIdx]?.words ?? []
    const safeIdx = words.length > 0 ? wIdx % words.length : 0
    return words[safeIdx] ?? ""
  }

  useEffect(() => {
    // Initialize at first level and first word
    setLevelIndex(0)
    setWordIndex(0)
    setTargetWord(pickWord(0, 0))
    setGuessed(new Set())
    setWrong(0)
    setStatus("playing")
  }, [])

  // Compute scale so that the designed base size fits viewport
  useEffect(() => {
    const computeScale = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const portrait = vh > vw
      const smallLandscape = !portrait && (vw <= 800 || vh <= 420)
      const BW = portrait
        ? PORTRAIT_BASE_WIDTH
        : smallLandscape
        ? SMALL_LANDSCAPE_BASE_WIDTH
        : BASE_WIDTH
      const BH = portrait
        ? PORTRAIT_BASE_HEIGHT
        : smallLandscape
        ? SMALL_LANDSCAPE_BASE_HEIGHT
        : BASE_HEIGHT
      const s = Math.min((vw - PADDING) / BW, (vh - PADDING) / BH)
      setIsPortrait(portrait)
      setIsSmallLandscape(smallLandscape)
      // avoid upscaling beyond 1 to preserve crispness
      setScale(Math.min(1, s))
    }
    computeScale()
    window.addEventListener("resize", computeScale)
    return () => window.removeEventListener("resize", computeScale)
  }, [])

  const reset = () => {
    setGuessed(new Set())
    setWrong(0)
    setStatus("playing")
    setIsPaused(false)
    setShowSidebar(false)
    setTargetWord(pickWord(levelIndex, wordIndex))
  }

  const nextWord = () => {
    const words = LEVELS[levelIndex]?.words ?? []
    const nextW = wordIndex + 1
    if (nextW < words.length) {
      setWordIndex(nextW)
      setTargetWord(pickWord(levelIndex, nextW))
    } else {
      const nextLevel = (levelIndex + 1) % LEVELS.length
      setLevelIndex(nextLevel)
      setWordIndex(0)
      setTargetWord(pickWord(nextLevel, 0))
    }
    setGuessed(new Set())
    setWrong(0)
    setStatus("playing")
    setIsPaused(false)
    setShowSidebar(false)
  }

  const display = useMemo(() => {
    if (!targetWord) return ""
    return targetWord
      .split("")
      .map((ch) => (guessed.has(ch) ? ch : "_"))
      .join(" ")
  }, [targetWord, guessed])

  const hintText = useMemo(() => {
    if (!targetWord) return ""
    return HINTS[targetWord] || "Try to guess the hidden word!"
  }, [targetWord])

  const currentLevelName = useMemo(() => {
    return String(levelIndex + 1)
  }, [levelIndex])

  useEffect(() => {
    if (!targetWord || status !== "playing") return
    const hasWon = targetWord.split("").every((ch) => guessed.has(ch))
    if (hasWon) setStatus("won")
    else if (wrong >= MAX_WRONG) setStatus("lost")
  }, [guessed, wrong, targetWord, status])

  // Auto-advance: when a word is guessed, move to next word; after last word, move to next level
  useEffect(() => {
    if (status !== "won") return
    const timer = setTimeout(() => {
      const words = LEVELS[levelIndex]?.words ?? []
      const nextW = wordIndex + 1
      if (nextW < words.length) {
        setWordIndex(nextW)
        setTargetWord(pickWord(levelIndex, nextW))
      } else {
        const nextLevel = (levelIndex + 1) % LEVELS.length
        setLevelIndex(nextLevel)
        setWordIndex(0)
        setTargetWord(pickWord(nextLevel, 0))
      }
      setGuessed(new Set())
      setWrong(0)
      setStatus("playing")
      setIsPaused(false)
      setShowSidebar(false)
    }, 1000) // brief pause so kids see the success
    return () => clearTimeout(timer)
  }, [status, levelIndex, wordIndex])

  const onGuess = (letter: string) => {
    if (status !== "playing" || isPaused) return
    if (guessed.has(letter)) return
    const next = new Set(guessed)
    next.add(letter)
    setGuessed(next)
    if (!targetWord.includes(letter)) {
      setWrong((w) => w + 1)
    }
  }

  const togglePause = () => {
    setIsPaused((p) => {
      const next = !p
      setShowSidebar(next)
      return next
    })
  }

  const toggleMute = () => setIsMuted((m) => !m)

  // Simple SVG hangman: gallows + 6 body parts; adds drop animation on loss
  const HangmanSVG = ({ wrong, animateHang }: { wrong: number; animateHang?: boolean }) => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Gallows */}
      <line x1="20" y1="180" x2="160" y2="180" stroke="#654321" strokeWidth="6" />
      <line x1="40" y1="180" x2="40" y2="20" stroke="#654321" strokeWidth="6" />
      <line x1="40" y1="20" x2="120" y2="20" stroke="#654321" strokeWidth="6" />
      <line x1="120" y1="20" x2="120" y2="40" stroke="#654321" strokeWidth="6" />

      {/* Rope extension shown on failure for visual drop */}
      {animateHang && (
        <line x1="120" y1="40" x2="120" y2="80" stroke="#654321" strokeWidth="4" />
      )}

      {/* Body parts appear with wrong count */}
      <g className={animateHang ? "hang-drop" : undefined}>
        {wrong > 0 && <circle cx="120" cy="55" r="15" stroke="#000" strokeWidth="4" fill="none" />}
        {wrong > 1 && <line x1="120" y1="70" x2="120" y2="110" stroke="#000" strokeWidth="4" />}
        {wrong > 2 && <line x1="120" y1="80" x2="100" y2="95" stroke="#000" strokeWidth="4" />}
        {wrong > 3 && <line x1="120" y1="80" x2="140" y2="95" stroke="#000" strokeWidth="4" />}
        {wrong > 4 && <line x1="120" y1="110" x2="105" y2="135" stroke="#000" strokeWidth="4" />}
        {wrong > 5 && <line x1="120" y1="110" x2="135" y2="135" stroke="#000" strokeWidth="4" />}
      </g>
    </svg>
  )

  const KEY_ROWS = [
    ALPHABET.slice(0, 9).join(""),
    ALPHABET.slice(9, 18).join(""),
    ALPHABET.slice(18).join("")
  ]

  return (
    <div className="h-[100dvh] w-[100vw] relative text-white overflow-hidden flex items-center justify-center">
      {/* Full-viewport background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/Desktop_Hangman_Game.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Pause Sidebar Controls (viewport-fixed, copied style from LabellingGame) */}
      <div
        className={`fixed top-2 left-2 z-[60] transition-all duration-300 ${
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
                onClick={reset}
                className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center transition-colors shadow-lg"
                aria-label="Reset game"
              >
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 lg:w-10 lg:h-10 text-white" />
              </button>
              <button
                onClick={nextWord}
                className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors shadow-lg"
                aria-label="Next level"
              >
                <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 lg:w-10 lg:h-10 text-white" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scaled game canvas with fixed base size */}
      <div
        ref={containerRef}
        style={{ width: isPortrait ? PORTRAIT_BASE_WIDTH : isSmallLandscape ? SMALL_LANDSCAPE_BASE_WIDTH : BASE_WIDTH, height: isPortrait ? PORTRAIT_BASE_HEIGHT : isSmallLandscape ? SMALL_LANDSCAPE_BASE_HEIGHT : BASE_HEIGHT, transform: `scale(${scale})`, transformOrigin: "center" }}
        className="relative z-10 will-change-transform"
      >
        {/* Top-left badge: guesses left */}
        <div className="absolute top-16 left-2 text-black">
          <span className="cabin-sketch-bold text-sm tracking-wide uppercase">Guesses left: {Math.max(0, MAX_WRONG - wrong)}</span>
        </div>
        {/* Top-right badge: level */}
        <div className="absolute top-16 right-2 text-black">
          <span className="cabin-sketch-bold text-sm tracking-wide uppercase">Level: {currentLevelName}</span>
        </div>
        
        {/* Header */}
        <div className="w-full pt-2 pb-2">
          <h1 className="text-center luckiest-guy-regular text-[42px] tracking-wide drop-shadow-lg text-black">
            HANGMAN GAME
          </h1>
        </div>

        {/* Main layout: columns adapt by orientation, filling remaining height */}
        <div style={{ height: (isPortrait ? PORTRAIT_BASE_HEIGHT : isSmallLandscape ? SMALL_LANDSCAPE_BASE_HEIGHT : BASE_HEIGHT) - 86 }} className={`px-4 grid ${isPortrait ? "grid-cols-1" : "grid-cols-2"} gap-6`}>
          {/* Left: Word on wood board + keyboard */}
          <div className="relative rounded-2xl bg-transparent p-5 flex flex-col">
            {/* Hint banner above guess area */}
            <div
              className="inline-block bg-transparent mt-2 mb-3 self-center"
            >
              <p className="text-sm sm:text-base cabin-sketch-bold text-black tracking-wide" style={{ letterSpacing: "0.03em" }}>
                Hint: {hintText}
              </p>
            </div>
            {/* Wood board word area */}
            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="relative z-10 flex items-center justify-center h-full px-6 py-8">
                <div className="flex items-center justify-center gap-3">
                  {targetWord.split("").map((ch, idx) => (
                    <div
                      key={`${ch}-${idx}`}
                      className="w-12 h-16 border-4 border-black rounded-lg bg-transparent flex items-center justify-center"
                    >
                      <span className="cabin-sketch-bold text-black text-4xl tracking-wider">
                        {guessed.has(ch) ? ch : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Status / CTA */}
            <div className="mt-3 text-center min-h-[28px]">
              {status === "won" && (
                <div className="text-green-400 font-semibold">Nice! You guessed it!</div>
              )}
              {status === "lost" && (
                <div className="text-rose-400 font-semibold">Oops! The word was {targetWord}</div>
              )}
            </div>

            {/* QWERTY Keyboard (left side) */}
            <div className="mt-2 flex flex-col items-center gap-3">
              {KEY_ROWS.map((row) => (
                <div key={row} className={`flex ${isSmallLandscape ? "gap-2" : "gap-3"}`}>
                  {row.split("").map((l) => {
                    const used = guessed.has(l)
                    return (
                      <button
                        key={l}
                        onClick={() => onGuess(l)}
                        disabled={used || status !== "playing" || isPaused}
                        className={`bg-transparent text-black cabin-sketch-bold ${isSmallLandscape ? "text-xl w-9 h-9" : "text-2xl w-12 h-12"} flex items-center justify-center ${
                          used ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        {l}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center justify-center gap-3">
              {status === "lost" && (
                <button onClick={reset} className="btn-3d-red">
                  Play Again
                </button>
              )}
            </div>
          </div>

          {/* Right: Gallows & figure with counter */}
          <div className="relative rounded-2xl bg-transparent p-5 flex flex-col">
            <div className="flex-1">
              <div className="aspect-[1/1] w-full max-w-[420px] mx-auto">
                <HangmanSVG wrong={wrong} animateHang={status === "lost" && wrong >= 5} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm uppercase tracking-widest opacity-80">Wrong guesses</div>
              <div className="text-xl font-bold luckiest-guy-regular">{wrong} / {MAX_WRONG}</div>
            </div>
          </div>
        </div>

        

        {/* Pause Overlay */}
        {/* Removed pause overlay */}
      </div>
    </div>
  )
}
// @ts-nocheck
