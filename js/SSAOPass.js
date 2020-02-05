import * as THREE from "../node_modules/three/build/three.module.js";
import { Pass } from '../node_modules/three/examples/jsm/postprocessing/Pass.js';
import { CopyShader } from "../node_modules/three/examples/jsm/shaders/CopyShader.js";
import { SimplexNoise } from "../node_modules/three/examples/jsm/math/SimplexNoise.js";


import { custom_random } from "./utils.js";
import { SSAOShader, SSAOBlurShader } from "./SSAOShader.js";

var SSAOPass = function(scene, camera, width, height) {

    Pass.call(this);

    this.scene = scene;
    this.camera = camera;
    this.width = width;
    this.height = height;

    this.kernel_size = 32;
    this.kernel_radius = 16;
    this.sample_kernel = [];
    this.noise_texture_width = 4;
    this.noise_texture_height = 4;
    this.noise_texture = null;

    this.output = "ssao";

    this.min_distance = 4.0;
    this.max_distance = 67.0;
    // this.min_distance = 0.005;
    // this.max_distance = 0.1;
    this.power_factor = 2.0;

    this.generate_sample_kernel();
    this.generate_noise_texture();

    let depth_texture = new THREE.DepthTexture();
    depth_texture.type = THREE.UnsignedShortType;
    depth_texture.minFilter = THREE.NearestFilter;
    depth_texture.maxFilter = THREE.NearestFilter;

    this.beauty_render_target = new THREE.WebGLRenderTarget(this.width, this.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        depthTexture: depth_texture,
        depthBuffer: true
    });

    this.ssao_render_target = new THREE.WebGLRenderTarget(this.width, this.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
    });

    this.blur_render_target = this.ssao_render_target.clone();

    this.normal_render_target = new THREE.WebGLRenderTarget(this.width, this.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
    });

    this.ssao_material = new THREE.ShaderMaterial({
        defines: Object.assign({}, SSAOShader.defines),
        uniforms: THREE.UniformsUtils.clone(SSAOShader.uniforms),
        vertexShader: SSAOShader.vertexShader,
        fragmentShader: SSAOShader.fragmentShader,
        blending: THREE.NoBlending
    });

    this.normal_material = new THREE.MeshNormalMaterial();
    this.normal_material.blending = THREE.NoBlending;

    this.ssao_material.uniforms['t_diffuse'].value = this.beauty_render_target.texture;
    this.ssao_material.uniforms['t_depth'].value = this.beauty_render_target.depthTexture;
    this.ssao_material.uniforms['t_noise'].value = this.noise_texture;
    this.ssao_material.uniforms['t_normal'].value = this.normal_render_target.texture;
    this.ssao_material.uniforms['sample_kernel'].value = this.sample_kernel;
    this.ssao_material.uniforms['kernel_radius'].value = this.kernel_radius;
    this.ssao_material.uniforms['resolution'].value.set(this.width, this.height);
    this.ssao_material.uniforms['camera_near'].value = this.camera.near;
    this.ssao_material.uniforms['camera_far'].value = this.camera.far;
    this.ssao_material.uniforms['camera_projection_matrix'].value.copy(this.camera.projectionMatrix);

    // DEBUG: TODO: remove
    this.ssao_material.uniforms['cameraProjectionMatrix'].value.copy(this.camera.projectionMatrix);
    this.ssao_material.uniforms['cameraInverseProjectionMatrix'].value.getInverse(this.camera.projectionMatrix);

    this.blur_material = new THREE.ShaderMaterial({
        defines: Object.assign({}, SSAOBlurShader.defines),
        uniforms: THREE.UniformsUtils.clone(SSAOBlurShader.uniforms),
        vertexShader: SSAOBlurShader.vertexShader,
        fragmentShader: SSAOBlurShader.fragmentShader
    });
    this.blur_material.uniforms['t_diffuse'].value = this.ssao_render_target.texture;
    this.blur_material.uniforms['resolution'].value.set(this.width, this.height);

    this.copy_material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
        vertexShader: CopyShader.vertexShader,
        fragmentShader: CopyShader.fragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blendSrc: THREE.DstColorFactor,
        blendDst: THREE.ZeroFactor,
        blendEquation: THREE.AddEquation,
        blendSrcAlpha: THREE.DstAlphaFactor,
        blendDstAlpha: THREE.ZeroFactor,
        blendEquationAlpha: THREE.AddEquation
    });

    this.fullscreen_quad = new Pass.FullScreenQuad(null);

    this.original_clear_color = new THREE.Color();
}

SSAOPass.prototype = Object.assign(Object.create(Pass.prototype), {

    constructor: SSAOPass,

    dispose: function() {
        this.beauty_render_target.dispose();
        this.normal_render_target.dispose();
        this.ssao_render_target.dispose();
        this.blur_render_target.dispose();

        this.normal_material.dispose();
        this.blur_material.dispose();
        this.copy_material.dispose();

        this.fullscreen_quad.dispose();
    },

    render: function(renderer, write_buffer) {
        // Render beauty and depth
        renderer.setRenderTarget(this.beauty_render_target);
        renderer.clear();
        renderer.render(this.scene, this.camera);

        this.render_normal(renderer);

        this.ssao_material.uniforms['kernel_radius'].value = this.kernel_radius;
        this.ssao_material.uniforms['min_distance'].value = this.min_distance;
        this.ssao_material.uniforms['max_distance'].value = this.max_distance;
        this.ssao_material.uniforms['power_factor'].value = this.power_factor;
        this.render_on_quad(renderer, this.ssao_material, this.ssao_render_target);

        this.render_on_quad(renderer, this.blur_material, this.blur_render_target);

        if (this.output === "beauty") {
            this.copy_material.uniforms['tDiffuse'].value = this.beauty_render_target.texture;
            this.copy_material.blending = THREE.NoBlending;
            this.render_on_quad(renderer, this.copy_material, this.renderToScreen ? null : write_buffer);
        } else if (this.output === "ssao") {
            this.copy_material.uniforms['tDiffuse'].value = this.ssao_render_target.texture;
            this.copy_material.blending = THREE.NoBlending;
            this.render_on_quad(renderer, this.copy_material, this.renderToScreen ? null : write_buffer);
        } else if (this.output === "blur") {
            this.copy_material.uniforms['tDiffuse'].value = this.blur_render_target.texture;
            this.copy_material.blending = THREE.NoBlending;
            this.render_on_quad(renderer, this.copy_material, this.renderToScreen ? null : write_buffer);
        } else if (this.output == "complete") {
            this.copy_material.uniforms['tDiffuse'].value = this.beauty_render_target.texture;
            this.copy_material.blending = THREE.NoBlending;
            this.render_on_quad(renderer, this.copy_material, this.renderToScreen ? null : write_buffer);
            this.copy_material.uniforms['tDiffuse'].value = this.blur_render_target.texture;
            this.copy_material.blending = THREE.CustomBlending;
            this.render_on_quad(renderer, this.copy_material, this.renderToScreen ? null : write_buffer);
        }
    },

    render_on_quad: function(renderer, material, render_target, clear_color, clear_alpha) {

        // save original state
        this.original_clear_color.copy(renderer.getClearColor());
        let original_clear_alpha = renderer.getClearAlpha();
        let original_auto_clear = renderer.autoClear;

        renderer.setRenderTarget(render_target);

        // setup pass state
        renderer.autoClear = false; // ???? TODO: is this necessary? Why?
        if ((clear_color !== undefined) && (clear_color !== null)) {
            renderer.setClearColor(clear_color);
            renderer.setClearAlpha(clear_alpha || 0.0);
            renderer.clear();
        }

        this.fullscreen_quad.material = material;
        this.fullscreen_quad.render(renderer);

        // restore original state
        renderer.autoClear = original_auto_clear;
        renderer.setClearColor(this.original_clear_color);
        renderer.setClearAlpha(original_clear_alpha);

    },

    render_normal: function(renderer, clear_color, clear_alpha) {

        // save original state
        this.original_clear_color.copy(renderer.getClearColor());
        let original_clear_alpha = renderer.getClearAlpha();
        let original_auto_clear = renderer.autoClear;

        renderer.setRenderTarget(this.normal_render_target);

        // setup pass state
        renderer.autoClear = false; // ???? TODO: is this necessary? Why?
        if ((clear_color !== undefined) && (clear_color !== null)) {
            renderer.setClearColor(clear_color);
            renderer.setClearAlpha(clear_alpha || 0.0);
            renderer.clear();
        }

        this.scene.overrideMaterial = this.normal_material;
        renderer.render(this.scene, this.camera);
        this.scene.overrideMaterial = null;

        // restore original state
        renderer.autoClear = original_auto_clear;
        renderer.setClearColor(this.original_clear_color);
        renderer.setClearAlpha(original_clear_alpha);

    },

    generate_sample_kernel: function() {
        for (let i = 0; i < this.kernel_size; i++) {
            let sample = new THREE.Vector3(
                (custom_random() * 2) - 1,
                (custom_random() * 2) - 1,
                custom_random()
            );
            sample.normalize();
            // sample.multiplyScalar(custom_random()); // FIXME: is this necessary?

            let scale = i / this.kernel_size;
            scale = THREE.Math.lerp(0.1, 1.0, scale * scale);
            sample.multiplyScalar(scale);
            this.sample_kernel.push(sample);
        }
    },

    generate_noise_texture: function() {
        const noise_texture_size = this.noise_texture_width * this.noise_texture_height;
        const stride = 4;
        let data = new Float32Array(noise_texture_size * stride);
        for (let i = 0; i < noise_texture_size * stride; i += stride) {
            const noise = new THREE.Vector2(
                (custom_random() * 2) - 1,
                (custom_random() * 2) - 1
            );
            noise.normalize();
            data[i] = noise.x;
            data[i + 1] = noise.y;
            data[i + 2] = 0.0;
            data[i + 3] = 1.0;
        }
        this.noise_texture = new THREE.DataTexture(
            data,
            this.noise_texture_width,
            this.noise_texture_height,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.noise_texture.wrapS = THREE.RepeatWrapping;
        this.noise_texture.wrapT = THREE.RepeatWrapping;
    },

    // DEBUG: TODO: remove
    generate_random_kernel_rotations: function() {

        var width = 4,
            height = 4;

        if (SimplexNoise === undefined) {
            console.error('THREE.SSAOPass: The pass relies on SimplexNoise.');
        }

        var simplex = new SimplexNoise();

        var size = width * height;
        var data = new Float32Array(size * 4);

        for (var i = 0; i < size; i++) {
            var stride = i * 4;
            var x = (Math.random() * 2) - 1;
            var y = (Math.random() * 2) - 1;
            var z = 0;
            var noise = simplex.noise3d(x, y, z);
            data[stride] = noise;
            data[stride + 1] = noise;
            data[stride + 2] = noise;
            data[stride + 3] = 1;

        }

        this.noise_texture = new THREE.DataTexture(
            data,
            this.noise_texture_width,
            this.noise_texture_height,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.noise_texture.wrapS = THREE.RepeatWrapping;
        this.noise_texture.wrapT = THREE.RepeatWrapping;

    },

    setSize: function(width, height) {

        this.width = width;
        this.height = height;

        this.beauty_render_target.setSize(width, height);
        this.ssao_render_target.setSize(width, height);
        this.normal_render_target.setSize(width, height);
        this.blur_render_target.setSize(width, height);

        this.ssao_material.uniforms['resolution'].value.set(width, height);
        this.ssao_material.uniforms['camera_projection_matrix'].value.copy(this.camera.projectionMatrix);
        this.ssao_material.uniforms['cameraProjectionMatrix'].value.copy(this.camera.projectionMatrix);
        this.ssao_material.uniforms['cameraInverseProjectionMatrix'].value.getInverse(this.camera.projectionMatrix);
        this.blur_material.uniforms['resolution'].value.set(width, height);
    },

});

export {
    SSAOPass
};
