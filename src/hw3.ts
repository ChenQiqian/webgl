import { mat4, vec3 } from 'gl-matrix';
import * as twgl from 'twgl.js';
import { Camera } from './common/camera';

// import three obj loader and mtl loader
import { createThreeMeshesFromFileName, createDrawObjectsFromMeshes, createBufferColored, createImmutableImageTexture, createTWGLMeshesFromThreeMeshes } from './common/objects/objfile';

import chromeImage from './assets/chrome.png';
import { Accumlator, AccumlatorExporter } from './common/accumlator';
import { getWhiteTexture, myDrawObjectList } from './utils/twgl_utils';
import { RayTracer, Scene } from './common/raytracer';

function do_raytracing(rayTracer: RayTracer, percent_callback: (percent: number) => void = (percent: number) => {}) {
    const imageData = rayTracer.do_raytracing(200, 200, (percent: number) => {
        percent_callback(percent);
    });


    console.log(imageData);
    // output data to canvas
    const raytraceCanvas = document.querySelector("#raytrace") as HTMLCanvasElement;
    const raytraceContext = raytraceCanvas.getContext("2d")!;
    raytraceCanvas.style.width = imageData.width + "px";
    raytraceCanvas.style.height = imageData.height + "px";
    raytraceCanvas.width = imageData.width;
    raytraceCanvas.height = imageData.height;

    raytraceContext.putImageData(imageData, 0, 0);

}

async function main() {
    // Get A WebGL context
    const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
    // resize canvas to displaying size
    twgl.resizeCanvasToDisplaySize(canvas);

    if (!gl) {
        alert("No WebGL2! Please use a newer browser.");
        return;
    }

    if (!gl.getExtension("EXT_color_buffer_float")) {
        alert("FLOAT color buffer not available");
        return;
    }

    twgl.setDefaults({ attribPrefix: "a_" });


    const camera = new Camera(vec3.fromValues(0.0, 8.0, 80.0));
    camera.setup_interaction(canvas);
    const lightPosition = vec3.fromValues(0, 0, 20);


    const scene = new Scene(camera, lightPosition);

    const rayTracer = new RayTracer(scene, 1, 1);


    // accumlator and exporter
    const accumlator = new Accumlator(gl);
    const accum_exporter = new AccumlatorExporter(gl, accumlator);

    // color, depth and stencil
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);


    const image = new Image();
    image.src = chromeImage;

    await new Promise<void>((resolve) => {
        image.onload = () => {
            resolve();
        }
    });

    console.log(image.width, image.height)
    const image_texture_cube = createImmutableImageTexture(gl, image);

    const cubeVertices = twgl.primitives.createCubeVertices(4);
    const cubeBuffer = createBufferColored(cubeVertices, gl, 1);

    // load with three.js
    const three_meshes = await createThreeMeshesFromFileName('./models/nanosuit/nanosuit', gl);
    console.log(three_meshes);

    const meshes = await createTWGLMeshesFromThreeMeshes(three_meshes, gl);
    const meshDrawObjects = createDrawObjectsFromMeshes(meshes, accumlator.normalprogramInfo);

    for(let i = 0; i < three_meshes.length; i++) {
        await scene.add_mesh(three_meshes[i] as THREE.Mesh);
    }

    console.log(scene)

    const button = document.querySelector("#render") as HTMLButtonElement;
    const progress_span = document.querySelector("#progress") as HTMLSpanElement;

    button.onclick = () => {
        do_raytracing(rayTracer, (percent: number) => {
            progress_span.innerHTML = percent.toFixed(2) + "%";
        });
    }



    function render(time: number) {
        time *= 0.001;

        // resize canvas to displaying size
        twgl.resizeCanvasToDisplaySize(canvas);

        accumlator.render(canvas, camera, lightPosition,
            // normal render
            (programInfo: twgl.ProgramInfo) => {
                const modelMatrix = mat4.create();
                // mat4.rotateX(modelMatrix, modelMatrix, time);
                // mat4.rotateY(modelMatrix, modelMatrix, time);

                const uniforms = {
                    u_model_matrix: modelMatrix,
                };

                twgl.setUniforms(programInfo, uniforms);

                myDrawObjectList(gl, meshDrawObjects);

            },
            // oit render
            (programInfo: twgl.ProgramInfo) => {
                const modelMatrix = mat4.create();
                // move the cube
                mat4.translate(modelMatrix, modelMatrix, vec3.fromValues(0.0, 0.0, 0.0));
                // rotate the cube
                mat4.rotateX(modelMatrix, modelMatrix, time);
                mat4.rotateY(modelMatrix, modelMatrix, time);

                const uniforms = {
                    u_model_matrix: modelMatrix,
                    u_texture: image_texture_cube,
                    u_specular_texture: getWhiteTexture(gl),
                    u_bump_texture: getWhiteTexture(gl),
                };

                twgl.setUniforms(programInfo, uniforms);

                twgl.createVAOFromBufferInfo(gl, programInfo, cubeBuffer);
                twgl.setBuffersAndAttributes(gl, programInfo, cubeBuffer);
                twgl.drawBufferInfo(gl, cubeBuffer);

            });

        // render frame buffer to screen
        accum_exporter.render(canvas);


        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    console.log("ready.")
}




main()
