import { Vector2 } from "../node_modules/three/build/three.module.js";

var SSAOShader = {

    uniforms: {
        "opacity": { value: 1.0 },
        "t_diffuse": { value: null },
        "t_depth": { value: null },
        "resolution": { value: new Vector2() },
        "texel_size": { value: new Vector2() },
        "camera_near": { value: null },
        "camera_far": { value: null },
    },

    vertexShader: `
        varying vec2 vUv;
        void main() {
           vUv = uv;
           gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
       }`,


    fragmentShader: `
        uniform float opacity;
        uniform sampler2D t_diffuse;
        uniform sampler2D t_depth;
        uniform vec2 resolution;
        uniform vec2 texel_size;
        uniform float camera_near;
        uniform float camera_far;

        varying vec2 vUv;

        float read_depth (in vec2 coord) {
            float camera_far_plus_near = camera_far + camera_near;
            float camera_far_minus_near = camera_far - camera_near;
            float camera_coef = 2.0 * camera_near;
            return camera_coef / ( camera_far_plus_near - texture2D( t_depth, coord ).x * camera_far_minus_near );
        }


        void main() {
            vec4 texel = texture2D(t_diffuse, vUv);
            float depth = read_depth(vUv);
            //gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 ); // to render depth.. Will not be used after
            gl_FragColor = opacity * texel;
        }`

};

export {
    SSAOShader
};
