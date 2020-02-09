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

import { GUI } from '../node_modules/three/examples/jsm/libs/dat.gui.module.js';


import { custom_random } from "./utils.js"

let camera, controls, scene, renderer, composer;
let uniforms;
let mesh;
let vertex_shader;
let fragment_shader;
let fxaa_pass;
let group;

let debug_geometry = false;
let rotate = false;

init();
animate();

function init() {

    let container = document.querySelector("#container");

    let gui_controls = {
        "Enable FXAA": true,
    }

    /* ************************* DEBUG SCENE ******************************** */
    if (debug_geometry) {
        camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 100, 700);
        camera.position.z = 500;
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xaaaaaa);
        scene.add(new THREE.DirectionalLight());
        scene.add(new THREE.HemisphereLight());
        group = new THREE.Group();
        scene.add(group);
        var geometry = new THREE.BoxBufferGeometry(10, 10, 10);
        for (var i = 0; i < 100; i++) {
            var material = new THREE.MeshLambertMaterial({
                color: custom_random() * 0xffffff
            });
            var mesh = new THREE.Mesh(geometry, material);
            mesh.position.x = custom_random() * 400 - 200;
            mesh.position.y = custom_random() * 400 - 200;
            mesh.position.z = custom_random() * 400 - 200;
            mesh.rotation.x = custom_random();
            mesh.rotation.y = custom_random();
            mesh.rotation.z = custom_random();
            mesh.scale.setScalar(custom_random() * 10 + 2);
            group.add(mesh);
        }
    }
    /* ************************* NORMAL SCENE ******************************* */
    else {
        // Setup Camera
        camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 1000
        );
        camera.position.x = 6;
        camera.position.y = -2;
        camera.position.z = -2;
        camera.near = 1;
        camera.far = 100;
        console.warn("Camera:", "(", camera.near, ",", camera.far, ")");

        // Setup Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xbbbbbb);

        const box_size = 30;
        let box_geometry = new THREE.BoxBufferGeometry(box_size, box_size, box_size);
        var box_material = new THREE.MeshPhongMaterial({
            color: 0x1700aa,
            shininess: 30,
            side: THREE.BackSide
        });
        var box = new THREE.Mesh(box_geometry, box_material);
        scene.add(box);

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
                obj.translateZ(10);
                obj.rotateX(-90 * Math.PI / 180);
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
    }

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
    fxaa_pass = new ShaderPass(FXAAShader);
    let ssao_pass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);

    composer = new EffectComposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(ssao_pass);
    composer.addPass(fxaa_pass);

    // Setup lights
    if (!debug_geometry) {
        let ambient_light = new THREE.AmbientLight(0xffffff);
        scene.add(ambient_light);
        let directional_light = new THREE.DirectionalLight(0xffffff, 0.6);
        scene.add(directional_light);
        let point_light = new THREE.PointLight(0xcccccc, 1, 100);
        point_light.position.set(5, 5, 20);
        scene.add(point_light);
        let light = new THREE.HemisphereLight();
        scene.add(light);
    }

    // Setup controls
    controls = new MapControls(camera, renderer.domElement);
    controls.screenSpacePanning = true;
    controls.target.set(0, -15, 0);
    controls.update();

    let gui = new GUI();

    gui.add(ssao_pass, 'output', {
        'Complete': "complete",
        'Beauty': "beauty",
        'SSAO': "ssao",
        'SSAO + Blur': "blur",
    }).onChange(value => ssao_pass.output = value);
    gui.add(ssao_pass, 'kernel_radius').min(0).max(32);
    // gui.add(ssao_pass, 'min_distance').min(0.001).max(0.02);
    // gui.add(ssao_pass, 'max_distance').min(0.01).max(0.3);
    gui.add(ssao_pass, 'min_distance').min(1.0).max(10.0);
    gui.add(ssao_pass, 'max_distance').min(5.0).max(100.0);
    gui.add(ssao_pass, 'power_factor').min(1.0).max(5.0);

    gui.add(gui_controls, "Enable FXAA")
        .onChange(value => fxaa_pass.enabled = value);

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

    // TODO: maybe this is not necessary anymore? Check
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
    if (debug_geometry) {
        if (rotate) {
            var timer = performance.now();
            group.rotation.x = timer * 0.0002;
            group.rotation.y = timer * 0.0001;
        }
    }
    composer.render();
}
