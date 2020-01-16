import * as THREE from "./lib/three.module.js";

let camera, scene, renderer;
let uniforms;
let mesh;
let vertexShader;
let fragmentShader;

const shader_dir = "./shaders"
const vertex_shader_file = shader_dir + "/" + "shader.vert";
const fragment_shader_file = shader_dir + "/" + "shader.frag";
const shader_files = [vertex_shader_file, fragment_shader_file];
const shader_promises = shader_files.map((shader_file) => load_shader(shader_file));

Promise.all(shader_promises).then((shaders) => {
    vertexShader = shaders[0];
    fragmentShader = shaders[1];
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

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 2;

    scene = new THREE.Scene();

    let geometry = new THREE.PlaneBufferGeometry(1, 1);

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

    let material = new THREE.RawShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader.trim(),
        fragmentShader: fragmentShader.trim()
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

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