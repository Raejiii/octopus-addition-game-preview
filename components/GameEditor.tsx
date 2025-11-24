// @ts-nocheck
import { useState, useRef, useEffect } from "react"
import { Save, RotateCcw, Eye, Upload, ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { gameConfig } from "../config/game-config"

export function GameEditor() {
  const [selectedScenario, setSelectedScenario] = useState(0)
  const [currentScenario, setCurrentScenario] = useState(gameConfig.scenarios[0])
  const [isDragging, setIsDragging] = useState(false)
  const [draggedItem, setDraggedItem] = useState(null)
  const [dragType, setDragType] = useState(null) // 'dropzone' or 'target'
  const [hasChanges, setHasChanges] = useState(false)
  const gameAreaRef = useRef(null)

  useEffect(() => {
    setCurrentScenario(gameConfig.scenarios[selectedScenario])
  }, [selectedScenario])

  const handleScenarioChange = (index) => {
    if (hasChanges) {
      const confirm = window.confirm("You have unsaved changes. Are you sure you want to switch scenarios?")
      if (!confirm) return
    }
    setSelectedScenario(index)
    setHasChanges(false)
  }

  const getEventPoint = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    return { x: e.clientX, y: e.clientY }
  }

  const handleMouseDown = (e, itemId, type) => {
    e.preventDefault()
    setIsDragging(true)
    setDraggedItem(itemId)
    setDragType(type)
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !draggedItem || !gameAreaRef.current) return

    e.preventDefault()
    const point = getEventPoint(e)
    const gameRect = gameAreaRef.current.getBoundingClientRect()

    const relativeX = ((point.x - gameRect.left) / gameRect.width) * 100
    const relativeY = ((point.y - gameRect.top) / gameRect.height) * 100

    // Clamp values between 0 and 100
    const clampedX = Math.max(0, Math.min(100, relativeX))
    const clampedY = Math.max(0, Math.min(100, relativeY))

    // Update the scenario data
    const updatedPositions = currentScenario.labelPositions.map((position) => {
      if (position.id === draggedItem) {
        if (dragType === "dropzone") {
          return { ...position, x: clampedX, y: clampedY }
        } else if (dragType === "target") {
          return { ...position, targetX: clampedX, targetY: clampedY }
        }
      }
      return position
    })

    setCurrentScenario({
      ...currentScenario,
      labelPositions: updatedPositions,
    })
    setHasChanges(true)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDraggedItem(null)
    setDragType(null)
  }

  const saveConfiguration = () => {
    // Create updated config
    const updatedConfig = {
      ...gameConfig,
      scenarios: gameConfig.scenarios.map((scenario, index) =>
        index === selectedScenario ? currentScenario : scenario,
      ),
    }

    // Download as JSON file
    const dataStr = JSON.stringify(updatedConfig, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "game-config.json"
    link.click()
    URL.revokeObjectURL(url)

    setHasChanges(false)
    alert("Configuration saved! You can now replace your game-config.ts file with this data.")
  }

  const saveToConfigFile = async () => {
    try {
      // Create updated config
      const updatedConfig = {
        ...gameConfig,
        scenarios: gameConfig.scenarios.map((scenario, index) =>
          index === selectedScenario ? currentScenario : scenario,
        ),
      }

      // Generate the TypeScript config file content
      const configContent = `export const gameConfig = ${JSON.stringify(updatedConfig, null, 2)}`

      // Create and download the file
      const dataBlob = new Blob([configContent], { type: "text/typescript" })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = "game-config.ts"
      link.click()
      URL.revokeObjectURL(url)

      setHasChanges(false)
      alert("Configuration saved as game-config.ts! Replace your existing config file with this one.")
    } catch (error) {
      console.error("Error saving configuration:", error)
      alert("Error saving configuration. Please try again.")
    }
  }

  const loadConfigFromFile = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        let config

        // Try to parse as JSON first
        try {
          config = JSON.parse(content)
        } catch {
          // If JSON parsing fails, try to extract from TypeScript export
          const match = content.match(/export const gameConfig = ({[\s\S]*})/)
          if (match) {
            config = JSON.parse(match[1])
          } else {
            throw new Error("Invalid file format")
          }
        }

        if (config && config.scenarios) {
          // Update the current scenario with loaded data
          const loadedScenario = config.scenarios[selectedScenario]
          if (loadedScenario) {
            setCurrentScenario(loadedScenario)
            setHasChanges(true)
            alert("Configuration loaded successfully!")
          } else {
            alert("Selected scenario not found in loaded configuration.")
          }
        } else {
          alert("Invalid configuration file format.")
        }
      } catch (error) {
        console.error("Error loading configuration:", error)
        alert("Error loading configuration file. Please check the file format.")
      }
    }
    reader.readAsText(file)

    // Reset the input
    event.target.value = ""
  }

  const copyCoordinatesToClipboard = async () => {
    const coordinates = currentScenario.labelPositions.map((pos) => ({
      id: pos.id,
      label: pos.label,
      x: Math.round(pos.x * 10) / 10,
      y: Math.round(pos.y * 10) / 10,
      targetX: Math.round(pos.targetX * 10) / 10,
      targetY: Math.round(pos.targetY * 10) / 10,
    }))

    const coordinatesText = JSON.stringify(coordinates, null, 2)

    try {
      await navigator.clipboard.writeText(coordinatesText)
      alert("Coordinates copied to clipboard!")
    } catch (error) {
      console.error("Error copying to clipboard:", error)
      // Fallback: show in console and alert
      console.log("Coordinates:", coordinatesText)
      alert("Coordinates logged to console. Check browser developer tools.")
    }
  }

  const resetScenario = () => {
    const confirm = window.confirm("Are you sure you want to reset this scenario to its original state?")
    if (confirm) {
      setCurrentScenario(gameConfig.scenarios[selectedScenario])
      setHasChanges(false)
    }
  }

  const exportCoordinates = () => {
    const coordinates = currentScenario.labelPositions.map((pos) => ({
      label: pos.label,
      dropzone: { x: pos.x, y: pos.y },
      target: { x: pos.targetX, y: pos.targetY },
    }))

    console.log("Current coordinates:", coordinates)
    alert("Coordinates exported to console. Check the browser developer tools.")
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl luckiest-guy-regular text-black">Game Configuration Editor</h1>
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-black rounded-md hover:bg-gray-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Game
            </Link>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="font-medium text-black">Scenario:</label>
              <select
                value={selectedScenario}
                onChange={(e) => handleScenarioChange(Number.parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {gameConfig.scenarios.map((scenario, index) => (
                  <option key={index} value={index}>
                    {scenario.name} ({scenario.difficulty})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveToConfigFile}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-black rounded-md hover:bg-green-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Config
              </button>

              <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-black rounded-md hover:bg-blue-600 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                Load Config
                <input type="file" accept=".json,.ts" onChange={loadConfigFromFile} className="hidden" />
              </label>

              <button
                onClick={copyCoordinatesToClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-black rounded-md hover:bg-purple-600 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Copy Coords
              </button>

              <button
                onClick={resetScenario}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-black rounded-md hover:bg-red-600 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>

            {hasChanges && <div className="text-orange-600 font-medium">⚠️ Unsaved changes</div>}
          </div>
        </div>

        {/* Editor Area */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-black mb-4">Editing: {currentScenario.name}</h2>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Game Preview */}
            <div className="lg:col-span-3">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="luckiest-guy-regular text-black mb-3">Game Preview</h3>
                <div
                  ref={gameAreaRef}
                  className="relative w-full aspect-square max-w-2xl mx-auto bg-white rounded-lg shadow-inner cursor-crosshair"
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseUp}
                  style={{ touchAction: "none" }}
                >
                  {/* Background Image */}
                  <img
                    src={currentScenario.image || "/placeholder.svg"}
                    alt={currentScenario.title}
                    className="w-full h-full object-contain rounded-lg"
                    draggable={false}
                  />

                  {/* Lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {currentScenario.labelPositions.map((position) => (
                      <line
                        key={`line-${position.id}`}
                        x1={`${position.x}%`}
                        y1={`${position.y}%`}
                        x2={`${position.targetX}%`}
                        y2={`${position.targetY}%`}
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                        className="transition-all duration-200"
                      />
                    ))}
                  </svg>

                  {/* Drop Zones */}
                  {currentScenario.labelPositions.map((position) => (
                    <div
                      key={`dropzone-${position.id}`}
                      className="absolute w-20 h-8 rounded border-2 border-dashed border-green-500/50 bg-green-500/20 cursor-move hover:bg-green-500/30 transition-colors flex items-center justify-center"
                      style={{
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      onMouseDown={(e) => handleMouseDown(e, position.id, "dropzone")}
                      onTouchStart={(e) => handleMouseDown(e, position.id, "dropzone")}
                    >
                      <span className="text-xs font-bold text-green-700 pointer-events-none">{position.label}</span>
                    </div>
                  ))}

                  {/* Target Points */}
                  {currentScenario.labelPositions.map((position) => (
                    <div
                      key={`target-${position.id}`}
                      className="absolute w-4 h-4 rounded-full bg-green-500 border-2 border-white cursor-move hover:bg-green-600 transition-colors shadow-lg"
                      style={{
                        left: `${position.targetX}%`,
                        top: `${position.targetY}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      onMouseDown={(e) => handleMouseDown(e, position.id, "target")}
                      onTouchStart={(e) => handleMouseDown(e, position.id, "target")}
                      title={`Target for ${position.label}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Controls Panel */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="luckiest-guy-regular text-black mb-3">Instructions</h3>
                <div className="text-sm text-black space-y-2">
                  <p className="luckiest-guy-regular">
                    <strong>Blue rectangles:</strong> Drop zones (drag to move)
                  </p>
                  <p className="luckiest-guy-regular">
                    <strong>Green circles:</strong> Target points (drag to move)
                  </p>
                  <p className="luckiest-guy-regular">
                    <strong>Green dashed lines:</strong> Connect drop zones to targets
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="luckiest-guy-regular text-black mb-3">Current Coordinates</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {currentScenario.labelPositions.map((position) => (
                    <div key={position.id} className="text-xs bg-white p-2 rounded border">
                      <div className="font-bold text-black">{position.label}</div>
                      <div className="text-black">
                        Drop: ({position.x.toFixed(1)}%, {position.y.toFixed(1)}%)
                      </div>
                      <div className="text-gray-600">
                        Target: ({position.targetX.toFixed(1)}%, {position.targetY.toFixed(1)}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
// @ts-nocheck
