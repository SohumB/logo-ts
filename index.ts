import { createCanvas, NodeCanvasRenderingContext2D } from 'canvas';
import * as fs from 'fs';
import { parseProgram } from './parser';

const width = (1920 / 2) - 20;
const height = 1080 - 20;

const program = "fd 200";
const canvas = createCanvas(width, height);
const ctx: NodeCanvasRenderingContext2D = canvas.getContext('2d');

let ast = parseProgram(program);
if (ast != null) {
    ast.result.eval(ctx, {
        pos: { x: 400, y: 400 },
        heading: 100
    });
}

fs.writeFileSync('out.png', canvas.toBuffer())
