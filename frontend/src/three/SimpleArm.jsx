import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { degToRad } from '../lib/imuMath'
import { usePrefs } from '../context/PrefsContext'

// Built-in stand-in used when public/models/arm.glb is not present.
export default function SimpleArm({ bicepAngle, forearmAngle }) {
  const { scene } = usePrefs()
  return (
    <div className="h-full w-full">
      <Canvas camera={{ position: [0, -0.4, 6.5], fov: 36 }}>
        <color attach="background" args={[scene.bg]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} />
        <group position={[-1.5, 0.6, 0]} rotation={[0, 0, degToRad(bicepAngle)]}>
          <mesh position={[0, -0.7, 0]}>
            <capsuleGeometry args={[0.22, 1.1, 8, 16]} />
            <meshStandardMaterial color="#e8b99a" />
          </mesh>
          <group position={[0, -1.4, 0]} rotation={[0, 0, degToRad(forearmAngle - bicepAngle)]}>
            <mesh position={[0, -0.6, 0]}>
              <capsuleGeometry args={[0.17, 0.95, 8, 16]} />
              <meshStandardMaterial color="#dca88a" />
            </mesh>
          </group>
        </group>
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  )
}