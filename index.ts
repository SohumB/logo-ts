import { createCanvas } from 'canvas';
import * as fs from 'fs';

const width = (1920 / 2) - 20;
const height = 1080 - 20;

const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

ctx.lineWidth = 10;
ctx.strokeStyle = "black";
ctx.beginPath();
ctx.moveTo(width, 0);
ctx.lineTo(0, height);
ctx.stroke();

fs.writeFileSync('out.png', canvas.toBuffer())
