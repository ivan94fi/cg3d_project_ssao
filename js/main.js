import * as THREE from 'three';
import * as path from 'path';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader2 } from 'three/examples/jsm/loaders/OBJLoader2.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MtlObjBridge } from 'three/examples/jsm/loaders/obj2/bridge/MtlObjBridge.js';
import { MapControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module.js';

import { custom_random } from './utils.js';
import { SSAOPass } from './SSAOPass.js';

// Global variables
let camera, controls, scene, renderer, composer, fxaa_pass, group;

// DEBUG
const debug_geometry = false;
const rotate = false;

init();
animate();

function init() {
    const container = document.querySelector('#container');

    const gui_controls = {
        'Enable FXAA': true,
    };

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
                color: custom_random() * 0xffffff,
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
    } else {
        /* ************************* NORMAL SCENE ******************************* */
        // Setup Camera
        camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 1, 100,
        );

        var r = path.join('..', 'resources', 'skyboxes', 'Sea');
        var urls = [
            path.join(r, 'right.jpg'), path.join(r, 'left.jpg'),
            path.join(r, 'top.jpg'), path.join(r, 'bottom.jpg'),
            path.join(r, 'front.jpg'), path.join(r, 'back.jpg'),
        ];

        // var r = path.join('..', 'resources', 'skyboxes', 'MilkyWay');
        // var urls = [path.join(r, 'dark-s_px.jpg'), path.join(r, 'dark-s_nx.jpg'),
        //     path.join(r, 'dark-s_py.jpg'), path.join(r, 'dark-s_ny.jpg'),
        //     path.join(r, 'dark-s_pz.jpg'), path.join(r, 'dark-s_nz.jpg'),
        // ];
        const texture_cube = new THREE.CubeTextureLoader().load(urls);
        texture_cube.format = THREE.RGBFormat;
        texture_cube.mapping = THREE.CubeReflectionMapping;
        texture_cube.encoding = THREE.sRGBEncoding;

        var cube_shader = THREE.ShaderLib.cube;
        var cube_material = new THREE.ShaderMaterial({
            fragmentShader: cube_shader.fragmentShader,
            vertexShader: cube_shader.vertexShader,
            uniforms: cube_shader.uniforms,
            depthWrite: false,
            side: THREE.BackSide,
        });
        cube_material.envMap = texture_cube;
        const cube_mesh = new THREE.Mesh(new THREE.BoxBufferGeometry(1000, 1000, 1000), cube_material);

        // Setup Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xbbbbbb);
        scene.add(cube_mesh);

        // Nanosuit model: start async file loading as soon as possible.
        const mtl_loader = new MTLLoader();
        const obj_loader = new OBJLoader2();
        const gltf_loader = new GLTFLoader();

        const models_dir = path.join('..', 'resources', 'models');
        const loaders = [
            mtl_loader,
            obj_loader,
            gltf_loader,
        ];
        const files = [
            path.join('nanosuit', 'nanosuit.mtl'),
            path.join('nanosuit', 'nanosuit.obj'),
            path.join('spaceship', 'spaceship.gltf'),
        ];

        const promises = {};
        files.forEach((file, i) => {
            // Start loading and save promises
            promises[path.basename(file)] = new Promise((resolve, reject) => {
                loaders[i].load(path.join(models_dir, file), resolve);
            });
        });

        promises['nanosuit.obj']
            .then(obj => {
                scene.add(obj);
                obj.translateY(-9.0);
                obj.translateZ(-20);
                // obj.rotateX(-90 * Math.PI / 180);
            })
            .catch(error => {
                console.error('Error in object loading: ', error);
            });

        promises['nanosuit.mtl']
            .then(mtl => {
                obj_loader.addMaterials(
                    MtlObjBridge.addMaterialsFromMtlLoader(mtl, true));
            })
            .catch(error => {
                console.error('Error in material loading: ', error);
            });

        promises['spaceship.gltf']
            .then(gltf => {
                gltf.scene.translateX(-60);
                gltf.scene.scale.set(3, 3, 3);
                scene.add(gltf.scene);
                gltf.scene.traverse(child => {
                    if (child.material) {
                        const material = child.material;
                        material.envMap = texture_cube;
                        if (material.name === 'Floor_and_vent') {
                            material.color.multiplyScalar(1.2);
                        }
                        if (material.name === 'Floor_vent') {
                            material.color.multiplyScalar(2);
                        }
                    }
                });
            })
            .catch(error => {
                console.error('Error in object loading: ', error);
            });

        // Setup lights
        const ambient_light = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambient_light);
        const directional_light = new THREE.DirectionalLight(0xffffff, 1);
        scene.add(directional_light);
        const point_light = new THREE.PointLight(0xcccccc, 1, 100);
        point_light.position.set(5, 5, 20);
        scene.add(point_light);
        const light = new THREE.HemisphereLight();
        light.intensity = 0.2;
        scene.add(light);
    }

    // Setup renderer
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', {
        alpha: false,
    });
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        context: context,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Setup passes for postprocessing and composer
    fxaa_pass = new ShaderPass(FXAAShader);
    const ssao_pass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);

    composer = new EffectComposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(ssao_pass);
    composer.addPass(fxaa_pass);

    // Setup controls
    controls = new MapControls(camera, renderer.domElement);
    controls.screenSpacePanning = true;
    controls.target.set(0, -10, -50);
    controls.update();

    const gui = new GUI();
    gui.add(ssao_pass, 'output', {
        'Complete': 'complete',
        'Beauty': 'beauty',
        'SSAO': 'ssao',
        'SSAO + Blur': 'blur',
    }).onChange(value => { ssao_pass.output = value; });
    gui.add(ssao_pass, 'kernel_radius').min(0).max(32);
    // gui.add(ssao_pass, 'min_distance').min(0.001).max(0.02);
    // gui.add(ssao_pass, 'max_distance').min(0.01).max(0.3);
    gui.add(ssao_pass, 'min_distance').min(1.0).max(10.0);
    gui.add(ssao_pass, 'max_distance').min(5.0).max(100.0);
    gui.add(ssao_pass, 'power_factor').min(1.0).max(5.0);

    gui.add(gui_controls, 'Enable FXAA')
        .onChange(value => { fxaa_pass.enabled = value; });

    // Handle window resize events
    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize(event) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    composer.setSize(width, height);

    // TODO: maybe this is not necessary anymore? Check
    const pixel_ratio = renderer.getPixelRatio();
    const uniforms = fxaa_pass.material.uniforms;

    uniforms.resolution.value.x = 1 / (width * pixel_ratio);
    uniforms.resolution.value.y = 1 / (height * pixel_ratio);
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
