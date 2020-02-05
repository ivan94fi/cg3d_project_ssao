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
        "min_distance": { value: null },
        "max_distance": { value: null },
        "camera_projection_matrix": { value: new Matrix4() },
        "cameraProjectionMatrix": { value: new Matrix4() },
        "cameraInverseProjectionMatrix": { value: new Matrix4() },
    },

    vertexShader: `
        uniform float camera_near;
        uniform float camera_far;

        varying vec2 vUv;
        varying vec3 view_ray;

        void main() {
            vUv = uv;
            vec2 ndc = uv * 2.0 - 1.0;
            view_ray = vec3((camera_far / camera_near) * ndc, camera_far);
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
        uniform float min_distance;
        uniform float max_distance;
        uniform mat4 camera_projection_matrix;

        uniform mat4 cameraProjectionMatrix;
        uniform mat4 cameraInverseProjectionMatrix;

        varying vec2 vUv;
        varying vec3 view_ray;

        // DEBUG:
        vec3 red = vec3(1.0, 0.0, 0.0);
        vec3 green = vec3(0.0, 1.0, 0.0);
        vec3 blue = vec3(0.0, 0.0, 1.0);

        #include <packing>

        vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {
            float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];
            vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );
            clipPosition *= clipW; // unprojection.
            return ( cameraInverseProjectionMatrix * clipPosition ).xyz;
        }

        float getLinearDepth( const in vec2 screenPosition ) {
            // From projected coordinates in [0,1] to view coordinates to ortographic coordinates in [n,f]

            // fragCoordZ is (0.5 * z_ndc + 0.5). Let's call them biased ndc coordinates.
            float fragCoordZ = texture2D( t_depth, screenPosition ).x;

            // perspectiveDepthToViewZ transforms from biased ndc (in [0,1]) to view coordinates.
            // It is the unprojection => from nonlinear projected coords to linear unprojected coords.
            float viewZ = perspectiveDepthToViewZ( fragCoordZ, camera_near, camera_far );

            // From viewZ, which is already linear but in [n,f], to [0,1].
            // This is just a linear transform to scale the values in [0,1].
            return viewZToOrthographicDepth( viewZ, camera_near, camera_far );
        }

        void main() {
            vec4 texel = texture2D(t_diffuse, vUv);
            float depth = texture2D(t_depth, vUv).x;
            vec2 noise_scale = vec2( resolution.x / 4.0, resolution.y / 4.0 );
            vec3 noise = texture2D(t_noise, vUv * noise_scale).xyz;
            vec3 normal = texture2D(t_normal, vUv).xyz * 2.0 - 1.0;
            normal = normalize(normal);

            float view_z = (camera_near * camera_far) / ((camera_far - camera_near) * depth - camera_far);

            // FIXME: still does not work
            // vec3 origin = view_ray * (view_z / camera_far);
            // origin.xy *= (view_z);
            vec3 origin = vec3(0.0);

            vec3 three_origin = getViewPosition(vUv, depth, view_z);
            origin = three_origin;

            vec3 tangent = normalize(noise - normal * dot(noise, normal));
            vec3 bitangent = cross(normal, tangent);
            mat3 tbn = mat3(tangent, bitangent, normal);

            float occlusion = 0.0;
            for (int i = 0; i < KERNEL_SIZE; ++i) {
                // get sample position:
                vec3 sample_point = tbn * sample_kernel[i];
                sample_point = (sample_point * kernel_radius) + origin;

                // project sample position:
                vec4 sample_point_ndc = camera_projection_matrix * vec4(sample_point, 1.0);
                sample_point_ndc.xy /= sample_point_ndc.w;
                vec2 sample_point_uv = sample_point_ndc.xy * 0.5 + 0.5;

                float real_depth = texture2D(t_depth, sample_point_uv).r;
                float linear_real_depth = (camera_near * camera_far) / ((camera_far - camera_near) * real_depth - camera_far);
                float sample_depth = sample_point.z;

                // Reversed w.r.t to threejs because I have negative view space depths
                float delta = linear_real_depth - sample_depth;

                // float range_check = smoothstep(0.0, 1.0, kernel_radius / abs(linear_real_depth - origin.z));
                // float range_check = abs(linear_real_depth - origin.z) < kernel_radius ? 1.0 : 0.0;
                float range_check = 1.0;

                occlusion += ((delta >= min_distance && delta < max_distance) ? 1.0 : 0.0) * range_check;
                // occlusion += (delta >= 0.0 ? 1.0 : 0.0) * range_check;
            }

            occlusion = 1.0 - (occlusion / float(KERNEL_SIZE));
            gl_FragColor = vec4( vec3(occlusion), 1.0 );
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
