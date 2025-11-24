import { lazy, Suspense } from "react"

const PoolAdditionGame = lazy(() => import("./PoolAdditionGame").then((mod) => ({ default: mod.default })))

export default function GameWrapper() {
  return (
    <div className="h-screen w-screen bg-[#000B18] overflow-hidden">
      <Suspense fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-[#000B18]">
          <div className="text-xl text-black">Loading game...</div>
        </div>
      }>
        <PoolAdditionGame />
      </Suspense>
    </div>
  )
}
