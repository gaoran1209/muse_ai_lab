import { CanvasEditor } from '../components/CanvasEditor';

export default function CanvasPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <CanvasEditor />
    </div>
  );
}
