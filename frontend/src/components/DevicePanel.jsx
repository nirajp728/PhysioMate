import { Bluetooth, BluetoothOff, RefreshCw } from 'lucide-react'
import { useBle } from '../context/BleContext'

const LABEL = {
  off: 'Bluetooth is off in the app',
  idle: 'Ready. Pick your device below.',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Connection dropped. Reconnecting…',
  error: 'Problem',
}

export default function DevicePanel() {
  const { supported, enabled, devices, selected, status, error, toggle, select, disconnect, refreshDevices } = useBle()
  const busy = status === 'connecting' || status === 'reconnecting'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {enabled ? <Bluetooth size={20} className="text-sun" /> : <BluetoothOff size={20} className="text-paper/60" />}
          <div>
            <p className="text-sm font-medium text-paper">Bluetooth</p>
            <p className={`text-xs ${status === 'connected' ? 'text-line-green' : status === 'error' ? 'text-coral' : 'text-paper/60'}`}>
              {LABEL[status]}
            </p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle Bluetooth"
          onClick={() => toggle(!enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? 'bg-sun' : 'bg-paper/20'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-paper transition-all ${enabled ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      {!supported && (
        <p className="rounded-lg bg-coral/20 px-3 py-2 text-xs text-paper/80">
          This browser cannot use Bluetooth. Open the app in Chrome or Edge on a computer, or Chrome on Android.
        </p>
      )}

      {enabled && (
        <div className="space-y-2">
          <select
            aria-label="Choose device"
            value={selected}
            disabled={busy}
            onChange={(e) => select(e.target.value)}
            className="w-full rounded-lg border border-paper/20 bg-ink px-2 py-2 text-xs text-paper outline-none"
          >
            <option value="">Select a device…</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name || 'Unnamed device'}</option>
            ))}
            <option value="__choose__">Choose another device…</option>
          </select>
          <div className="flex gap-2">
            <button onClick={refreshDevices} title="Refresh list" className="rounded-lg border border-paper/20 px-3 py-1.5 text-paper/60 hover:text-paper">
              <RefreshCw size={16} />
            </button>
            {status === 'connected' && (
              <button onClick={disconnect} className="flex-1 rounded-lg bg-paper px-3 py-1.5 text-xs font-medium text-ink">Disconnect</button>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-coral">{error}</p>}
    </div>
  )
}