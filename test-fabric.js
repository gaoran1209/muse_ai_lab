import { Canvas, Rect } from 'fabric';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><canvas id="c" width="500" height="500"></canvas>`);
const window = dom.window;
global.window = window;
global.document = window.document;

const canvas = new Canvas(document.getElementById('c'));
canvas.setZoom(2);
const rect = new Rect({ left: 100, top: 100, width: 50, height: 50 });
canvas.add(rect);

console.log("Zoom x2, rect at 100");
console.log(rect.getBoundingRect());
