import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import * as fs from 'fs';
import { parseProgram } from './parser';

const width = 1920;
const height = 1080;

const program = fs.readFileSync('sierpinski.logo', { encoding: "utf8" });
// const program = `to foo :n
//                   if :n = 0 [stop]
//                   foo :n-1
//                   fd 200 rt 120/:n
//                  end
//                  foo 10`
const canvas = createCanvas(width, height);
const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

let ast = parseProgram(program);
if (ast != null && ast.unparsed == '') {
    ast.result.eval(ctx, {
        pos: { x: 480, y: 1000 },
        heading: 0,
        arithEnv: {},
        fnEnv: {}
    });
}

fs.writeFileSync('out.png', canvas.toBuffer())
