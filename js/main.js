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

import { custom_random, close_loading_icon } from './utils.js';
import { SSAOPass } from './SSAOPass.js';

import '../css/style.css';

// Global variables
let camera, controls, scene, renderer, composer, fxaa_pass, group;

const storage_value = window.localStorage.getItem('debug_geometry');
const debug_geometry = storage_value ? (storage_value === 'true') : false;

init();
animate();

function init() {
    const container = document.querySelector('#container');

    const gui_controls = {
        'Enable FXAA': true,
        'lights_visibility': {},
        'Debug geometry': debug_geometry,
    };
    const lights_dict = {};

    /* ************************* DEBUG SCENE ******************************** */
    if (debug_geometry) {
        camera = new THREE.PerspectiveCamera(
            65,
            window.innerWidth / window.innerHeight,
            100,
            700,
        );
        camera.position.z = 500;
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xaaaaaa);
        scene.add(new THREE.DirectionalLight());
        scene.add(new THREE.HemisphereLight());
        group = new THREE.Group();
        scene.add(group);
        const geometry = new THREE.BoxBufferGeometry(10, 10, 10);
        for (let i = 0; i < 100; i++) {
            const material = new THREE.MeshLambertMaterial({
                color: custom_random() * 0xffffff,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.x = custom_random() * 400 - 200;
            mesh.position.y = custom_random() * 400 - 200;
            mesh.position.z = custom_random() * 400 - 200;
            mesh.rotation.x = custom_random();
            mesh.rotation.y = custom_random();
            mesh.rotation.z = custom_random();
            mesh.scale.setScalar(custom_random() * 10 + 2);
            group.add(mesh);
        }
        close_loading_icon();
    } else {
        /* ************************* NORMAL SCENE *************************** */
        // Setup Camera
        camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 1, 100,
        );

        // Setup Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xbbbbbb);

        // Models: start async file loading as soon as possible.
        const manager = new THREE.LoadingManager();
        manager.onLoad = close_loading_icon;

        const mtl_loader = new MTLLoader(manager);
        const obj_loader = new OBJLoader2(manager);
        const gltf_loader = new GLTFLoader(manager);

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

        // Load skybox (envmap)
        const skybox_path = path.join(
            '..', 'resources', 'skyboxes', 'Sea', path.sep,
        );
        const urls = ['right.jpg', 'left.jpg', 'top.jpg',
            'bottom.jpg', 'front.jpg', 'back.jpg',
        ];
        const texture_cube = new THREE.CubeTextureLoader(manager)
            .setPath(skybox_path)
            .load(urls);
        texture_cube.format = THREE.RGBFormat;
        texture_cube.mapping = THREE.CubeReflectionMapping;

        const cube_shader = THREE.ShaderLib.cube;
        const cube_material = new THREE.ShaderMaterial({
            fragmentShader: cube_shader.fragmentShader,
            vertexShader: cube_shader.vertexShader,
            uniforms: cube_shader.uniforms,
            depthWrite: false,
            side: THREE.BackSide,
        });
        cube_material.envMap = texture_cube;
        const cube_mesh = new THREE.Mesh(
            new THREE.BoxBufferGeometry(1000, 1000, 1000),
            cube_material,
        );
        scene.add(cube_mesh);

        // Setup lights
        const ambient_light = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambient_light);
        const directional_light = new THREE.DirectionalLight(0xffffff, 1);
        scene.add(directional_light);
        const point_light = new THREE.PointLight(0xcccccc, 1, 100);
        point_light.position.set(5, 5, 20);
        scene.add(point_light);
        const hemisphere_light = new THREE.HemisphereLight();
        hemisphere_light.intensity = 0.2;
        scene.add(hemisphere_light);

        lights_dict.ambient = ambient_light;
        lights_dict.directional = directional_light;
        lights_dict.point = point_light;
        lights_dict.hemisphere = hemisphere_light;
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
    const ssao_pass = new SSAOPass(
        scene,
        camera,
        window.innerWidth,
        window.innerHeight,
    );

    composer = new EffectComposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(ssao_pass);
    composer.addPass(fxaa_pass);

    // Setup controls
    controls = new MapControls(camera, renderer.domElement);
    controls.screenSpacePanning = true;
    controls.target.set(0, -10, -50);
    controls.update();

    // Setup User Interface
    const gui = new GUI();

    const output_folder = gui.addFolder('Output');
    output_folder.add(ssao_pass, 'output', {
        'Complete': 'complete',
        'Beauty': 'beauty',
        'SSAO': 'ssao',
        'SSAO + Blur': 'blur',
    }).onChange(value => { ssao_pass.output = value; });
    output_folder.open();

    const ssao_param_folder = gui.addFolder('SSAO Parameters');
    ssao_param_folder.add(ssao_pass, 'kernel_radius').min(4).max(32);
    ssao_param_folder.add(ssao_pass, 'min_distance').min(0.0).max(15.0);
    ssao_param_folder.add(ssao_pass, 'max_distance').min(0.0).max(100.0);
    ssao_param_folder.add(ssao_pass, 'range_check_factor').min(1.0).max(5.0);
    ssao_param_folder.add(ssao_pass, 'power_factor').min(1.0).max(5.0);
    ssao_param_folder.open();

    const fxaa_folder = gui.addFolder('FXAA');
    fxaa_folder.add(gui_controls, 'Enable FXAA')
        .onChange(value => { fxaa_pass.enabled = value; });

    if (!debug_geometry) {
        const lights_folder = gui.addFolder('Lights');
        for (const p in lights_dict) {
            gui_controls.lights_visibility[p] = lights_dict[p].visible;
            lights_folder.add(gui_controls.lights_visibility, p)
                .onChange(value => { lights_dict[p].visible = value; });
        }
    }

    const debug_folder = gui.addFolder('Debug');
    debug_folder.add(gui_controls, 'Debug geometry')
        .onChange(value => {
            window.localStorage.setItem('debug_geometry', value);
            location.reload();
        });

    // Handle window resize events
    on_window_resize();
    window.addEventListener('resize', on_window_resize, false);
}

function on_window_resize(event) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    composer.setSize(width, height);

    const pixel_ratio = renderer.getPixelRatio();
    fxaa_pass.material.uniforms.resolution.value.x = 1 / (width * pixel_ratio);
    fxaa_pass.material.uniforms.resolution.value.y = 1 / (height * pixel_ratio);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    render();
}

function render() {
    composer.render();
}
