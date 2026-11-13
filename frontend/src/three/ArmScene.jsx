import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Grid, useGLTF } from '@react-three/drei'
import { degToRad } from '../lib/imuMath'
import { usePrefs } from '../context/PrefsContext'

const ARM_SIDE = 'negative' // flip to 'positive' if this picks the wrong arm
const ELBOW_THRESHOLD = 29 // re-check this against the console log after aligning
const ELBOW_OVERLAP = 4
const VERTICAL_OFFSET = -0.6 // increase magnitude to push the model further down, 0 to disable

// Exercise demo only (the live arm ignores these)
const BICEP_TILT = 60   // degrees clockwise for the whole arm (negative = anticlockwise)
const FOREARM_MIN = -40 // forearm angle when the elbow is fully bent
const FOREARM_MAX = 100  // forearm angle when the arm is straight

// Live arm only: roll (supination / pronation) direction
const BICEP_ROLL_SIGN = 1   // set to -1 if the upper arm rolls the wrong way
const FOREARM_ROLL_SIGN = 1 // set to -1 if the forearm rolls the wrong way

// Live arm: fixed vertical-angle offsets in degrees (positive = anticlockwise on screen)
const BICEP_OFFSET = 10
const FOREARM_OFFSET = 90

const _e = new THREE.Euler()
const _qb = new THREE.Quaternion()
const _qf = new THREE.Quaternion()
// Bend (Z) applied after roll (Y): roll spins the limb about its own long axis.
const orient = (q, bend, roll) => q.setFromEuler(_e.set(0, degToRad(roll), degToRad(bend), 'ZYX'))

// Finds the arm's true "length" direction via PCA (the axis its vertices
// are most spread along, whatever diagonal the model was posed at) and
// rotates the whole geometry so that axis lines up with world Y. This has
// to happen before any axis-aligned cut, otherwise a flat Y-plane slices
// through a diagonal tube at a shallow angle instead of straight across it
// — which is what caused the jagged/spiky edges.
//
// Note: the rotation below pivots around the mesh's own centroid (mx,my,mz),
// so that point never moves. That means the arm's true central axis, after
// alignment, runs through (mx, *, mz) — NOT through x=0,z=0. Callers need
// (mx,mz) to center any rotation pivot on the actual tube instead of on an
// arbitrary offset from the original model's placement in the GLB.
function alignGeometryToY(geometry) {
  const pos = geometry.attributes.position
  const n = pos.count
  let mx = 0, my = 0, mz = 0
  for (let i = 0; i < n; i++) { mx += pos.getX(i); my += pos.getY(i); mz += pos.getZ(i) }
  mx /= n; my /= n; mz /= n

  let cxx = 0, cxy = 0, cxz = 0, cyy = 0, cyz = 0, czz = 0
  for (let i = 0; i < n; i++) {
    const dx = pos.getX(i) - mx, dy = pos.getY(i) - my, dz = pos.getZ(i) - mz
    cxx += dx * dx; cxy += dx * dy; cxz += dx * dz; cyy += dy * dy; cyz += dy * dz; czz += dz * dz
  }
  cxx /= n; cxy /= n; cxz /= n; cyy /= n; cyz /= n; czz /= n

  let v = new THREE.Vector3(1, 1, 1).normalize()
  for (let iter = 0; iter < 100; iter++) {
    const nx = cxx * v.x + cxy * v.y + cxz * v.z
    const ny = cxy * v.x + cyy * v.y + cyz * v.z
    const nz = cxz * v.x + cyz * v.y + czz * v.z
    v.set(nx, ny, nz).normalize()
  }

  const quaternion = new THREE.Quaternion().setFromUnitVectors(v, new THREE.Vector3(0, 1, 0))
  const mean = new THREE.Vector3(mx, my, mz)
  const p = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(mean).applyQuaternion(quaternion).add(mean)
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  pos.needsUpdate = true

  const normalAttr = geometry.attributes.normal
  if (normalAttr) {
    const nv = new THREE.Vector3()
    for (let i = 0; i < n; i++) {
      nv.set(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i)).applyQuaternion(quaternion)
      normalAttr.setXYZ(i, nv.x, nv.y, nv.z)
    }
    normalAttr.needsUpdate = true
  }

  geometry.computeBoundingBox()

  return { x: mx, z: mz }
}

function clipTriangleByPlane(v0, v1, v2, keepFn) {
  const verts = [v0, v1, v2]
  const interpolate = (a, b) => {
    const t = a.d / (a.d - b.d)
    const lerp3 = (pa, pb) => [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t]
    return {
      pos: lerp3(a.pos, b.pos),
      normal: a.normal && b.normal ? lerp3(a.normal, b.normal) : null,
      uv: a.uv && b.uv ? [a.uv[0] + (b.uv[0] - a.uv[0]) * t, a.uv[1] + (b.uv[1] - a.uv[1]) * t] : null,
    }
  }

  const output = []
  for (let i = 0; i < 3; i++) {
    const curr = verts[i]
    const next = verts[(i + 1) % 3]
    const currIn = keepFn(curr.d)
    const nextIn = keepFn(next.d)
    if (currIn) {
      output.push(curr)
      if (!nextIn) output.push(interpolate(curr, next))
    } else if (nextIn) {
      output.push(interpolate(curr, next))
    }
  }
  return output
}

function buildClippedGeometry(geometry, axisIndex, threshold, keepPositive) {
  const posAttr = geometry.attributes.position
  const normalAttr = geometry.attributes.normal
  const uvAttr = geometry.attributes.uv
  const index = geometry.index ? geometry.index.array : null
  const triCount = index ? index.length / 3 : posAttr.count / 3

  const outPositions = []
  const outNormals = []
  const outUvs = []

  const getVertex = (i) => {
    const pos = [posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)]
    const normal = normalAttr ? [normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i)] : null
    const uv = uvAttr ? [uvAttr.getX(i), uvAttr.getY(i)] : null
    const axisVal = pos[axisIndex]
    const d = keepPositive ? axisVal - threshold : threshold - axisVal
    return { pos, normal, uv, d }
  }

  const keepFn = (d) => d >= 0

  for (let t = 0; t < triCount; t++) {
    const ia = index ? index[t * 3] : t * 3
    const ib = index ? index[t * 3 + 1] : t * 3 + 1
    const ic = index ? index[t * 3 + 2] : t * 3 + 2
    const clipped = clipTriangleByPlane(getVertex(ia), getVertex(ib), getVertex(ic), keepFn)

    for (let k = 1; k < clipped.length - 1; k++) {
      for (const v of [clipped[0], clipped[k], clipped[k + 1]]) {
        outPositions.push(v.pos[0], v.pos[1], v.pos[2])
        if (v.normal) outNormals.push(v.normal[0], v.normal[1], v.normal[2])
        if (v.uv) outUvs.push(v.uv[0], v.uv[1])
      }
    }
  }

  if (!outPositions.length) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(outPositions, 3))
  if (outNormals.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(outNormals, 3))
  if (outUvs.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(outUvs, 2))
  return geo
}

export default function ArmScene({ bicepAngle, forearmAngle, bicepRoll = 0, forearmRoll = 0, demo = false }) {
  const { scene } = usePrefs()
  return (
    <div className="h-full w-full">
      <Canvas camera={{ position: [3.6, 0.6, 4.4], fov: 36 }} shadows>
        <color attach="background" args={[scene.bg]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3.5, 5, 4]} intensity={1.8} castShadow />
        <directionalLight position={[-4, 1.5, 2]} intensity={0.5} />
        <Environment preset="apartment" />

        <RiggedArm bicepAngle={bicepAngle} forearmAngle={forearmAngle} bicepRoll={bicepRoll} forearmRoll={forearmRoll} demo={demo} />

        <Grid
          position={[0, -1.21, 0]}
          args={[10, 10]}
          cellSize={0.25}
          cellThickness={0.6}
          cellColor={scene.cell}
          sectionSize={1}
          sectionThickness={1}
          sectionColor={scene.section}
          fadeDistance={14}
          fadeStrength={1.5}
          infiniteGrid
        />
        <ContactShadows position={[0, -1.2, 0]} opacity={0.32} scale={9} blur={2.6} />
        <OrbitControls enablePan={false} minDistance={0.5} maxDistance={10} target={[0, 0, 0]} />
      </Canvas>
    </div>
  )
}

function RiggedArm({ bicepAngle, forearmAngle, bicepRoll, forearmRoll, demo }) {
  const { scene } = useGLTF('/models/arm.glb')
  const bicepGroup = useRef()
  const forearmGroup = useRef()
  const [built, setBuilt] = useState(null)

  useEffect(() => {
    let armMesh = null
    scene.traverse((obj) => { if (obj.isMesh) armMesh = obj })
    if (!armMesh) return

    const isolated = buildClippedGeometry(armMesh.geometry, 0, 0, ARM_SIDE === 'positive')
    if (!isolated) {
      console.warn('No geometry for ARM_SIDE =', ARM_SIDE)
      return
    }

    const axis = alignGeometryToY(isolated)

    isolated.computeBoundingBox()
    const { min, max } = isolated.boundingBox
    console.log(
      'aligned arm bbox — min:', min.x.toFixed(3), min.y.toFixed(3), min.z.toFixed(3),
      'max:', max.x.toFixed(3), max.y.toFixed(3), max.z.toFixed(3),
      '— central axis x,z:', axis.x.toFixed(3), axis.z.toFixed(3)
    )

    const bicepGeo = buildClippedGeometry(isolated, 1, ELBOW_THRESHOLD - ELBOW_OVERLAP, true)
    const forearmGeo = buildClippedGeometry(isolated, 1, ELBOW_THRESHOLD + ELBOW_OVERLAP, false)

    const bicepMesh = bicepGeo ? new THREE.Mesh(bicepGeo, armMesh.material) : null
    const forearmMesh = forearmGeo ? new THREE.Mesh(forearmGeo, armMesh.material) : null

    // Shoulder = the far end of the bicep segment (opposite the elbow cut).
    // This is the real anchor point for bicep rotation — not the elbow.
    // The elbow should move WITH the bicep when it rotates, not stay fixed.
    let shoulderY = ELBOW_THRESHOLD
    if (bicepGeo) {
      bicepGeo.computeBoundingBox()
      shoulderY = bicepGeo.boundingBox.max.y
    }

    const tempGroup = new THREE.Group()
    if (bicepMesh) tempGroup.add(bicepMesh.clone())
    if (forearmMesh) tempGroup.add(forearmMesh.clone())
    const box = new THREE.Box3().setFromObject(tempGroup)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const fitScale = maxDim > 0 ? 2.5 / maxDim : 1
    const center = new THREE.Vector3()
    box.getCenter(center)

    setBuilt({ bicepMesh, forearmMesh, fitScale, center, shoulderY, axisX: axis.x, axisZ: axis.z })
  }, [scene])

  useFrame(() => {
    const b = bicepGroup.current
    const f = forearmGroup.current
    if (!b || !f) return
    if (demo) {
      b.rotation.z = degToRad(bicepAngle - BICEP_TILT)
      // elbow progress: 0 = fully bent, 1 = straight, mapped onto your min/max swing
      const t = THREE.MathUtils.clamp((forearmAngle - bicepAngle + 180) / 180, 0, 1)
      f.rotation.z = degToRad(FOREARM_MIN + t * (FOREARM_MAX - FOREARM_MIN))
    } else {
      // Each limb's world orientation comes from its own IMU. The forearm sits inside the
      // upper arm, so its local rotation is its world rotation relative to the upper arm.
      orient(_qb, bicepAngle + BICEP_OFFSET, BICEP_ROLL_SIGN * bicepRoll)
      orient(_qf, forearmAngle + FOREARM_OFFSET, FOREARM_ROLL_SIGN * forearmRoll)
      b.quaternion.copy(_qb)
      f.quaternion.copy(_qb).invert().multiply(_qf)
    }
  })

  if (!built) return null

  const { axisX, axisZ, shoulderY } = built
  const bicepPivot = [-axisX, -shoulderY, -axisZ]
  const elbowPivot = [-axisX, -ELBOW_THRESHOLD, -axisZ]

  return (
    <group
      scale={built.fitScale}
      position={[
        -built.center.x * built.fitScale,
        -built.center.y * built.fitScale + VERTICAL_OFFSET,
        -built.center.z * built.fitScale,
      ]}
    >
      <group ref={bicepGroup} position={[axisX, shoulderY, axisZ]}>
        <group position={bicepPivot}>
          {built.bicepMesh && <primitive object={built.bicepMesh} castShadow receiveShadow />}

          {/* Forearm nests INSIDE the bicep's frame, so bicep rotation carries
              the elbow (and forearm) along with it. */}
          <group ref={forearmGroup} position={[axisX, ELBOW_THRESHOLD, axisZ]}>
            <group position={elbowPivot}>
              {built.forearmMesh && <primitive object={built.forearmMesh} castShadow receiveShadow />}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/arm.glb')