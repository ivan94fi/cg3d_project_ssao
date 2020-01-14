#version 300 es

precision mediump float;
precision mediump int;

uniform vec2 u_resolution;
out vec4 fragColor;

void main() {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    fragColor=vec4(st.x,st.y,0.0,1.0);
}
