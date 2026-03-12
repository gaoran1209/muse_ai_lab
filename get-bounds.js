import { Canvas, Rect } from 'fabric';

const canvas = new Canvas(null, { width: 500, height: 500 });
canvas.setZoom(0.5);
const rect = new Rect({ left: 100, top: 100, width: 50, height: 50 });
canvas.add(rect);

console.log(rect.getBoundingRect());
