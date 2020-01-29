import * as THREE from "../node_modules/three/build/three.module.js";
import {
    MTLLoader
} from '../node_modules/three/examples/jsm/loaders/MTLLoader.js';
import {
    OBJLoader2
} from '../node_modules/three/examples/jsm/loaders/OBJLoader2.js';
import {
    MtlObjBridge
} from "../node_modules/three/examples/jsm/loaders/obj2/bridge/MtlObjBridge.js"
import {
    MapControls
} from '../node_modules/three/examples/jsm/controls/OrbitControls.js';

import {
    EffectComposer
} from '../node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import {
    RenderPass
} from '../node_modules/three/examples/jsm/postprocessing/RenderPass.js';
import {
    ShaderPass
} from '../node_modules/three/examples/jsm/postprocessing/ShaderPass.js';

import {
    FXAAShader
} from '../node_modules/three/examples/jsm/shaders/FXAAShader.js';
import {
    SSAOPass
} from './SSAOPass.js';
import { CopyShader } from "../node_modules/three/examples/jsm/shaders/CopyShader.js";


let camera, controls, scene, renderer, composer;
let uniforms;
let mesh;
let vertex_shader;
let fragment_shader;
let fxaa_pass;

init();
animate();

function init() {

    let container = document.querySelector("#container");

    // Setup Camera
    camera = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    camera.position.z = 3;
    camera.near = 1;
    camera.far = 30;
    console.warn("Camera:", "(", camera.near, ",", camera.far, ")");

    // Setup Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbbbbbb);

    // Start async file loading as soon as possible.
    let mtl_loader = new MTLLoader();
    let obj_loader = new OBJLoader2();

    const models_dir = "../resources/models/nanosuit";
    const loaders = [mtl_loader, obj_loader];
    const files = ["nanosuit.mtl", "nanosuit.obj"]

    let promises = {};
    files.forEach((file, i) => {
        // Start loading and save promises
        promises[file] = new Promise((resolve, reject) => {
            loaders[i].load(models_dir + "/" + file, resolve);
        });
    });

    promises["nanosuit.obj"]
        .then(obj => {
            scene.add(obj);
            obj.translateY(-13.0);
        })
        .catch(error => {
            console.error("Error in object loading: ", error);
        });

    promises["nanosuit.mtl"]
        .then(mtl => {
            obj_loader.addMaterials(
                MtlObjBridge.addMaterialsFromMtlLoader(mtl, true));
        })
        .catch(error => {
            console.error("Error in material loading: ", error);
        });


    // Setup renderer
    let canvas = document.createElement('canvas');
    let context = canvas.getContext('webgl2', {
        alpha: false
    });
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        context: context,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Setup passes for postprocessing and composer
    let render_pass = new RenderPass(scene, camera);
    fxaa_pass = new ShaderPass(FXAAShader);
    let ssao_pass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    let copy_pass = new ShaderPass(CopyShader);

    composer = new EffectComposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);
    // composer.addPass(render_pass);
    composer.addPass(ssao_pass);
    composer.addPass(fxaa_pass);
    // composer.addPass(copy_pass);

    // Setup lights
    let ambient_light = new THREE.AmbientLight(0xffffff);
    scene.add(ambient_light);
    let directional_light = new THREE.DirectionalLight(0xffffff, 0.6);
    scene.add(directional_light);
    let point_light = new THREE.PointLight(0xcccccc, 1, 100);
    point_light.position.set(5, 5, 20);
    scene.add(point_light);
    let light = new THREE.HemisphereLight();
    scene.add(light);

    // Setup controls
    controls = new MapControls(camera, renderer.domElement);
    controls.screenSpacePanning = true;
    controls.update();

    // Handle window resize events
    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize(event) {
    let width = window.innerWidth;
    let height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    composer.setSize(width, height);

    let pixel_ratio = renderer.getPixelRatio();
    let uniforms = fxaa_pass.material.uniforms;

    uniforms['resolution'].value.x = 1 / (width * pixel_ratio);
    uniforms['resolution'].value.y = 1 / (height * pixel_ratio);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    render();
}

function render() {
    composer.render();
}
