import * as THREE from "../node_modules/three/build/three.module.js";
import { Pass } from '../node_modules/three/examples/jsm/postprocessing/Pass.js';
import { CopyShader } from "../node_modules/three/examples/jsm/shaders/CopyShader.js";

import { SSAOShader } from "./SSAOShader.js";

var SSAOPass = function(scene, camera, width, height) {

    Pass.call(this);

    this.scene = scene;
    this.camera = camera;
    this.width = width;
    this.height = height;

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


    this.ssao_material = new THREE.ShaderMaterial({
        defines: Object.assign({}, SSAOShader.defines),
        uniforms: THREE.UniformsUtils.clone(SSAOShader.uniforms),
        vertexShader: SSAOShader.vertexShader,
        fragmentShader: SSAOShader.fragmentShader,
        blending: THREE.NoBlending
    });

    this.ssao_material.uniforms['t_diffuse'].value = this.beauty_render_target.texture;
    this.ssao_material.uniforms['t_depth'].value = this.beauty_render_target.depthTexture;
    this.ssao_material.uniforms['resolution'].value.set(this.width, this.height);
    this.ssao_material.uniforms['texel_size'].value.set(1 / this.width, 1 / this.height);
    this.ssao_material.uniforms['camera_near'].value = this.camera.near;
    this.ssao_material.uniforms['camera_far'].value = this.camera.far;

    // this.depthRenderMaterial = new ShaderMaterial({
    //     defines: Object.assign({}, SSAODepthShader.defines),
    //     uniforms: UniformsUtils.clone(SSAODepthShader.uniforms),
    //     vertexShader: SSAODepthShader.vertexShader,
    //     fragmentShader: SSAODepthShader.fragmentShader,
    //     blending: NoBlending
    // });
    // this.depthRenderMaterial.uniforms['tDepth'].value = this.beautyRenderTarget.depthTexture;
    // this.depthRenderMaterial.uniforms['cameraNear'].value = this.camera.near;
    // this.depthRenderMaterial.uniforms['cameraFar'].value = this.camera.far;


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

    dispose: function() {},

    render: function(renderer, write_buffer) {
        // Render beauty and depth
        renderer.setRenderTarget(this.beauty_render_target);
        renderer.clear();
        renderer.render(this.scene, this.camera);

        this.ssao_material.uniforms['t_diffuse'].value = this.beauty_render_target.texture;
        this.ssao_material.blending = THREE.NoBlending;
        this.render_on_quad(renderer, this.ssao_material, this.ssao_render_target);

        this.copy_material.uniforms['tDiffuse'].value = this.ssao_render_target.texture;
        this.copy_material.blending = THREE.NoBlending;
        this.render_on_quad(renderer, this.copy_material, this.renderToScreen ? null : write_buffer);
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

    }

});

export {
    SSAOPass
};
