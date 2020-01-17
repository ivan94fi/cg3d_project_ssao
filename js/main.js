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
    BaseCustomShader
} from './BaseCustomShader.js';

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

    camera = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 1000
    );

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

    composer = new EffectComposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);

    controls = new MapControls(camera, renderer.domElement);
    controls.screenSpacePanning = true;
    controls.update();
    camera.position.z = 15;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbbbbbb);

    let render_pass = new RenderPass(scene, camera);
    composer.addPass(render_pass);

    fxaa_pass = new ShaderPass(FXAAShader)
    composer.addPass(fxaa_pass);

    let copy_pass = new ShaderPass(BaseCustomShader);
    composer.addPass(copy_pass);


    let mtl_loader = new MTLLoader();
    let obj_loader = new OBJLoader2();

    let mtl_promise = new Promise((resolve, reject) => {
        mtl_loader.load("../resources/models/nanosuit/nanosuit.mtl", resolve);
    });
    let obj_promise = new Promise((resolve, reject) => {
        obj_loader.load("../resources/models/nanosuit/nanosuit.obj", resolve);
    });

    obj_promise
        .then(obj => {
            scene.add(obj);
            obj.translateY(-8.0);
        })
        .catch(error => {
            console.error("Error in object loading: ", error);
        });

    mtl_promise
        .then(mtl => {
            obj_loader.addMaterials(
                MtlObjBridge.addMaterialsFromMtlLoader(mtl, true));
        })
        .catch(error => {
            console.error("Error in material loading: ", error);
        });

    // LIGHTS
    let ambient_light = new THREE.AmbientLight(0xffffff);
    scene.add(ambient_light);
    let directional_light = new THREE.DirectionalLight(0xffffff, 0.6);
    scene.add(directional_light);
    let point_light = new THREE.PointLight(0xcccccc, 1, 100);
    point_light.position.set(5, 5, 20);
    scene.add(point_light);

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize(event) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    let pixel_ratio = renderer.getPixelRatio();
    let uniforms = fxaa_pass.material.uniforms;

    uniforms['resolution'].value.x = 1 / (window.innerWidth * pixel_ratio);
    uniforms['resolution'].value.y = 1 / (window.innerHeight * pixel_ratio);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    render();
}

function render() {
    // uniforms.u_time.value += 0.05;
    composer.render();
}
