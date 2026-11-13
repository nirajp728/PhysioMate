import { useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { usePrefs } from '../context/PrefsContext'

// A board tilts so that its "up" follows the measured gravity vector.
function Board({ imu, x, color }) {
  const ref = useRef()
  const q = useRef(new THREE.Quaternion())
  useFrame(() => {
    const v = new THREE.Vector3(imu.x || 0, imu.z || 1, -(imu.y || 0))
    if (v.lengthSq() < 1e-6) return
    q.current.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize())
    ref.current.quaternion.slerp(q.current, 0.4)
  })
  return (
    <group position={[x, 0, 0]}>
      <mesh ref={ref}>
        <boxGeometry args={[1.5, 0.12, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

export default function ImuBoards({ sample }) {
  const { scene } = usePrefs()
  return (
    <div className="h-full w-full">
      <Canvas camera={{ position: [0, 2, 4.2], fov: 38 }}>
        <color attach="background" args={[scene.bg]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 4, 3]} intensity={1.5} />
        <Board imu={sample.imu1} x={-1.0} color="#6e9bff" />
        <Board imu={sample.imu2} x={1.0} color="#3fae6b" />
        <gridHelper args={[6, 12, scene.section, scene.cell]} position={[0, -0.9, 0]} />
      </Canvas>
    </div>
  )
}