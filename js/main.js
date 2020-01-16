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

let camera, scene, renderer;
let uniforms;
let mesh;
let vertex_shader;
let fragment_shader;

const shader_dir = "./shaders"
const vertex_shader_file = shader_dir + "/" + "shader.vert";
const fragment_shader_file = shader_dir + "/" + "shader.frag";
const shader_files = [vertex_shader_file, fragment_shader_file];
const shader_promises = shader_files.map((shader_file) => load_shader(shader_file));

Promise.all(shader_promises).then((shaders) => {
    vertex_shader = shaders[0];
    fragment_shader = shaders[1];
    init();
    animate();
});

function load_shader(url) {
    return new Promise((resolve, reject) => {
        new THREE.FileLoader().load(url, resolve);
    });
}

function init() {

    let container = document.getElementById('container');

    camera = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    camera.position.z = 12;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbbbbbb);

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
            console.error(error);
        });

    mtl_promise
        .then(mtl => {
            obj_loader.addMaterials(
                MtlObjBridge.addMaterialsFromMtlLoader(mtl, true));
        })
        .catch(error => {
            console.error(error);
        });

    // LIGHTS
    let ambient_light = new THREE.AmbientLight(0xffffff);
    scene.add(ambient_light);
    // var directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    //scene.add(directionalLight);
    // var pointLight = new THREE.PointLight( 0xffffff, 1, 100 );
    // pointLight.position.set( 5, 5, 10 );
    //scene.add( pointLight );

    uniforms = {
        u_time: {
            type: "f",
            value: 1.0
        },
        u_resolution: {
            type: "v2",
            value: new THREE.Vector2()
        },
        u_mouse: {
            type: "v2",
            value: new THREE.Vector2()
        }
    };

    // let geometry = new THREE.PlaneBufferGeometry(1, 1);
    // let material = new THREE.RawShaderMaterial({
    //     uniforms: uniforms,
    //     vertexShader: vertex_shader.trim(),
    //     fragmentShader: fragment_shader.trim()
    // });
    // mesh = new THREE.Mesh(geometry, material);
    // scene.add(mesh);

    let canvas = document.createElement('canvas');
    let context = canvas.getContext('webgl2', {
        alpha: false
    });
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        context: context
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    document.onmousemove = function(e) {
        uniforms.u_mouse.value.x = e.pageX
        uniforms.u_mouse.value.y = e.pageY
    }
}

function onWindowResize(event) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.u_resolution.value.x = renderer.domElement.width;
    uniforms.u_resolution.value.y = renderer.domElement.height;
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    uniforms.u_time.value += 0.05;
    renderer.render(scene, camera);
}
