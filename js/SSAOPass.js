import * as THREE from 'three';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';

import { custom_random } from './utils.js';
import { SSAOShader, SSAOBlurShader } from './SSAOShader.js';

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

    this.output = 'complete';

    // this.min_distance = 4.0;
    // this.max_distance = 67.0;
    this.min_distance = 1.0;
    this.max_distance = 5.0;
    this.power_factor = 1.0;

    this.generate_sample_kernel();
    this.generate_noise_texture();

    const depth_texture = new THREE.DepthTexture();
    depth_texture.type = THREE.UnsignedShortType;
    depth_texture.minFilter = THREE.NearestFilter;
    depth_texture.maxFilter = THREE.NearestFilter;

    this.beauty_render_target = new THREE.WebGLRenderTarget(
        this.width,
        this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            depthTexture: depth_texture,
            depthBuffer: true,
        },
    );

    this.ssao_render_target = new THREE.WebGLRenderTarget(
        this.width,
        this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
        },
    );

    this.blur_render_target = this.ssao_render_target.clone();

    this.normal_render_target = new THREE.WebGLRenderTarget(
        this.width,
        this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
        },
    );

    this.ssao_material = new THREE.ShaderMaterial({
        defines: Object.assign({}, SSAOShader.defines),
        uniforms: THREE.UniformsUtils.clone(SSAOShader.uniforms),
        vertexShader: SSAOShader.vertexShader,
        fragmentShader: SSAOShader.fragmentShader,
        blending: THREE.NoBlending,
    });

    this.normal_material = new THREE.MeshNormalMaterial();
    this.normal_material.blending = THREE.NoBlending;

    const ssao_uniforms = this.ssao_material.uniforms;
    ssao_uniforms.t_diffuse.value = this.beauty_render_target.texture;
    ssao_uniforms.t_depth.value = this.beauty_render_target.depthTexture;
    ssao_uniforms.t_noise.value = this.noise_texture;
    ssao_uniforms.t_normal.value = this.normal_render_target.texture;
    ssao_uniforms.sample_kernel.value = this.sample_kernel;
    ssao_uniforms.kernel_radius.value = this.kernel_radius;
    ssao_uniforms.resolution.value.set(this.width, this.height);
    ssao_uniforms.camera_near.value = this.camera.near;
    ssao_uniforms.camera_far.value = this.camera.far;
    ssao_uniforms.aspect.value = this.camera.aspect;
    ssao_uniforms.tan_half_fov.value = Math.tan(
        THREE.Math.degToRad(0.5 * this.camera.fov),
    );
    ssao_uniforms.camera_projection_matrix
        .value.copy(this.camera.projectionMatrix);

    this.blur_material = new THREE.ShaderMaterial({
        defines: Object.assign({}, SSAOBlurShader.defines),
        uniforms: THREE.UniformsUtils.clone(SSAOBlurShader.uniforms),
        vertexShader: SSAOBlurShader.vertexShader,
        fragmentShader: SSAOBlurShader.fragmentShader,
    });
    this.blur_material.uniforms.t_diffuse.value = this
        .ssao_render_target.texture;
    this.blur_material.uniforms.resolution.value.set(this.width, this.height);

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
        blendEquationAlpha: THREE.AddEquation,
    });

    this.fullscreen_quad = new Pass.FullScreenQuad(null);

    this.original_clear_color = new THREE.Color();
};

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

    prepare_output: function(target, blending) {
        this.copy_material.uniforms.tDiffuse.value = target.texture;
        this.copy_material.blending = blending;
    },

    render: function(renderer, write_buffer) {
        // Render beauty and depth
        renderer.setRenderTarget(this.beauty_render_target);
        renderer.clear();
        renderer.render(this.scene, this.camera);

        this.render_normal(renderer);

        this.ssao_material.uniforms.kernel_radius.value = this.kernel_radius;
        this.ssao_material.uniforms.min_distance.value = this.min_distance;
        this.ssao_material.uniforms.max_distance.value = this.max_distance;
        this.ssao_material.uniforms.power_factor.value = this.power_factor;
        this.render_on_quad(
            renderer, this.ssao_material, this.ssao_render_target);

        this.render_on_quad(
            renderer, this.blur_material, this.blur_render_target);

        if (this.output === 'beauty') {
            this.prepare_output(this.beauty_render_target, THREE.NoBlending);
        } else if (this.output === 'ssao') {
            this.prepare_output(this.ssao_render_target, THREE.NoBlending);
        } else if (this.output === 'blur') {
            this.prepare_output(this.blur_render_target, THREE.NoBlending);
        } else if (this.output === 'complete') {
            this.prepare_output(this.beauty_render_target, THREE.NoBlending);
            this.render_on_quad(
                renderer,
                this.copy_material,
                this.renderToScreen ? null : write_buffer,
            );
            this.prepare_output(this.blur_render_target, THREE.CustomBlending);
        }
        this.render_on_quad(
            renderer,
            this.copy_material,
            this.renderToScreen ? null : write_buffer,
        );
    },

    render_on_quad: function(
        renderer, material, render_target, clear_color, clear_alpha,
    ) {
        // save original state
        this.original_clear_color.copy(renderer.getClearColor());
        const original_clear_alpha = renderer.getClearAlpha();
        const original_auto_clear = renderer.autoClear;

        renderer.setRenderTarget(render_target);

        // setup pass state
        renderer.autoClear = false;
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
        const original_clear_alpha = renderer.getClearAlpha();
        const original_auto_clear = renderer.autoClear;

        renderer.setRenderTarget(this.normal_render_target);

        // setup pass state
        renderer.autoClear = false;
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
            const sample = new THREE.Vector3(
                (custom_random() * 2) - 1,
                (custom_random() * 2) - 1,
                custom_random(),
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
        const noise_texture_size =
            this.noise_texture_width * this.noise_texture_height;
        const stride = 4;
        const data = new Float32Array(noise_texture_size * stride);
        for (let i = 0; i < noise_texture_size * stride; i += stride) {
            const noise = new THREE.Vector2(
                (custom_random() * 2) - 1,
                (custom_random() * 2) - 1,
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
            THREE.FloatType,
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

        this.ssao_material.uniforms.resolution.value.set(width, height);
        this.ssao_material.uniforms.camera_projection_matrix
            .value.copy(this.camera.projectionMatrix);
        this.ssao_material.uniforms.aspect.value = this.camera.aspect;
        this.ssao_material.uniforms.tan_half_fov.value = Math.tan(
            THREE.Math.degToRad(0.5 * this.camera.fov));
        this.blur_material.uniforms.resolution.value.set(width, height);
    },

});

export {
    SSAOPass,
};
