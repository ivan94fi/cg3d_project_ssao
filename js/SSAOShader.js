import { Vector2 } from "../node_modules/three/build/three.module.js";

var SSAOShader = {

    defines: {
        "KERNEL_SIZE": 32
    },

    uniforms: {
        "opacity": { value: 1.0 },
        "t_diffuse": { value: null },
        "t_depth": { value: null },
        "t_noise": { value: null },
        "sample_kernel": { value: null },
        "resolution": { value: new Vector2() },
        "texel_size": { value: new Vector2() },
        "camera_near": { value: null },
        "camera_far": { value: null },
        "noise_scale": { value: new Vector2() }
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
        uniform sampler2D t_noise;
        uniform vec2 resolution;
        uniform vec2 texel_size;
        uniform float camera_near;
        uniform float camera_far;
        uniform vec3 sample_kernel[KERNEL_SIZE];
        uniform vec2 noise_scale;

        varying vec2 vUv;

        void main() {
            vec4 texel = texture2D(t_diffuse, vUv);
            float depth = texture2D(t_depth, vUv).x;
            vec4 noise = texture2D(t_noise, vUv * noise_scale);
            // gl_FragColor = vec4(sample_kernel[int(vUv.x * vUv.y * float(KERNEL_SIZE))], 1.0);
            gl_FragColor = vec4(vec3(depth), 1.0);

            // TODO:
            // - calcolare viewray
            // - usare depth texture (trovare formula per unprojection)
            // - passare normal map come texture
            // - calcolare origin

            // depth > 0 : sì
            // depth < 1 : modello sì, sfondo no
            // depth <= 1 : sì
            // depth == 1: modello no, sfondo sì
            // depth: valori tutti in (0,1], sfondo == 1
            // if (depth < 0.9) {
            //     gl_FragColor = vec4(0.2,0.6,0.2,1.0);
            // } else {
            //     gl_FragColor = vec4(0.6,0.2,0.2,1.0);
            // }
        }`

};

export {
    SSAOShader
};
