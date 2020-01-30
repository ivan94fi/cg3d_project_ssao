import { Vector2, Matrix4 } from "../node_modules/three/build/three.module.js";

var SSAOShader = {

    defines: {
        "KERNEL_SIZE": 32
    },

    uniforms: {
        "opacity": { value: 1.0 },
        "t_diffuse": { value: null },
        "t_depth": { value: null },
        "t_noise": { value: null },
        "t_normal": { value: null },
        "sample_kernel": { value: null },
        "resolution": { value: new Vector2() },
        "camera_near": { value: null },
        "camera_far": { value: null },
        "kernel_radius": { value: null },
        "camera_projection_matrix": { value: new Matrix4() },
    },

    vertexShader: `
        uniform float camera_near;
        uniform float camera_far;

        varying vec2 vUv;
        varying vec3 view_ray;

        void main() {
            vUv = uv;
            view_ray = vec3((camera_far / camera_near) * uv, camera_far);
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
       }`,


    fragmentShader: `
        uniform float opacity;
        uniform sampler2D t_diffuse;
        uniform sampler2D t_depth;
        uniform sampler2D t_noise;
        uniform sampler2D t_normal;
        uniform vec2 resolution;
        uniform float camera_near;
        uniform float camera_far;
        uniform vec3 sample_kernel[KERNEL_SIZE];
        uniform float kernel_radius;
        uniform mat4 camera_projection_matrix;

        varying vec2 vUv;
        varying vec3 view_ray;

        void main() {
            vec4 texel = texture2D(t_diffuse, vUv);
            float depth = texture2D(t_depth, vUv).x;
            vec2 noise_scale = vec2( resolution.x / 4.0, resolution.y / 4.0 );
            vec3 noise = texture2D(t_noise, vUv * noise_scale).xyz * 2.0 - 1.0;
            vec3 normal = texture2D(t_normal, vUv).xyz * 2.0 - 1.0;
            normal =  normalize(normal);

            vec3 origin = view_ray * (depth / camera_far);

            vec3 tangent = normalize(noise - normal * dot(noise, normal));
            vec3 bitangent = cross(normal, tangent);
            mat3 tbn = mat3(tangent, bitangent, normal);

            float occlusion = 0.0;
            for (int i = 0; i < KERNEL_SIZE; ++i) {
                // get sample position:
                vec3 sample_point = tbn * sample_kernel[i];
                sample_point = sample_point * kernel_radius + origin;

                // project sample position:
                vec4 offset = camera_projection_matrix * vec4(sample_point, 1.0);
                offset.xy /= offset.w;
                offset.xy = offset.xy * 0.5 + 0.5;

                // get sample depth:
                float sample_depth = texture2D(t_depth, offset.xy).r;

                // range check & accumulate:
                float range_check = abs(origin.z - sample_depth) < kernel_radius ? 1.0 : 0.0;
                occlusion += (sample_depth <= sample_point.z ? 1.0 : 0.0) * range_check;
            }

            occlusion = 1.0 - (occlusion / float(KERNEL_SIZE));
            gl_FragColor = vec4( vec3( 1.0 - occlusion ), 1.0 );
        }`

};

var SSAOBlurShader = {

    uniforms: {
        "t_diffuse": { value: null },
        "resolution": { value: new Vector2() }
    },

    vertexShader: `
        varying vec2 vUv;
        varying vec3 view_ray;

        void main() {
           vUv = uv;
           gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
       }`,


    fragmentShader: `
        uniform sampler2D t_diffuse;
        uniform vec2 resolution;

        varying vec2 vUv;

        void main() {
            vec2 texel_size = (1.0 / resolution);
            float result = 0.0;
            for ( int i = - 2; i <= 2; i ++ ) {
                for ( int j = - 2; j <= 2; j ++ ) {
                    vec2 offset = ( vec2( float( i ), float( j ) ) ) * texel_size;
                    result += texture2D( t_diffuse, vUv + offset ).r;
                }
            }
            gl_FragColor = vec4( vec3( result / ( 5.0 * 5.0 ) ), 1.0 );
        }`

};

export { SSAOShader, SSAOBlurShader };
