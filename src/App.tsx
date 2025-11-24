import { Routes, Route } from 'react-router-dom'
import GameWrapper from '../components/game-wrapper'
import { GameEditor } from '../components/GameEditor'
import { ThemeProvider } from './contexts/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <div className="h-screen w-screen bg-[#000B18] overflow-hidden">
        <Routes>
          <Route path="/" element={<GameWrapper />} />
          <Route path="/editor" element={<GameEditor />} />
        </Routes>
      </div>
    </ThemeProvider>
  )
}

export default App